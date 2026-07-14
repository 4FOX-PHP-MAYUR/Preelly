const mongoose = require('mongoose')
const { Schema } = mongoose

const PackageSchema = new Schema(
  {
    packageName: {
      type: String,
      required: [true, 'Package name is required'],
      trim: true,
      minlength: [3, 'Package name must be at least 3 characters'],
      maxlength: [100, 'Package name cannot exceed 100 characters'],
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, 'Display order cannot be negative'],
    },
    packageAmount: {
      type: Number,
      required: [true, 'Package amount is required'],
      validate: {
        validator: (value) => typeof value === 'number' && value > 0,
        message: 'Package amount must be greater than 0',
      },
    },
    isVatApplicable: {
      type: Boolean,
      default: false,
    },
    // VAT rate as a percentage of packageAmount (e.g. 5 = 5%).
    vatAmount: {
      type: Number,
      default: 0,
      min: [0, 'VAT percentage cannot be negative'],
      max: [100, 'VAT percentage cannot exceed 100'],
    },
    validityDays: {
      type: Number,
      default: null,
      min: [1, 'Validity must be at least 1 day'],
    },
    isRecomended: {
      type: Boolean,
      default: false,
      index: true,
    },
    packageFeatures: {
      type: [{ type: String, trim: true }],
      default: [],
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
    collection: 'packages',
  }
)

PackageSchema.index({ isDeleted: 1, status: 1, displayOrder: 1 })
PackageSchema.index({ isDeleted: 1, packageName: 1 })

// VAT is only meaningful when it applies — keep the stored amount consistent.
PackageSchema.pre('validate', function () {
  if (!this.isVatApplicable) {
    this.vatAmount = 0
  }
})

PackageSchema.statics.fixIndexes = async function fixIndexes() {
  try {
    await this.syncIndexes()
    console.log('[Package] Indexes synced')
  } catch (err) {
    console.error('[Package] fixIndexes error:', err.message)
  }
}

module.exports = mongoose.model('Package', PackageSchema)
