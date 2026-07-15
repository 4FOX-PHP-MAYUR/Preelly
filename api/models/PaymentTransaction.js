const mongoose = require('mongoose')
const { Schema } = mongoose

const ORDER_STATUSES = ['INITIATED', 'SUCCESS', 'FAILED', 'CANCELLED', 'PENDING']

const PaymentTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true, index: true },
    storagefacilitiesId: { type: Schema.Types.ObjectId, ref: 'StorageFacility', default: null, index: true },

    // Applied coupon (redeemed on success), if any.
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', default: null },
    couponCode: { type: String, trim: true, uppercase: true, default: null },
    discountAmount: { type: Number, default: 0 },

    orderId: { type: String, required: true },
    trackingId: { type: String, default: null },
    bankRefNo: { type: String, default: null },
    merchantId: { type: String, default: null },
    currency: { type: String, default: 'AED' },
    amount: { type: Number, required: true },

    orderStatus: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'INITIATED',
      index: true,
    },
    paymentMode: { type: String, default: null },
    gatewayName: { type: String, default: 'CCAvenue' },
    gatewayOrderStatus: { type: String, default: null },
    failureMessage: { type: String, default: null },

    billingName: { type: String, default: null },
    billingEmail: { type: String, default: null },
    billingMobile: { type: String, default: null },
    billingAddress: { type: String, default: null },
    billingCity: { type: String, default: null },
    billingState: { type: String, default: null },
    billingCountry: { type: String, default: null },
    billingPincode: { type: String, default: null },

    merchantParam1: { type: String, default: null },
    merchantParam2: { type: String, default: null },
    merchantParam3: { type: String, default: null },
    merchantParam4: { type: String, default: null },
    merchantParam5: { type: String, default: null },

    // Encrypted request/response are retained for audit and dispute resolution.
    encRequest: { type: String, default: null },
    encResponse: { type: String, default: null },
    gatewayResponse: { type: Schema.Types.Mixed, default: null },

    paymentDate: { type: Date, default: null, index: true },
    isVerified: { type: Boolean, default: false },

    // Invoice (generated once, on success)
    invoiceNumber: { type: String, default: null },
    invoicePath: { type: String, default: null }, // absolute server path (never exposed)
    invoiceUrl: { type: String, default: null }, // owner-only download endpoint
    // Confirmation email
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date, default: null },

    // Payment history is never hard-deleted; soft delete only if ever needed.
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'paymentTransaction',
  }
)

// orderId is our unique idempotency key.
PaymentTransactionSchema.index({ orderId: 1 }, { unique: true })
// trackingId arrives only after the gateway responds. A partial index (not sparse!)
// is required: the field defaults to an explicit null, and sparse only excludes
// *absent* fields, so multiple INITIATED rows with trackingId=null would collide.
PaymentTransactionSchema.index(
  { trackingId: 1 },
  { unique: true, partialFilterExpression: { trackingId: { $type: 'string' } } }
)
// invoiceNumber is minted only on success — same reasoning as trackingId.
PaymentTransactionSchema.index(
  { invoiceNumber: 1 },
  { unique: true, partialFilterExpression: { invoiceNumber: { $type: 'string' } } }
)

PaymentTransactionSchema.statics.ORDER_STATUSES = ORDER_STATUSES

PaymentTransactionSchema.statics.fixIndexes = async function fixIndexes() {
  try {
    await this.syncIndexes()
    console.log('[PaymentTransaction] Indexes synced')
  } catch (err) {
    console.error('[PaymentTransaction] fixIndexes error:', err.message)
  }
}

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema)
module.exports.ORDER_STATUSES = ORDER_STATUSES
