const mongoose = require('mongoose')
const { Schema } = mongoose

const SearchHistorySchema = new Schema(
  {
    keyword: { type: String, required: true, trim: true, maxlength: 300 },
    deviceId: { type: String, required: true, trim: true, maxlength: 128 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    platform: { type: String, enum: ['web', 'mobile'], required: true },
    isLoggedIn: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'search_histories' },
)

SearchHistorySchema.index({ deviceId: 1, createdAt: -1 })
SearchHistorySchema.index({ userId: 1, createdAt: -1 })
SearchHistorySchema.index({ keyword: 1 })
SearchHistorySchema.index({ createdAt: -1 })
SearchHistorySchema.index({ userId: 1, keyword: 1, createdAt: -1 })
SearchHistorySchema.index({ deviceId: 1, keyword: 1, createdAt: -1 })
// Guest history scoped to device without user linkage
SearchHistorySchema.index({ deviceId: 1, userId: 1, createdAt: -1 })

module.exports = mongoose.model('SearchHistory', SearchHistorySchema)
