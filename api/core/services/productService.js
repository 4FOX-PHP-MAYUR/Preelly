/**
 * Shared product business logic — used by mobile and web controllers.
 * Extract additional methods from routes/products.js incrementally.
 */
const mongoose = require('mongoose')
const Product = require('../../models/Product')
const Category = require('../../models/Category')
const User = require('../../models/User')
const AppError = require('../errors/AppError')
const { buildVehicleDetailPresentation } = require('../../utils/productVehicleFields')
const { buildProductAttributesPresentation } = require('../../utils/productAttributesResolver')

const toCanonicalId = (id) => {
  if (id == null || id === '') return ''
  return String(id).trim()
}

/**
 * Load saved product IDs for a user (single DB read per request).
 * @returns {Promise<Set<string>>}
 */
async function getSavedProductIds(userId) {
  if (!userId) return new Set()
  const user = await User.findById(userId).select('savedProducts').lean()
  if (!user?.savedProducts?.length) return new Set()
  return new Set(user.savedProducts.map((id) => toCanonicalId(id)).filter(Boolean))
}

/**
 * Expand category filter to include descendants.
 */
async function expandCategoryScope(categoryId) {
  if (!categoryId) return null
  if (!mongoose.Types.ObjectId.isValid(String(categoryId))) {
    throw new AppError('Invalid categoryId', 400, 'INVALID_CATEGORY_ID')
  }
  const catObjId = new mongoose.Types.ObjectId(String(categoryId))
  const scopeDocs = await Category.find({
    isDeleted: false,
    $or: [{ _id: catObjId }, { path: catObjId }],
  })
    .select('_id')
    .lean()
  const scopeIds = (scopeDocs || []).map((d) => d._id)
  return scopeIds.length ? { $in: scopeIds } : catObjId
}

/**
 * List active products with pagination and optional category filter.
 * @param {object} query - { categoryId, page, limit, sort }
 * @param {object} options - { userId, status }
 */
async function listProducts(query = {}, options = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20))
  const skip = (page - 1) * limit
  const status = options.status || 'active'

  const filter = { status }

  if (query.categoryId) {
    const scopeExpr = await expandCategoryScope(query.categoryId)
    filter.$or = [{ category: scopeExpr }, { subcategory: scopeExpr }]
  }

  let sortOption = { createdAt: -1 }
  if (query.sort === 'price_asc') sortOption = { price: 1 }
  if (query.sort === 'price_desc') sortOption = { price: -1 }

  const [items, total, savedProductIds] = await Promise.all([
    Product.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('seller', 'name avatar isVerified')
      .populate('category', 'name slug')
      .lean(),
    Product.countDocuments(filter),
    getSavedProductIds(options.userId),
  ])

  const enriched = items.map((product) => ({
    ...product,
    saved: savedProductIds.has(toCanonicalId(product._id)),
  }))

  return {
    items: enriched,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
      hasMore: skip + items.length < total,
    },
  }
}

/**
 * Get single product by ID.
 */
async function getProductById(productId, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(productId))) {
    throw new AppError('Invalid product ID', 400, 'INVALID_PRODUCT_ID')
  }

  const product = await Product.findById(productId)
    .populate('seller', 'name avatar phone isVerified createdAt')
    .populate('category', 'name slug path')
    .lean()

  if (!product) {
    throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND')
  }

  const enrichAttributes = options.enrichProductAttributes !== false

  const [savedProductIds, vehiclePresentation, attributesPresentation] = await Promise.all([
    getSavedProductIds(options.userId),
    options.enrichVehicleFields ? buildVehicleDetailPresentation(product) : Promise.resolve(null),
    enrichAttributes ? buildProductAttributesPresentation(product) : Promise.resolve(null),
  ])

  return {
    ...product,
    ...(vehiclePresentation?.legacyFields || {}),
    user: product.seller || null,
    saved: savedProductIds.has(toCanonicalId(product._id)),
    ...(vehiclePresentation
      ? {
          vehicleListingFields: vehiclePresentation.vehicleListingFields,
          carOverview: vehiclePresentation.carOverview,
          vehicleFeatures: vehiclePresentation.vehicleFeatures,
        }
      : {}),
    ...(attributesPresentation
      ? {
          productAttributes: attributesPresentation.productAttributes,
          productMultiAttributes: attributesPresentation.productMultiAttributes,
        }
      : {}),
  }
}

module.exports = {
  listProducts,
  getProductById,
  getSavedProductIds,
  expandCategoryScope,
}
