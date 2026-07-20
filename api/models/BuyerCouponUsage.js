const mongoose = require('mongoose')
const { Schema } = mongoose

// One row per successful buyer-coupon application — the ledger that answers
// total and per-buyer usage limits, and doubles as the usage report.
const BuyerCouponUsageSchema = new Schema(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'BuyerCoupon',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderId: { type: String, default: null },
    checkoutServiceId: {
      type: Schema.Types.ObjectId,
      ref: 'CheckoutService',
      default: null,
    },
    couponCode: { type: String, trim: true, uppercase: true },
    discountAmount: { type: Number, default: 0 },
    originalAmount: { type: Number, default: 0 },
    finalAmount: { type: Number, default: 0 },
    usedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'buyer_coupon_usage',
  }
)

BuyerCouponUsageSchema.index({ couponId: 1, userId: 1 })

module.exports = mongoose.model('BuyerCouponUsage', BuyerCouponUsageSchema)
