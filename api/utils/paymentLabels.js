/**
 * Shared labels / normalizers for payment transactions (admin + gateway callback).
 * Kept free of Express/Mongoose so it can be reused from services and DTOs.
 */

const PAYMENT_FROM = Object.freeze({
  WEB: 1,
  IOS: 2,
  ANDROID: 3,
})

const PLATFORM_LABELS = Object.freeze({
  web: 'Web',
  ios: 'iOS',
  android: 'Android',
})

const PAYMENT_METHOD_OPTIONS = Object.freeze([
  'UPI',
  'Credit Card',
  'Debit Card',
  'Net Banking',
  'Wallet',
  'COD',
  'Other',
])

const PAYMENT_STATUS_UI = Object.freeze({
  SUCCESS: 'Success',
  FAILED: 'Failed',
  CANCELLED: 'Failed',
  PENDING: 'Pending',
  INITIATED: 'Pending',
})

function resolveOrderPlatform(req = {}) {
  const xPlatform = String(req.headers?.['x-platform'] || '').trim().toLowerCase()
  if (xPlatform === 'ios' || xPlatform === 'android' || xPlatform === 'web') {
    return xPlatform
  }

  if (req.platform === 'web') return 'web'

  const ua = String(req.headers?.['user-agent'] || '').toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'

  // Mobile auth sets req.platform = 'mobile' without ios/android — treat as Android default
  // only when UA is unavailable; prefer Web for unknown desktop agents.
  if (req.platform === 'mobile') {
    if (/iphone|ipad|ipod|ios/.test(ua)) return 'ios'
    return 'android'
  }

  return 'web'
}

function platformToPaymentFrom(platform) {
  const p = String(platform || '').toLowerCase()
  if (p === 'ios') return PAYMENT_FROM.IOS
  if (p === 'android') return PAYMENT_FROM.ANDROID
  return PAYMENT_FROM.WEB
}

function paymentFromToPlatform(paymentFrom) {
  const n = Number(paymentFrom)
  if (n === PAYMENT_FROM.IOS) return 'ios'
  if (n === PAYMENT_FROM.ANDROID) return 'android'
  return 'web'
}

function platformLabel(platform) {
  const key = String(platform || 'web').toLowerCase()
  return PLATFORM_LABELS[key] || PLATFORM_LABELS.web
}

/**
 * Normalize gateway payment_mode strings into a stable display vocabulary.
 * Unknown values are returned title-cased rather than dropped.
 */
function normalizePaymentMethod(raw) {
  if (raw == null || String(raw).trim() === '') return null
  const s = String(raw).trim().toLowerCase()

  if (/^cod$|cash.?on.?delivery|cash on delivery/.test(s)) return 'COD'
  if (/upi|unified.?payment|bhim/.test(s)) return 'UPI'
  if (/debit/.test(s)) return 'Debit Card'
  if (/credit|visa|master|amex|american.?express/.test(s)) return 'Credit Card'
  if (/net.?bank|\bnb\b|internet.?bank/.test(s)) return 'Net Banking'
  if (/wallet|paytm|phonepe|amazon.?pay|mobikwik|freecharge|paypal/.test(s)) return 'Wallet'
  if (/\bcard\b|ccavenue/.test(s)) return 'Credit Card'

  // Preserve gateway-specific labels when they don't match known buckets.
  return String(raw).trim().replace(/\s+/g, ' ')
}

function paymentStatusLabel(orderStatus) {
  const key = String(orderStatus || '').toUpperCase()
  return PAYMENT_STATUS_UI[key] || 'Pending'
}

function paymentStatusBadge(orderStatus) {
  const label = paymentStatusLabel(orderStatus)
  if (label === 'Success') return 'success'
  if (label === 'Failed') return 'failed'
  return 'pending'
}

/** Map UI filter values (Success|Failed|Pending) → orderStatus values. */
function orderStatusesForPaymentStatusFilter(paymentStatus) {
  const key = String(paymentStatus || '').toLowerCase()
  if (key === 'success') return ['SUCCESS']
  if (key === 'failed') return ['FAILED', 'CANCELLED']
  if (key === 'pending') return ['PENDING', 'INITIATED']
  return null
}

function paymentFromForPlatformFilter(platform) {
  const p = String(platform || '').toLowerCase()
  if (p === 'ios') return PAYMENT_FROM.IOS
  if (p === 'android') return PAYMENT_FROM.ANDROID
  if (p === 'web') return PAYMENT_FROM.WEB
  return null
}

module.exports = {
  PAYMENT_FROM,
  PLATFORM_LABELS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_UI,
  resolveOrderPlatform,
  platformToPaymentFrom,
  paymentFromToPlatform,
  platformLabel,
  normalizePaymentMethod,
  paymentStatusLabel,
  paymentStatusBadge,
  orderStatusesForPaymentStatusFilter,
  paymentFromForPlatformFilter,
}
