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

    // Soft delete: rows are retained (past transactions reference them) and simply
    // stop being returned. Every read path filters on `isDeleted`.
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

SavedCardSchema.index({ userId: 1, isDeleted: 1, isPrimary: -1, createdAt: -1 })
SavedCardSchema.index({ userId: 1, isPrimary: 1 })
SavedCardSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('SavedCard', SavedCardSchema)
