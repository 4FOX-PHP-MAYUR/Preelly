const { Types } = require('mongoose')
const ProductDraft = require('../../models/ProductDraft')
const User = require('../../models/User')

/**
 * Admin-side data access for the existing `productDraft` collection (the
 * "Post Your Ad" wizard state). The seller-facing flow keeps using
 * services/productDraftService.js — this repository is read/write access for
 * the Admin Panel module and deliberately touches the same documents without
 * changing their shape.
 *
 * There is no `isDeleted` flag on ProductDraft; the collection's own soft-delete
 * state is `status: 'discarded'`, which is what softDeleteById sets.
 */

const STATUSES = ['draft', 'published', 'discarded']

const SORTABLE_FIELDS = [
  'updatedAt',
  'createdAt',
  'lastSavedAt',
  'currentStep',
  'status',
  'imageCount',
]

const USER_FIELDS = 'name email avatar phone'
const PRODUCT_FIELDS = 'title status productPrice'

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Search spans the draft's own text (title/description live inside the free-form
 * `formValues`) plus the owner's name/email, which needs a lookup first because
 * the draft only stores `userId`.
 */
async function resolveSearchQuery(search) {
  const term = String(search || '').trim()
  if (!term) return null

  const rx = new RegExp(escapeRegex(term), 'i')
  const or = [
    { 'formValues.title': rx },
    { 'formValues.description': rx },
    { 'videoMeta.name': rx },
  ]

  if (Types.ObjectId.isValid(term)) {
    or.push({ _id: new Types.ObjectId(term) })
    or.push({ userId: new Types.ObjectId(term) })
  }

  const matchedUsers = await User.find({ $or: [{ name: rx }, { email: rx }] })
    .select('_id')
    .limit(200)
    .lean()
  if (matchedUsers.length) {
    or.push({ userId: { $in: matchedUsers.map((u) => u._id) } })
  }

  return { $or: or }
}

async function buildListQuery({
  search,
  status,
  userId,
  hasVideo,
  step,
  fromDate,
  toDate,
} = {}) {
  const and = []

  if (STATUSES.includes(status)) and.push({ status })

  if (userId && Types.ObjectId.isValid(String(userId))) {
    and.push({ userId: new Types.ObjectId(String(userId)) })
  }

  if (hasVideo === 'yes' || hasVideo === true || hasVideo === 'true') {
    and.push({ hasVideo: true })
  } else if (hasVideo === 'no' || hasVideo === false || hasVideo === 'false') {
    and.push({ hasVideo: { $ne: true } })
  }

  const stepNum = Number(step)
  if (step !== undefined && step !== '' && Number.isInteger(stepNum) && stepNum >= 1) {
    and.push({ currentStep: stepNum })
  }

  if (fromDate || toDate) {
    const createdAt = {}
    if (fromDate) {
      const from = new Date(fromDate)
      if (!Number.isNaN(from.getTime())) createdAt.$gte = from
    }
    if (toDate) {
      const to = new Date(toDate)
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999)
        createdAt.$lte = to
      }
    }
    if (Object.keys(createdAt).length) and.push({ createdAt })
  }

  const searchQuery = await resolveSearchQuery(search)
  if (searchQuery) and.push(searchQuery)

  return and.length ? { $and: and } : {}
}

async function findPaginated({
  page = 1,
  limit = 20,
  search,
  status,
  userId,
  hasVideo,
  step,
  fromDate,
  toDate,
  sortBy = 'updatedAt',
  sortDir = 'desc',
} = {}) {
  const query = await buildListQuery({ search, status, userId, hasVideo, step, fromDate, toDate })
  const pageNum = Math.max(1, Number(page) || 1)
  const limitNum = Math.min(500, Math.max(1, Number(limit) || 20))
  const skip = (pageNum - 1) * limitNum

  const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'updatedAt'
  // `_id` breaks ties so paging can never repeat or skip a row on equal keys.
  const sort = { [sortField]: sortDir === 'asc' ? 1 : -1, _id: -1 }

  const [items, total] = await Promise.all([
    ProductDraft.find(query)
      .populate('userId', USER_FIELDS)
      .populate('productId', PRODUCT_FIELDS)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ProductDraft.countDocuments(query),
  ])

  return { items, total, page: pageNum, limit: limitNum }
}

async function countByStatus() {
  const rows = await ProductDraft.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
  const counts = { total: 0, draft: 0, published: 0, discarded: 0 }
  rows.forEach((row) => {
    if (counts[row._id] !== undefined) counts[row._id] = row.count
    counts.total += row.count
  })
  return counts
}

async function findById(id) {
  if (!Types.ObjectId.isValid(String(id))) return null
  return ProductDraft.findById(id)
    .populate('userId', USER_FIELDS)
    .populate('productId', PRODUCT_FIELDS)
    .lean()
}

/** Raw document (no populate) — used when merging an update onto existing data. */
async function findRawById(id) {
  if (!Types.ObjectId.isValid(String(id))) return null
  return ProductDraft.findById(id).lean()
}

async function findLiveByUserId(userId, excludeId = null) {
  if (!Types.ObjectId.isValid(String(userId))) return null
  const query = { userId, status: 'draft' }
  if (excludeId && Types.ObjectId.isValid(String(excludeId))) {
    query._id = { $ne: new Types.ObjectId(String(excludeId)) }
  }
  return ProductDraft.findOne(query).lean()
}

async function create(data) {
  const doc = await ProductDraft.create(data)
  return findById(doc._id)
}

async function updateById(id, data) {
  const updated = await ProductDraft.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  )
  if (!updated) return null
  return findById(updated._id)
}

/**
 * Soft delete = the collection's own 'discarded' state, so the record and its
 * user/product references stay intact and the seller-facing flow keeps ignoring it.
 */
async function softDeleteById(id) {
  const updated = await ProductDraft.findOneAndUpdate(
    { _id: id, status: { $ne: 'discarded' } },
    { $set: { status: 'discarded', lastSavedAt: new Date() } },
    { new: true }
  )
  if (!updated) return null
  return findById(updated._id)
}

async function hardDeleteById(id) {
  if (!Types.ObjectId.isValid(String(id))) return false
  const result = await ProductDraft.deleteOne({ _id: id })
  return result.deletedCount > 0
}

module.exports = {
  STATUSES,
  SORTABLE_FIELDS,
  buildListQuery,
  findPaginated,
  countByStatus,
  findById,
  findRawById,
  findLiveByUserId,
  create,
  updateById,
  softDeleteById,
  hardDeleteById,
}
