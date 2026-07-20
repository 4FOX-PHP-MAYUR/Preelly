const BuyerCoupon = require('../../models/BuyerCoupon')
const BuyerCouponService = require('../../models/BuyerCouponService')
const BuyerCouponUsage = require('../../models/BuyerCouponUsage')

const ACTIVE_FILTER = { isDeleted: false }

function buildListQuery({ search, status } = {}) {
  const query = { ...ACTIVE_FILTER }

  if (search && String(search).trim()) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rx = new RegExp(escaped, 'i')
    // Search by coupon code OR coupon name.
    query.$or = [{ couponCode: rx }, { couponName: rx }]
  }

  if (status === 'active') {
    query.status = true
  } else if (status === 'inactive') {
    query.status = false
  }

  return query
}

async function findPaginated({
  page = 1,
  limit = 20,
  search,
  status,
  sortBy = 'createdAt',
  sortDir = 'desc',
}) {
  const query = buildListQuery({ search, status })
  const skip = (Number(page) - 1) * Number(limit)
  const allowedSort = {
    couponName: 1,
    couponCode: 1,
    discountValue: 1,
    validFrom: 1,
    validTill: 1,
    status: 1,
    createdAt: 1,
    updatedAt: 1,
  }
  const sortField = allowedSort[sortBy] !== undefined ? sortBy : 'createdAt'
  const sort = { [sortField]: sortDir === 'asc' ? 1 : -1 }

  const [items, total] = await Promise.all([
    BuyerCoupon.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
    BuyerCoupon.countDocuments(query),
  ])

  return { items, total, page: Number(page), limit: Number(limit) }
}

async function findById(id) {
  return BuyerCoupon.findOne({ _id: id, ...ACTIVE_FILTER }).lean()
}

async function findByCode(couponCode) {
  const escaped = String(couponCode).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return BuyerCoupon.findOne({
    couponCode: new RegExp(`^${escaped}$`, 'i'),
    ...ACTIVE_FILTER,
  }).lean()
}

async function existsByCode(couponCode, excludeId = null) {
  const escaped = String(couponCode).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const query = { couponCode: new RegExp(`^${escaped}$`, 'i'), ...ACTIVE_FILTER }
  if (excludeId) query._id = { $ne: excludeId }
  return BuyerCoupon.findOne(query).lean()
}

async function create(data) {
  const doc = new BuyerCoupon(data)
  await doc.save()
  return doc.toObject()
}

async function updateById(id, data) {
  return BuyerCoupon.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: data },
    { new: true, runValidators: true }
  ).lean()
}

async function softDeleteById(id, updatedBy = null) {
  return BuyerCoupon.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { isDeleted: true, status: false, updatedBy } },
    { new: true }
  ).lean()
}

async function updateStatusById(id, status, updatedBy = null) {
  return BuyerCoupon.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { status: Boolean(status), updatedBy } },
    { new: true, runValidators: true }
  ).lean()
}

// ── Service mapping (buyer_coupon_services) ───────────────────────────────────

async function findServiceIds(couponId) {
  const rows = await BuyerCouponService.find({ couponId }).select('checkoutServiceId').lean()
  return rows.map((r) => String(r.checkoutServiceId))
}

async function findServiceIdsForMany(couponIds = []) {
  if (!couponIds.length) return []
  return BuyerCouponService.find({ couponId: { $in: couponIds } }).lean()
}

async function replaceServiceMappings(couponId, checkoutServiceIds = []) {
  await BuyerCouponService.deleteMany({ couponId })
  const unique = [...new Set(checkoutServiceIds.map(String))]
  if (!unique.length) return []
  return BuyerCouponService.insertMany(
    unique.map((checkoutServiceId) => ({ couponId, checkoutServiceId }))
  )
}

// ── Usage ledger (buyer_coupon_usage) ─────────────────────────────────────────

async function countUsage(couponId) {
  return BuyerCouponUsage.countDocuments({ couponId })
}

async function countUserUsage(couponId, userId) {
  return BuyerCouponUsage.countDocuments({ couponId, userId })
}

async function recordUsage(data) {
  const doc = new BuyerCouponUsage(data)
  await doc.save()
  return doc.toObject()
}

module.exports = {
  ACTIVE_FILTER,
  buildListQuery,
  findPaginated,
  findById,
  findByCode,
  existsByCode,
  create,
  updateById,
  softDeleteById,
  updateStatusById,
  findServiceIds,
  findServiceIdsForMany,
  replaceServiceMappings,
  countUsage,
  countUserUsage,
  recordUsage,
}
