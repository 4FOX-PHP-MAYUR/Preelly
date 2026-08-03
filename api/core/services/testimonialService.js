const AppError = require('../errors/AppError')
const testimonialRepository = require('../repositories/testimonialRepository')

const NAME_MIN = 2
const NAME_MAX = 100
const TESTIMONIAL_MIN = 10
const TESTIMONIAL_MAX = 2000
const CUSTOMER_TYPES = ['seller', 'buyer']

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return value !== false && value !== 'false' && value !== 0 && value !== '0'
}

function parseNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function assertTestimonialName(value) {
  const name = String(value ?? '').trim()
  if (!name) {
    throw new AppError('Testimonial name is required', 400, 'VALIDATION_ERROR')
  }
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new AppError(`Testimonial name must be between ${NAME_MIN} and ${NAME_MAX} characters`, 400, 'VALIDATION_ERROR')
  }
  return name
}

function assertCustomerType(value) {
  const type = String(value ?? '').trim().toLowerCase()
  if (!CUSTOMER_TYPES.includes(type)) {
    throw new AppError('Customer type must be Seller or Buyer', 400, 'VALIDATION_ERROR')
  }
  return type
}

function assertTestimonialText(value) {
  const text = String(value ?? '').trim()
  if (!text) {
    throw new AppError('Testimonial is required', 400, 'VALIDATION_ERROR')
  }
  if (text.length < TESTIMONIAL_MIN || text.length > TESTIMONIAL_MAX) {
    throw new AppError(`Testimonial must be between ${TESTIMONIAL_MIN} and ${TESTIMONIAL_MAX} characters`, 400, 'VALIDATION_ERROR')
  }
  return text
}

function assertRating(value) {
  const rating = parseNumber(value, NaN)
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new AppError('Rating must be between 1 and 5', 400, 'VALIDATION_ERROR')
  }
  return rating
}

function assertDisplayOrder(value) {
  const order = parseNumber(value, 0) ?? 0
  if (order < 0) {
    throw new AppError('Display order cannot be negative', 400, 'VALIDATION_ERROR')
  }
  return order
}

async function listTestimonials(params) {
  return testimonialRepository.findPaginated(params)
}

async function listTestimonialsForExport(params) {
  return testimonialRepository.findAllForExport(params)
}

async function listActiveTestimonials() {
  return testimonialRepository.findActiveAll()
}

async function getTestimonialById(id) {
  const testimonial = await testimonialRepository.findById(id)
  if (!testimonial) {
    throw new AppError('Testimonial not found', 404, 'TESTIMONIAL_NOT_FOUND')
  }
  return testimonial
}

async function createTestimonial(payload, actorId = null) {
  return testimonialRepository.create({
    testimonialName: assertTestimonialName(payload.testimonialName),
    customerType: assertCustomerType(payload.customerType),
    testimonial: assertTestimonialText(payload.testimonial),
    profileImage: payload.profileImage || null,
    rating: assertRating(payload.rating),
    displayOrder: assertDisplayOrder(payload.displayOrder),
    status: parseBoolean(payload.status, true),
    createdBy: actorId,
    updatedBy: actorId,
  })
}

async function updateTestimonial(id, payload, actorId = null) {
  const existing = await testimonialRepository.findById(id)
  if (!existing) {
    throw new AppError('Testimonial not found', 404, 'TESTIMONIAL_NOT_FOUND')
  }

  const updates = {}

  if (payload.testimonialName !== undefined) updates.testimonialName = assertTestimonialName(payload.testimonialName)
  if (payload.customerType !== undefined) updates.customerType = assertCustomerType(payload.customerType)
  if (payload.testimonial !== undefined) updates.testimonial = assertTestimonialText(payload.testimonial)
  if (payload.rating !== undefined) updates.rating = assertRating(payload.rating)
  if (payload.displayOrder !== undefined) updates.displayOrder = assertDisplayOrder(payload.displayOrder)
  if (payload.status !== undefined) updates.status = parseBoolean(payload.status, existing.status)

  // A newly uploaded image wins; otherwise an explicit clear removes the existing one.
  if (payload.profileImage) {
    updates.profileImage = payload.profileImage
  } else if (parseBoolean(payload.clearProfileImage, false)) {
    updates.profileImage = null
  }

  if (!Object.keys(updates).length) {
    return existing
  }

  updates.updatedBy = actorId

  const updated = await testimonialRepository.updateById(id, updates)
  if (!updated) {
    throw new AppError('Testimonial not found', 404, 'TESTIMONIAL_NOT_FOUND')
  }
  return updated
}

async function deleteTestimonial(id, actorId = null) {
  const deleted = await testimonialRepository.softDeleteById(id, actorId)
  if (!deleted) {
    throw new AppError('Testimonial not found', 404, 'TESTIMONIAL_NOT_FOUND')
  }
  return deleted
}

async function setTestimonialStatus(id, status, actorId = null) {
  const updated = await testimonialRepository.updateStatusById(id, parseBoolean(status, true), actorId)
  if (!updated) {
    throw new AppError('Testimonial not found', 404, 'TESTIMONIAL_NOT_FOUND')
  }
  return updated
}

module.exports = {
  NAME_MIN,
  NAME_MAX,
  TESTIMONIAL_MIN,
  TESTIMONIAL_MAX,
  CUSTOMER_TYPES,
  listTestimonials,
  listTestimonialsForExport,
  listActiveTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  setTestimonialStatus,
}
