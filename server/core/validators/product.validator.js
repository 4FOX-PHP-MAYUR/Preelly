const { body, query, param } = require('express-validator')
const { VEHICLE_LISTING_FIELDS, API_KEY_ALIASES } = require('../../utils/productVehicleFields')

const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('sort').optional().isIn(['newest', 'price_asc', 'price_desc']),
  query('categoryId').optional().isString().trim(),
]

const productIdParam = [
  param('id').isMongoId().withMessage('Invalid product ID'),
]

const optionalObjectIdField = (field) =>
  body(field)
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      return /^[a-fA-F0-9]{24}$/.test(String(value).trim())
    })
    .withMessage(`${field} must be a valid ObjectId`)

const optionalObjectIdListField = (field) =>
  body(field)
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      let parts = []
      if (Array.isArray(value)) {
        parts = value.map((v) => String(v).trim()).filter(Boolean)
      } else {
        const raw = String(value).trim()
        if (raw.startsWith('[')) {
          try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
              parts = parsed.map((v) => String(v).trim()).filter(Boolean)
            }
          } catch {
            // fall through
          }
        }
        if (!parts.length) {
          parts = raw.split(',').map((v) => v.trim()).filter(Boolean)
        }
      }
      return parts.every((part) => /^[a-fA-F0-9]{24}$/.test(part))
    })
    .withMessage(`${field} must be a valid ObjectId or comma-separated list of ObjectIds`)

const optionalNumberField = (field) =>
  body(field)
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      return !Number.isNaN(Number(value))
    })
    .withMessage(`${field} must be a number`)

const optionalStringField = (field) =>
  body(field)
    .optional({ values: 'null' })
    .isString()
    .withMessage(`${field} must be a string`)

const objectIdRuleForKey = (fieldKey) => {
  const config = VEHICLE_LISTING_FIELDS[fieldKey]
  if (!config || config.type !== 'objectId') return []
  return [config.multi ? optionalObjectIdListField(fieldKey) : optionalObjectIdField(fieldKey)]
}

/** Validation for optional vehicle listing fields (camelCase + lowercase aliases). */
const vehicleListingFieldRules = [
  ...Object.keys(VEHICLE_LISTING_FIELDS).flatMap((key) => {
    if (key === 'kilometers' || key === 'productPrice') {
      return [optionalNumberField(key)]
    }
    if (
      key === 'phoneNumber' ||
      key === 'interiorColor' ||
      key === 'locateYourItem' ||
      key === 'buildingStreetName'
    ) {
      return [optionalStringField(key)]
    }
    return objectIdRuleForKey(key)
  }),
  ...Object.keys(API_KEY_ALIASES).flatMap((alias) => {
    const schemaKey = API_KEY_ALIASES[alias]
    if (schemaKey === 'kilometers' || schemaKey === 'productPrice') {
      return [optionalNumberField(alias)]
    }
    if (
      schemaKey === 'phoneNumber' ||
      schemaKey === 'interiorColor' ||
      schemaKey === 'locateYourItem' ||
      schemaKey === 'buildingStreetName'
    ) {
      return [optionalStringField(alias)]
    }
    const config = VEHICLE_LISTING_FIELDS[schemaKey]
    if (config?.multi) return [optionalObjectIdListField(alias)]
    return [optionalObjectIdField(alias)]
  }),
]

const createProductRules = [...vehicleListingFieldRules]
const updateProductRules = [...vehicleListingFieldRules]

module.exports = {
  listQueryRules,
  productIdParam,
  vehicleListingFieldRules,
  createProductRules,
  updateProductRules,
}
