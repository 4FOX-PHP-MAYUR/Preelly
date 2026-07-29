const mongoose = require('mongoose')
const { Schema } = mongoose

/**
 * Saved card metadata only — never store full PAN or CVV.
 */
const SavedCardSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    brand: { type: String, default: 'Card', trim: true, maxlength: 40 },
    last4: { type: String, required: true, trim: true, maxlength: 4 },
    expiry: { type: String, default: '', trim: true, maxlength: 7 }, // MM/YY
    holderName: { type: String, default: '', trim: true, maxlength: 120 },
    nickname: { type: String, default: '', trim: true, maxlength: 80 },
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: true }
)

SavedCardSchema.index({ userId: 1, isPrimary: 1 })
SavedCardSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('SavedCard', SavedCardSchema)
