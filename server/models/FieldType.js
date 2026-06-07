const mongoose = require('mongoose')

const FieldTypeSchema = new mongoose.Schema(
  {
    fieldValue: {
      type: String,
      required: [true, 'Field value is required'],
      trim: true,
    },
    sortOrder: {
      type: Number,
      required: [true, 'Sort order is required'],
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'fieldTypes',
  }
)

FieldTypeSchema.index({ sortOrder: 1 })
FieldTypeSchema.index({ isDeleted: 1, sortOrder: 1 })

module.exports = mongoose.model('FieldType', FieldTypeSchema)
