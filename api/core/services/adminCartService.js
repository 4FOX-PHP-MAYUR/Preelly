const { Types } = require('mongoose')
const AppError = require('../errors/AppError')
const Cart = require('../../models/Cart')
const Product = require('../../models/Product')
const User = require('../../models/User')

function escapeRegex(value) {
  return String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** UI-facing status filter ("pending"/"purchased") → underlying cartStatus enum value(s). */
function resolveCartStatusFilter(status) {
  const key = String(status || '').trim().toUpperCase()
  if (!key || key === 'ALL') return null
  if (key === 'PENDING') return { $in: ['ACTIVE', 'CHECKOUT'] }
  if (Cart.CART_STATUSES.includes(key)) return key
  return null
}

/**
 * Build the Mongo filter for the admin cart list/export endpoints.
 * Soft-deleted rows (deletedAt set) are excluded, matching the buyer-facing cart route.
 */
async function buildCartListQuery({ status, search, category, fromDate, toDate } = {}) {
  const query = { deletedAt: null }
  const andConditions = []

  const cartStatus = resolveCartStatusFilter(status)
  if (cartStatus) query.cartStatus = cartStatus

  if (search && String(search).trim()) {
    const rx = new RegExp(escapeRegex(search), 'i')
    const [productIds, userIds] = await Promise.all([
      Product.find({ title: rx }).distinct('_id'),
      User.find({ $or: [{ name: rx }, { email: rx }] }).distinct('_id'),
    ])
    andConditions.push({
      $or: [
        { productId: { $in: productIds } },
        { userId: { $in: userIds } },
        { sellerId: { $in: userIds } },
      ],
    })
  }

  if (category && Types.ObjectId.isValid(category)) {
    const productIds = await Product.find({
      $or: [{ category }, { subcategory: category }],
    }).distinct('_id')
    andConditions.push({ productId: { $in: productIds } })
  }

  const createdAt = {}
  if (fromDate) {
    const start = new Date(fromDate)
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0)
      createdAt.$gte = start
    }
  }
  if (toDate) {
    const end = new Date(toDate)
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999)
      createdAt.$lte = end
    }
  }
  if (Object.keys(createdAt).length) query.createdAt = createdAt

  if (andConditions.length) query.$and = andConditions

  return query
}

const CART_POPULATE = [
  { path: 'productId', select: 'title images category subcategory productPrice price', populate: [
    { path: 'category', select: 'name' },
    { path: 'subcategory', select: 'name' },
  ] },
  { path: 'userId', select: 'name email' },
  { path: 'sellerId', select: 'name email' },
]

async function listCartItems(params = {}) {
  const page = Math.max(Number(params.page) || 1, 1)
  const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100)
  const query = await buildCartListQuery(params)
  const skip = (page - 1) * limit

  const [items, total] = await Promise.all([
    Cart.find(query)
      .populate(CART_POPULATE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Cart.countDocuments(query),
  ])

  return { items, total, page, limit }
}

async function getCartItemById(id) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid cart id', 400, 'INVALID_ID')
  }

  const item = await Cart.findOne({ _id: id, deletedAt: null })
    .populate([
      ...CART_POPULATE,
      { path: 'packageId', select: 'packageName packageAmount' },
      { path: 'storagefacilitiesId', select: 'facilityWeek facilityAmount' },
    ])
    .lean()

  if (!item) throw new AppError('Cart item not found', 404, 'CART_ITEM_NOT_FOUND')

  return item
}

const EXPORT_MAX_ROWS = 10000

/**
 * Fetch cart items for Excel export using the same filters as the list.
 * Requires fromDate + toDate. Caps at EXPORT_MAX_ROWS to keep response size bounded.
 */
async function exportCartItems(params = {}) {
  if (!params.fromDate || !params.toDate) {
    throw new AppError('From date and To date are required for export', 400, 'DATE_RANGE_REQUIRED')
  }

  const from = new Date(params.fromDate)
  const to = new Date(params.toDate)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError('Invalid from date or to date', 400, 'INVALID_DATE')
  }
  if (from.getTime() > to.getTime()) {
    throw new AppError('From date cannot be after To date', 400, 'INVALID_DATE_RANGE')
  }

  const query = await buildCartListQuery(params)

  const [items, total] = await Promise.all([
    Cart.find(query)
      .populate(CART_POPULATE)
      .sort({ createdAt: -1 })
      .limit(EXPORT_MAX_ROWS)
      .lean(),
    Cart.countDocuments(query),
  ])

  return { items, total, truncated: total > items.length }
}

module.exports = {
  listCartItems,
  getCartItemById,
  exportCartItems,
  EXPORT_MAX_ROWS,
}
