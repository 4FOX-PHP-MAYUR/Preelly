const crypto = require('crypto')
const AppError = require('../errors/AppError')
const couponRepository = require('../repositories/couponRepository')
const Coupon = require('../../models/Coupon')
const Product = require('../../models/Product')

const {
  DISCOUNT_TYPES,
  APPLICABLE_TYPES,
  USER_ELIGIBILITY,
  COUPON_TYPES,
} = Coupon

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 — avoids misreads
const CODE_LENGTH = 8

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return value !== false && value !== 'false' && value !== 0 && value !== '0'
}

function parseNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeCode(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

function generateCode(length = CODE_LENGTH) {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return out
}

/** Generates a code that isn't already taken by a live coupon. */
async function generateUniqueCode(length = CODE_LENGTH) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateCode(length)
    const existing = await couponRepository.findByCode(code)
    if (!existing) return code
  }
  throw new AppError('Could not generate a unique coupon code, please retry', 500, 'CODE_GENERATION_FAILED')
}

// ── Validation of admin input ────────────────────────────────────────────────

function assertCouponName(value) {
  const name = String(value ?? '').trim()
  if (!name) throw new AppError('Coupon name is required', 400, 'VALIDATION_ERROR')
  if (name.length > 100) throw new AppError('Coupon name cannot exceed 100 characters', 400, 'VALIDATION_ERROR')
  return name
}

function assertCouponCode(value) {
  const code = normalizeCode(value)
  if (!code) throw new AppError('Coupon code is required', 400, 'VALIDATION_ERROR')
  if (code.length > 20) throw new AppError('Coupon code cannot exceed 20 characters', 400, 'VALIDATION_ERROR')
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    throw new AppError('Coupon code cannot contain spaces or special characters', 400, 'VALIDATION_ERROR')
  }
  return code
}

function assertDiscount({ discountType, discountValue, maximumDiscount }) {
  if (!DISCOUNT_TYPES.includes(discountType)) {
    throw new AppError('Discount type must be percentage or fixed', 400, 'VALIDATION_ERROR')
  }
  const value = parseNumber(discountValue, NaN)
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError('Discount value must be greater than 0', 400, 'VALIDATION_ERROR')
  }
  if (discountType === 'percentage' && value > 100) {
    throw new AppError('Percentage discount cannot exceed 100', 400, 'VALIDATION_ERROR')
  }

  // A cap only means anything for percentage coupons.
  let cap = null
  if (discountType === 'percentage') {
    cap = parseNumber(maximumDiscount, null)
    if (cap !== null && cap <= 0) {
      throw new AppError('Maximum discount must be greater than 0', 400, 'VALIDATION_ERROR')
    }
  }

  return { discountType, discountValue: round2(value), maximumDiscount: cap }
}

function assertDates({ startDate, endDate }) {
  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null
  if (!start || Number.isNaN(start.getTime())) {
    throw new AppError('A valid start date is required', 400, 'VALIDATION_ERROR')
  }
  if (!end || Number.isNaN(end.getTime())) {
    throw new AppError('A valid end date is required', 400, 'VALIDATION_ERROR')
  }
  if (end.getTime() < start.getTime()) {
    throw new AppError('End date cannot be before start date', 400, 'VALIDATION_ERROR')
  }
  return { startDate: start, endDate: end }
}

function assertApplicability({ applicableType, applicableIds }) {
  // Matches the schema default — omitting it means "all packages", not an error.
  const type = applicableType == null || applicableType === '' ? 'all_packages' : applicableType
  if (!APPLICABLE_TYPES.includes(type)) {
    throw new AppError('Invalid "Applicable For" selection', 400, 'VALIDATION_ERROR')
  }
  const ids = Array.isArray(applicableIds) ? applicableIds.filter(Boolean) : []
  const needsIds = type.startsWith('selected_')
  if (needsIds && ids.length === 0) {
    throw new AppError('Select at least one item for the chosen "Applicable For"', 400, 'VALIDATION_ERROR')
  }
  // "all_*" types ignore any ids that were sent.
  return { applicableType: type, applicableIds: needsIds ? ids : [] }
}

function assertCouponType({ couponType, assignedUsers }) {
  const type = COUPON_TYPES.includes(couponType) ? couponType : 'public'
  const users = Array.isArray(assignedUsers) ? assignedUsers.filter(Boolean) : []
  if (type === 'private' && users.length === 0) {
    throw new AppError('Assign at least one user to a private coupon', 400, 'VALIDATION_ERROR')
  }
  return { couponType: type, assignedUsers: type === 'private' ? users : [] }
}

function buildPayload(input) {
  const discount = assertDiscount(input)
  const dates = assertDates(input)
  const applicability = assertApplicability(input)
  const couponTyping = assertCouponType(input)

  const minimumOrderAmount = parseNumber(input.minimumOrderAmount, null)
  if (minimumOrderAmount !== null && minimumOrderAmount < 0) {
    throw new AppError('Minimum order amount cannot be negative', 400, 'VALIDATION_ERROR')
  }

  const usageLimit = parseNumber(input.usageLimit, null)
  if (usageLimit !== null && usageLimit < 1) {
    throw new AppError('Usage limit must be at least 1', 400, 'VALIDATION_ERROR')
  }

  const usagePerUser = parseNumber(input.usagePerUser, null)
  if (usagePerUser !== null && usagePerUser < 1) {
    throw new AppError('Usage per user must be at least 1', 400, 'VALIDATION_ERROR')
  }

  return {
    couponName: assertCouponName(input.couponName),
    description: input.description ? String(input.description).trim() : null,
    ...discount,
    minimumOrderAmount,
    ...dates,
    usageLimit,
    usagePerUser,
    ...applicability,
    userEligibility: USER_ELIGIBILITY.includes(input.userEligibility) ? input.userEligibility : 'everyone',
    ...couponTyping,
    stackable: parseBoolean(input.stackable, false),
    terms: input.terms ? String(input.terms).trim() : null,
    status: parseBoolean(input.status, true),
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

async function listCoupons(params) {
  return couponRepository.findPaginated(params)
}

async function getCouponById(id) {
  const coupon = await couponRepository.findById(id)
  if (!coupon) throw new AppError('Coupon not found', 404, 'COUPON_NOT_FOUND')
  return coupon
}

async function createCoupon(input, actorId = null) {
  const couponCode = assertCouponCode(input.couponCode)

  const duplicate = await couponRepository.findByCode(couponCode)
  if (duplicate) {
    throw new AppError('A coupon with this code already exists', 400, 'DUPLICATE_COUPON_CODE')
  }

  return couponRepository.create({
    ...buildPayload(input),
    couponCode,
    usedCount: 0,
    createdBy: actorId,
    updatedBy: actorId,
  })
}

async function updateCoupon(id, input, actorId = null) {
  const existing = await couponRepository.findById(id)
  if (!existing) throw new AppError('Coupon not found', 404, 'COUPON_NOT_FOUND')

  // Business rule: once expired, only the status may change.
  const isExpired = existing.endDate && new Date(existing.endDate).getTime() < Date.now()
  if (isExpired) {
    const touchesMoreThanStatus = Object.keys(input).some(
      (key) => !['status'].includes(key)
    )
    if (touchesMoreThanStatus) {
      throw new AppError('An expired coupon can only have its status changed', 400, 'COUPON_EXPIRED')
    }
    const updated = await couponRepository.updateById(id, {
      status: parseBoolean(input.status, existing.status),
      updatedBy: actorId,
    })
    return updated
  }

  const couponCode = input.couponCode !== undefined ? assertCouponCode(input.couponCode) : existing.couponCode
  if (input.couponCode !== undefined) {
    const duplicate = await couponRepository.findByCode(couponCode, id)
    if (duplicate) {
      throw new AppError('A coupon with this code already exists', 400, 'DUPLICATE_COUPON_CODE')
    }
  }

  // Merge over the existing doc so partial updates still validate as a whole
  // (e.g. changing only endDate must still be checked against startDate).
  const merged = { ...existing, ...input }
  const payload = buildPayload(merged)

  const updated = await couponRepository.updateById(id, {
    ...payload,
    couponCode,
    updatedBy: actorId,
  })
  if (!updated) throw new AppError('Coupon not found', 404, 'COUPON_NOT_FOUND')
  return updated
}

async function setCouponStatus(id, status, actorId = null) {
  const updated = await couponRepository.updateStatusById(id, parseBoolean(status, true), actorId)
  if (!updated) throw new AppError('Coupon not found', 404, 'COUPON_NOT_FOUND')
  return updated
}

async function deleteCoupon(id, actorId = null) {
  const existing = await couponRepository.findById(id)
  if (!existing) throw new AppError('Coupon not found', 404, 'COUPON_NOT_FOUND')

  // Business rule: a coupon that has been redeemed is kept for reporting integrity.
  if ((existing.usedCount ?? 0) > 0) {
    throw new AppError('This coupon has already been used and cannot be deleted — deactivate it instead', 400, 'COUPON_IN_USE')
  }

  return couponRepository.softDeleteById(id, actorId)
}

// ── Validation / redemption (frontend-facing) ────────────────────────────────

function computeDiscount(coupon, orderAmount) {
  const amount = round2(orderAmount)
  let discount = coupon.discountType === 'percentage'
    ? round2((amount * Number(coupon.discountValue)) / 100)
    : round2(Number(coupon.discountValue))

  // Percentage discounts respect the cap.
  if (coupon.discountType === 'percentage' && coupon.maximumDiscount != null) {
    discount = Math.min(discount, round2(Number(coupon.maximumDiscount)))
  }
  // A discount can never exceed what's being paid.
  discount = Math.min(discount, amount)
  return round2(Math.max(discount, 0))
}

/**
 * Checks a coupon against an order and returns the discount it would give.
 * Throws AppError with a human-readable reason when it doesn't apply.
 */
async function validateCoupon({
  couponCode,
  userId,
  packageId,
  storageFacilityId,
  categoryId,
  categoryIds,
  orderAmount,
}) {
  // A listing sits in a category *and* a subcategory — a category-scoped coupon may
  // target either, so match against every id the listing belongs to.
  const listingCategoryIds = [
    ...(Array.isArray(categoryIds) ? categoryIds : []),
    ...(categoryId ? [categoryId] : []),
  ]
    .filter(Boolean)
    .map(String)

  const code = normalizeCode(couponCode)
  if (!code) throw new AppError('Coupon code is required', 400, 'VALIDATION_ERROR')

  const amount = parseNumber(orderAmount, NaN)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('A valid order amount is required', 400, 'VALIDATION_ERROR')
  }

  const coupon = await couponRepository.findByCode(code)
  if (!coupon) throw new AppError('This coupon code is not valid', 404, 'COUPON_NOT_FOUND')
  if (!coupon.status) throw new AppError('This coupon is no longer active', 400, 'COUPON_INACTIVE')

  const now = Date.now()
  if (coupon.startDate && new Date(coupon.startDate).getTime() > now) {
    throw new AppError('This coupon is not active yet', 400, 'COUPON_NOT_STARTED')
  }
  if (coupon.endDate && new Date(coupon.endDate).getTime() < now) {
    throw new AppError('This coupon has expired', 400, 'COUPON_EXPIRED')
  }

  if (coupon.usageLimit != null && (coupon.usedCount ?? 0) >= coupon.usageLimit) {
    throw new AppError('This coupon has reached its usage limit', 400, 'COUPON_LIMIT_REACHED')
  }

  if (coupon.minimumOrderAmount != null && amount < coupon.minimumOrderAmount) {
    throw new AppError(
      `This coupon requires a minimum order of ${coupon.minimumOrderAmount}`,
      400,
      'MINIMUM_ORDER_NOT_MET'
    )
  }

  if (userId) {
    if (coupon.couponType === 'private') {
      const assigned = (coupon.assignedUsers || []).some((u) => String(u) === String(userId))
      if (!assigned) throw new AppError('This coupon is not available for your account', 403, 'COUPON_NOT_ASSIGNED')
    }

    if (coupon.usagePerUser != null) {
      const used = await couponRepository.countUserRedemptions(coupon._id, userId)
      if (used >= coupon.usagePerUser) {
        throw new AppError('You have already used this coupon', 400, 'USER_LIMIT_REACHED')
      }
    }

    if (coupon.userEligibility !== 'everyone') {
      const hasListings = await Product.exists({ seller: userId })
      const isNewUser = !hasListings
      if (coupon.userEligibility === 'new_users' && !isNewUser) {
        throw new AppError('This coupon is only for new users', 400, 'NOT_NEW_USER')
      }
      if (coupon.userEligibility === 'existing_users' && isNewUser) {
        throw new AppError('This coupon is only for existing users', 400, 'NOT_EXISTING_USER')
      }
    }
  }

  // Applicability
  const ids = (coupon.applicableIds || []).map(String)
  const type = coupon.applicableType
  if (type === 'selected_packages') {
    if (!packageId || !ids.includes(String(packageId))) {
      throw new AppError('This coupon does not apply to the selected package', 400, 'NOT_APPLICABLE')
    }
  } else if (type === 'selected_storage_facilities') {
    if (!storageFacilityId || !ids.includes(String(storageFacilityId))) {
      throw new AppError('This coupon does not apply to the selected storage facility', 400, 'NOT_APPLICABLE')
    }
  } else if (type === 'selected_categories') {
    const matches = listingCategoryIds.some((cid) => ids.includes(cid))
    if (!matches) {
      throw new AppError('This coupon does not apply to this category', 400, 'NOT_APPLICABLE')
    }
  } else if (type === 'all_storage_facilities' && !storageFacilityId) {
    throw new AppError('This coupon only applies to storage facility purchases', 400, 'NOT_APPLICABLE')
  }

  const discountAmount = computeDiscount(coupon, amount)
  const finalAmount = round2(amount - discountAmount)

  return {
    valid: true,
    couponId: String(coupon._id),
    couponCode: coupon.couponCode,
    couponName: coupon.couponName,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    orderAmount: round2(amount),
    discountAmount,
    finalAmount,
    stackable: Boolean(coupon.stackable),
    message: 'Coupon applied successfully',
  }
}

/**
 * Records a redemption after a successful payment. Claims the usage slot
 * atomically first, then writes the ledger row — releasing the slot if that fails,
 * so a crash can't silently burn a use.
 */
async function redeemCoupon({ couponId, userId, productId, orderAmount, discountAmount }) {
  const claimed = await couponRepository.claimUsage(couponId)
  if (!claimed) {
    throw new AppError('This coupon is no longer available', 400, 'COUPON_UNAVAILABLE')
  }

  try {
    return await couponRepository.createRedemption({
      coupon: claimed._id,
      couponCode: claimed.couponCode,
      user: userId,
      product: productId || null,
      orderAmount: round2(orderAmount ?? 0),
      discountAmount: round2(discountAmount ?? 0),
      finalAmount: round2((orderAmount ?? 0) - (discountAmount ?? 0)),
    })
  } catch (error) {
    await couponRepository.releaseUsage(claimed._id)
    // Duplicate key = the coupon was already applied to this order.
    if (error.code === 11000) {
      throw new AppError('This coupon has already been applied to this order', 400, 'COUPON_ALREADY_APPLIED')
    }
    throw error
  }
}

/** Cron sweep — flips expired coupons to inactive. */
async function deactivateExpiredCoupons() {
  return couponRepository.deactivateExpired()
}

module.exports = {
  DISCOUNT_TYPES,
  APPLICABLE_TYPES,
  USER_ELIGIBILITY,
  COUPON_TYPES,
  generateUniqueCode,
  computeDiscount,
  listCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  setCouponStatus,
  deleteCoupon,
  validateCoupon,
  redeemCoupon,
  deactivateExpiredCoupons,
}
