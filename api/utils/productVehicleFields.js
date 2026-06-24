const mongoose = require('mongoose')

/**
 * Optional vehicle/listing fields for POST/PUT /api/products.
 * API accepts lowercase keys (cityid) or camelCase (cityId).
 * Dropdown *Id fields store Filter/Category ObjectIds in MongoDB.
 * Detail API can enrich ids with display values via pickVehicleListingFields({ enrich: true }).
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
  interiorColorId: { type: 'objectId', ref: 'Filter' },
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
  interiorcolorid: 'interiorColorId',
  interiorcolor: 'interiorColorId',
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

function toIdString(value) {
  if (value == null || value === '') return null
  if (typeof value === 'object' && value._id != null) return String(value._id)
  return String(value)
}

function serializeObjectId(value) {
  const str = toIdString(value)
  if (!str) return null
  return mongoose.Types.ObjectId.isValid(str) ? str : str
}

function splitRawList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean)
  }
  const raw = String(value).trim()
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean)
      }
    } catch {
      // fall through
    }
  }
  return raw.split(',').map((v) => v.trim()).filter(Boolean)
}

function parseObjectId(value) {
  if (isEmptyValue(value)) return null
  const str = String(value).trim()
  if (!str) return null
  if (!mongoose.Types.ObjectId.isValid(str)) {
    return { pending: str }
  }
  return new mongoose.Types.ObjectId(str)
}

/** Parse single ObjectId or comma-separated / JSON array of ObjectIds. */
function parseObjectIdList(value) {
  if (isEmptyValue(value)) return null

  const parts = splitRawList(value)
  if (!parts.length) return null

  const ids = []
  const pending = []
  for (const part of parts) {
    if (mongoose.Types.ObjectId.isValid(part)) {
      ids.push(new mongoose.Types.ObjectId(part))
    } else {
      pending.push(part)
    }
  }

  if (pending.length) {
    return { pending }
  }
  return ids.length ? ids : null
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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function lookupRefByDisplayValue(refModel, displayValue) {
  const label = String(displayValue || '').trim()
  if (!label) return null

  if (refModel === 'Filter') {
    const Filter = require('../models/Filter')
    const doc = await Filter.findOne({
      name: new RegExp(`^${escapeRegex(label)}$`, 'i'),
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    })
      .select('_id name')
      .lean()
    return doc?._id ? new mongoose.Types.ObjectId(String(doc._id)) : null
  }

  if (refModel === 'Category') {
    const Category = require('../models/Category')
    const doc = await Category.findOne({
      name: new RegExp(`^${escapeRegex(label)}$`, 'i'),
      isDeleted: false,
      isActive: true,
    })
      .select('_id name')
      .lean()
    return doc?._id ? new mongoose.Types.ObjectId(String(doc._id)) : null
  }

  return null
}

/**
 * Resolve display labels (e.g. "Dubai", "Hybrid") to Filter/Category ObjectIds for storage.
 */
async function resolvePendingVehicleFieldIds(pendingResolve = {}) {
  const values = {}
  const errors = []

  for (const [schemaKey, rawValue] of Object.entries(pendingResolve || {})) {
    const config = VEHICLE_LISTING_FIELDS[schemaKey]
    if (!config || config.type !== 'objectId') continue

    if (config.multi) {
      const parts = splitRawList(rawValue)
      const ids = []
      for (const part of parts) {
        if (mongoose.Types.ObjectId.isValid(part)) {
          ids.push(new mongoose.Types.ObjectId(part))
          continue
        }
        const found = await lookupRefByDisplayValue(config.ref, part)
        if (!found) {
          errors.push(`${schemaKey}: could not resolve value "${part}" to ${config.ref} ObjectId`)
          continue
        }
        ids.push(found)
      }
      if (ids.length) values[schemaKey] = ids
      continue
    }

    const raw = String(rawValue).trim()
    if (mongoose.Types.ObjectId.isValid(raw)) {
      values[schemaKey] = new mongoose.Types.ObjectId(raw)
      continue
    }

    const found = await lookupRefByDisplayValue(config.ref, raw)
    if (!found) {
      errors.push(`${schemaKey}: could not resolve value "${raw}" to ${config.ref} ObjectId`)
      continue
    }
    values[schemaKey] = found
  }

  return { values, errors }
}

/**
 * Parse vehicle listing fields from a request body (multipart form fields).
 * Non-ObjectId dropdown values are queued in pendingResolve for async lookup.
 * @returns {{ values: Record<string, unknown>, pendingResolve: Record<string, unknown>, errors: string[] }}
 */
function parseProductVehicleFields(body = {}) {
  const values = {}
  const pendingResolve = {}
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
      if (parsed && parsed.pending) {
        pendingResolve[schemaKey] = config.multi ? splitRawList(rawValue) : parsed.pending
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

  return { values, pendingResolve, errors }
}

/**
 * Parse + resolve all vehicle fields (ObjectId storage in DB).
 */
async function parseAndResolveProductVehicleFields(body = {}) {
  const { values, pendingResolve, errors } = parseProductVehicleFields(body)
  if (errors.length) {
    return { values, errors }
  }

  const resolved = await resolvePendingVehicleFieldIds(pendingResolve)
  return {
    values: { ...values, ...resolved.values },
    errors: resolved.errors,
  }
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

async function buildVehicleFieldLookupMaps(product = {}) {
  const filterIds = new Set()
  const categoryIds = new Set()

  for (const [key, config] of Object.entries(VEHICLE_LISTING_FIELDS)) {
    if (config.type !== 'objectId') continue
    const raw = product[key]
    if (config.multi) {
      const list = Array.isArray(raw) ? raw : raw != null ? [raw] : []
      for (const item of list) {
        const id = toIdString(item)
        if (!id) continue
        if (config.ref === 'Filter') filterIds.add(id)
        if (config.ref === 'Category') categoryIds.add(id)
      }
      continue
    }
    const id = toIdString(raw)
    if (!id) continue
    if (config.ref === 'Filter') filterIds.add(id)
    if (config.ref === 'Category') categoryIds.add(id)
  }

  // Legacy: interiorColor may hold an ObjectId string from older creates
  const legacyInterior = toIdString(product.interiorColor)
  if (legacyInterior && mongoose.Types.ObjectId.isValid(legacyInterior)) {
    filterIds.add(legacyInterior)
  }

  const [filters, categories] = await Promise.all([
    filterIds.size
      ? require('../models/Filter')
          .find({ _id: { $in: [...filterIds] } })
          .select('_id name')
          .lean()
      : [],
    categoryIds.size
      ? require('../models/Category')
          .find({ _id: { $in: [...categoryIds] } })
          .select('_id name')
          .lean()
      : [],
  ])

  const filterNames = new Map(filters.map((f) => [String(f._id), f.name]))
  const categoryNames = new Map(categories.map((c) => [String(c._id), c.name]))

  return { filterNames, categoryNames }
}

function resolveFieldDisplayValue(key, config, raw, lookupMaps) {
  if (config.type !== 'objectId') {
    return raw ?? null
  }

  const map = config.ref === 'Category' ? lookupMaps.categoryNames : lookupMaps.filterNames

  if (config.multi) {
    const list = Array.isArray(raw) ? raw : raw != null ? [raw] : []
    return list.map((item) => {
      const id = serializeObjectId(item)
      return id ? map.get(id) || null : null
    })
  }

  const id = serializeObjectId(raw)
  return id ? map.get(id) || null : null
}

/**
 * Pick vehicle listing fields from a product document for DTO output.
 * @param {object} product
 * @param {{ enrich?: boolean, lookupMaps?: { filterNames: Map, categoryNames: Map } }} options
 */
function pickVehicleListingFields(product = {}, options = {}) {
  const { enrich = false, lookupMaps = null } = options
  const out = {}

  for (const [key, config] of Object.entries(VEHICLE_LISTING_FIELDS)) {
    let value = product[key]

    // Legacy fallback: interiorColor stored as ObjectId string
    if (key === 'interiorColorId' && (value == null || value === '') && product.interiorColor) {
      const legacy = toIdString(product.interiorColor)
      if (legacy && mongoose.Types.ObjectId.isValid(legacy)) {
        value = legacy
      }
    }

    if (config.multi) {
      if (Array.isArray(value) && value.length) {
        out[key] = value.map((item) => serializeObjectId(item)).filter(Boolean)
      } else if (value != null && value !== '') {
        out[key] = [serializeObjectId(value)].filter(Boolean)
      } else {
        out[key] = null
      }

      if (enrich && lookupMaps && out[key]?.length) {
        out[`${key}Value`] = resolveFieldDisplayValue(key, config, value, lookupMaps)
      }
      continue
    }

    out[key] = value != null && value !== '' ? serializeObjectId(value) : null

    if (enrich && lookupMaps && out[key]) {
      out[`${key}Value`] = resolveFieldDisplayValue(key, config, value, lookupMaps)
    }
  }

  return out
}

async function pickVehicleListingFieldsEnriched(product = {}) {
  const presentation = await buildVehicleDetailPresentation(product)
  return presentation.vehicleListingFields
}

function pickResolvedValue(fields, idKey) {
  const value = fields?.[`${idKey}Value`]
  if (value === null || value === undefined || value === '') return null
  return value
}

function isObjectIdString(value) {
  const str = toIdString(value)
  return Boolean(str && /^[a-fA-F0-9]{24}$/.test(str))
}

/** Replace legacy string fields that accidentally store raw ObjectIds. */
function buildSanitizedLegacyVehicleFields(product = {}, fields = {}) {
  const out = {}
  const scalarMap = {
    fuelType: 'fuelTypeId',
    transmission: 'transmissionTypeId',
    bodyType: 'bodyTypeId',
    warranty: 'warrantyId',
    doors: 'doorsId',
    color: 'exteriorColorId',
  }

  for (const [legacyKey, idKey] of Object.entries(scalarMap)) {
    const resolved = pickResolvedValue(fields, idKey)
    if (resolved) {
      out[legacyKey] = resolved
      continue
    }
    const current = product[legacyKey]
    if (current != null && current !== '' && !isObjectIdString(current)) {
      out[legacyKey] = current
    }
  }

  const interiorResolved = pickResolvedValue(fields, 'interiorColorId')
  if (interiorResolved) {
    out.interiorColor = interiorResolved
  } else if (product.interiorColor && !isObjectIdString(product.interiorColor)) {
    out.interiorColor = product.interiorColor
  }

  if (fields.kilometers != null) out.kilometers = fields.kilometers
  if (pickResolvedValue(fields, 'trimId')) out.trim = pickResolvedValue(fields, 'trimId')
  else if (product.trim && !isObjectIdString(product.trim)) out.trim = product.trim

  if (pickResolvedValue(fields, 'modelId')) out.model = pickResolvedValue(fields, 'modelId')
  else if (product.model && !isObjectIdString(product.model)) out.model = product.model

  if (pickResolvedValue(fields, 'cityId')) out.city = pickResolvedValue(fields, 'cityId')
  else if (product.city && !isObjectIdString(product.city)) out.city = product.city

  return out
}

function buildCarOverview(product = {}, fields = {}) {
  const kilometers = fields.kilometers ?? product.kilometers ?? product.mileage ?? null

  return {
    engineCapacity: pickResolvedValue(fields, 'engineCapacityId'),
    fuelType: pickResolvedValue(fields, 'fuelTypeId'),
    transmission: pickResolvedValue(fields, 'transmissionTypeId'),
    bodyType: pickResolvedValue(fields, 'bodyTypeId'),
    doors: pickResolvedValue(fields, 'doorsId'),
    horsepower: pickResolvedValue(fields, 'horsepowerId'),
    kilometers: kilometers != null && kilometers !== '' ? Number(kilometers) : null,
    trim:
      pickResolvedValue(fields, 'trimId') ||
      (product.trim && !isObjectIdString(product.trim) ? product.trim : null) ||
      product.variant ||
      null,
    seatingCapacity: pickResolvedValue(fields, 'seatId'),
    interiorColor: pickResolvedValue(fields, 'interiorColorId'),
    warranty: pickResolvedValue(fields, 'warrantyId'),
    cylinders: pickResolvedValue(fields, 'numberOfCylenderId'),
    condition: product.condition || null,
    city:
      pickResolvedValue(fields, 'cityId') ||
      (product.city && !isObjectIdString(product.city) ? product.city : null),
    regionalSpecs: pickResolvedValue(fields, 'regionalSpecsId'),
    year:
      pickResolvedValue(fields, 'yearId') ||
      (product.year && !isObjectIdString(product.year) ? product.year : null),
    exteriorColor: pickResolvedValue(fields, 'exteriorColorId'),
    steeringSide: pickResolvedValue(fields, 'steeringSideId'),
    isInsured: pickResolvedValue(fields, 'isInsuredId'),
    model:
      pickResolvedValue(fields, 'modelId') ||
      (product.model && !isObjectIdString(product.model) ? product.model : null),
    engineCapacityId: fields.engineCapacityId || null,
    fuelTypeId: fields.fuelTypeId || null,
    transmissionTypeId: fields.transmissionTypeId || null,
    bodyTypeId: fields.bodyTypeId || null,
    doorsId: fields.doorsId || null,
    horsepowerId: fields.horsepowerId || null,
    trimId: fields.trimId || null,
    seatId: fields.seatId || null,
    interiorColorId: fields.interiorColorId || null,
    warrantyId: fields.warrantyId || null,
    numberOfCylenderId: fields.numberOfCylenderId || null,
  }
}

function buildVehicleFeatureSections(fields = {}) {
  return [
    { title: 'Driver Assistance & Safety', items: pickResolvedValue(fields, 'driverAssistanceSafetyId') || [] },
    { title: 'Entertainment & Technology', items: pickResolvedValue(fields, 'entertainmentTechnologyId') || [] },
    { title: 'Comfort & Convenience', items: pickResolvedValue(fields, 'comfortConvenienceId') || [] },
    { title: 'Exterior', items: pickResolvedValue(fields, 'exteriorId') || [] },
  ].filter((section) => Array.isArray(section.items) && section.items.length)
}

/**
 * Resolve stored vehicle ObjectIds to display labels for product detail APIs.
 */
async function buildVehicleDetailPresentation(product = {}) {
  const lookupMaps = await buildVehicleFieldLookupMaps(product)
  const vehicleListingFields = pickVehicleListingFields(product, { enrich: true, lookupMaps })
  const carOverview = buildCarOverview(product, vehicleListingFields)
  const vehicleFeatures = buildVehicleFeatureSections(vehicleListingFields)
  const legacyFields = buildSanitizedLegacyVehicleFields(product, vehicleListingFields)

  return {
    vehicleListingFields,
    carOverview,
    vehicleFeatures,
    legacyFields,
  }
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
            description: `Optional ${key} — ObjectId or display value (${config.ref} ref, stored as ObjectId)`,
          }
        : {
            type: 'string',
            nullable: true,
            description: `Optional ${key} — ObjectId or display value (stored as ${config.ref} ObjectId)`,
          }
      props[`${key}Value`] = config.multi
        ? { type: 'array', nullable: true, items: { type: 'string' }, description: `Resolved display label(s) for ${key}` }
        : { type: 'string', nullable: true, description: `Resolved display label for ${key}` }
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
  parseAndResolveProductVehicleFields,
  resolvePendingVehicleFieldIds,
  applyProductVehicleFields,
  pickVehicleListingFields,
  pickVehicleListingFieldsEnriched,
  buildVehicleDetailPresentation,
  buildCarOverview,
  buildVehicleFeatureSections,
  buildVehicleFieldLookupMaps,
  getVehicleFieldSwaggerProperties,
}
