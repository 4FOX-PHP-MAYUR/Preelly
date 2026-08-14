const express = require('express')
const router = express.Router()
const Chat = require('../models/Chat')
const Message = require('../models/Message')
const Product = require('../models/Product')
const User = require('../models/User')
const Notification = require('../models/Notification')
const Report = require('../models/Report')
const authMiddleware = require('../middleware/auth')
const { chatUpload } = require('../middleware/upload')
const { sendPushToUser } = require('../services/firebaseAdmin')
const path = require('path')
const fs = require('fs')

// Block state lives in core/services/blockService (backed by the same
// { follower: blockedUser, following: blocker, status: 'blocked' } record
// written by routes/interactions.js POST /user/:id/block).
const {
  getBlockMap,
  getBlockState,
  isBlockedBetween,
  getBlockedUserIds,
} = require('../core/services/blockService')

async function getUnreadTotalForUser(userId) {
  const productChats = await Chat.find({
    type: { $ne: 'support' },
    $or: [{ buyer: userId }, { seller: userId }],
  }).select('buyer seller unreadForBuyer unreadForSeller')

  // Blocked counterparties must not contribute to the badge in either direction.
  const blockedIds = new Set((await getBlockedUserIds(userId)).map(String))

  let total = 0
  for (const chat of productChats) {
    if (!chat.buyer || !chat.seller) continue
    const isBuyer = chat.buyer.toString() === userId.toString()
    const otherId = isBuyer ? chat.seller.toString() : chat.buyer.toString()
    if (blockedIds.has(otherId)) continue
    total += isBuyer ? (chat.unreadForBuyer || 0) : (chat.unreadForSeller || 0)
  }
  const supportChat = await Chat.findOne({ type: 'support', user: userId }).select('unreadForUser')
  if (supportChat) total += supportChat.unreadForUser || 0

  const groupChats = await Chat.find({ type: 'group', participants: userId }).select('unreadFor')
  for (const chat of groupChats) {
    total += Number(chat.unreadFor?.[userId.toString()] || 0)
  }
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
      .populate('product', 'title images video isSold status')
      .populate('buyer', 'name username avatar isVerified identityVerificationStatus')
      .populate('seller', 'name username avatar isVerified identityVerificationStatus')
      .lean()

    const supportChat = await Chat.findOne({ type: 'support', user: userId })
      .populate('user', 'name username avatar isVerified identityVerificationStatus')
      .lean()

    const groupChats = await Chat.find({ type: 'group', participants: userId })
      .populate('product', 'title images video isSold status')
      .populate('participants', 'name username avatar isVerified identityVerificationStatus')
      .lean()

    const chats = [...productChats, ...groupChats]
    if (supportChat) chats.push(supportChat)
    chats.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))

    // 1:1 threads carry the block state so the inbox can lock them right away.
    const counterpartyOf = (chat) => {
      if (chat.type === 'support' || chat.type === 'group') return null
      const buyerId = chat.buyer?._id || chat.buyer
      const sellerId = chat.seller?._id || chat.seller
      if (!buyerId || !sellerId) return null
      return String(buyerId) === String(userId) ? String(sellerId) : String(buyerId)
    }
    const blockMap = await getBlockMap(userId, chats.map(counterpartyOf))
    const withBlockState = chats.map((chat) => {
      const otherId = counterpartyOf(chat)
      const state = (otherId && blockMap[otherId]) || { blockedByMe: false, blockedMe: false }
      return { ...chat, ...state }
    })

    res.json(withBlockState)
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
      .populate('product', 'title images video price currency isSold status')
      .populate('buyer', 'name username avatar isVerified identityVerificationStatus')
      .populate('seller', 'name username avatar isVerified identityVerificationStatus')
      .populate('user', 'name username avatar isVerified identityVerificationStatus')
      .populate('participants', 'name username avatar isVerified identityVerificationStatus')

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' })
    }

    const isAdmin = req.user.role === 'admin'
    if (chat.type === 'support') {
      if (!isAdmin && (!chat.user || chat.user._id.toString() !== userId.toString())) {
        return res.status(403).json({ message: 'Not authorized to view this chat' })
      }
    } else if (chat.type === 'group') {
      const isMember = (chat.participants || []).some(
        (p) => (p?._id?.toString?.() || p?.toString?.()) === userId.toString(),
      )
      if (!isMember && !isAdmin) {
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

    const muted = (chat.mutedBy || []).some((id) => id.toString() === userId.toString())

    // Block state (1:1 product threads only) — locks the composer on the client.
    let blockState = { blockedByMe: false, blockedMe: false }
    if (chat.type !== 'support' && chat.type !== 'group') {
      const buyerId = chat.buyer?._id?.toString?.() || chat.buyer?.toString?.()
      const sellerId = chat.seller?._id?.toString?.() || chat.seller?.toString?.()
      const otherId = buyerId === userId.toString() ? sellerId : buyerId
      if (otherId && otherId !== userId.toString()) {
        blockState = await getBlockState(userId, otherId)
      }
    }

    res.json({
      chat: { ...chat.toObject(), muted, ...blockState },
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

// @route   POST /api/chats/group
// @desc    Create a group chat with the given members and an optional first message
// @access  Private
router.post('/group', authMiddleware, async (req, res) => {
  try {
    const creatorId = req.user._id
    const io = req.app.get('io')
    const { memberIds, name, productId, text } = req.body

    const rawMembers = Array.isArray(memberIds) ? memberIds : []
    // Dedupe members, drop the creator (added separately), keep valid ids only.
    const memberSet = new Set(
      rawMembers
        .map((m) => String(m || '').trim())
        .filter((m) => m && m !== creatorId.toString()),
    )

    if (memberSet.size < 2) {
      return res.status(400).json({ message: 'A group needs at least 2 other members' })
    }

    const members = await User.find({ _id: { $in: Array.from(memberSet) } }).select('name')
    if (members.length !== memberSet.size) {
      return res.status(400).json({ message: 'One or more members were not found' })
    }

    // A block in either direction prevents the creator from adding that member.
    const memberBlockMap = await getBlockMap(creatorId, Array.from(memberSet))
    const blockedMember = Array.from(memberSet).find(
      (id) => memberBlockMap[id]?.blockedByMe || memberBlockMap[id]?.blockedMe,
    )
    if (blockedMember) {
      return res.status(403).json({
        blocked: true,
        message: "You can't add an account you've blocked, or that has blocked you, to a group.",
      })
    }

    const participants = [creatorId, ...members.map((m) => m._id)]

    // Default group name: creator + first couple of member names, else "Group".
    const creator = await User.findById(creatorId).select('name')
    const memberNames = members.map((m) => m.name).filter(Boolean)
    const defaultName = [creator?.name, ...memberNames]
      .filter(Boolean)
      .slice(0, 3)
      .join(', ') || 'Group'

    const chat = await Chat.create({
      type: 'group',
      name: String(name || '').trim() || defaultName,
      participants,
      createdBy: creatorId,
      product: productId || null,
      unreadFor: {},
    })

    const messages = []
    const body = String(text || '').trim()
    if (body) {
      const message = await Message.create({
        chat: chat._id,
        sender: creatorId,
        type: 'text',
        text: body,
      })
      chat.lastMessage = body
      chat.lastMessageAt = new Date()
      const unreadFor = {}
      for (const p of participants) {
        if (p.toString() === creatorId.toString()) continue
        unreadFor[p.toString()] = 1
      }
      chat.unreadFor = unreadFor
      chat.markModified('unreadFor')
      await chat.save()
      await message.populate('sender', 'name username avatar')
      messages.push(message)
    }

    await chat.populate('participants', 'name username avatar isVerified identityVerificationStatus')
    if (productId) {
      await chat.populate('product', 'title images video price currency isSold status')
    }

    // Notify every member (real-time thread + notification bell).
    const messageData = messages[0]
      ? {
          _id: messages[0]._id,
          chat: chat._id,
          sender: {
            _id: messages[0].sender._id,
            name: messages[0].sender.name,
            username: messages[0].sender.username,
            avatar: messages[0].sender.avatar,
          },
          type: messages[0].type,
          text: messages[0].text,
          attachments: messages[0].attachments || [],
          createdAt: messages[0].createdAt,
          updatedAt: messages[0].updatedAt,
          read: false,
          readAt: null,
        }
      : null

    if (io) {
      for (const p of participants) {
        const pid = p.toString()
        const isOwnMessage = pid === creatorId.toString()
        let unreadTotal = 0
        try { unreadTotal = await getUnreadTotalForUser(pid) } catch (e) {}
        io.to(`user-${pid}`).emit('group-created', { chatId: chat._id, unreadTotal })
        if (messageData) {
          io.to(`user-${pid}`).emit('new-message', { chatId: chat._id, message: messageData, isOwnMessage, unreadTotal })
        }
      }
    }

    if (messageData) {
      const preview = String(messageData.text || '').slice(0, 160)
      for (const p of participants) {
        const pid = p.toString()
        if (pid === creatorId.toString()) continue
        try {
          const title = `New message in ${chat.name}`
          const notif = await Notification.create({
            user: pid,
            type: 'message',
            title,
            body: preview,
            actor: creatorId,
            data: { chatId: String(chat._id), senderId: String(creatorId) },
          })
          sendPushToUser(pid, {
            notification: { title, body: preview },
            data: { type: 'message', notificationId: notif._id, chatId: chat._id, actorId: creatorId },
          })
        } catch (e) {
          console.error('Error creating group notification:', e)
        }
      }
    }

    res.status(201).json({ chat, messages })
  } catch (error) {
    console.error('Error creating group chat:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid member id' })
    }
    res.status(500).json({ message: 'Error creating group chat' })
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
        .populate('user', 'name username avatar isVerified identityVerificationStatus')
      const created = !chat
      if (!chat) {
        chat = await Chat.create({ type: 'support', user: userId })
        await chat.populate('user', 'name username avatar isVerified identityVerificationStatus')
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

    // Classic listing chat: `sellerId` must be the product owner.
    // Reel/message share: `sellerId` is the *recipient* user id (legacy field name); they are often not the seller.
    // Classic chat: `sellerId` is the listing owner. Reel/share: `sellerId` is the chosen recipient
    // (follower/following); they may differ from `product.seller` — still allowed.

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
      .populate('product', 'title images video price currency isSold status')
      .populate('buyer', 'name username avatar isVerified identityVerificationStatus')
      .populate('seller', 'name username avatar isVerified identityVerificationStatus')

    if (chat) {
      // Get messages for existing chat
      const messages = await Message.find({ chat: chat._id })
        .populate('sender', 'name username avatar')
        .sort({ createdAt: 1 })

      const blockState = await getBlockState(buyerId, sellerId)
      return res.json({
        chat: { ...chat.toObject(), ...blockState },
        messages,
      })
    }

    // No existing thread: a block in either direction prevents starting a new
    // conversation. (An already-existing thread is still returned above, with
    // its block state, so history stays visible but the composer stays locked.)
    if (await isBlockedBetween(buyerId, sellerId)) {
      const { blockedByMe } = await getBlockState(buyerId, sellerId)
      return res.status(403).json({
        blocked: true,
        message: blockedByMe
          ? "You've blocked this account. Unblock them to start a conversation."
          : "You can't start a conversation with this account.",
      })
    }

    // Create new chat
    chat = await Chat.create({
      product: productId,
      buyer: buyerId,
      seller: sellerId,
    })

    await chat.populate('product', 'title images video price currency isSold status')
    await chat.populate('buyer', 'name username avatar isVerified identityVerificationStatus')
    await chat.populate('seller', 'name username avatar isVerified identityVerificationStatus')

    const blockState = await getBlockState(buyerId, sellerId)
    res.status(201).json({
      chat: { ...chat.toObject(), ...blockState },
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
        .populate('product', 'title images video price currency isSold status')
        .populate('buyer', 'name username avatar isVerified identityVerificationStatus')
        .populate('seller', 'name username avatar isVerified identityVerificationStatus')
        .populate('user', 'name username avatar isVerified identityVerificationStatus')

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
// @desc    Send a message in a chat (text and/or file attachment)
// @access  Private
router.post('/:id/messages', authMiddleware, (req, res, next) => {
  chatUpload.array('files', 10)(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'File upload error' })
    next()
  })
}, async (req, res) => {
  try {
    const chatId = req.params.id
    const text = String(req.body?.text || '').trim()
    const files = req.files || []
    const userId = req.user._id
    const isAdmin = req.user.role === 'admin'
    const io = req.app.get('io')

    if (!text && files.length === 0) {
      return res.status(400).json({ message: 'Message text or file is required' })
    }

    const chat = await Chat.findById(chatId)

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' })
    }

    let otherPartyId = null
    let groupRecipients = null
    if (chat.type === 'support') {
      if (!chat.user) return res.status(400).json({ message: 'Invalid support chat' })
      const isCustomer = chat.user.toString() === userId.toString()
      if (!isCustomer && !isAdmin) return res.status(403).json({ message: 'Not authorized to send in this chat' })
      otherPartyId = isCustomer ? null : chat.user.toString()
    } else if (chat.type === 'group') {
      const memberIds = (chat.participants || []).map((p) => p.toString())
      if (!memberIds.includes(userId.toString()) && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized to send messages in this chat' })
      }
      groupRecipients = memberIds.filter((pid) => pid !== userId.toString())
    } else {
      if (
        (!chat.buyer || chat.buyer.toString() !== userId.toString()) &&
        (!chat.seller || chat.seller.toString() !== userId.toString())
      ) {
        return res.status(403).json({ message: 'Not authorized to send messages in this chat' })
      }
      otherPartyId = chat.buyer.toString() === userId.toString() ? chat.seller.toString() : chat.buyer.toString()

      // A blocked thread is locked in both directions.
      if (!isAdmin && otherPartyId) {
        const { blockedByMe, blockedMe } = await getBlockState(userId, otherPartyId)
        if (blockedByMe || blockedMe) {
          // Drop anything multer already wrote to disk for this rejected send.
          for (const f of files) {
            fs.unlink(f.path, () => {})
          }
          return res.status(403).json({
            blocked: true,
            blockedByMe,
            blockedMe,
            message: blockedByMe
              ? "You've blocked this account. Unblock them to send messages."
              : "You can't send messages in this chat.",
          })
        }
      }
    }

    const attachments = files.map((f) => ({
      url: `/uploads/chats/${f.filename}`,
      mimeType: f.mimetype,
      name: f.originalname,
      size: f.size,
    }))

    const msgData = {
      chat: chatId,
      sender: userId,
      type: files.length > 0 ? 'file' : 'text',
      text: text || '',
      attachments,
      // keep legacy single-attachment field populated for old clients
      ...(attachments.length === 1 ? { attachment: attachments[0] } : {}),
    }

    const message = await Message.create(msgData)

    const displayText = files.length > 0 ? (text || files[0].originalname) : text
    chat.lastMessage = displayText
    chat.lastMessageAt = new Date()

    if (chat.type === 'support') {
      if (isAdmin) {
        chat.unreadForUser = (chat.unreadForUser || 0) + 1
      } else {
        chat.unreadForAdmin = (chat.unreadForAdmin || 0) + 1
      }
    } else if (chat.type === 'group') {
      const unreadFor = { ...(chat.unreadFor || {}) }
      for (const pid of groupRecipients) {
        unreadFor[pid] = Number(unreadFor[pid] || 0) + 1
      }
      chat.unreadFor = unreadFor
      chat.markModified('unreadFor')
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
      type: message.type,
      text: message.text,
      attachment: message.attachment || null,
      attachments: message.attachments || [],
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
    } else if (chat.type === 'group') {
      for (const pid of groupRecipients) {
        let unreadTotal = 0
        try { unreadTotal = await getUnreadTotalForUser(pid) } catch (e) {}
        io.to(`user-${pid}`).emit('new-message', { chatId, message: messageData, isOwnMessage: false, unreadTotal })
      }
    } else {
      let unreadTotal = 0
      try { unreadTotal = await getUnreadTotalForUser(otherPartyId) } catch (e) {}
      io.to(`user-${otherPartyId}`).emit('new-message', { chatId, message: messageData, isOwnMessage: false, unreadTotal })
    }

    // Create an in-app notification for the receiver(s) so it appears in Notifications page too.
    // Recipients who muted this chat still get the message in real time but no notification.
    const mutedIds = new Set((chat.mutedBy || []).map((id) => id.toString()))
    const notifyRecipients = (chat.type === 'group' ? groupRecipients : (otherPartyId ? [otherPartyId] : []))
      .filter((rid) => !mutedIds.has(String(rid)))
    if (notifyRecipients.length > 0) {
      const preview = String(message.text || '').slice(0, 160)
      const title = chat.type === 'group' ? `New message in ${chat.name || 'group'}` : 'New message'
      for (const rid of notifyRecipients) {
        try {
          const notif = await Notification.create({
            user: rid,
            type: 'message',
            title,
            body: preview,
            actor: userId,
            relatedProduct: chat.product || null,
            data: {
              chatId: String(chatId),
              productId: chat.product ? String(chat.product) : null,
              senderId: String(userId),
            },
          })
          sendPushToUser(rid, {
            notification: { title, body: preview },
            data: {
              type: 'message',
              notificationId: notif._id,
              chatId,
              productId: chat.product || undefined,
              actorId: userId,
            },
          })
        } catch (notificationError) {
          console.error('Error creating message notification:', notificationError)
        }
      }
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

// @route   POST /api/chats/:id/call-event
// @desc    Save a call event (completed/missed/rejected/cancelled) as a chat message
// @access  Private
router.post('/:id/call-event', authMiddleware, async (req, res) => {
  try {
    const chatId  = req.params.id
    const userId  = req.user._id
    const { callType, status, duration } = req.body
    const io = req.app.get('io')

    if (!callType || !status) {
      return res.status(400).json({ message: 'callType and status are required' })
    }

    const chat = await Chat.findById(chatId)
    if (!chat) return res.status(404).json({ message: 'Chat not found' })

    const buyerId  = chat.buyer?.toString()
    const sellerId = chat.seller?.toString()
    const uid      = userId.toString()
    if (uid !== buyerId && uid !== sellerId) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    // Calls are a form of contact — a block in either direction closes them.
    const callOtherId = uid === buyerId ? sellerId : buyerId
    if (callOtherId && (await isBlockedBetween(userId, callOtherId))) {
      return res.status(403).json({ blocked: true, message: "You can't call this account." })
    }

    const message = await Message.create({
      chat: chatId,
      sender: userId,
      type: 'call',
      callMeta: { callType, status, duration: Number(duration) || 0 },
    })

    // Update chat preview
    const callLabel = status === 'completed'
      ? `${callType === 'video' ? '📹' : '📞'} ${callType} call`
      : `📵 Missed ${callType} call`
    chat.lastMessage    = callLabel
    chat.lastMessageAt  = new Date()
    await chat.save()

    const msgData = {
      _id: message._id,
      chat: chatId,
      sender: { _id: userId },
      text: '',
      type: 'call',
      callMeta: message.callMeta,
      createdAt: message.createdAt,
      read: false,
      readAt: null,
    }

    // Emit to both participants so both see it in real-time
    const otherPartyId = uid === buyerId ? sellerId : buyerId
    io.to(`user-${uid}`).emit('new-message',          { chatId, message: msgData, isOwnMessage: true  })
    io.to(`user-${otherPartyId}`).emit('new-message', { chatId, message: msgData, isOwnMessage: false })

    res.status(201).json(message)
  } catch (error) {
    console.error('Error saving call event:', error)
    res.status(500).json({ message: 'Error saving call event' })
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
      chat.type === 'group'
        ? (chat.participants || []).some((p) => p.toString() === userId.toString())
        : (chat.buyer?.toString() === userId.toString() || chat.seller?.toString() === userId.toString())
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
      // mark related message notifications as read
      await Notification.updateMany(
        { user: userId, type: 'message', 'data.chatId': String(chatId), isRead: false },
        { isRead: true }
      )
      const io = req.app.get('io')
      if (io && otherSenderId) io.to(`user-${otherSenderId}`).emit('messages-read', { chatId })
      return res.json({ message: 'Messages marked as read' })
    }

    if (chat.type === 'group') {
      const isMember = (chat.participants || []).some((p) => p.toString() === userId.toString())
      if (!isMember && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized to mark this chat as read' })
      }
      const unreadFor = { ...(chat.unreadFor || {}) }
      unreadFor[userId.toString()] = 0
      chat.unreadFor = unreadFor
      chat.markModified('unreadFor')
      await chat.save()
      await Notification.updateMany(
        { user: userId, type: 'message', 'data.chatId': String(chatId), isRead: false },
        { isRead: true },
      )
      const io = req.app.get('io')
      if (io) {
        const readerUnread = await getUnreadTotalForUser(userId).catch(() => 0)
        io.to(`user-${userId}`).emit('unread-updated', { unreadTotal: readerUnread })
      }
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

    // mark related message notifications as read so the bell badge clears
    await Notification.updateMany(
      { user: userId, type: 'message', 'data.chatId': String(chatId), isRead: false },
      { isRead: true }
    )

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

// Membership check: is `userId` a party to this chat (buyer/seller/support user/group member)?
function isChatParticipant(chat, userId) {
  const uid = String(userId)
  const ids = [chat.buyer, chat.seller, chat.user, ...(chat.participants || [])]
    .filter(Boolean)
    .map((x) => (x && x._id ? String(x._id) : String(x)))
  return ids.includes(uid)
}

// Resolve the "other party" in a 1:1 (product) chat relative to `userId`.
function otherPartyOf(chat, userId) {
  const uid = String(userId)
  const buyerId = chat.buyer ? String(chat.buyer._id || chat.buyer) : null
  const sellerId = chat.seller ? String(chat.seller._id || chat.seller) : null
  if (buyerId && buyerId === uid) return sellerId
  if (sellerId && sellerId === uid) return buyerId
  return null
}

// @route   PUT /api/chats/:id/mute
// @desc    Toggle notification mute for the current user on this chat
// @access  Private
router.put('/:id/mute', authMiddleware, async (req, res) => {
  try {
    const chatId = req.params.id
    const userId = req.user._id
    const chat = await Chat.findById(chatId)
    if (!chat) return res.status(404).json({ message: 'Chat not found' })
    if (!isChatParticipant(chat, userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' })
    }

    const uid = String(userId)
    const already = (chat.mutedBy || []).some((id) => id.toString() === uid)
    if (already) {
      chat.mutedBy = chat.mutedBy.filter((id) => id.toString() !== uid)
    } else {
      chat.mutedBy = [...(chat.mutedBy || []), userId]
    }
    await chat.save()

    res.json({ muted: !already, message: already ? 'Notifications unmuted' : 'Notifications muted' })
  } catch (error) {
    console.error('Error toggling chat mute:', error)
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid chat ID' })
    res.status(500).json({ message: 'Error updating mute setting' })
  }
})

// @route   POST /api/chats/:id/report
// @desc    Report the other party in a chat (stored for admin review)
// @access  Private
router.post('/:id/report', authMiddleware, async (req, res) => {
  try {
    const chatId = req.params.id
    const userId = req.user._id
    const { reason, details, reportedUserId } = req.body || {}

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'A reason is required' })
    }

    const chat = await Chat.findById(chatId)
    if (!chat) return res.status(404).json({ message: 'Chat not found' })
    if (!isChatParticipant(chat, userId)) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    const targetId = reportedUserId || otherPartyOf(chat, userId)
    if (!targetId) {
      return res.status(400).json({ message: 'Could not determine who to report' })
    }
    if (String(targetId) === String(userId)) {
      return res.status(400).json({ message: 'You cannot report yourself' })
    }

    const report = await Report.create({
      reporter: userId,
      reportedUser: targetId,
      chat: chatId,
      reason: String(reason).trim(),
      details: String(details || '').trim(),
    })

    res.status(201).json({ message: 'Report submitted', reportId: report._id })
  } catch (error) {
    console.error('Error submitting report:', error)
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid chat ID' })
    res.status(500).json({ message: 'Error submitting report' })
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
    } else if (chat.type === 'group') {
      allowed = isAdmin || (chat.participants || []).some((p) => p.toString() === userId.toString())
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
