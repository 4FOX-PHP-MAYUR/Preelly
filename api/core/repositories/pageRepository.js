const Page = require('../../models/Page')

const ACTIVE_FILTER = { isDeleted: false }

function buildListQuery({ search, slug, status, fromDate, toDate } = {}) {
  const query = { ...ACTIVE_FILTER }

  if (search && String(search).trim()) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.pageTitle = new RegExp(escaped, 'i')
  }

  if (slug && String(slug).trim()) {
    const escaped = String(slug).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.pageSlug = new RegExp(escaped, 'i')
  }

  if (status === 'active') {
    query.status = true
  } else if (status === 'inactive') {
    query.status = false
  }

  if (fromDate || toDate) {
    query.createdAt = {}
    if (fromDate) query.createdAt.$gte = new Date(fromDate)
    if (toDate) {
      const to = new Date(toDate)
      to.setHours(23, 59, 59, 999)
      query.createdAt.$lte = to
    }
  }

  return query
}

async function findPaginated({
  page = 1,
  limit = 20,
  search,
  slug,
  status,
  fromDate,
  toDate,
  sortBy = 'displayOrder',
  sortDir = 'asc',
}) {
  const query = buildListQuery({ search, slug, status, fromDate, toDate })
  const skip = (Number(page) - 1) * Number(limit)
  const allowedSort = {
    pageTitle: 1,
    pageSlug: 1,
    displayOrder: 1,
    status: 1,
    createdAt: 1,
    updatedAt: 1,
  }
  const sortField = allowedSort[sortBy] !== undefined ? sortBy : 'displayOrder'
  const sort = { [sortField]: sortDir === 'desc' ? -1 : 1 }

  const [items, total] = await Promise.all([
    Page.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
    Page.countDocuments(query),
  ])

  return { items, total, page: Number(page), limit: Number(limit) }
}

async function findAllForExport({ search, slug, status, fromDate, toDate } = {}) {
  const query = buildListQuery({ search, slug, status, fromDate, toDate })
  return Page.find(query).sort({ displayOrder: 1, createdAt: -1 }).lean()
}

async function findById(id) {
  return Page.findOne({ _id: id, ...ACTIVE_FILTER }).lean()
}

async function findBySlug(slug, excludeId = null) {
  if (!slug) return null
  const query = { pageSlug: slug, ...ACTIVE_FILTER }
  if (excludeId) query._id = { $ne: excludeId }
  return Page.findOne(query).lean()
}

/** Public reader: active, non-deleted page by slug — powers the dynamic frontend route. */
async function findActiveBySlug(slug) {
  if (!slug) return null
  return Page.findOne({ pageSlug: slug, status: true, ...ACTIVE_FILTER }).lean()
}

async function findByTitle(pageTitle, excludeId = null) {
  if (!pageTitle) return null
  const escaped = String(pageTitle).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const query = { pageTitle: new RegExp(`^${escaped}$`, 'i'), ...ACTIVE_FILTER }
  if (excludeId) query._id = { $ne: excludeId }
  return Page.findOne(query).lean()
}

async function create(data) {
  const doc = new Page(data)
  await doc.save()
  return doc.toObject()
}

async function updateById(id, data) {
  return Page.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: data },
    { new: true, runValidators: true }
  ).lean()
}

async function softDeleteById(id, updatedBy = null) {
  return Page.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { isDeleted: true, status: false, updatedBy } },
    { new: true }
  ).lean()
}

async function updateStatusById(id, status, updatedBy = null) {
  return Page.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { status: Boolean(status), updatedBy } },
    { new: true, runValidators: true }
  ).lean()
}

module.exports = {
  ACTIVE_FILTER,
  buildListQuery,
  findPaginated,
  findAllForExport,
  findById,
  findBySlug,
  findActiveBySlug,
  findByTitle,
  create,
  updateById,
  softDeleteById,
  updateStatusById,
}
