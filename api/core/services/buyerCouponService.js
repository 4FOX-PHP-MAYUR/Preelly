const AppError = require('../errors/AppError')
const buyerCouponRepository = require('../repositories/buyerCouponRepository')

const DISCOUNT_TYPES = ['percentage', 'fixed']

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
  return String(value ?? '').trim().toUpperCase()
}

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

function assertDiscount({ discountType, discountValue, maximumDiscountAmount }) {
  if (!DISCOUNT_TYPES.includes(discountType)) {
    throw new AppError('Invalid discount type', 400, 'VALIDATION_ERROR')
  }
  const value = parseNumber(discountValue, NaN)
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError('Discount value must be greater than 0', 400, 'VALIDATION_ERROR')
  }
  if (discountType === 'percentage') {
    if (value > 100) {
      throw new AppError('Discount percentage cannot exceed 100%', 400, 'VALIDATION_ERROR')
    }
    const max = parseNumber(maximumDiscountAmount, NaN)
    if (!Number.isFinite(max) || max <= 0) {
      throw new AppError('Maximum discount amount is required for percentage coupons', 400, 'VALIDATION_ERROR')
    }
  }
  return value
}

function assertDates({ validFrom, validTill }) {
  const from = validFrom ? new Date(validFrom) : null
  const till = validTill ? new Date(validTill) : null
  if (!from || Number.isNaN(from.getTime())) {
    throw new AppError('Valid from is required', 400, 'VALIDATION_ERROR')
  }
  if (!till || Number.isNaN(till.getTime())) {
    throw new AppError('Valid till is required', 400, 'VALIDATION_ERROR')
  }
  if (till < from) {
    throw new AppError('Valid till cannot be before valid from', 400, 'VALIDATION_ERROR')
  }
  return { validFrom: from, validTill: till }
}

function assertServiceIds(checkoutServiceIds) {
  const ids = Array.isArray(checkoutServiceIds) ? checkoutServiceIds.filter(Boolean).map(String) : []
  if (!ids.length) {
    throw new AppError('Select at least one checkout service', 400, 'VALIDATION_ERROR')
  }
  return [...new Set(ids)]
}

function buildPayload(input) {
  const { validFrom, validTill } = assertDates(input)
  return {
    couponName: assertCouponName(input.couponName),
    couponCode: assertCouponCode(input.couponCode),
    description: input.description ? String(input.description).trim() : null,
    discountType: input.discountType,
    discountValue: assertDiscount(input),
    minimumOrderAmount: parseNumber(input.minimumOrderAmount, null),
    maximumDiscountAmount:
      input.discountType === 'percentage' ? parseNumber(input.maximumDiscountAmount, null) : null,
    usageLimit: parseNumber(input.usageLimit, null),
    usageLimitPerBuyer: parseNumber(input.usageLimitPerBuyer, 1) ?? 1,
    validFrom,
    validTill,
    status: parseBoolean(input.status, true),
  }
}

async function attachServices(coupon) {
  if (!coupon) return coupon
  const checkoutServiceIds = await buyerCouponRepository.findServiceIds(coupon._id)
  return { ...coupon, checkoutServiceIds }
}

async function listBuyerCoupons(params) {
  const result = await buyerCouponRepository.findPaginated(params)
  const ids = result.items.map((c) => c._id)
  const mappings = await buyerCouponRepository.findServiceIdsForMany(ids)
  const byCoupon = mappings.reduce((acc, m) => {
    const key = String(m.couponId)
    ;(acc[key] = acc[key] || []).push(String(m.checkoutServiceId))
    return acc
  }, {})
  result.items = result.items.map((c) => ({ ...c, checkoutServiceIds: byCoupon[String(c._id)] || [] }))
  return result
}

async function getBuyerCouponById(id) {
  const coupon = await buyerCouponRepository.findById(id)
  if (!coupon) throw new AppError('Buyer coupon not found', 404, 'BUYER_COUPON_NOT_FOUND')
  return attachServices(coupon)
}

async function createBuyerCoupon(input, actorId = null) {
  const payload = buildPayload(input)
  const checkoutServiceIds = assertServiceIds(input.checkoutServiceIds)

  const duplicate = await buyerCouponRepository.existsByCode(payload.couponCode)
  if (duplicate) {
    throw new AppError('A coupon with this code already exists', 400, 'DUPLICATE_COUPON_CODE')
  }

  const coupon = await buyerCouponRepository.create({
    ...payload,
    createdBy: actorId,
    updatedBy: actorId,
  })
  await buyerCouponRepository.replaceServiceMappings(coupon._id, checkoutServiceIds)
  return attachServices(coupon)
}

async function updateBuyerCoupon(id, input, actorId = null) {
  const existing = await buyerCouponRepository.findById(id)
  if (!existing) throw new AppError('Buyer coupon not found', 404, 'BUYER_COUPON_NOT_FOUND')

  // Validate the merged document so partial updates still make sense as a whole.
  const merged = { ...existing, ...input }
  const payload = buildPayload(merged)

  if (payload.couponCode !== existing.couponCode) {
    const duplicate = await buyerCouponRepository.existsByCode(payload.couponCode, id)
    if (duplicate) {
      throw new AppError('A coupon with this code already exists', 400, 'DUPLICATE_COUPON_CODE')
    }
  }

  const updated = await buyerCouponRepository.updateById(id, { ...payload, updatedBy: actorId })
  if (!updated) throw new AppError('Buyer coupon not found', 404, 'BUYER_COUPON_NOT_FOUND')

  if (input.checkoutServiceIds !== undefined) {
    const checkoutServiceIds = assertServiceIds(input.checkoutServiceIds)
    await buyerCouponRepository.replaceServiceMappings(id, checkoutServiceIds)
  }

  return attachServices(updated)
}

async function setBuyerCouponStatus(id, status, actorId = null) {
  const updated = await buyerCouponRepository.updateStatusById(id, parseBoolean(status, true), actorId)
  if (!updated) throw new AppError('Buyer coupon not found', 404, 'BUYER_COUPON_NOT_FOUND')
  return updated
}

async function deleteBuyerCoupon(id, actorId = null) {
  const deleted = await buyerCouponRepository.softDeleteById(id, actorId)
  if (!deleted) throw new AppError('Buyer coupon not found', 404, 'BUYER_COUPON_NOT_FOUND')
  return deleted
}

function computeDiscount(coupon, amount) {
  const base = round2(amount)
  let discount = coupon.discountType === 'percentage'
    ? round2((base * Number(coupon.discountValue)) / 100)
    : round2(Number(coupon.discountValue))

  if (coupon.discountType === 'percentage' && coupon.maximumDiscountAmount != null) {
    discount = Math.min(discount, round2(Number(coupon.maximumDiscountAmount)))
  }
  // A discount can never exceed what's being charged.
  discount = Math.min(discount, base)
  return round2(Math.max(discount, 0))
}

/**
 * Validates a buyer coupon against the SELECTED checkout services only.
 * `services` is [{ checkoutServiceId, amount }] — the charges the buyer picked.
 * The coupon discounts only the eligible (mapped) checkout-service charges;
 * product prices are never involved.
 */
async function validateBuyerCoupon({ couponCode, userId, services }) {
  const code = normalizeCode(couponCode)
  if (!code) throw new AppError('Coupon code is required', 400, 'VALIDATION_ERROR')

  const selected = (Array.isArray(services) ? services : [])
    .map((s) => ({ id: String(s.checkoutServiceId ?? s.id ?? ''), amount: parseNumber(s.amount, 0) ?? 0 }))
    .filter((s) => s.id)
  if (!selected.length) {
    throw new AppError('Select a checkout service to apply this coupon', 400, 'NO_SERVICES_SELECTED')
  }

  const coupon = await buyerCouponRepository.findByCode(code)
  if (!coupon) throw new AppError('This coupon code is not valid', 404, 'COUPON_NOT_FOUND')
  if (!coupon.status) throw new AppError('This coupon is no longer active', 400, 'COUPON_INACTIVE')

  const now = Date.now()
  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > now) {
    throw new AppError('This coupon is not active yet', 400, 'COUPON_NOT_STARTED')
  }
  if (coupon.validTill && new Date(coupon.validTill).getTime() < now) {
    throw new AppError('This coupon has expired', 400, 'COUPON_EXPIRED')
  }

  // Eligibility: only the checkout services mapped to this coupon count.
  const eligibleIds = new Set(await buyerCouponRepository.findServiceIds(coupon._id))
  const eligible = selected.filter((s) => eligibleIds.has(s.id))
  if (!eligible.length) {
    throw new AppError('This coupon does not apply to the selected checkout services', 400, 'NOT_APPLICABLE')
  }
  const originalAmount = round2(eligible.reduce((sum, s) => sum + s.amount, 0))
  if (originalAmount <= 0) {
    throw new AppError('There is no eligible checkout service charge to discount', 400, 'NOT_APPLICABLE')
  }

  if (coupon.minimumOrderAmount != null && originalAmount < coupon.minimumOrderAmount) {
    throw new AppError(
      `This coupon requires a minimum checkout charge of ${coupon.minimumOrderAmount}`,
      400,
      'MINIMUM_ORDER_NOT_MET'
    )
  }

  // Usage limits.
  if (coupon.usageLimit != null) {
    const used = await buyerCouponRepository.countUsage(coupon._id)
    if (used >= coupon.usageLimit) {
      throw new AppError('This coupon has reached its usage limit', 400, 'COUPON_LIMIT_REACHED')
    }
  }
  if (userId && coupon.usageLimitPerBuyer != null) {
    const usedByUser = await buyerCouponRepository.countUserUsage(coupon._id, userId)
    if (usedByUser >= coupon.usageLimitPerBuyer) {
      throw new AppError('You have already used this coupon', 400, 'USER_LIMIT_REACHED')
    }
  }

  const discountAmount = computeDiscount(coupon, originalAmount)
  const finalAmount = round2(originalAmount - discountAmount)

  return {
    valid: true,
    couponId: String(coupon._id),
    couponCode: coupon.couponCode,
    couponName: coupon.couponName,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    eligibleServiceIds: [...eligibleIds].filter((id) => selected.some((s) => s.id === id)),
    originalAmount,
    discountAmount,
    finalAmount,
    message: 'Coupon applied successfully',
  }
}

/**
 * Records a usage row after a successful application. Re-checks limits first so a
 * coupon can't be over-redeemed.
 */
async function applyBuyerCoupon({ couponCode, userId, orderId, checkoutServiceId, services }) {
  const result = await validateBuyerCoupon({ couponCode, userId, services })

  const usage = await buyerCouponRepository.recordUsage({
    couponId: result.couponId,
    userId,
    orderId: orderId || null,
    checkoutServiceId: checkoutServiceId || result.eligibleServiceIds?.[0] || null,
    couponCode: result.couponCode,
    discountAmount: result.discountAmount,
    originalAmount: result.originalAmount,
    finalAmount: result.finalAmount,
  })

  return { ...result, usageId: String(usage._id), message: 'Coupon applied' }
}

module.exports = {
  DISCOUNT_TYPES,
  listBuyerCoupons,
  getBuyerCouponById,
  createBuyerCoupon,
  updateBuyerCoupon,
  setBuyerCouponStatus,
  deleteBuyerCoupon,
  validateBuyerCoupon,
  applyBuyerCoupon,
  computeDiscount,
}
