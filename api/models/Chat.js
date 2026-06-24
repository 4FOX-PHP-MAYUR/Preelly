const mongoose = require('mongoose')

const chatSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['product', 'support'],
      default: 'product',
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // For support chats: the user (customer) who started the chat; admin is implicit
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    unreadForBuyer: { type: Number, default: 0 },
    unreadForSeller: { type: Number, default: 0 },
    unreadForUser: { type: Number, default: 0 },
    unreadForAdmin: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
)

// Product chats: unique per product-buyer-seller
chatSchema.index({ product: 1, buyer: 1, seller: 1 }, { unique: true, sparse: true })
// Support: one chat per user
chatSchema.index({ type: 1, user: 1 }, { unique: true, partialFilterExpression: { type: 'support' } })

chatSchema.index({ buyer: 1, updatedAt: -1 })
chatSchema.index({ seller: 1, updatedAt: -1 })
// Shortcut for “support chat by user”.
chatSchema.index({ user: 1 })
chatSchema.index({ lastMessageAt: -1 })

module.exports = mongoose.model('Chat', chatSchema)
