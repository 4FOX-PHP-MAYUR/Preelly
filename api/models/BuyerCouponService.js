const mongoose = require('mongoose')
const { Schema } = mongoose

// Many-to-many mapping: which Checkout Services a buyer coupon applies to.
const BuyerCouponServiceSchema = new Schema(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'BuyerCoupon',
      required: true,
      index: true,
    },
    checkoutServiceId: {
      type: Schema.Types.ObjectId,
      ref: 'CheckoutService',
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'buyer_coupon_services',
  }
)

BuyerCouponServiceSchema.index({ couponId: 1, checkoutServiceId: 1 }, { unique: true })

module.exports = mongoose.model('BuyerCouponService', BuyerCouponServiceSchema)
