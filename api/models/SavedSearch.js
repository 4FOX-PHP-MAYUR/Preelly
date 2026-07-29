const mongoose = require('mongoose')
const { Schema } = mongoose

/**
 * Saved searches ("My Search") for logged-in users.
 * Existing fields are preserved for backward compatibility; newer fields
 * extend the same `saved_searches` collection without breaking old documents.
 */
const SavedSearchSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Legacy display title (kept) + explicit searchName alias
    title: { type: String, required: true, trim: true, maxlength: 120 },
    searchName: { type: String, trim: true, maxlength: 120, default: '' },

    // Keyword / free-text query (legacy `query` kept; `keyword` mirrors SearchHistory naming)
    query: { type: String, default: '', trim: true, maxlength: 300 },
    keyword: { type: String, default: '', trim: true, maxlength: 300 },

    // Category breadcrumbs e.g. ["Residential", "Townhouse"]
    categoryPath: { type: [String], default: [] },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    categoryName: { type: String, default: '', trim: true, maxlength: 120 },
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    subCategoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    subCategoryName: { type: String, default: '', trim: true, maxlength: 120 },

    searchType: {
      type: String,
      enum: ['keyword', 'category', 'filtered', 'mixed'],
      default: 'mixed',
    },

    filters: {
      location: { type: String, default: '', trim: true },
      minPrice: { type: String, default: '', trim: true },
      maxPrice: { type: String, default: '', trim: true },
      sortBy: { type: String, default: 'newest', trim: true },
      tags: { type: [String], default: [] },
      extra: { type: Schema.Types.Mixed, default: {} },
    },
    // Structured snapshot of applied filters (JSON) for matching / reopen
    selectedFilters: { type: Schema.Types.Mixed, default: {} },
    sortOption: { type: String, default: 'newest', trim: true, maxlength: 64 },
    location: { type: String, default: '', trim: true, maxlength: 200 },

    // Serialized query string for reopening /search?...
    searchUrl: { type: String, default: '/search', trim: true, maxlength: 2000 },

    // Notification prefs (legacy notifyEnabled kept in sync with notificationEnabled)
    notifyEnabled: { type: Boolean, default: true },
    notificationEnabled: { type: Boolean, default: true },
    emailNotificationEnabled: { type: Boolean, default: true },
    pushNotificationEnabled: { type: Boolean, default: true },

    // Cached match stats (refreshed on list + when new ads match)
    newAdsCount: { type: Number, default: 0, min: 0 },
    totalMatchingAdsCount: { type: Number, default: 0, min: 0 },
    latestMatchingImages: { type: [String], default: [] },

    lastViewedAt: { type: Date, default: Date.now },
    lastNotificationSentAt: { type: Date, default: null },

    // Soft delete / lifecycle
    status: {
      type: String,
      enum: ['active', 'inactive', 'deleted'],
      default: 'active',
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },

    // Provenance (aligned with SearchHistory naming for analytics compatibility)
    deviceId: { type: String, default: '', trim: true, maxlength: 128 },
    platform: { type: String, enum: ['web', 'mobile', ''], default: 'web' },
    isLoggedIn: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'saved_searches' }
)

SavedSearchSchema.index({ userId: 1, createdAt: -1 })
SavedSearchSchema.index({ userId: 1, categoryId: 1 })
SavedSearchSchema.index({ userId: 1, isDeleted: 1, status: 1 })
SavedSearchSchema.index({ isDeleted: 1, notificationEnabled: 1, status: 1 })

/** Normalize aliases before validate/save so old clients keep working. */
SavedSearchSchema.pre('validate', function syncAliases() {
  if (!this.searchName && this.title) this.searchName = this.title
  if (!this.title && this.searchName) this.title = this.searchName

  const q = this.query || this.keyword || ''
  if (!this.query) this.query = q
  if (!this.keyword) this.keyword = q

  if (this.subcategoryId && !this.subCategoryId) this.subCategoryId = this.subcategoryId
  if (this.subCategoryId && !this.subcategoryId) this.subcategoryId = this.subCategoryId

  if (this.filters?.sortBy && !this.sortOption) this.sortOption = this.filters.sortBy
  if (this.sortOption && this.filters && !this.filters.sortBy) this.filters.sortBy = this.sortOption

  if (this.filters?.location && !this.location) this.location = this.filters.location
  if (this.location && this.filters && !this.filters.location) this.filters.location = this.location

  // Keep master + legacy notify flags aligned
  if (this.isModified('notificationEnabled') && !this.isModified('notifyEnabled')) {
    this.notifyEnabled = this.notificationEnabled
  } else if (this.isModified('notifyEnabled') && !this.isModified('notificationEnabled')) {
    this.notificationEnabled = this.notifyEnabled
  } else if (this.notificationEnabled == null && this.notifyEnabled != null) {
    this.notificationEnabled = this.notifyEnabled
  } else if (this.notifyEnabled == null && this.notificationEnabled != null) {
    this.notifyEnabled = this.notificationEnabled
  }

  if (this.isDeleted) {
    this.status = 'deleted'
    if (!this.deletedAt) this.deletedAt = new Date()
  }
})

module.exports = mongoose.model('SavedSearch', SavedSearchSchema)
