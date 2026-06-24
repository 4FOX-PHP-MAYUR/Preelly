const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema(
  {
    // recipient
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // who triggered the notification (null for system notifications)
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // related product/listing (optional)
    relatedProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },

    type: {
      type: String,
      enum: ['like', 'comment', 'follow', 'follow_request', 'message', 'order', 'listing', 'system'],
      required: true,
      index: true,
    },

    // which dashboard tab this belongs to
    tab: {
      type: String,
      enum: ['buying', 'selling', 'general'],
      default: 'general',
    },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, default: '', trim: true, maxlength: 500 },

    // extra payload (productTitle, commentText, etc.)
    data: { type: Object, default: () => ({}) },

    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
)

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 })
notificationSchema.index({ user: 1, tab: 1, createdAt: -1 })

module.exports = mongoose.model('Notification', notificationSchema)
