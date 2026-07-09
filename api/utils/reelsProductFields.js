const mongoose = require('mongoose')
const Product = require('../models/Product')
const { buildQuickViewDataForProducts, buildFeaturesForProducts } = require('./productAttributesResolver')

function toIdString (value) {
  if (value == null || value === '') return null
  if (typeof value === 'object' && value._id != null) return String(value._id)
  return String(value)
}

function isObjectIdString (value) {
  const str = toIdString(value)
  return Boolean(str && /^[a-fA-F0-9]{24}$/.test(str))
}

function resolveYear (product, filterNames) {
  const yearId = toIdString(product.yearId)
  if (yearId && filterNames.get(yearId)) return filterNames.get(yearId)

  if (product.year != null && product.year !== '' && !isObjectIdString(product.year)) {
    const y = Number(product.year)
    return Number.isFinite(y) ? y : product.year
  }

  const fdYear = product.filter_data?.year
  if (fdYear != null && fdYear !== '') return fdYear

  if (product.vehicleSpecifications?.year != null) return product.vehicleSpecifications.year

  return null
}

function resolveKilometers (product) {
  const km = product.kilometers ?? product.mileage ?? product.filter_data?.mileage_km
  if (km == null || km === '') return null
  const n = Number(km)
  return Number.isFinite(n) ? n : null
}

function resolveRegionalSpecs (product, filterNames) {
  const regionalSpecsId = toIdString(product.regionalSpecsId)
  if (regionalSpecsId && filterNames.get(regionalSpecsId)) return filterNames.get(regionalSpecsId)

  if (product.targetMarket) return product.targetMarket

  const fd = product.filter_data || {}
  if (fd.regional_spec) return fd.regional_spec
  if (fd.regionalSpec) return fd.regionalSpec
  if (fd.target_market) return fd.target_market

  if (product.vehicleSpecifications?.region) return product.vehicleSpecifications.region

  return null
}

function resolveIsSold (product) {
  if (product.isSold === true) return true
  if (product.isSold === false) return false
  return product.status === 'sold'
}

function attachReelsVehicleFields (product, filterNames) {
  const kilometers = resolveKilometers(product)
  return {
    ...product,
    year: resolveYear(product, filterNames),
    kilometers,
    mileage: kilometers,
    regionalSpecs: resolveRegionalSpecs(product, filterNames),
    isSold: resolveIsSold(product),
  }
}

/**
 * The feed's own $project stage never selects `category` (see buildPostProjection
 * in routes/feedData.js), so it's not present on these product objects even though
 * it exists in the DB. Look it up by product _id instead of trusting product.category.
 */
async function fetchCategoryNamesByProductId (products) {
  const productIds = products
    .map((p) => toIdString(p._id))
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id))

  if (!productIds.length) return new Map()

  const docs = await Product.find({ _id: { $in: productIds } }).select('_id category').lean()
  const categoryIdByProductId = new Map()
  const categoryIds = new Set()
  for (const doc of docs) {
    const categoryId = toIdString(doc.category)
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      categoryIdByProductId.set(String(doc._id), categoryId)
      categoryIds.add(categoryId)
    }
  }

  if (!categoryIds.size) return new Map()

  const Category = require('../models/Category')
  const categories = await Category.find({ _id: { $in: [...categoryIds] } }).select('_id name').lean()
  const categoryNameById = new Map(categories.map((c) => [String(c._id), c.name]))

  const categoryNameByProductId = new Map()
  for (const [productId, categoryId] of categoryIdByProductId) {
    const name = categoryNameById.get(categoryId)
    if (name) categoryNameByProductId.set(productId, name)
  }
  return categoryNameByProductId
}

async function enrichReelsProducts (products) {
  if (!Array.isArray(products) || products.length === 0) return []

  const filterIds = new Set()
  for (const p of products) {
    const yearId = toIdString(p.yearId)
    const regionalSpecsId = toIdString(p.regionalSpecsId)
    if (yearId && mongoose.Types.ObjectId.isValid(yearId)) filterIds.add(yearId)
    if (regionalSpecsId && mongoose.Types.ObjectId.isValid(regionalSpecsId)) filterIds.add(regionalSpecsId)
  }

  const filterNames = new Map()
  if (filterIds.size > 0) {
    const Filter = require('../models/Filter')
    const filters = await Filter.find({ _id: { $in: [...filterIds] } }).select('_id name').lean()
    for (const f of filters) filterNames.set(String(f._id), f.name)
  }

  const categoryNameByProductId = await fetchCategoryNamesByProductId(products)
  const withVehicleFields = products.map((p) => attachReelsVehicleFields(p, filterNames))
  const [quickViewDataByIndex, featuresByIndex] = await Promise.all([
    buildQuickViewDataForProducts(withVehicleFields),
    // Every checkbox/multi-select field, independent of `showOnQuickView` — a
    // multi-select field is a feature regardless of whether it's also surfaced in
    // the quick-view/"Car Overview" summary above.
    buildFeaturesForProducts(withVehicleFields),
  ])

  return withVehicleFields.map((product, index) => ({
    ...product,
    categoryName: categoryNameByProductId.get(toIdString(product._id)) || null,
    quickViewData: quickViewDataByIndex[index] || [],
    features: featuresByIndex[index] || [],
  }))
}

module.exports = {
  enrichReelsProducts,
  attachReelsVehicleFields,
  resolveYear,
  resolveKilometers,
  resolveRegionalSpecs,
  resolveIsSold,
}
