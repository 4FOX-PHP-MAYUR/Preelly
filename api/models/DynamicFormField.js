const mongoose = require('mongoose')
const { Schema } = mongoose

const dynamicFormFieldSchema = new Schema(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    fieldTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'FieldType',
      required: [true, 'Field type is required'],
    },
    fieldTitle: {
      type: String,
      required: [true, 'Field title is required'],
      trim: true,
    },
    placeholder: {
      type: String,
      trim: true,
      default: '',
    },
    fieldName: {
      type: String,
      required: [true, 'Field name is required'],
      trim: true,
    },
    // Optional: link this form field to a filter from the filters table
    filterId: {
      type: Schema.Types.ObjectId,
      ref: 'Filter',
      default: null,
      index: true,
    },

    // Supports "add more" — zero or more option values
    fieldValues: {
      type: [String],
      default: [],
    },
    fieldOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    formStep: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
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
  }
)

dynamicFormFieldSchema.index({ categoryId: 1, fieldOrder: 1 })

module.exports = mongoose.model('DynamicFormField', dynamicFormFieldSchema)
