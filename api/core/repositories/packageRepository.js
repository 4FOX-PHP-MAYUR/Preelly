const Package = require('../../models/Package')

const ACTIVE_FILTER = { isDeleted: false }

function buildListQuery({ search, status, isRecomended } = {}) {
  const query = { ...ACTIVE_FILTER }

  if (search && String(search).trim()) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.packageName = new RegExp(escaped, 'i')
  }

  if (status === 'active') {
    query.status = true
  } else if (status === 'inactive') {
    query.status = false
  }

  if (isRecomended === 'yes') {
    query.isRecomended = true
  } else if (isRecomended === 'no') {
    query.isRecomended = false
  }

  return query
}

async function findPaginated({
  page = 1,
  limit = 20,
  search,
  status,
  isRecomended,
  sortBy = 'displayOrder',
  sortDir = 'asc',
}) {
  const query = buildListQuery({ search, status, isRecomended })
  const skip = (Number(page) - 1) * Number(limit)
  const allowedSort = {
    packageName: 1,
    displayOrder: 1,
    packageAmount: 1,
    validityDays: 1,
    status: 1,
    createdAt: 1,
    updatedAt: 1,
  }
  const sortField = allowedSort[sortBy] !== undefined ? sortBy : 'displayOrder'
  const sort = { [sortField]: sortDir === 'desc' ? -1 : 1 }

  const [items, total] = await Promise.all([
    Package.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
    Package.countDocuments(query),
  ])

  return { items, total, page: Number(page), limit: Number(limit) }
}

async function findActiveAll() {
  return Package.find({ ...ACTIVE_FILTER, status: true })
    .sort({ displayOrder: 1, packageAmount: 1 })
    .lean()
}

async function findById(id) {
  return Package.findOne({ _id: id, ...ACTIVE_FILTER }).lean()
}

async function findByName(packageName, excludeId = null) {
  const escaped = String(packageName).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const query = { packageName: new RegExp(`^${escaped}$`, 'i'), ...ACTIVE_FILTER }
  if (excludeId) query._id = { $ne: excludeId }
  return Package.findOne(query).lean()
}

async function create(data) {
  const doc = new Package(data)
  await doc.save()
  return doc.toObject()
}

async function updateById(id, data) {
  return Package.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: data },
    { new: true, runValidators: true }
  ).lean()
}

async function softDeleteById(id, updatedBy = null) {
  return Package.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { isDeleted: true, status: false, updatedBy } },
    { new: true }
  ).lean()
}

async function updateStatusById(id, status, updatedBy = null) {
  return Package.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { status: Boolean(status), updatedBy } },
    { new: true, runValidators: true }
  ).lean()
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
}
