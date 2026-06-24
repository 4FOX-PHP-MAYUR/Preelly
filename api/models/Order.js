const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    orderStatus: {
      type: String,
      enum: ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'placed',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'failed', 'refunded'],
      default: 'unpaid',
      index: true,
    },
    paymentProvider: { type: String, default: null },
    paymentRef: { type: String, default: null },
    totals: {
      subtotal: { type: Number, required: true, min: 0 },
      fees: { type: Number, default: 0, min: 0 },
      shipping: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 0 },
    },
    shippingAddress: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
      city: { type: String, default: null },
      address1: { type: String, default: null },
      address2: { type: String, default: null },
      postalCode: { type: String, default: null },
      country: { type: String, default: null },
    },
  },
  { timestamps: true },
)

orderSchema.index({ buyer: 1, createdAt: -1 })
orderSchema.index({ seller: 1, createdAt: -1 })

module.exports = mongoose.model('Order', orderSchema)

