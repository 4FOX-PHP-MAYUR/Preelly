const mongoose = require('mongoose')
const { Schema } = mongoose

const SavedSearchSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    // Display breadcrumbs e.g. ["Residential", "Townhouse"]
    categoryPath: { type: [String], default: [] },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    query: { type: String, default: '', trim: true, maxlength: 300 },
    filters: {
      location: { type: String, default: '', trim: true },
      minPrice: { type: String, default: '', trim: true },
      maxPrice: { type: String, default: '', trim: true },
      sortBy: { type: String, default: 'newest', trim: true },
      // Free-form tags shown in UI (e.g. "ALL CITIES", "BEDS: 3")
      tags: { type: [String], default: [] },
      extra: { type: Schema.Types.Mixed, default: {} },
    },
    // Serialized query string for reopening /search?...
    searchUrl: { type: String, default: '/search', trim: true, maxlength: 2000 },
    notifyEnabled: { type: Boolean, default: true },
    lastViewedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'saved_searches' }
)

SavedSearchSchema.index({ userId: 1, createdAt: -1 })
SavedSearchSchema.index({ userId: 1, categoryId: 1 })

module.exports = mongoose.model('SavedSearch', SavedSearchSchema)
