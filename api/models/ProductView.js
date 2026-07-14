const mongoose = require('mongoose')

const productViewSchema = new mongoose.Schema(
  {
    productID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dateAdded: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'productview',
  }
)

// One active view record per user per product
productViewSchema.index(
  { productID: 1, userID: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
)
productViewSchema.index({ productID: 1, status: 1 })

const ProductView = mongoose.model('ProductView', productViewSchema)

module.exports = ProductView
