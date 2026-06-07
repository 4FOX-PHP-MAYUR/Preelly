const mongoose = require('mongoose')

/**
 * Optional vehicle/listing fields for POST/PUT /api/products.
 * API accepts lowercase keys (cityid) or camelCase (cityId).
 * Stored on Product using camelCase schema paths.
 */
const VEHICLE_LISTING_FIELDS = {
  cityId: { type: 'objectId', ref: 'Filter' },
  modelId: { type: 'objectId', ref: 'Category' },
  trimId: { type: 'objectId', ref: 'Category' },
  regionalSpecsId: { type: 'objectId', ref: 'Filter' },
  yearId: { type: 'objectId', ref: 'Filter' },
  kilometers: { type: 'number' },
  bodyTypeId: { type: 'objectId', ref: 'Filter' },
  seatId: { type: 'objectId', ref: 'Filter' },
  isInsuredId: { type: 'objectId', ref: 'Filter' },
  productPrice: { type: 'number' },
  phoneNumber: { type: 'string' },
  exteriorColorId: { type: 'objectId', ref: 'Filter' },
  interiorColor: { type: 'string' },
  warrantyId: { type: 'objectId', ref: 'Filter' },
  fuelTypeId: { type: 'objectId', ref: 'Filter' },
  doorsId: { type: 'objectId', ref: 'Filter' },
  numberOfCylenderId: { type: 'objectId', ref: 'Filter' },
  transmissionTypeId: { type: 'objectId', ref: 'Filter' },
  horsepowerId: { type: 'objectId', ref: 'Filter' },
  steeringSideId: { type: 'objectId', ref: 'Filter' },
  engineCapacityId: { type: 'objectId', ref: 'Filter' },
  driverAssistanceSafetyId: { type: 'objectId', ref: 'Filter', multi: true },
  entertainmentTechnologyId: { type: 'objectId', ref: 'Filter', multi: true },
  comfortConvenienceId: { type: 'objectId', ref: 'Filter', multi: true },
  exteriorId: { type: 'objectId', ref: 'Filter', multi: true },
  locateYourItem: { type: 'string' },
  buildingStreetName: { type: 'string' },
}

/** Lowercase / legacy API key → schema key */
const API_KEY_ALIASES = {
  cityid: 'cityId',
  modelid: 'modelId',
  trimid: 'trimId',
  regionalspecsid: 'regionalSpecsId',
  yearid: 'yearId',
  bodytypeid: 'bodyTypeId',
  seatid: 'seatId',
  isinsuredid: 'isInsuredId',
  productprice: 'productPrice',
  phonenumber: 'phoneNumber',
  exteriorcolorid: 'exteriorColorId',
  interiorcolor: 'interiorColor',
  warrantyid: 'warrantyId',
  fueltypeid: 'fuelTypeId',
  doorsid: 'doorsId',
  numberofcylenderid: 'numberOfCylenderId',
  transmissiontypeid: 'transmissionTypeId',
  horsepowerid: 'horsepowerId',
  steeringsideid: 'steeringSideId',
  enginecapacityid: 'engineCapacityId',
  driverassistancesafetyid: 'driverAssistanceSafetyId',
  entertainmenttechnologyid: 'entertainmentTechnologyId',
  comforfconvenienceid: 'comfortConvenienceId',
  comfortconvenienceid: 'comfortConvenienceId',
  exteriorid: 'exteriorId',
  locateyouritem: 'locateYourItem',
  buildingstreetname: 'buildingStreetName',
}

const SCHEMA_KEYS = Object.keys(VEHICLE_LISTING_FIELDS)

const HANDLED_REQUEST_KEYS = new Set([
  ...SCHEMA_KEYS,
  ...Object.keys(API_KEY_ALIASES),
])

function normalizeRequestKey(key) {
  if (!key) return null
  if (VEHICLE_LISTING_FIELDS[key]) return key
  const alias = API_KEY_ALIASES[String(key).toLowerCase()]
  return alias || null
}

function isEmptyValue(value) {
  return value === undefined || value === null || value === ''
}

function parseObjectId(value) {
  if (isEmptyValue(value)) return null
  const str = String(value).trim()
  if (!str) return null
  if (!mongoose.Types.ObjectId.isValid(str)) {
    return { error: `Invalid ObjectId: ${str}` }
  }
  return new mongoose.Types.ObjectId(str)
}

/** Parse single ObjectId or comma-separated / JSON array of ObjectIds. */
function parseObjectIdList(value) {
  if (isEmptyValue(value)) return null

  let parts = []
  if (Array.isArray(value)) {
    parts = value.map((v) => String(v).trim()).filter(Boolean)
  } else {
    const raw = String(value).trim()
    if (!raw) return null
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          parts = parsed.map((v) => String(v).trim()).filter(Boolean)
        }
      } catch {
        // fall through to comma split
      }
    }
    if (!parts.length) {
      parts = raw.split(',').map((v) => v.trim()).filter(Boolean)
    }
  }

  if (!parts.length) return null

  const ids = []
  for (const part of parts) {
    if (!mongoose.Types.ObjectId.isValid(part)) {
      return { error: `Invalid ObjectId: ${part}` }
    }
    ids.push(new mongoose.Types.ObjectId(part))
  }

  return ids
}

function parseNumber(value) {
  if (isEmptyValue(value)) return null
  const num = Number(value)
  if (Number.isNaN(num)) {
    return { error: `Invalid number: ${value}` }
  }
  return num
}

function parseString(value) {
  if (isEmptyValue(value)) return null
  return String(value).trim() || null
}

/**
 * Parse vehicle listing fields from a request body (multipart form fields).
 * @returns {{ values: Record<string, unknown>, errors: string[] }}
 */
function parseProductVehicleFields(body = {}) {
  const values = {}
  const errors = []

  for (const [rawKey, rawValue] of Object.entries(body || {})) {
    const schemaKey = normalizeRequestKey(rawKey)
    if (!schemaKey) continue

    const config = VEHICLE_LISTING_FIELDS[schemaKey]
    let parsed

    if (config.type === 'objectId') {
      parsed = config.multi ? parseObjectIdList(rawValue) : parseObjectId(rawValue)
      if (parsed && parsed.error) {
        errors.push(`${schemaKey}: ${parsed.error}`)
        continue
      }
      values[schemaKey] = parsed
    } else if (config.type === 'number') {
      parsed = parseNumber(rawValue)
      if (parsed && typeof parsed === 'object' && parsed.error) {
        errors.push(`${schemaKey}: ${parsed.error}`)
        continue
      }
      values[schemaKey] = parsed
    } else {
      values[schemaKey] = parseString(rawValue)
    }
  }

  return { values, errors }
}

/**
 * Apply parsed vehicle fields onto a plain object or Mongoose document.
 * Only sets keys present in `values` (partial update friendly).
 */
function applyProductVehicleFields(target, values = {}) {
  if (!target || !values) return target
  for (const [key, value] of Object.entries(values)) {
    target[key] = value
  }
  return target
}

/** Pick vehicle listing fields from a product document for DTO output. */
function pickVehicleListingFields(product = {}) {
  const out = {}
  for (const [key, config] of Object.entries(VEHICLE_LISTING_FIELDS)) {
    const value = product[key]
    if (config.multi) {
      if (Array.isArray(value) && value.length) {
        out[key] = value
      } else if (value != null && value !== '') {
        out[key] = [value]
      } else {
        out[key] = null
      }
      continue
    }
    out[key] = value ?? null
  }
  return out
}

function getVehicleFieldSwaggerProperties() {
  const props = {}
  for (const [key, config] of Object.entries(VEHICLE_LISTING_FIELDS)) {
    if (config.type === 'objectId') {
      props[key] = config.multi
        ? {
            type: 'array',
            nullable: true,
            items: { type: 'string' },
            description: `Optional ${key} — single ObjectId, comma-separated ObjectIds, or JSON array (${config.ref} refs)`,
          }
        : {
            type: 'string',
            nullable: true,
            description: `Optional ${key} (stores ${config.ref} ObjectId)`,
          }
    } else if (config.type === 'number') {
      props[key] = { type: 'number', nullable: true }
    } else {
      props[key] = { type: 'string', nullable: true }
    }
  }
  return props
}

module.exports = {
  VEHICLE_LISTING_FIELDS,
  API_KEY_ALIASES,
  SCHEMA_KEYS,
  HANDLED_REQUEST_KEYS,
  normalizeRequestKey,
  parseProductVehicleFields,
  applyProductVehicleFields,
  pickVehicleListingFields,
  getVehicleFieldSwaggerProperties,
}
