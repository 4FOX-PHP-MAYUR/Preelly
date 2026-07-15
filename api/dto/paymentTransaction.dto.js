/** Client-safe view of a transaction — powers the success/failure pages.
 *  Deliberately omits encRequest/encResponse and the raw gatewayResponse. */
function toPaymentTransactionDto(txn) {
  if (!txn) return null
  const product = txn.productId && typeof txn.productId === 'object' ? txn.productId : null
  const pkg = txn.packageId && typeof txn.packageId === 'object' ? txn.packageId : null
  const facility = txn.storagefacilitiesId && typeof txn.storagefacilitiesId === 'object' ? txn.storagefacilitiesId : null

  return {
    orderId: txn.orderId,
    trackingId: txn.trackingId || null,
    bankRefNo: txn.bankRefNo || null,
    orderStatus: txn.orderStatus,
    gatewayName: txn.gatewayName,
    paymentMode: txn.paymentMode || null,
    failureMessage: txn.failureMessage || null,
    currency: txn.currency,
    amount: Number(txn.amount ?? 0),
    discountAmount: Number(txn.discountAmount ?? 0),
    couponCode: txn.couponCode || null,
    paymentDate: txn.paymentDate || null,
    isVerified: Boolean(txn.isVerified),
    invoiceNumber: txn.invoiceNumber || null,
    // BASE_URL-based authenticated download endpoint (never the file path).
    invoiceUrl: txn.invoiceUrl || null,
    // Whether an invoice is available to download (path itself is never exposed).
    hasInvoice: Boolean(txn.invoiceNumber),
    emailSent: Boolean(txn.emailSent),
    product: product
      ? { id: String(product._id), title: product.title, image: product.images?.[0] || product.videoScreenshots?.[0]?.image || null }
      : (txn.productId ? { id: String(txn.productId) } : null),
    package: pkg
      ? { id: String(pkg._id), packageName: pkg.packageName, packageAmount: Number(pkg.packageAmount ?? 0) }
      : (txn.packageId ? { id: String(txn.packageId) } : null),
    storageFacility: facility
      ? { id: String(facility._id), facilityWeek: facility.facilityWeek, facilityAmount: Number(facility.facilityAmount ?? 0) }
      : null,
  }
}

module.exports = { toPaymentTransactionDto }
