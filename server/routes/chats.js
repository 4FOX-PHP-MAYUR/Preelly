const express = require('express')
const router = express.Router()
const Chat = require('../models/Chat')
const Message = require('../models/Message')
const Product = require('../models/Product')
const User = require('../models/User')
const authMiddleware = require('../middleware/auth')

async function getUnreadTotalForUser(userId) {
  const productChats = await Chat.find({
    type: { $ne: 'support' },
    $or: [{ buyer: userId }, { seller: userId }],
  }).select('buyer seller unreadForBuyer unreadForSeller')
  let total = 0
  for (const chat of productChats) {
    if (!chat.buyer || !chat.seller) continue
    const isBuyer = chat.buyer.toString() === userId.toString()
    total += isBuyer ? (chat.unreadForBuyer || 0) : (chat.unreadForSeller || 0)
  }
  const supportChat = await Chat.findOne({ type: 'support', user: userId }).select('unreadForUser')
  if (supportChat) total += supportChat.unreadForUser || 0
  return total
}

// @route   GET /api/chats
// @desc    Get all chats for the current user (product + support)
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id

    // Buyer–seller (product) chats only; support chats fetched separately below
    const productChats = await Chat.find({
      type: { $ne: 'support' },
      $or: [{ buyer: userId }, { seller: userId }],
    })
      .populate('product', 'title images video')
      .populate('buyer', 'name username avatar isVerified')
      .populate('seller', 'name username avatar isVerified')
      .lean()

    const supportChat = await Chat.findOne({ type: 'support', user: userId })
      .populate('user', 'name username avatar isVerified')
      .lean()

    const chats = [...productChats]
    if (supportChat) chats.push(supportChat)
    chats.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))

    res.json(chats)
  } catch (error) {
    console.error('Error fetching chats:', error)
    res.status(500).json({ message: 'Error fetching chats' })
  }
})

// @route   GET /api/chats/unread-count
// @desc    Total unread message count for current user (nav badge)
// @access  Private
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const total = await getUnreadTotalForUser(req.user._id)
    res.json({ unread: total })
  } catch (error) {
    console.error('Error fetching unread count:', error)
    res.status(500).json({ message: 'Error fetching unread count', unread: 0 })
  }
})

// @route   GET /api/chats/:id
// @desc    Get a specific chat with messages
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const chatId = req.params.id
    const userId = req.user._id

    const chat = await Chat.findById(chatId)
      .populate('product', 'title images video price currency')
      .populate('buyer', 'name username avatar isVerified')
      .populate('seller', 'name username avatar isVerified')
      .populate('user', 'name username avatar isVerified')

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' })
    }

    const isAdmin = req.user.role === 'admin'
    if (chat.type === 'support') {
      if (!isAdmin && (!chat.user || chat.user._id.toString() !== userId.toString())) {
        return res.status(403).json({ message: 'Not authorized to view this chat' })
      }
    } else {
      if (!isAdmin) {
        const buyerId = chat.buyer?._id?.toString?.() || chat.buyer?.toString?.()
        const sellerId = chat.seller?._id?.toString?.() || chat.seller?.toString?.()
        if (buyerId !== userId.toString() && sellerId !== userId.toString()) {
          return res.status(403).json({ message: 'Not authorized to view this chat' })
        }
      }
    }

    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'name username avatar')
      .sort({ createdAt: 1 })

    res.json({
      chat,
      messages,
    })
  } catch (error) {
    console.error('Error fetching chat:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid chat ID' })
    }
    res.status(500).json({ message: 'Error fetching chat' })
  }
})

// @route   POST /api/chats
// @desc    Create or get existing chat (product or support)
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.body.type === 'support') {
      const userId = req.user._id
      let chat = await Chat.findOne({ type: 'support', user: userId })
        .populate('user', 'name username avatar isVerified')
      const created = !chat
      if (!chat) {
        chat = await Chat.create({ type: 'support', user: userId })
        await chat.populate('user', 'name username avatar isVerified')
      }
      const messages = await Message.find({ chat: chat._id })
        .populate('sender', 'name username avatar')
        .sort({ createdAt: 1 })
      return res.status(created ? 201 : 200).json({ chat, messages })
    }

    const { productId, sellerId } = req.body
    const buyerId = req.user._id

    if (!productId || !sellerId) {
      return res.status(400).json({ message: 'Product ID and Seller ID are required' })
    }

    // Verify product exists
    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // Verify seller exists and matches product seller
    const seller = await User.findById(sellerId)
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' })
    }

    if (product.seller.toString() !== sellerId) {
      return res.status(400).json({ message: 'Seller does not match product seller' })
    }

    // Prevent users from chatting with themselves
    if (buyerId.toString() === sellerId.toString()) {
      return res.status(400).json({ message: 'Cannot create chat with yourself' })
    }

    // Try to find existing chat
    let chat = await Chat.findOne({
      product: productId,
      buyer: buyerId,
      seller: sellerId,
    })
      .populate('product', 'title images video price currency')
      .populate('buyer', 'name username avatar isVerified')
      .populate('seller', 'name username avatar isVerified')

    if (chat) {
      // Get messages for existing chat
      const messages = await Message.find({ chat: chat._id })
        .populate('sender', 'name username avatar')
        .sort({ createdAt: 1 })

      return res.json({
        chat,
        messages,
      })
    }

    // Create new chat
    chat = await Chat.create({
      product: productId,
      buyer: buyerId,
      seller: sellerId,
    })

    await chat.populate('product', 'title images video price currency')
    await chat.populate('buyer', 'name username avatar isVerified')
    await chat.populate('seller', 'name username avatar isVerified')

    res.status(201).json({
      chat,
      messages: [],
    })
  } catch (error) {
    console.error('Error creating chat:', error)
    if (error.code === 11000) {
      // Duplicate key error (unique index violation), likely due to race.
      // Fetch and return the existing chat for the same payload.
      const buyerId = req.user._id
      const isSupport = req.body.type === 'support'

      const chatQuery = isSupport
        ? { type: 'support', user: buyerId }
        : {
            product: req.body.productId,
            buyer: buyerId,
            seller: req.body.sellerId,
          }

      const chat = await Chat.findOne(chatQuery)
        .populate('product', 'title images video price currency')
        .populate('buyer', 'name username avatar isVerified')
        .populate('seller', 'name username avatar isVerified')
        .populate('user', 'name username avatar isVerified')

      if (chat) {
        const messages = await Message.find({ chat: chat._id })
          .populate('sender', 'name username avatar')
          .sort({ createdAt: 1 })

        return res.json({ chat, messages })
      }
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product or seller ID' })
    }
    res.status(500).json({ message: 'Error creating chat' })
  }
})

// @route   POST /api/chats/:id/messages
// @desc    Send a message in a chat
// @access  Private
router.post('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const chatId = req.params.id
    const { text } = req.body
    const userId = req.user._id
    const isAdmin = req.user.role === 'admin'
    const io = req.app.get('io')

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' })
    }

    const chat = await Chat.findById(chatId)

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' })
    }

    let otherPartyId = null
    if (chat.type === 'support') {
      if (!chat.user) return res.status(400).json({ message: 'Invalid support chat' })
      const isCustomer = chat.user.toString() === userId.toString()
      if (!isCustomer && !isAdmin) return res.status(403).json({ message: 'Not authorized to send in this chat' })
      otherPartyId = isCustomer ? null : chat.user.toString() // admin sent -> notify user (customer)
    } else {
      if (
        (!chat.buyer || chat.buyer.toString() !== userId.toString()) &&
        (!chat.seller || chat.seller.toString() !== userId.toString())
      ) {
        return res.status(403).json({ message: 'Not authorized to send messages in this chat' })
      }
      otherPartyId = chat.buyer.toString() === userId.toString() ? chat.seller.toString() : chat.buyer.toString()
    }

    const message = await Message.create({
      chat: chatId,
      sender: userId,
      text: text.trim(),
    })

    chat.lastMessage = text.trim()
    chat.lastMessageAt = new Date()

    if (chat.type === 'support') {
      if (isAdmin) {
        chat.unreadForUser = (chat.unreadForUser || 0) + 1
      } else {
        chat.unreadForAdmin = (chat.unreadForAdmin || 0) + 1
      }
    } else {
      const isBuyer = chat.buyer.toString() === userId.toString()
      if (isBuyer) chat.unreadForSeller += 1
      else chat.unreadForBuyer += 1
    }

    await chat.save()

    await message.populate('sender', 'name username avatar')

    const messageData = {
      _id: message._id,
      chat: chatId,
      sender: {
        _id: message.sender._id,
        name: message.sender.name,
        username: message.sender.username,
        avatar: message.sender.avatar,
      },
      text: message.text,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      read: message.read || false,
      readAt: message.readAt || null,
    }

    io.to(`user-${userId}`).emit('new-message', { chatId, message: messageData, isOwnMessage: true })
    io.to(`chat-${chatId}`).emit('message', messageData)

    if (chat.type === 'support') {
      if (isAdmin && otherPartyId) {
        let unreadTotal = 0
        try { unreadTotal = await getUnreadTotalForUser(otherPartyId) } catch (e) {}
        io.to(`user-${otherPartyId}`).emit('new-message', { chatId, message: messageData, isOwnMessage: false, unreadTotal })
      } else {
        io.to('admin').emit('new-support-message', { chatId, message: messageData, chat })
      }
    } else {
      let unreadTotal = 0
      try { unreadTotal = await getUnreadTotalForUser(otherPartyId) } catch (e) {}
      io.to(`user-${otherPartyId}`).emit('new-message', { chatId, message: messageData, isOwnMessage: false, unreadTotal })
    }

    res.status(201).json(message)
  } catch (error) {
    console.error('Error sending message:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid chat ID' })
    }
    res.status(500).json({ message: 'Error sending message' })
  }
})

// @route   DELETE /api/chats/:chatId/messages/:messageId
// @desc    Delete a single message (sender only)
// @access  Private
router.delete('/:chatId/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    const { chatId, messageId } = req.params
    const userId = req.user._id

    const chat = await Chat.findById(chatId)
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' })
    }

    // Only participants can delete
    const isParticipant =
      chat.buyer.toString() === userId.toString() || chat.seller.toString() === userId.toString()
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to delete messages in this chat' })
    }

    const message = await Message.findById(messageId)
    if (!message || message.chat.toString() !== chatId.toString()) {
      return res.status(404).json({ message: 'Message not found in this chat' })
    }

    // Only the sender can delete their message
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages' })
    }

    await message.deleteOne()

    // Recalculate last message and unread counters
    const latestMessage = await Message.findOne({ chat: chatId }).sort({ createdAt: -1 })

    chat.lastMessage = latestMessage?.text || ''
    chat.lastMessageAt = latestMessage?.createdAt || chat.updatedAt || new Date()

    // unreadForBuyer = unread messages sent by seller
    chat.unreadForBuyer = await Message.countDocuments({
      chat: chatId,
      sender: chat.seller,
      read: false,
    })

    // unreadForSeller = unread messages sent by buyer
    chat.unreadForSeller = await Message.countDocuments({
      chat: chatId,
      sender: chat.buyer,
      read: false,
    })

    await chat.save()

    res.json({
      message: 'Message deleted',
      chat,
    })
  } catch (error) {
    console.error('Error deleting message:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid chat or message ID' })
    }
    res.status(500).json({ message: 'Error deleting message' })
  }
})

// @route   PUT /api/chats/:id/read
// @desc    Mark messages as read in a chat
// @access  Private
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const chatId = req.params.id
    const userId = req.user._id
    const isAdmin = req.user.role === 'admin'

    const chat = await Chat.findById(chatId)

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' })
    }

    if (chat.type === 'support') {
      if (!chat.user) return res.status(400).json({ message: 'Invalid support chat' })
      const isCustomer = chat.user.toString() === userId.toString()
      if (!isCustomer && !isAdmin) return res.status(403).json({ message: 'Not authorized' })
      const otherSenderId = isCustomer ? null : chat.user
      await Message.updateMany(
        { chat: chatId, sender: otherSenderId, read: false },
        { $set: { read: true, readAt: new Date() } }
      )
      if (isCustomer) chat.unreadForUser = 0
      else chat.unreadForAdmin = 0
      await chat.save()
      const io = req.app.get('io')
      if (io && otherSenderId) io.to(`user-${otherSenderId}`).emit('messages-read', { chatId })
      return res.json({ message: 'Messages marked as read' })
    }

    if (
      (!chat.buyer || chat.buyer.toString() !== userId.toString()) &&
      (!chat.seller || chat.seller.toString() !== userId.toString())
    ) {
      return res.status(403).json({ message: 'Not authorized to mark this chat as read' })
    }

    const otherPartyId = chat.buyer.toString() === userId.toString() ? chat.seller : chat.buyer

    await Message.updateMany(
      { chat: chatId, sender: otherPartyId, read: false },
      { $set: { read: true, readAt: new Date() } }
    )

    if (chat.buyer.toString() === userId.toString()) {
      chat.unreadForBuyer = 0
    } else {
      chat.unreadForSeller = 0
    }

    await chat.save()

    const io = req.app.get('io')
    if (io) {
      io.to(`user-${otherPartyId}`).emit('messages-read', { chatId })
      const readerUnread = await getUnreadTotalForUser(userId).catch(() => 0)
      io.to(`user-${userId}`).emit('unread-updated', { unreadTotal: readerUnread })
    }

    res.json({ message: 'Messages marked as read' })
  } catch (error) {
    console.error('Error marking messages as read:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid chat ID' })
    }
    res.status(500).json({ message: 'Error marking messages as read' })
  }
})

// @route   DELETE /api/chats/:id
// @desc    Delete a chat and its messages for participants
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const chatId = req.params.id
    const userId = req.user._id
    const isAdmin = req.user.role === 'admin'

    const chat = await Chat.findById(chatId)
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' })
    }

    let allowed = false
    if (chat.type === 'support') {
      allowed = isAdmin || (chat.user && chat.user.toString() === userId.toString())
    } else {
      allowed =
        (chat.buyer && chat.buyer.toString() === userId.toString()) ||
        (chat.seller && chat.seller.toString() === userId.toString())
    }
    if (!allowed) {
      return res.status(403).json({ message: 'Not authorized to delete this chat' })
    }

    // Remove messages first to avoid orphans
    await Message.deleteMany({ chat: chatId })
    await chat.deleteOne()

    res.json({ message: 'Chat deleted' })
  } catch (error) {
    console.error('Error deleting chat:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid chat ID' })
    }
    res.status(500).json({ message: 'Error deleting chat' })
  }
})

module.exports = router
