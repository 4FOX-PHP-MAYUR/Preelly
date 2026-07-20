const mongoose = require('mongoose')
const { Schema } = mongoose

const ORDER_STATUSES = ['INITIATED', 'SUCCESS', 'FAILED', 'CANCELLED', 'PENDING']

const PaymentTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    // Package is required for the Ads flow (paymentType 1) but absent for the
    // Product Checkout flow (paymentType 2), so it is optional at the schema level.
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', default: null, index: true },
    storagefacilitiesId: { type: Schema.Types.ObjectId, ref: 'StorageFacility', default: null, index: true },

    // 1 = Ads Payment (existing seller flow), 2 = Product Checkout Payment (buyer).
    paymentType: { type: Number, default: 1, index: true },
    // 1 = Web (kept configurable for future platforms like Mobile).
    paymentFrom: { type: Number, default: 1 },
    // Populated for checkout payments: the product's seller and the paying buyer.
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // Snapshot of everything on the checkout page (selected services, pick & drop
    // booking, preelly conditions, price breakdown) — the rest of the page data.
    metadata: { type: Schema.Types.Mixed, default: null },

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
