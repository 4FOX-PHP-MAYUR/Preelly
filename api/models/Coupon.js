const mongoose = require('mongoose')
const { Schema } = mongoose

const DISCOUNT_TYPES = ['percentage', 'fixed']

const APPLICABLE_TYPES = [
  'all_packages',
  'selected_packages',
  'all_storage_facilities',
  'selected_storage_facilities',
  'all_categories',
  'selected_categories',
]

const USER_ELIGIBILITY = ['everyone', 'new_users', 'existing_users']

const COUPON_TYPES = ['public', 'private']

/** applicableType → the collection `applicableIds` point at. */
const APPLICABLE_REF = {
  selected_packages: 'Package',
  selected_storage_facilities: 'StorageFacility',
  selected_categories: 'Category',
}

const CouponSchema = new Schema(
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

    // ── Discount ──────────────────────────────────────────────────────────────
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
    // Percentage coupons only — caps the discount (e.g. "20% up to 500").
    maximumDiscount: {
      type: Number,
      default: null,
      min: [0, 'Maximum discount cannot be negative'],
    },
    minimumOrderAmount: {
      type: Number,
      default: null,
      min: [0, 'Minimum order amount cannot be negative'],
    },

    // ── Validity ──────────────────────────────────────────────────────────────
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },

    // ── Usage ─────────────────────────────────────────────────────────────────
    // null = unlimited
    usageLimit: {
      type: Number,
      default: null,
      min: [1, 'Usage limit must be at least 1'],
    },
    usagePerUser: {
      type: Number,
      default: null,
      min: [1, 'Usage per user must be at least 1'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Applicability ─────────────────────────────────────────────────────────
    applicableType: {
      type: String,
      enum: APPLICABLE_TYPES,
      required: [true, 'Applicable for is required'],
      default: 'all_packages',
    },
    // Only meaningful for the "selected_*" types; the collection varies by type,
    // so this stays an untyped ObjectId array (see APPLICABLE_REF).
    applicableIds: [{ type: Schema.Types.ObjectId }],

    userEligibility: {
      type: String,
      enum: USER_ELIGIBILITY,
      default: 'everyone',
    },
    couponType: {
      type: String,
      enum: COUPON_TYPES,
      default: 'public',
    },
    // Private coupons: only these users may redeem.
    assignedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    stackable: {
      type: Boolean,
      default: false,
    },
    terms: {
      type: String,
      trim: true,
      default: null,
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
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'coupons',
  }
)

// Coupon codes are unique among live coupons — a soft-deleted code can be reused.
CouponSchema.index(
  { couponCode: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
)
CouponSchema.index({ isDeleted: 1, status: 1, createdAt: -1 })
CouponSchema.index({ isDeleted: 1, endDate: 1 })
CouponSchema.index({ isDeleted: 1, discountType: 1 })
CouponSchema.index({ isDeleted: 1, applicableType: 1 })

/** True when the coupon is past its end date. */
CouponSchema.virtual('isExpired').get(function () {
  return Boolean(this.endDate && this.endDate.getTime() < Date.now())
})

CouponSchema.statics.fixIndexes = async function fixIndexes() {
  try {
    await this.syncIndexes()
    console.log('[Coupon] Indexes synced')
  } catch (err) {
    console.error('[Coupon] fixIndexes error:', err.message)
  }
}

module.exports = mongoose.model('Coupon', CouponSchema)
module.exports.DISCOUNT_TYPES = DISCOUNT_TYPES
module.exports.APPLICABLE_TYPES = APPLICABLE_TYPES
module.exports.USER_ELIGIBILITY = USER_ELIGIBILITY
module.exports.COUPON_TYPES = COUPON_TYPES
module.exports.APPLICABLE_REF = APPLICABLE_REF
