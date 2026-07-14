const mongoose = require('mongoose')
const { Schema } = mongoose

const StorageFacilitySchema = new Schema(
  {
    facilityWeek: {
      type: String,
      required: [true, 'Facility week is required'],
      trim: true,
      minlength: [3, 'Facility week must be at least 3 characters'],
      maxlength: [100, 'Facility week cannot exceed 100 characters'],
    },
    facilityAmount: {
      type: Number,
      required: [true, 'Facility amount is required'],
      validate: {
        validator: (value) => typeof value === 'number' && value > 0,
        message: 'Facility amount must be greater than 0',
      },
    },
    // Relative path to the uploaded icon, e.g. "/uploads/images/imageIcon-123.png"
    imageIcon: {
      type: String,
      default: null,
      trim: true,
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
    collection: 'storagefacilities',
  }
)

StorageFacilitySchema.index({ isDeleted: 1, status: 1, displayOrder: 1 })
StorageFacilitySchema.index({ isDeleted: 1, facilityWeek: 1 })

StorageFacilitySchema.statics.fixIndexes = async function fixIndexes() {
  try {
    await this.syncIndexes()
    console.log('[StorageFacility] Indexes synced')
  } catch (err) {
    console.error('[StorageFacility] fixIndexes error:', err.message)
  }
}

module.exports = mongoose.model('StorageFacility', StorageFacilitySchema)
