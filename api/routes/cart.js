const express = require('express')
const router = express.Router()
const Cart = require('../models/Cart')
const Chat = require('../models/Chat')
const Product = require('../models/Product')
const authMiddleware = require('../middleware/auth')
const { resolveStoredFeaturesColumn } = require('../utils/productAttributesResolver')

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

// @route   POST /api/cart/preelly-conditions
// @desc    Persist the seller-approved Preelly inspection conditions onto the
//          buyer's ACTIVE cart row for the chat's product. Called when the seller
//          approves the conditions in chat.
// @access  Private
router.post('/preelly-conditions', authMiddleware, async (req, res) => {
  try {
    const requesterId = req.user._id
    const { chatId, conditions, comment } = req.body

    if (!chatId) {
      return res.status(400).json({ success: false, message: 'chatId is required' })
    }

    const chat = await Chat.findById(chatId).select('product buyer seller')
    if (!chat || !chat.product || !chat.buyer || !chat.seller) {
      return res.status(404).json({ success: false, message: 'Chat not found' })
    }

    // Only chat participants may approve; conditions apply to the buyer's cart.
    const isParticipant =
      chat.buyer.toString() === requesterId.toString() ||
      chat.seller.toString() === requesterId.toString()
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not allowed for this chat' })
    }

    const cleanConditions = Array.isArray(conditions)
      ? [...new Set(conditions.map((c) => String(c).trim()).filter(Boolean))]
      : []

    const cart = await Cart.findOneAndUpdate(
      { userId: chat.buyer, productId: chat.product, cartStatus: 'ACTIVE', deletedAt: null },
      {
        $set: {
          preellyInspection: {
            conditions: cleanConditions,
            comment: typeof comment === 'string' ? comment.trim() : '',
            approved: true,
            approvedAt: new Date(),
          },
        },
      },
      { new: true }
    )

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart item not found for this product' })
    }

    return res.status(200).json({ success: true, data: cart })
  } catch (err) {
    console.error('cart/preelly-conditions error:', err)
    return res.status(500).json({ success: false, message: 'Failed to save inspection conditions' })
  }
})

// @route   POST /api/cart/preelly-not-interested
// @desc    Buyer declined Preelly Pay in chat — record the opt-out on their active
//          cart row for the chat's product, then they proceed to cart.
// @access  Private
router.post('/preelly-not-interested', authMiddleware, async (req, res) => {
  try {
    const requesterId = req.user._id
    const { chatId } = req.body

    if (!chatId) {
      return res.status(400).json({ success: false, message: 'chatId is required' })
    }

    const chat = await Chat.findById(chatId).select('product buyer seller')
    if (!chat || !chat.product || !chat.buyer || !chat.seller) {
      return res.status(404).json({ success: false, message: 'Chat not found' })
    }

    // Only the buyer of this chat can opt out on their own cart.
    if (chat.buyer.toString() !== requesterId.toString()) {
      return res.status(403).json({ success: false, message: 'Not allowed for this chat' })
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: chat.buyer, productId: chat.product, cartStatus: 'ACTIVE', deletedAt: null },
      {
        $set: {
          preellyInspection: {
            conditions: ['Not Interested'],
            comment: '',
            approved: false,
            approvedAt: null,
            notInterested: true,
            notInterestedAt: new Date(),
          },
        },
      },
      { new: true }
    )

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart item not found for this product' })
    }

    return res.status(200).json({ success: true, data: cart })
  } catch (err) {
    console.error('cart/preelly-not-interested error:', err)
    return res.status(500).json({ success: false, message: 'Failed to save preference' })
  }
})

// @route   GET /api/cart
// @desc    List the current user's cart items (as buyer). Defaults to the ACTIVE
//          cart; `?cartStatus=PURCHASED` (or any valid status) narrows to another
//          stage — used by the chat inbox's Cart tab.
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const requestedStatus = String(req.query.cartStatus || req.query.status || '').trim().toUpperCase()
    const cartStatus = Cart.CART_STATUSES.includes(requestedStatus) ? requestedStatus : 'ACTIVE'

    const items = await Cart.find({
      userId: req.user._id,
      cartStatus,
      deletedAt: null,
    })
      .populate({
        path: 'productId',
        select: 'title images video productPrice price year kilometers mileage condition category subcategory features',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subcategory', select: 'name' },
        ],
      })
      .populate('sellerId', 'name image avatar')
      .sort({ updatedAt: -1 })
      .lean()

    // Resolve the product's multi-select feature IDs to their readable labels
    // (matched against the Filter master table) so the checkout popup shows text.
    const data = await Promise.all(
      items.map(async (it) => {
        const product = it.productId
        if (product && Array.isArray(product.features) && product.features.length) {
          try {
            product.features = await resolveStoredFeaturesColumn(product)
          } catch {
            /* leave raw features as-is on failure */
          }
        }
        return it
      })
    )
    return res.json({ success: true, data })
  } catch (err) {
    console.error('cart list error:', err)
    return res.status(500).json({ success: false, message: 'Failed to load cart' })
  }
})

module.exports = router
