const Coupon = require('../../models/Coupon')
const CouponRedemption = require('../../models/CouponRedemption')

const ACTIVE_FILTER = { isDeleted: false }

function escapeRegex(value) {
  return String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildListQuery({ search, status, discountType, applicableType, startDate, endDate } = {}) {
  const query = { ...ACTIVE_FILTER }

  if (search && String(search).trim()) {
    const rx = new RegExp(escapeRegex(search), 'i')
    query.$or = [{ couponCode: rx }, { couponName: rx }]
  }

  if (status === 'active') query.status = true
  else if (status === 'inactive') query.status = false

  if (discountType) query.discountType = discountType
  if (applicableType) query.applicableType = applicableType

  // Coupons live on or after `startDate` / on or before `endDate`.
  if (startDate) query.startDate = { $gte: new Date(startDate) }
  if (endDate) query.endDate = { $lte: new Date(endDate) }

  return query
}

async function findPaginated({
  page = 1,
  limit = 10,
  search,
  status,
  discountType,
  applicableType,
  startDate,
  endDate,
  sortBy = 'createdAt',
  sortDir = 'desc',
}) {
  const query = buildListQuery({ search, status, discountType, applicableType, startDate, endDate })
  const skip = (Number(page) - 1) * Number(limit)
  const allowedSort = {
    couponCode: 1, couponName: 1, discountType: 1, discountValue: 1,
    usageLimit: 1, usedCount: 1, startDate: 1, endDate: 1, status: 1, createdAt: 1, updatedAt: 1,
  }
  const sortField = allowedSort[sortBy] !== undefined ? sortBy : 'createdAt'
  const sort = { [sortField]: sortDir === 'asc' ? 1 : -1 }

  const [items, total] = await Promise.all([
    Coupon.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
    Coupon.countDocuments(query),
  ])

  return { items, total, page: Number(page), limit: Number(limit) }
}

async function findById(id) {
  return Coupon.findOne({ _id: id, ...ACTIVE_FILTER }).lean()
}

async function findByCode(couponCode, excludeId = null) {
  const query = { couponCode: String(couponCode).trim().toUpperCase(), ...ACTIVE_FILTER }
  if (excludeId) query._id = { $ne: excludeId }
  return Coupon.findOne(query).lean()
}

async function create(data) {
  const doc = new Coupon(data)
  await doc.save()
  return doc.toObject()
}

async function updateById(id, data) {
  return Coupon.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: data },
    { new: true, runValidators: true }
  ).lean()
}

async function softDeleteById(id, updatedBy = null) {
  return Coupon.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { isDeleted: true, status: false, updatedBy } },
    { new: true }
  ).lean()
}

async function updateStatusById(id, status, updatedBy = null) {
  return Coupon.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { status: Boolean(status), updatedBy } },
    { new: true, runValidators: true }
  ).lean()
}

/** Atomically claims a use — guards the total usage limit against races. */
async function claimUsage(id) {
  return Coupon.findOneAndUpdate(
    {
      _id: id,
      ...ACTIVE_FILTER,
      status: true,
      $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  ).lean()
}

async function releaseUsage(id) {
  return Coupon.findOneAndUpdate({ _id: id }, { $inc: { usedCount: -1 } }, { new: true }).lean()
}

async function countUserRedemptions(couponId, userId) {
  return CouponRedemption.countDocuments({ coupon: couponId, user: userId })
}

async function createRedemption(data) {
  const doc = new CouponRedemption(data)
  await doc.save()
  return doc.toObject()
}

/** Deactivates coupons whose end date has passed (cron sweep). */
async function deactivateExpired(now = new Date()) {
  const res = await Coupon.updateMany(
    { ...ACTIVE_FILTER, status: true, endDate: { $lt: now } },
    { $set: { status: false } }
  )
  return res.modifiedCount || 0
}

module.exports = {
  ACTIVE_FILTER,
  buildListQuery,
  findPaginated,
  findById,
  findByCode,
  create,
  updateById,
  softDeleteById,
  updateStatusById,
  claimUsage,
  releaseUsage,
  countUserRedemptions,
  createRedemption,
  deactivateExpired,
}
