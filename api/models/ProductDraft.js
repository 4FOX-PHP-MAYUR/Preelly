const mongoose = require('mongoose')
const { Schema } = mongoose

const DRAFT_STATUSES = ['draft', 'published', 'discarded']

/**
 * In-progress "Post Your Ad" wizard state persisted server-side.
 * Media File/Blob objects remain client-side (IndexedDB); this collection
 * stores serializable form/category/step data for resume + cross-device sync.
 */
const ProductDraftSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: DRAFT_STATUSES,
      default: 'draft',
      index: true,
    },

    // Wizard progress
    currentStep: { type: Number, default: 1, min: 1 },
    lastSavedStep: { type: Number, default: null, min: 1 },
    categoryLevel: { type: Number, default: 0, min: 0 },

    // Category selection (serializable snapshots from the wizard)
    selectedPath: { type: Schema.Types.Mixed, default: [] },
    selectedCategory: { type: Schema.Types.Mixed, default: null },

    // react-hook-form values (minus File/Blob fields)
    formValues: { type: Schema.Types.Mixed, default: {} },

    // Step 5 admin dynamic-form values
    dynamicFormValues: { type: Schema.Types.Mixed, default: {} },

    // Media metadata only — actual blobs stay in IndexedDB on the client
    hasVideo: { type: Boolean, default: false },
    videoMeta: {
      type: new Schema(
        {
          name: { type: String, default: null },
          size: { type: Number, default: null },
          type: { type: String, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    imageCount: { type: Number, default: 0, min: 0 },
    imageMeta: {
      type: [
        new Schema(
          {
            name: { type: String, default: null },
            size: { type: Number, default: null },
            type: { type: String, default: null },
            isScreenshot: { type: Boolean, default: false },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    // Set when the listing is published from this draft
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    publishedAt: { type: Date, default: null },
    lastSavedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'productDraft',
  }
)

// One live draft per user — avoids duplicate in-progress records.
ProductDraftSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: 'draft' } }
)
ProductDraftSchema.index({ userId: 1, status: 1, updatedAt: -1 })

ProductDraftSchema.statics.DRAFT_STATUSES = DRAFT_STATUSES

module.exports = mongoose.model('ProductDraft', ProductDraftSchema)
