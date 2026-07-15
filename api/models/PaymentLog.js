const mongoose = require('mongoose')
const { Schema } = mongoose

/**
 * One entry per payment attempt outcome (success / failure / cancelled / pending).
 * Append-only audit trail — kept separate from PaymentTransaction so a log write
 * can never interfere with the transaction record it describes.
 */
const PaymentLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    userName: { type: String, default: null },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', default: null },
    storagefacilitiesId: { type: Schema.Types.ObjectId, ref: 'StorageFacility', default: null },

    orderId: { type: String, default: null, index: true },
    invoiceNumber: { type: String, default: null },
    trackingId: { type: String, default: null },

    activity: { type: String, default: null }, // "Payment Successful" | "Payment Failed" | ...
    description: { type: String, default: null },
    paymentStatus: { type: String, default: null, index: true },
    paymentMethod: { type: String, default: null },

    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'AED' },
    gatewayName: { type: String, default: 'CCAvenue' },
    gatewayStatus: { type: String, default: null },
    failureReason: { type: String, default: null },

    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    requestTime: { type: Date, default: null },
    responseTime: { type: Date, default: null },
    callbackTime: { type: Date, default: null },

    emailSent: { type: Boolean, default: false },
    invoiceGenerated: { type: Boolean, default: false },

    gatewayResponse: { type: Schema.Types.Mixed, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true, // createdAt / updatedAt
    collection: 'paymentLogs',
  }
)

PaymentLogSchema.index({ createdAt: -1 })

PaymentLogSchema.statics.fixIndexes = async function fixIndexes() {
  try {
    await this.syncIndexes()
    console.log('[PaymentLog] Indexes synced')
  } catch (err) {
    console.error('[PaymentLog] fixIndexes error:', err.message)
  }
}

module.exports = mongoose.model('PaymentLog', PaymentLogSchema)
