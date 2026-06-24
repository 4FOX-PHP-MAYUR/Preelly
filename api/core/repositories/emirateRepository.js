const Emirate = require('../../models/Emirate')

const ACTIVE_FILTER = { isDeleted: false }

function buildListQuery({ search, status } = {}) {
  const query = { ...ACTIVE_FILTER }

  if (search && String(search).trim()) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.name = new RegExp(escaped, 'i')
  }

  if (status === 'active') {
    query.status = true
  } else if (status === 'inactive') {
    query.status = false
  }

  return query
}

async function findPaginated({ page = 1, limit = 20, search, status, sortBy = 'name', sortDir = 'asc' }) {
  const query = buildListQuery({ search, status })
  const skip = (Number(page) - 1) * Number(limit)
  const allowedSort = { name: 1, slug: 1, status: 1, createdAt: 1, updatedAt: 1 }
  const sortField = allowedSort[sortBy] !== undefined ? sortBy : 'name'
  const sort = { [sortField]: sortDir === 'desc' ? -1 : 1 }

  const [items, total] = await Promise.all([
    Emirate.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
    Emirate.countDocuments(query),
  ])

  return { items, total, page: Number(page), limit: Number(limit) }
}

async function findActiveAll() {
  return Emirate.find({ ...ACTIVE_FILTER, status: true })
    .sort({ name: 1 })
    .lean()
}

async function findById(id) {
  return Emirate.findOne({ _id: id, ...ACTIVE_FILTER }).lean()
}

async function findBySlug(slug, excludeId = null) {
  const query = { slug: String(slug).trim(), ...ACTIVE_FILTER }
  if (excludeId) query._id = { $ne: excludeId }
  return Emirate.findOne(query).lean()
}

async function create(data) {
  const doc = new Emirate(data)
  await doc.save()
  return doc.toObject()
}

async function updateById(id, data) {
  return Emirate.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: data },
    { new: true, runValidators: true }
  ).lean()
}

async function softDeleteById(id) {
  return Emirate.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { isDeleted: true, status: false } },
    { new: true }
  ).lean()
}

async function updateStatusById(id, status) {
  return Emirate.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { status: Boolean(status) } },
    { new: true, runValidators: true }
  ).lean()
}

module.exports = {
  ACTIVE_FILTER,
  buildListQuery,
  findPaginated,
  findActiveAll,
  findById,
  findBySlug,
  create,
  updateById,
  softDeleteById,
  updateStatusById,
}
