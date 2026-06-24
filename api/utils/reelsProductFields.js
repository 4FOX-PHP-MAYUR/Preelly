const mongoose = require('mongoose')
const { buildQuickViewDataForProducts } = require('./productAttributesResolver')

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

  const withVehicleFields = products.map((p) => attachReelsVehicleFields(p, filterNames))
  const quickViewDataByIndex = await buildQuickViewDataForProducts(withVehicleFields)

  return withVehicleFields.map((product, index) => ({
    ...product,
    quickViewData: quickViewDataByIndex[index] || [],
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
