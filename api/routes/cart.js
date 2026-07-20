const express = require('express')
const router = express.Router()
const Cart = require('../models/Cart')
const Chat = require('../models/Chat')
const Product = require('../models/Product')
const authMiddleware = require('../middleware/auth')

// @route   POST /api/cart/from-offer
// @desc    Add a product to the buyer's cart when an offer is accepted.
//          Either party (buyer or seller) may accept, but userId is ALWAYS the buyer.
// @access  Private
router.post('/from-offer', authMiddleware, async (req, res) => {
  try {
    const requesterId = req.user._id
    const { chatId, amount } = req.body

    if (!chatId) {
      return res.status(400).json({ success: false, message: 'chatId is required' })
    }

    const chat = await Chat.findById(chatId).select('product buyer seller type')
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' })
    }
    if (!chat.product || !chat.buyer || !chat.seller) {
      return res.status(400).json({ success: false, message: 'Chat is not a valid product conversation' })
    }

    // Only participants of the chat may accept an offer.
    const isParticipant =
      chat.buyer.toString() === requesterId.toString() ||
      chat.seller.toString() === requesterId.toString()
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not allowed for this chat' })
    }

    // unitPrice = accepted offer amount; fall back to the product price.
    let unitPrice = Number(amount)
    if (!unitPrice || unitPrice <= 0) {
      const product = await Product.findById(chat.product).select('productPrice price')
      unitPrice = Number(product?.productPrice ?? product?.price ?? 0)
    }

    const quantity = 1
    const subtotal = quantity * unitPrice
    const totalAmount = subtotal // no discount/coupon/tax at offer-accept time

    // Upsert the ACTIVE cart row for this buyer + product so accepting twice
    // just refreshes the agreed price instead of creating duplicates.
    const cart = await Cart.findOneAndUpdate(
      { userId: chat.buyer, productId: chat.product, cartStatus: 'ACTIVE', deletedAt: null },
      {
        $set: {
          sellerId: chat.seller,
          quantity,
          unitPrice,
          subtotal,
          totalAmount,
          isSelected: true,
        },
        $setOnInsert: {
          userId: chat.buyer,
          productId: chat.product,
          cartStatus: 'ACTIVE',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    return res.status(200).json({ success: true, data: cart })
  } catch (err) {
    // Duplicate-key from a race on the unique index — treat as success.
    if (err && err.code === 11000) {
      return res.status(200).json({ success: true, message: 'Already in cart' })
    }
    console.error('cart/from-offer error:', err)
    return res.status(500).json({ success: false, message: 'Failed to add to cart' })
  }
})

// @route   GET /api/cart
// @desc    List the current user's active cart items (as buyer)
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const items = await Cart.find({
      userId: req.user._id,
      cartStatus: 'ACTIVE',
      deletedAt: null,
    })
      .populate({
        path: 'productId',
        select: 'title images video productPrice price year kilometers mileage condition category subcategory',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subcategory', select: 'name' },
        ],
      })
      .populate('sellerId', 'name image avatar')
      .sort({ updatedAt: -1 })
    return res.json({ success: true, data: items })
  } catch (err) {
    console.error('cart list error:', err)
    return res.status(500).json({ success: false, message: 'Failed to load cart' })
  }
})

module.exports = router
