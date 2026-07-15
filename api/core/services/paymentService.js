const crypto = require('crypto')
const mongoose = require('mongoose')
const AppError = require('../errors/AppError')
const PaymentTransaction = require('../../models/PaymentTransaction')
const Product = require('../../models/Product')
const Package = require('../../models/Package')
const StorageFacility = require('../../models/StorageFacility')
const checkoutService = require('./checkoutService')
const couponService = require('./couponService')
const invoiceService = require('./invoiceService')
const paymentEmailService = require('./paymentEmailService')
const PaymentLog = require('../../models/PaymentLog')
const ccavenueGateway = require('../gateways/ccavenueGateway')
const logger = require('../../utils/paymentLogger')

const gateways = { CCAvenue: ccavenueGateway }
const DEFAULT_GATEWAY = 'CCAvenue'

function round2(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100
}

function generateOrderId() {
  // PRLY + base36 time + random — short, unique, human-scannable in logs.
  return `PRLY${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

/**
 * Runs `fn(session)` inside a transaction when the deployment supports one
 * (replica set / Atlas). On a standalone Mongo — where transactions throw — it
 * runs `fn(null)` directly; the callback path is written to be idempotent and
 * re-entrant so this is safe either way.
 */
// Standalone Mongo rejects transactions/retryable writes with one of these; on any
// of them we re-run without a session. The transaction aborts first, so nothing was
// committed and re-running is safe.
const TXN_UNSUPPORTED = /Transaction numbers|replica set|does not support|not supported|retryable writes|mongos|Current topology/i

async function runInSession(fn) {
  let session = null
  try {
    session = await mongoose.startSession()
    session.startTransaction()
  } catch {
    if (session) { try { session.endSession() } catch { /* noop */ } }
    return fn(null)
  }

  try {
    const result = await fn(session)
    await session.commitTransaction()
    session.endSession()
    return result
  } catch (err) {
    try { await session.abortTransaction() } catch { /* noop */ }
    try { session.endSession() } catch { /* noop */ }
    if (TXN_UNSUPPORTED.test(err.message || '')) return fn(null)
    throw err
  }
}

// ── Initiate ─────────────────────────────────────────────────────────────────

/**
 * Validates the order, computes the authoritative amount, creates an INITIATED
 * transaction, and returns the encrypted gateway redirect. The client never
 * supplies the amount — it is always recomputed here.
 */
async function initiatePayment({
  userId,
  user,
  productId,
  packageId,
  storageFacilityId = null,
  couponCode = null,
  gatewayName = DEFAULT_GATEWAY,
  baseUrl,
  frontendUrl,
  context = {},
}) {
  const gateway = gateways[gatewayName]
  if (!gateway) throw new AppError('Unsupported payment gateway', 400, 'GATEWAY_UNSUPPORTED')

  if (!productId) throw new AppError('productId is required', 400, 'VALIDATION_ERROR')
  if (!packageId) throw new AppError('packageId is required', 400, 'VALIDATION_ERROR')

  const product = await Product.findById(productId).select('_id seller title category subcategory').lean()
  if (!product) throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND')
  if (String(product.seller) !== String(userId)) {
    throw new AppError('You can only pay for your own listing', 403, 'FORBIDDEN')
  }

  const pkg = await Package.findOne({ _id: packageId, isDeleted: false, status: true }).lean()
  if (!pkg) throw new AppError('Package not found or inactive', 404, 'PACKAGE_NOT_FOUND')

  if (storageFacilityId) {
    const facility = await StorageFacility.findOne({ _id: storageFacilityId, isDeleted: false, status: true }).lean()
    if (!facility) throw new AppError('Storage facility not found or inactive', 404, 'STORAGE_FACILITY_NOT_FOUND')
  }

  // Authoritative amount — package + storage + VAT, computed server-side.
  const summary = await checkoutService.getCheckoutSummary({
    productId,
    packageId,
    storageFacilityId,
    userId,
  })

  // Optional coupon — validated here so the discount can't be spoofed.
  let couponId = null
  let discountAmount = 0
  let normalizedCoupon = null
  if (couponCode) {
    const result = await couponService.validateCoupon({
      couponCode,
      userId,
      packageId,
      storageFacilityId,
      categoryIds: [product.category, product.subcategory].filter(Boolean).map(String),
      orderAmount: summary.summary.packageAmount + summary.summary.storageAmount,
    })
    couponId = result.couponId
    discountAmount = result.discountAmount
    normalizedCoupon = result.couponCode
  }

  // Discount applies pre-VAT; VAT is charged on the discounted base.
  const preTaxBase = round2(summary.summary.packageAmount + summary.summary.storageAmount - discountAmount)
  const vatValue = round2((preTaxBase * summary.summary.vatPercentage) / 100)
  const amount = round2(preTaxBase + vatValue)

  if (!(amount > 0)) throw new AppError('Payable amount must be greater than 0', 400, 'INVALID_AMOUNT')

  // Unique order id — retry on the rare collision.
  let orderId = generateOrderId()
  for (let i = 0; i < 5; i += 1) {
    const clash = await PaymentTransaction.exists({ orderId })
    if (!clash) break
    orderId = generateOrderId()
  }

  const billing = {
    name: user?.name || 'Customer',
    email: user?.email || '',
    mobile: user?.phone || '',
    country: 'United Arab Emirates',
  }

  const redirect = gateway.buildRedirect({
    orderId,
    amount,
    currency: summary.summary.currency || 'AED',
    redirectUrl: `${baseUrl}/api/payment/${gatewayName.toLowerCase()}/callback`,
    cancelUrl: `${baseUrl}/api/payment/${gatewayName.toLowerCase()}/callback`,
    billing,
    merchantParams: { p1: orderId, p2: String(productId) },
  })

  const txn = await PaymentTransaction.create({
    userId,
    productId,
    packageId,
    storagefacilitiesId: storageFacilityId || null,
    couponId,
    couponCode: normalizedCoupon,
    discountAmount,
    orderId,
    merchantId: gateway.getConfig().merchantId,
    currency: summary.summary.currency || 'AED',
    amount,
    orderStatus: 'INITIATED',
    gatewayName,
    billingName: billing.name,
    billingEmail: billing.email,
    billingMobile: billing.mobile,
    billingCountry: billing.country,
    encRequest: redirect.encRequest,
  })

  logger.info('payment.initiated', {
    orderId, userId: String(userId), productId: String(productId),
    packageId: String(packageId), storageFacilityId: storageFacilityId ? String(storageFacilityId) : null,
    amount, couponCode: normalizedCoupon,
  })

  // Log the attempt immediately — so every initiation is on record even if the
  // gateway callback never arrives (e.g. the user abandons, or CCAvenue can't
  // reach the callback URL in local/dev). Best effort; never blocks the payment.
  await writePaymentLog({
    txn,
    context: { ...context, requestTime: txn.createdAt },
    activity: 'Payment Initiated',
    description: 'User initiated payment through CCAvenue.',
  })

  // frontendUrl retained so the caller can build success/failure links if needed.
  return {
    orderId,
    amount,
    currency: summary.summary.currency || 'AED',
    paymentUrl: redirect.paymentUrl,
    accessCode: redirect.accessCode,
    encRequest: redirect.encRequest,
    frontendUrl,
  }
}

// ── Callback ─────────────────────────────────────────────────────────────────

/**
 * Processes a decrypted gateway callback. Idempotent: a duplicate callback for an
 * already-finalized order is ignored. Only ever trusts the decrypted response.
 */
async function processCallback({ gatewayName = DEFAULT_GATEWAY, encResponse, context = {} }) {
  const gateway = gateways[gatewayName]
  if (!gateway) throw new AppError('Unsupported payment gateway', 400, 'GATEWAY_UNSUPPORTED')
  if (!encResponse) throw new AppError('Missing gateway response', 400, 'MISSING_RESPONSE')

  let parsed
  try {
    parsed = gateway.parseCallback(encResponse)
  } catch (err) {
    logger.error('payment.decrypt_failed', { gatewayName, message: err.message })
    throw new AppError('Could not decrypt gateway response', 400, 'DECRYPT_FAILED')
  }

  const { normalized, response } = parsed
  const { orderId } = normalized
  logger.info('payment.callback_received', {
    orderId, trackingId: normalized.trackingId,
    gatewayStatus: normalized.gatewayOrderStatus, amount: normalized.amount,
  })

  if (!orderId) throw new AppError('Callback missing order id', 400, 'INVALID_CALLBACK')

  const txn = await PaymentTransaction.findOne({ orderId })
  if (!txn) {
    logger.error('payment.unknown_order', { orderId })
    throw new AppError('Unknown order', 404, 'ORDER_NOT_FOUND')
  }

  // Idempotency: a finalized, verified order ignores repeat callbacks.
  if (txn.isVerified && ['SUCCESS', 'FAILED', 'CANCELLED'].includes(txn.orderStatus)) {
    logger.info('payment.duplicate_ignored', { orderId, status: txn.orderStatus })
    return { txn, status: txn.orderStatus, duplicate: true }
  }

  // Amount tamper check — the gateway must echo the amount we asked for.
  const amountMatches =
    normalized.amount == null || Math.abs(round2(normalized.amount) - round2(txn.amount)) < 0.01

  // Always persist the raw audit trail regardless of outcome.
  txn.trackingId = normalized.trackingId || txn.trackingId
  txn.bankRefNo = normalized.bankRefNo || txn.bankRefNo
  txn.paymentMode = normalized.paymentMode || txn.paymentMode
  txn.gatewayOrderStatus = normalized.gatewayOrderStatus || txn.gatewayOrderStatus
  txn.gatewayResponse = response
  txn.encResponse = encResponse
  txn.paymentDate = new Date()
  if (normalized.billing) {
    txn.billingName = normalized.billing.name || txn.billingName
    txn.billingEmail = normalized.billing.email || txn.billingEmail
    txn.billingMobile = normalized.billing.mobile || txn.billingMobile
    txn.billingAddress = normalized.billing.address || txn.billingAddress
    txn.billingCity = normalized.billing.city || txn.billingCity
    txn.billingState = normalized.billing.state || txn.billingState
    txn.billingCountry = normalized.billing.country || txn.billingCountry
    txn.billingPincode = normalized.billing.pincode || txn.billingPincode
  }

  let finalStatus = normalized.orderStatus
  if (finalStatus === 'SUCCESS' && !amountMatches) {
    // Paid, but not the amount we asked for → treat as failed, don't fulfil.
    finalStatus = 'FAILED'
    txn.failureMessage = `Amount mismatch: expected ${txn.amount}, received ${normalized.amount}`
    logger.error('payment.amount_mismatch', { orderId, expected: txn.amount, received: normalized.amount })
  } else if (finalStatus !== 'SUCCESS') {
    txn.failureMessage = normalized.failureMessage || `Payment ${finalStatus.toLowerCase()}`
  }

  if (finalStatus !== 'SUCCESS') {
    txn.orderStatus = finalStatus
    txn.isVerified = true
    await txn.save()
    logger.info('payment.finalized', { orderId, status: finalStatus })
    // Log the attempt (failure / cancelled / pending). Product is NOT touched.
    const copy = LOG_COPY[finalStatus] || LOG_COPY.PENDING
    await writePaymentLog({ txn, context, activity: copy.activity, description: copy.description })
    return { txn, status: finalStatus, duplicate: false }
  }

  // ── Success: fulfil the order atomically (or idempotently on standalone Mongo) ──
  await runInSession(async (session) => {
    const opts = session ? { session } : {}

    // Activate the package on the listing + link storage facility.
    await Product.updateOne(
      { _id: txn.productId },
      {
        $set: {
          isPaymentDone: 1,
          package: txn.packageId,
          storageFacility: txn.storagefacilitiesId || null,
          paymentTransaction: txn._id,
        },
      },
      opts
    )

    // Redeem the coupon (records usage; the coupon+product unique index makes this
    // safe against a duplicate callback slipping through).
    if (txn.couponId) {
      try {
        await couponService.redeemCoupon({
          couponId: txn.couponId,
          userId: txn.userId,
          productId: txn.productId,
          orderAmount: txn.amount + txn.discountAmount,
          discountAmount: txn.discountAmount,
        })
      } catch (err) {
        if (err.code !== 'COUPON_ALREADY_APPLIED') throw err
      }
    }

    txn.orderStatus = 'SUCCESS'
    txn.isVerified = true
    await txn.save(opts)
  })

  logger.info('payment.success', { orderId, trackingId: txn.trackingId, amount: txn.amount })

  // Post-success side effects — best effort, never roll back the payment.
  const { invoiceGenerated, emailSent } = await runSuccessSideEffects(txn, context)
  await writePaymentLog({
    txn,
    context,
    activity: LOG_COPY.SUCCESS.activity,
    description: LOG_COPY.SUCCESS.description,
    invoiceGenerated,
    emailSent,
  })

  return { txn, status: 'SUCCESS', duplicate: false }
}

/**
 * Returns the invoice PDF path for a transaction the given user owns, generating
 * it on demand if the file is missing. Only SUCCESS transactions have invoices.
 */
async function getInvoiceForUser(orderId, userId, { baseUrl } = {}) {
  const txn = await PaymentTransaction.findOne({ orderId })
  if (!txn) throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND')
  if (String(txn.userId) !== String(userId)) {
    throw new AppError('Not authorized to download this invoice', 403, 'FORBIDDEN')
  }
  if (txn.orderStatus !== 'SUCCESS') {
    throw new AppError('An invoice is only available for a successful payment', 400, 'NO_INVOICE')
  }
  const invoicePath = await ensureInvoice(txn, { baseUrl })
  return { invoicePath, invoiceNumber: txn.invoiceNumber }
}

// ── Invoice / email / log side effects (post-success, never fatal) ───────────

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-AE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Resolves product/package/facility names into the flat shape invoice + email need. */
async function buildInvoiceData(txn, { baseUrl } = {}) {
  const [product, pkg, facility] = await Promise.all([
    Product.findById(txn.productId).select('title').lean(),
    Package.findById(txn.packageId).select('packageName').lean(),
    txn.storagefacilitiesId
      ? StorageFacility.findById(txn.storagefacilitiesId).select('facilityWeek').lean()
      : Promise.resolve(null),
  ])

  const subtotal = round2(txn.amount + (txn.discountAmount || 0))
  return {
    invoiceNumber: txn.invoiceNumber,
    invoiceDate: formatDateTime(txn.paymentDate || txn.createdAt),
    orderId: txn.orderId,
    trackingId: txn.trackingId,
    customerName: txn.billingName,
    customerEmail: txn.billingEmail,
    customerMobile: txn.billingMobile,
    productTitle: product?.title || null,
    packageName: pkg?.packageName || null,
    storageFacilityName: facility?.facilityWeek || null,
    paymentMethod: txn.paymentMode,
    paymentStatus: txn.orderStatus,
    paymentDate: formatDateTime(txn.paymentDate),
    currency: txn.currency,
    couponCode: txn.couponCode,
    discountAmount: Number(txn.discountAmount || 0),
    subtotal,
    grandTotal: round2(txn.amount),
    invoiceUrl: txn.invoiceUrl || (baseUrl ? `${baseUrl}/api/payment/invoice/${txn.orderId}` : null),
  }
}

/**
 * Ensures the transaction has an invoice PDF on disk. Idempotent: if the number
 * and file already exist, it's a no-op. Also used by the download route to
 * regenerate a missing file. Returns the absolute path.
 */
async function ensureInvoice(txn, { baseUrl } = {}) {
  if (txn.invoiceNumber && invoiceService.invoiceExists(txn.invoicePath)) {
    return invoiceService.resolvePath(txn.invoicePath)
  }

  // Mint a number once; reuse it if we're only regenerating the file.
  const invoiceNumber = txn.invoiceNumber || invoiceService.buildInvoiceNumber()
  txn.invoiceNumber = invoiceNumber
  const data = await buildInvoiceData(txn, { baseUrl })
  data.invoiceNumber = invoiceNumber

  const { invoicePath, fileName } = await invoiceService.generateInvoicePdf(data)

  // Store ONLY the filename; the absolute path is derived at read time.
  txn.invoicePath = fileName
  txn.invoiceUrl = (baseUrl || process.env.BASE_URL)
    ? `${baseUrl || process.env.BASE_URL}/api/payment/invoice/${txn.orderId}`
    : `/api/payment/invoice/${txn.orderId}`
  await txn.save()
  return invoicePath
}

/** Writes an append-only PaymentLog entry for any outcome. Never throws. */
async function writePaymentLog({ txn, context = {}, activity, description, invoiceGenerated = false, emailSent = false }) {
  try {
    await PaymentLog.create({
      userId: txn.userId,
      userName: txn.billingName || null,
      productId: txn.productId,
      packageId: txn.packageId,
      storagefacilitiesId: txn.storagefacilitiesId || null,
      orderId: txn.orderId,
      invoiceNumber: txn.invoiceNumber || null,
      trackingId: txn.trackingId || null,
      activity,
      description,
      paymentStatus: txn.orderStatus,
      paymentMethod: txn.paymentMode || null,
      amount: txn.amount,
      currency: txn.currency,
      gatewayName: txn.gatewayName,
      gatewayStatus: txn.gatewayOrderStatus || null,
      failureReason: txn.failureMessage || null,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      requestTime: txn.createdAt || null,
      responseTime: context.responseTime || new Date(),
      callbackTime: context.callbackTime || new Date(),
      emailSent,
      invoiceGenerated,
      gatewayResponse: txn.gatewayResponse || null,
      createdBy: txn.userId,
    })
  } catch (err) {
    logger.error('payment.log_write_failed', { orderId: txn.orderId, message: err.message })
  }
}

const LOG_COPY = {
  SUCCESS: { activity: 'Payment Successful', description: 'User successfully completed payment through CCAvenue. Product activated and invoice generated.' },
  FAILED: { activity: 'Payment Failed', description: 'Payment failed while processing through CCAvenue.' },
  CANCELLED: { activity: 'Payment Cancelled', description: 'Payment was cancelled by the user.' },
  PENDING: { activity: 'Payment Pending', description: 'Payment is pending confirmation from CCAvenue.' },
}

/**
 * Runs invoice generation + confirmation email after a verified SUCCESS.
 * Each step is independent and best-effort — a failure here NEVER rolls back the
 * payment; it is logged and the outcome recorded on the transaction.
 */
async function runSuccessSideEffects(txn, context = {}) {
  let invoiceGenerated = false
  let emailSent = false
  let invoiceAbsPath = null

  // 1) Invoice (once)
  try {
    invoiceAbsPath = await ensureInvoice(txn, context)
    invoiceGenerated = true
    logger.info('payment.invoice_generated', { orderId: txn.orderId, invoiceNumber: txn.invoiceNumber })
  } catch (err) {
    logger.error('payment.invoice_failed', { orderId: txn.orderId, message: err.message })
  }

  // 2) Confirmation email with invoice attached (once)
  if (!txn.emailSent && txn.billingEmail) {
    try {
      const data = await buildInvoiceData(txn, context)
      // nodemailer needs the absolute path for the attachment, not the stored filename.
      await paymentEmailService.sendPaymentConfirmation(data, invoiceAbsPath || invoiceService.resolvePath(txn.invoicePath))
      txn.emailSent = true
      txn.emailSentAt = new Date()
      await txn.save()
      emailSent = true
      logger.info('payment.email_sent', { orderId: txn.orderId, to: logger.redact(txn.billingEmail) })
    } catch (err) {
      logger.error('payment.email_failed', { orderId: txn.orderId, message: err.message })
    }
  } else if (txn.emailSent) {
    emailSent = true
  }

  return { invoiceGenerated, emailSent }
}

async function getTransactionForUser(orderId, userId) {
  const txn = await PaymentTransaction.findOne({ orderId })
    .populate('productId', 'title images videoScreenshots')
    .populate('packageId', 'packageName packageAmount')
    .populate('storagefacilitiesId', 'facilityWeek facilityAmount')
    .lean()
  if (!txn) throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND')
  if (userId && String(txn.userId) !== String(userId)) {
    throw new AppError('Not authorized to view this transaction', 403, 'FORBIDDEN')
  }
  return txn
}

module.exports = {
  DEFAULT_GATEWAY,
  initiatePayment,
  processCallback,
  getTransactionForUser,
  getInvoiceForUser,
}
