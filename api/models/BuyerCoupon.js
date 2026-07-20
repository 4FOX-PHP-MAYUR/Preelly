const mongoose = require('mongoose')
const { Schema } = mongoose

const DISCOUNT_TYPES = ['percentage', 'fixed']

// Coupons that discount ONLY Checkout Service charges (never product prices).
const BuyerCouponSchema = new Schema(
  {
    couponName: {
      type: String,
      required: [true, 'Coupon name is required'],
      trim: true,
      maxlength: [100, 'Coupon name cannot exceed 100 characters'],
    },
    couponCode: {
      type: String,
      required: [true, 'Coupon code is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Coupon code cannot exceed 20 characters'],
      match: [/^[A-Z0-9_-]+$/, 'Coupon code cannot contain spaces or special characters'],
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },

    discountType: {
      type: String,
      enum: DISCOUNT_TYPES,
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    minimumOrderAmount: {
      type: Number,
      default: null,
      min: [0, 'Minimum order amount cannot be negative'],
    },
    // Required for percentage coupons — caps the discount.
    maximumDiscountAmount: {
      type: Number,
      default: null,
      min: [0, 'Maximum discount amount cannot be negative'],
    },

    // null = unlimited
    usageLimit: {
      type: Number,
      default: null,
      min: [1, 'Usage limit must be at least 1'],
    },
    usageLimitPerBuyer: {
      type: Number,
      default: 1,
      min: [1, 'Usage limit per buyer must be at least 1'],
    },

    validFrom: {
      type: Date,
      required: [true, 'Valid from is required'],
    },
    validTill: {
      type: Date,
      required: [true, 'Valid till is required'],
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
  },
  {
    timestamps: true,
    collection: 'buyers_coupons',
  }
)

// Unique coupon code among non-deleted coupons.
BuyerCouponSchema.index(
  { couponCode: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
)
BuyerCouponSchema.index({ isDeleted: 1, status: 1, validTill: 1 })

BuyerCouponSchema.statics.DISCOUNT_TYPES = DISCOUNT_TYPES

module.exports = mongoose.model('BuyerCoupon', BuyerCouponSchema)
