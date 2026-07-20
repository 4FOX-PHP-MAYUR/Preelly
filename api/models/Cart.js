const mongoose = require('mongoose')
const { Schema } = mongoose

const CART_STATUSES = ['ACTIVE', 'CHECKOUT', 'PURCHASED', 'ABANDONED']

const CartSchema = new Schema(
  {
    // userId always holds the BUYER's id (per business rule).
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    // Package is chosen later at checkout, so it is optional at cart-creation time.
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', default: null, index: true },
    storagefacilitiesId: { type: Schema.Types.ObjectId, ref: 'StorageFacility', default: null, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, trim: true, uppercase: true, default: null },
    couponDiscount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },

    cartStatus: {
      type: String,
      enum: CART_STATUSES,
      default: 'ACTIVE',
      index: true,
    },
    isSelected: { type: Boolean, default: true },
    notes: { type: String, default: null },
    expiresAt: { type: Date, default: null },

    // Soft delete
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
)

// One live cart row per buyer+product (ignoring soft-deleted rows).
CartSchema.index(
  { userId: 1, productId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null, cartStatus: 'ACTIVE' } }
)
CartSchema.index({ userId: 1, cartStatus: 1, deletedAt: 1 })

CartSchema.statics.CART_STATUSES = CART_STATUSES

module.exports = mongoose.model('Cart', CartSchema)
