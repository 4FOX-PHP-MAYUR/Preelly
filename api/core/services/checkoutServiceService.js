const AppError = require('../errors/AppError')
const checkoutServiceRepository = require('../repositories/checkoutServiceRepository')

const SERVICE_NAME_MIN = 2
const SERVICE_NAME_MAX = 120
const PRICE_TYPES = ['FIXED', 'STARTING_FROM', 'FREE']

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return value !== false && value !== 'false' && value !== 0 && value !== '0'
}

function parseNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function assertServiceName(value) {
  const name = String(value ?? '').trim()
  if (!name) {
    throw new AppError('Service name is required', 400, 'VALIDATION_ERROR')
  }
  if (name.length < SERVICE_NAME_MIN) {
    throw new AppError(`Service name must be at least ${SERVICE_NAME_MIN} characters`, 400, 'VALIDATION_ERROR')
  }
  if (name.length > SERVICE_NAME_MAX) {
    throw new AppError(`Service name cannot exceed ${SERVICE_NAME_MAX} characters`, 400, 'VALIDATION_ERROR')
  }
  return name
}

function assertPriceType(value) {
  const type = String(value ?? 'FIXED').trim().toUpperCase()
  if (!PRICE_TYPES.includes(type)) {
    throw new AppError('Invalid price type', 400, 'VALIDATION_ERROR')
  }
  return type
}

// FREE services carry no price; otherwise the price must be a non-negative number.
function assertPrice(value, priceType) {
  if (priceType === 'FREE') return 0
  const amount = parseNumber(value, NaN)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError('Price must be a valid non-negative number', 400, 'VALIDATION_ERROR')
  }
  return amount
}

function assertDisplayOrder(value) {
  const order = parseNumber(value, 0) ?? 0
  if (order < 0) {
    throw new AppError('Display order cannot be negative', 400, 'VALIDATION_ERROR')
  }
  return order
}

// Accepts an array of strings or an array of { highlight } objects; trims, drops
// blanks, and caps length. Returns an ordered array of clean strings.
function normalizeHighlights(raw) {
  let list = raw
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list)
    } catch {
      list = list.split('\n')
    }
  }
  if (!Array.isArray(list)) return []
  return list
    .map((item) => (typeof item === 'string' ? item : item?.highlight))
    .map((text) => String(text ?? '').trim())
    .filter(Boolean)
    .slice(0, 20)
}

async function attachHighlights(service) {
  if (!service) return service
  const highlights = await checkoutServiceRepository.findHighlights(service._id)
  return { ...service, highlights }
}

async function listCheckoutServices(params) {
  const result = await checkoutServiceRepository.findPaginated(params)
  const ids = result.items.map((s) => s._id)
  const highlights = await checkoutServiceRepository.findHighlightsForMany(ids)
  const byService = highlights.reduce((acc, h) => {
    const key = String(h.checkoutServiceId)
    ;(acc[key] = acc[key] || []).push(h)
    return acc
  }, {})
  result.items = result.items.map((s) => ({ ...s, highlights: byService[String(s._id)] || [] }))
  return result
}

async function listActiveCheckoutServices() {
  const services = await checkoutServiceRepository.findActiveAll()
  const ids = services.map((s) => s._id)
  const highlights = await checkoutServiceRepository.findHighlightsForMany(ids)
  const byService = highlights.reduce((acc, h) => {
    const key = String(h.checkoutServiceId)
    ;(acc[key] = acc[key] || []).push(h)
    return acc
  }, {})
  return services.map((s) => ({ ...s, highlights: byService[String(s._id)] || [] }))
}

async function getCheckoutServiceById(id) {
  const service = await checkoutServiceRepository.findById(id)
  if (!service) {
    throw new AppError('Checkout service not found', 404, 'CHECKOUT_SERVICE_NOT_FOUND')
  }
  return attachHighlights(service)
}

async function createCheckoutService(payload, actorId = null) {
  const serviceName = assertServiceName(payload.serviceName)

  const duplicate = await checkoutServiceRepository.findByName(serviceName)
  if (duplicate) {
    throw new AppError('A checkout service with this name already exists', 400, 'DUPLICATE_SERVICE_NAME')
  }

  const priceType = assertPriceType(payload.priceType)

  const service = await checkoutServiceRepository.create({
    serviceName,
    description: String(payload.description ?? '').trim(),
    priceType,
    price: assertPrice(payload.price, priceType),
    learnMoreUrl: String(payload.learnMoreUrl ?? '').trim(),
    buttonText: String(payload.buttonText ?? '').trim() || 'Learn More',
    displayOrder: assertDisplayOrder(payload.displayOrder),
    isDefault: parseBoolean(payload.isDefault, false),
    status: parseBoolean(payload.status, true),
    createdBy: actorId,
    updatedBy: actorId,
  })

  await checkoutServiceRepository.replaceHighlights(service._id, normalizeHighlights(payload.highlights))
  return attachHighlights(service)
}

async function updateCheckoutService(id, payload, actorId = null) {
  const existing = await checkoutServiceRepository.findById(id)
  if (!existing) {
    throw new AppError('Checkout service not found', 404, 'CHECKOUT_SERVICE_NOT_FOUND')
  }

  const updates = {}

  if (payload.serviceName !== undefined) {
    const serviceName = assertServiceName(payload.serviceName)
    const duplicate = await checkoutServiceRepository.findByName(serviceName, id)
    if (duplicate) {
      throw new AppError('A checkout service with this name already exists', 400, 'DUPLICATE_SERVICE_NAME')
    }
    updates.serviceName = serviceName
  }

  if (payload.description !== undefined) {
    updates.description = String(payload.description ?? '').trim()
  }

  // priceType and price interact — a change to either re-validates the pair.
  const nextPriceType =
    payload.priceType !== undefined ? assertPriceType(payload.priceType) : existing.priceType
  if (payload.priceType !== undefined) updates.priceType = nextPriceType
  if (payload.price !== undefined || payload.priceType !== undefined) {
    updates.price = assertPrice(payload.price !== undefined ? payload.price : existing.price, nextPriceType)
  }

  if (payload.learnMoreUrl !== undefined) {
    updates.learnMoreUrl = String(payload.learnMoreUrl ?? '').trim()
  }
  if (payload.buttonText !== undefined) {
    updates.buttonText = String(payload.buttonText ?? '').trim() || 'Learn More'
  }
  if (payload.displayOrder !== undefined) {
    updates.displayOrder = assertDisplayOrder(payload.displayOrder)
  }
  if (payload.isDefault !== undefined) {
    updates.isDefault = parseBoolean(payload.isDefault, existing.isDefault)
  }
  if (payload.status !== undefined) {
    updates.status = parseBoolean(payload.status, existing.status)
  }

  updates.updatedBy = actorId
  const updated = await checkoutServiceRepository.updateById(id, updates)
  if (!updated) {
    throw new AppError('Checkout service not found', 404, 'CHECKOUT_SERVICE_NOT_FOUND')
  }

  // Highlights are only replaced when explicitly provided.
  if (payload.highlights !== undefined) {
    await checkoutServiceRepository.replaceHighlights(id, normalizeHighlights(payload.highlights))
  }

  return attachHighlights(updated)
}

async function deleteCheckoutService(id, actorId = null) {
  const deleted = await checkoutServiceRepository.softDeleteById(id, actorId)
  if (!deleted) {
    throw new AppError('Checkout service not found', 404, 'CHECKOUT_SERVICE_NOT_FOUND')
  }
  return deleted
}

async function setCheckoutServiceStatus(id, status, actorId = null) {
  const updated = await checkoutServiceRepository.updateStatusById(id, parseBoolean(status, true), actorId)
  if (!updated) {
    throw new AppError('Checkout service not found', 404, 'CHECKOUT_SERVICE_NOT_FOUND')
  }
  return updated
}

module.exports = {
  SERVICE_NAME_MIN,
  SERVICE_NAME_MAX,
  PRICE_TYPES,
  listCheckoutServices,
  listActiveCheckoutServices,
  getCheckoutServiceById,
  createCheckoutService,
  updateCheckoutService,
  deleteCheckoutService,
  setCheckoutServiceStatus,
}
