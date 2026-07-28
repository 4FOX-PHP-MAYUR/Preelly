/**
 * Admin-facing DTOs for payment transactions.
 * Omits encRequest / encResponse; gatewayResponse is sanitized for dispute review.
 */

const {
  paymentFromToPlatform,
  platformLabel,
  normalizePaymentMethod,
  paymentStatusLabel,
  paymentStatusBadge,
} = require('../utils/paymentLabels')

function toUserBrief(value) {
  if (!value) return null
  if (typeof value === 'object' && (value.name || value.email || value.phone)) {
    return {
      id: String(value._id),
      name: value.name || null,
      email: value.email || null,
      phone: value.phone || null,
    }
  }
  return { id: String(value._id || value), name: null, email: null, phone: null }
}

function toProductBrief(value) {
  if (!value) return null
  if (typeof value === 'object' && value.title != null) {
    return {
      id: String(value._id),
      title: value.title || null,
      image: value.images?.[0] || value.videoScreenshots?.[0]?.image || null,
    }
  }
  return value ? { id: String(value._id || value), title: null, image: null } : null
}

function toPackageBrief(value) {
  if (!value) return null
  if (typeof value === 'object' && value.packageName != null) {
    return {
      id: String(value._id),
      packageName: value.packageName,
      packageAmount: Number(value.packageAmount ?? 0),
    }
  }
  return value ? { id: String(value._id || value), packageName: null, packageAmount: null } : null
}

function toFacilityBrief(value) {
  if (!value) return null
  if (typeof value === 'object' && value.facilityWeek != null) {
    return {
      id: String(value._id),
      facilityWeek: value.facilityWeek,
      facilityAmount: Number(value.facilityAmount ?? 0),
    }
  }
  return value ? { id: String(value._id || value), facilityWeek: null, facilityAmount: null } : null
}

function sanitizeGatewayResponse(raw) {
  if (!raw || typeof raw !== 'object') return null
  // Prefer a flat allow-list of non-sensitive gateway fields for the admin UI.
  const allow = [
    'order_id', 'tracking_id', 'bank_ref_no', 'order_status', 'failure_message',
    'status_message', 'payment_mode', 'card_name', 'status_code', 'currency',
    'amount', 'trans_date', 'response_code', 'merchant_param1', 'merchant_param2',
    'merchant_param3', 'merchant_param4', 'merchant_param5',
  ]
  const out = {}
  for (const key of allow) {
    if (raw[key] != null && raw[key] !== '') out[key] = raw[key]
  }
  return Object.keys(out).length ? out : null
}

function customerName(txn) {
  return txn.billingName || toUserBrief(txn.userId)?.name || null
}

function customerEmail(txn) {
  return txn.billingEmail || toUserBrief(txn.userId)?.email || null
}

function toAdminTransactionListDto(txn) {
  if (!txn) return null
  const platform = paymentFromToPlatform(txn.paymentFrom)
  const orderStatus = txn.orderStatus || 'INITIATED'

  return {
    id: String(txn._id),
    transactionId: String(txn._id),
    orderId: txn.orderId,
    customerName: customerName(txn),
    customerEmail: customerEmail(txn),
    amount: Number(txn.amount ?? 0),
    currency: txn.currency || 'AED',
    orderStatus,
    paymentStatus: paymentStatusLabel(orderStatus),
    paymentStatusBadge: paymentStatusBadge(orderStatus),
    paymentMethod: normalizePaymentMethod(txn.paymentMode) || txn.paymentMode || null,
    paymentModeRaw: txn.paymentMode || null,
    orderPlatform: platform,
    orderPlatformLabel: platformLabel(platform),
    gatewayTransactionId: txn.trackingId || null,
    gatewayName: txn.gatewayName || 'CCAvenue',
    paymentType: Number(txn.paymentType ?? 1),
    paymentTypeLabel: Number(txn.paymentType) === 2 ? 'Product Checkout' : 'Ads Payment',
    transactionDate: txn.paymentDate || txn.createdAt || null,
    createdAt: txn.createdAt || null,
  }
}

function toAdminTransactionDetailDto(txn, logs = []) {
  if (!txn) return null
  const list = toAdminTransactionListDto(txn)
  const platform = paymentFromToPlatform(txn.paymentFrom)

  return {
    ...list,
    bankRefNo: txn.bankRefNo || null,
    merchantId: txn.merchantId || null,
    gatewayOrderStatus: txn.gatewayOrderStatus || null,
    failureMessage: txn.failureMessage || null,
    isVerified: Boolean(txn.isVerified),
    discountAmount: Number(txn.discountAmount ?? 0),
    couponCode: txn.couponCode || null,
    invoiceNumber: txn.invoiceNumber || null,
    hasInvoice: Boolean(txn.invoiceNumber),
    invoiceUrl: txn.invoiceUrl || null,
    emailSent: Boolean(txn.emailSent),
    emailSentAt: txn.emailSentAt || null,
    paymentDate: txn.paymentDate || null,
    updatedAt: txn.updatedAt || null,

    billing: {
      name: txn.billingName || null,
      email: txn.billingEmail || null,
      mobile: txn.billingMobile || null,
      address: txn.billingAddress || null,
      city: txn.billingCity || null,
      state: txn.billingState || null,
      country: txn.billingCountry || null,
      pincode: txn.billingPincode || null,
    },

    customer: toUserBrief(txn.userId),
    buyer: toUserBrief(txn.buyerId),
    seller: toUserBrief(txn.sellerId),
    product: toProductBrief(txn.productId),
    package: toPackageBrief(txn.packageId),
    storageFacility: toFacilityBrief(txn.storagefacilitiesId),
    metadata: txn.metadata || null,

    orderPlatform: platform,
    orderPlatformLabel: platformLabel(platform),
    gatewayResponse: sanitizeGatewayResponse(txn.gatewayResponse),

    logs: (logs || []).map((log) => ({
      id: String(log._id),
      activity: log.activity || null,
      description: log.description || null,
      paymentStatus: log.paymentStatus || null,
      paymentMethod: normalizePaymentMethod(log.paymentMethod) || log.paymentMethod || null,
      failureReason: log.failureReason || null,
      gatewayStatus: log.gatewayStatus || null,
      amount: Number(log.amount ?? 0),
      currency: log.currency || 'AED',
      createdAt: log.createdAt || null,
    })),
  }
}

function toPaginatedAdminTransactionsResponse(result) {
  const { items, total, page, limit } = result
  return {
    transactions: (items || []).map(toAdminTransactionListDto),
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / Math.max(limit, 1)), 1),
    hasMore: (page - 1) * limit + (items?.length || 0) < total,
  }
}

function toAdminTransactionStatsDto(stats) {
  return {
    totalTransactions: Number(stats.totalTransactions ?? 0),
    successfulTransactions: Number(stats.successfulTransactions ?? 0),
    failedTransactions: Number(stats.failedTransactions ?? 0),
    pendingTransactions: Number(stats.pendingTransactions ?? 0),
    totalTransactionAmount: Number(stats.totalTransactionAmount ?? 0),
    currency: stats.currency || 'AED',
  }
}

function formatExcelDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

/** Flat rows for Excel export — column order matches the admin list. */
function toAdminTransactionExcelRows(items = []) {
  return (items || []).map((txn) => {
    const row = toAdminTransactionListDto(txn)
    return {
      'Transaction ID': row.transactionId || '',
      'Order ID': row.orderId || '',
      'Customer Name': row.customerName || '',
      'Customer Email': row.customerEmail || '',
      'Order Amount': row.amount,
      Currency: row.currency || 'AED',
      'Payment Status': row.paymentStatus || '',
      'Payment Method': row.paymentMethod || '',
      'Order Platform': row.orderPlatformLabel || '',
      'Gateway Transaction ID': row.gatewayTransactionId || '',
      'Gateway Name': row.gatewayName || '',
      'Payment Type': row.paymentTypeLabel || '',
      'Transaction Date & Time': formatExcelDate(row.transactionDate),
      'Failure Reason': txn.failureMessage || '',
      'Bank Ref No': txn.bankRefNo || '',
      'Invoice Number': txn.invoiceNumber || '',
    }
  })
}

module.exports = {
  toAdminTransactionListDto,
  toAdminTransactionDetailDto,
  toPaginatedAdminTransactionsResponse,
  toAdminTransactionStatsDto,
  toAdminTransactionExcelRows,
}
