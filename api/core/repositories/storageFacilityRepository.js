const StorageFacility = require('../../models/StorageFacility')

const ACTIVE_FILTER = { isDeleted: false }

function buildListQuery({ search, status } = {}) {
  const query = { ...ACTIVE_FILTER }

  if (search && String(search).trim()) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.facilityWeek = new RegExp(escaped, 'i')
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
    facilityWeek: 1,
    facilityAmount: 1,
    displayOrder: 1,
    status: 1,
    createdAt: 1,
    updatedAt: 1,
  }
  const sortField = allowedSort[sortBy] !== undefined ? sortBy : 'displayOrder'
  const sort = { [sortField]: sortDir === 'desc' ? -1 : 1 }

  const [items, total] = await Promise.all([
    StorageFacility.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
    StorageFacility.countDocuments(query),
  ])

  return { items, total, page: Number(page), limit: Number(limit) }
}

async function findActiveAll() {
  return StorageFacility.find({ ...ACTIVE_FILTER, status: true })
    .sort({ displayOrder: 1, facilityAmount: 1 })
    .lean()
}

async function findById(id) {
  return StorageFacility.findOne({ _id: id, ...ACTIVE_FILTER }).lean()
}

async function findByWeek(facilityWeek, excludeId = null) {
  const escaped = String(facilityWeek).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const query = { facilityWeek: new RegExp(`^${escaped}$`, 'i'), ...ACTIVE_FILTER }
  if (excludeId) query._id = { $ne: excludeId }
  return StorageFacility.findOne(query).lean()
}

async function create(data) {
  const doc = new StorageFacility(data)
  await doc.save()
  return doc.toObject()
}

async function updateById(id, data) {
  return StorageFacility.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: data },
    { new: true, runValidators: true }
  ).lean()
}

async function softDeleteById(id, updatedBy = null) {
  return StorageFacility.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { isDeleted: true, status: false, updatedBy } },
    { new: true }
  ).lean()
}

async function updateStatusById(id, status, updatedBy = null) {
  return StorageFacility.findOneAndUpdate(
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
  findByWeek,
  create,
  updateById,
  softDeleteById,
  updateStatusById,
}
