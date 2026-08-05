const mongoose = require('mongoose')
const { Schema } = mongoose

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const PageSchema = new Schema(
  {
    pageTitle: {
      type: String,
      required: [true, 'Page title is required'],
      trim: true,
      minlength: [2, 'Page title must be at least 2 characters'],
      maxlength: [150, 'Page title cannot exceed 150 characters'],
    },
    pageSlug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    heading: {
      type: String,
      required: [true, 'Heading is required'],
      trim: true,
      maxlength: [200, 'Heading cannot exceed 200 characters'],
    },
    // Rich-text HTML content authored via the admin WYSIWYG editor.
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    // Relative path to the uploaded banner image, e.g. "/uploads/images/pageBannerImage-123.png"
    pageBannerImage: {
      type: String,
      default: null,
      trim: true,
    },
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [70, 'Meta title should not exceed 70 characters'],
      default: '',
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'Meta description should not exceed 160 characters'],
      default: '',
    },
    metaKeywords: {
      type: String,
      trim: true,
      default: '',
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, 'Display order cannot be negative'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'pages',
  }
)

PageSchema.index({ isDeleted: 1, status: 1, displayOrder: 1 })
PageSchema.index({ isDeleted: 1, pageTitle: 1 })
PageSchema.index({ pageSlug: 1, isDeleted: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } })

PageSchema.pre('validate', function () {
  if (!this.pageSlug && this.pageTitle) {
    this.pageSlug = slugify(this.pageTitle)
  } else if (this.pageSlug) {
    this.pageSlug = slugify(this.pageSlug)
  }
})

PageSchema.statics.slugify = slugify

PageSchema.statics.fixIndexes = async function fixIndexes() {
  try {
    await this.syncIndexes()
    console.log('[Page] Indexes synced')
  } catch (err) {
    console.error('[Page] fixIndexes error:', err.message)
  }
}

module.exports = mongoose.model('Page', PageSchema)
