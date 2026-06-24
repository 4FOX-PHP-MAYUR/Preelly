const mongoose = require('mongoose')
const { Schema } = mongoose

/**
 * Aggregated search analytics for reporting and popular-search features.
 * One document per normalized keyword; updated on every successful search.
 */
const SearchAnalyticsSchema = new Schema(
  {
    keyword: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 300,
      unique: true,
    },
    searchCount: { type: Number, default: 1, min: 0 },
    lastSearchedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'search_analytics' },
)

SearchAnalyticsSchema.index({ searchCount: -1, lastSearchedAt: -1 })
SearchAnalyticsSchema.index({ keyword: 1 })

module.exports = mongoose.model('SearchAnalytics', SearchAnalyticsSchema)
