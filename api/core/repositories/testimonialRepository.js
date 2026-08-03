const Testimonial = require('../../models/Testimonial')

const ACTIVE_FILTER = { isDeleted: false }

function buildListQuery({ search, status, customerType, fromDate, toDate } = {}) {
  const query = { ...ACTIVE_FILTER }

  if (search && String(search).trim()) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.testimonialName = new RegExp(escaped, 'i')
  }

  if (status === 'active') {
    query.status = true
  } else if (status === 'inactive') {
    query.status = false
  }

  if (customerType === 'seller' || customerType === 'buyer') {
    query.customerType = customerType
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
  status,
  customerType,
  fromDate,
  toDate,
  sortBy = 'displayOrder',
  sortDir = 'asc',
}) {
  const query = buildListQuery({ search, status, customerType, fromDate, toDate })
  const skip = (Number(page) - 1) * Number(limit)
  const allowedSort = {
    testimonialName: 1,
    customerType: 1,
    rating: 1,
    displayOrder: 1,
    status: 1,
    createdAt: 1,
    updatedAt: 1,
  }
  const sortField = allowedSort[sortBy] !== undefined ? sortBy : 'displayOrder'
  const sort = { [sortField]: sortDir === 'desc' ? -1 : 1 }

  const [items, total] = await Promise.all([
    Testimonial.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
    Testimonial.countDocuments(query),
  ])

  return { items, total, page: Number(page), limit: Number(limit) }
}

async function findAllForExport({ search, status, customerType, fromDate, toDate } = {}) {
  const query = buildListQuery({ search, status, customerType, fromDate, toDate })
  return Testimonial.find(query).sort({ displayOrder: 1, createdAt: -1 }).lean()
}

async function findActiveAll() {
  return Testimonial.find({ ...ACTIVE_FILTER, status: true })
    .sort({ displayOrder: 1, createdAt: -1 })
    .lean()
}

async function findById(id) {
  return Testimonial.findOne({ _id: id, ...ACTIVE_FILTER }).lean()
}

async function create(data) {
  const doc = new Testimonial(data)
  await doc.save()
  return doc.toObject()
}

async function updateById(id, data) {
  return Testimonial.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: data },
    { new: true, runValidators: true }
  ).lean()
}

async function softDeleteById(id, updatedBy = null) {
  return Testimonial.findOneAndUpdate(
    { _id: id, ...ACTIVE_FILTER },
    { $set: { isDeleted: true, status: false, updatedBy } },
    { new: true }
  ).lean()
}

async function updateStatusById(id, status, updatedBy = null) {
  return Testimonial.findOneAndUpdate(
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
  findActiveAll,
  findById,
  create,
  updateById,
  softDeleteById,
  updateStatusById,
}
