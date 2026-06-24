const mongoose = require('mongoose')
const { Schema } = mongoose

const CategoryFilterSchema = new Schema(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    filterId: { type: Schema.Types.ObjectId, ref: 'Filter', required: true, index: true },
  },
  {
    timestamps: true,
    collection: 'category_filters',
  }
)

// Prevent duplicate assignments for same category + filter
CategoryFilterSchema.index({ categoryId: 1, filterId: 1 }, { unique: true })

module.exports = mongoose.model('CategoryFilter', CategoryFilterSchema)

