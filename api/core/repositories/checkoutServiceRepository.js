const CheckoutService = require('../../models/CheckoutService')
const CheckoutServiceHighlight = require('../../models/CheckoutServiceHighlight')

const ACTIVE_FILTER = { isDeleted: false }

function buildListQuery({ search, status } = {}) {
  const query = { ...ACTIVE_FILTER }

  if (search && String(search).trim()) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.serviceName = new RegExp(escaped, 'i')
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
  sortBy = 'displayOrder',
  sortDir = 'asc',
}) {
  const query = buildListQuery({ search, status })
  const skip = (Number(page) - 1) * Number(limit)
  const allowedSort = {
    serviceName: 1,
    price: 1,
    priceType: 1,
    displayOrder: 1,
    status: 1,
    createdAt: 1,
    updatedAt: 1,
  }
  const sortField = allowedSort[sortBy] !== undefined ? sortBy : 'displayOrder'
  const sort = { [sortField]: sortDir === 'desc' ? -1 : 1 }

  const [items, total] = await Promise.all([
    CheckoutService.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
    CheckoutService.countDocuments(query),
  ])

  return { items, total, page: Number(page), limit: Number(limit) }
}

async function findActiveAll() {
  return CheckoutService.find({ ...ACTIVE_FILTER, status: true })
    .sort({ displayOrder: 1, serviceName: 1 })
    .lean()
}

async function findById(id) {
  return CheckoutService.findOne({ _id: id, ...ACTIVE_FILTER }).lean()
}

async function findByName(serviceName, excludeId = null) {
  const escaped = String(serviceName).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const query = { serviceName: new RegExp(`^${escaped}$`, 'i'), ...ACTIVE_FILTER }
  if (excludeId) query._id = { $ne: excludeId }
  return CheckoutService.findOne(query).lean()
}

async function create(data) {
  const doc = new CheckoutService(data)
  await doc.save()
  return doc.toObject()
}

async function updateById(id, data) {
  return CheckoutService.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: data },
    { new: true, runValidators: true }
  ).lean()
}

async function softDeleteById(id, updatedBy = null) {
  return CheckoutService.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { isDeleted: true, status: false, updatedBy } },
    { new: true }
  ).lean()
}

async function updateStatusById(id, status, updatedBy = null) {
  return CheckoutService.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { status: Boolean(status), updatedBy } },
    { new: true, runValidators: true }
  ).lean()
}

// ── Highlights (separate collection) ──────────────────────────────────────────

async function findHighlights(checkoutServiceId) {
  return CheckoutServiceHighlight.find({ checkoutServiceId })
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean()
}

async function findHighlightsForMany(serviceIds = []) {
  if (!serviceIds.length) return []
  return CheckoutServiceHighlight.find({ checkoutServiceId: { $in: serviceIds } })
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean()
}

// Replace all highlights for a service with a fresh ordered set.
async function replaceHighlights(checkoutServiceId, highlights = []) {
  await CheckoutServiceHighlight.deleteMany({ checkoutServiceId })
  if (!highlights.length) return []
  const docs = highlights.map((highlight, index) => ({
    checkoutServiceId,
    highlight,
    displayOrder: index,
  }))
  return CheckoutServiceHighlight.insertMany(docs)
}

async function deleteHighlights(checkoutServiceId) {
  return CheckoutServiceHighlight.deleteMany({ checkoutServiceId })
}

module.exports = {
  ACTIVE_FILTER,
  buildListQuery,
  findPaginated,
  findActiveAll,
  findById,
  findByName,
  create,
  updateById,
  softDeleteById,
  updateStatusById,
  findHighlights,
  findHighlightsForMany,
  replaceHighlights,
  deleteHighlights,
}
