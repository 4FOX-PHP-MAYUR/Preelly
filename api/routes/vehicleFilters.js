/**
 * Dynamic vehicle filter options aggregated from stored listings.
 * Values are derived from database — not hardcoded.
 */

const express = require('express')
const mongoose = require('mongoose')
const Product = require('../models/Product')

const router = express.Router()

const VEHICLE_SPEC_FIELDS = [
  'brand',
  'model',
  'variant',
  'year',
  'fuelType',
  'transmission',
  'bodyType',
  'driveType',
  'engineCapacity',
  'seatingCapacity',
  'region',
]

function buildMatchQuery({ categoryId, subcategoryId }) {
  const match = {
    status: { $in: ['active', 'pending'] },
    vehicleSpecifications: { $exists: true, $ne: null },
  }
  if (categoryId && mongoose.Types.ObjectId.isValid(String(categoryId))) {
    match.category = new mongoose.Types.ObjectId(String(categoryId))
  }
  if (subcategoryId && mongoose.Types.ObjectId.isValid(String(subcategoryId))) {
    match.subcategory = new mongoose.Types.ObjectId(String(subcategoryId))
  }
  return match
}

async function distinctFromVehicleSpecs(match, field) {
  const path = `vehicleSpecifications.${field}`
  const values = await Product.distinct(path, {
    ...match,
    [path]: { $exists: true, $nin: [null, ''] },
  })
  return values
    .filter((v) => v !== null && v !== undefined && v !== '')
    .sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b
      return String(a).localeCompare(String(b))
    })
}

// @route   GET /api/vehicle-filters/options
// @desc    Distinct filter values from vehicleSpecifications + filter_data
// @access  Public
router.get('/options', async (req, res) => {
  try {
    const categoryId = req.query.category_id ?? req.query.categoryId
    const subcategoryId = req.query.subcategory_id ?? req.query.subcategoryId
    const match = buildMatchQuery({ categoryId, subcategoryId })

    const options = {}
    for (const field of VEHICLE_SPEC_FIELDS) {
      options[field] = await distinctFromVehicleSpecs(match, field)
    }

    // Price and mileage ranges from filter_data (legacy indexed fields)
    const priceValues = await Product.distinct('filter_data.price', {
      ...match,
      'filter_data.price': { $exists: true, $ne: null },
    })
    const mileageValues = await Product.distinct('filter_data.mileage_km', {
      ...match,
      'filter_data.mileage_km': { $exists: true, $ne: null },
    })

    const horsepowerValues = await Product.distinct('vehicleSpecifications.horsepower', {
      ...match,
      'vehicleSpecifications.horsepower': { $exists: true, $ne: null },
    })

    options.price = priceValues.filter((n) => typeof n === 'number').sort((a, b) => a - b)
    options.mileage_km = mileageValues.filter((n) => typeof n === 'number').sort((a, b) => a - b)
    options.horsepower = horsepowerValues.sort((a, b) => String(a).localeCompare(String(b)))

    if (options.price.length) {
      options.priceRange = { min: options.price[0], max: options.price[options.price.length - 1] }
    }
    if (options.mileage_km.length) {
      options.mileageRange = {
        min: options.mileage_km[0],
        max: options.mileage_km[options.mileage_km.length - 1],
      }
    }

    res.json({
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
      options,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[vehicle-filters] options error:', error)
    res.status(500).json({ message: 'Failed to load vehicle filter options' })
  }
})

module.exports = router
