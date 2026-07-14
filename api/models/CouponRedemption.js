const mongoose = require('mongoose')
const { Schema } = mongoose

/**
 * One row per successful coupon redemption.
 *
 * `Coupon.usedCount` is the running total, but per-user limits ("usagePerUser")
 * can't be enforced from that alone — this ledger is what makes them answerable,
 * and it doubles as the usage report.
 */
const CouponRedemptionSchema = new Schema(
  {
    coupon: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    couponCode: { type: String, trim: true, uppercase: true },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // The listing the coupon was applied to (post-ad checkout).
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    orderAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    finalAmount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'couponredemptions',
  }
)

CouponRedemptionSchema.index({ coupon: 1, user: 1 })
// A coupon may only be applied once to a given listing/order.
CouponRedemptionSchema.index(
  { coupon: 1, product: 1 },
  { unique: true, partialFilterExpression: { product: { $type: 'objectId' } } }
)

CouponRedemptionSchema.statics.fixIndexes = async function fixIndexes() {
  try {
    await this.syncIndexes()
    console.log('[CouponRedemption] Indexes synced')
  } catch (err) {
    console.error('[CouponRedemption] fixIndexes error:', err.message)
  }
}

module.exports = mongoose.model('CouponRedemption', CouponRedemptionSchema)
