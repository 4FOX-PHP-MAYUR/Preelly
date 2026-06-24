const mongoose = require('mongoose')
const { Schema } = mongoose

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const EmirateSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      index: true,
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
    collection: 'emirates',
  }
)

EmirateSchema.index({ isDeleted: 1, status: 1, name: 1 })
EmirateSchema.index({ slug: 1, isDeleted: 1 })

EmirateSchema.pre('validate', function () {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name)
  }
})

EmirateSchema.statics.fixIndexes = async function fixIndexes() {
  try {
    await this.syncIndexes()
    console.log('[Emirate] Indexes synced')
  } catch (err) {
    console.error('[Emirate] fixIndexes error:', err.message)
  }
}

module.exports = mongoose.model('Emirate', EmirateSchema)
