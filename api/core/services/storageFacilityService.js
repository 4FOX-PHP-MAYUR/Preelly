const AppError = require('../errors/AppError')
const storageFacilityRepository = require('../repositories/storageFacilityRepository')

const FACILITY_WEEK_MIN = 3
const FACILITY_WEEK_MAX = 100

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return value !== false && value !== 'false' && value !== 0 && value !== '0'
}

function parseNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function assertFacilityWeek(value) {
  const week = String(value ?? '').trim()
  if (!week) {
    throw new AppError('Facility week is required', 400, 'VALIDATION_ERROR')
  }
  if (week.length < FACILITY_WEEK_MIN) {
    throw new AppError(`Facility week must be at least ${FACILITY_WEEK_MIN} characters`, 400, 'VALIDATION_ERROR')
  }
  if (week.length > FACILITY_WEEK_MAX) {
    throw new AppError(`Facility week cannot exceed ${FACILITY_WEEK_MAX} characters`, 400, 'VALIDATION_ERROR')
  }
  return week
}

function assertFacilityAmount(value) {
  const amount = parseNumber(value, NaN)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('Facility amount must be greater than 0', 400, 'VALIDATION_ERROR')
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

async function listStorageFacilities(params) {
  return storageFacilityRepository.findPaginated(params)
}

async function listActiveStorageFacilities() {
  return storageFacilityRepository.findActiveAll()
}

async function getStorageFacilityById(id) {
  const facility = await storageFacilityRepository.findById(id)
  if (!facility) {
    throw new AppError('Storage facility not found', 404, 'STORAGE_FACILITY_NOT_FOUND')
  }
  return facility
}

async function createStorageFacility(payload, actorId = null) {
  const facilityWeek = assertFacilityWeek(payload.facilityWeek)

  const duplicate = await storageFacilityRepository.findByWeek(facilityWeek)
  if (duplicate) {
    throw new AppError('A storage facility with this week already exists', 400, 'DUPLICATE_FACILITY_WEEK')
  }

  return storageFacilityRepository.create({
    facilityWeek,
    facilityAmount: assertFacilityAmount(payload.facilityAmount),
    imageIcon: payload.imageIcon || null,
    displayOrder: assertDisplayOrder(payload.displayOrder),
    status: parseBoolean(payload.status, true),
    createdBy: actorId,
    updatedBy: actorId,
  })
}

async function updateStorageFacility(id, payload, actorId = null) {
  const existing = await storageFacilityRepository.findById(id)
  if (!existing) {
    throw new AppError('Storage facility not found', 404, 'STORAGE_FACILITY_NOT_FOUND')
  }

  const updates = {}

  if (payload.facilityWeek !== undefined) {
    const facilityWeek = assertFacilityWeek(payload.facilityWeek)
    const duplicate = await storageFacilityRepository.findByWeek(facilityWeek, id)
    if (duplicate) {
      throw new AppError('A storage facility with this week already exists', 400, 'DUPLICATE_FACILITY_WEEK')
    }
    updates.facilityWeek = facilityWeek
  }

  if (payload.facilityAmount !== undefined) {
    updates.facilityAmount = assertFacilityAmount(payload.facilityAmount)
  }

  if (payload.displayOrder !== undefined) {
    updates.displayOrder = assertDisplayOrder(payload.displayOrder)
  }

  // A newly uploaded icon wins; otherwise an explicit clear removes the existing one.
  if (payload.imageIcon) {
    updates.imageIcon = payload.imageIcon
  } else if (parseBoolean(payload.clearImageIcon, false)) {
    updates.imageIcon = null
  }

  if (payload.status !== undefined) {
    updates.status = parseBoolean(payload.status, existing.status)
  }

  if (!Object.keys(updates).length) {
    return existing
  }

  updates.updatedBy = actorId

  const updated = await storageFacilityRepository.updateById(id, updates)
  if (!updated) {
    throw new AppError('Storage facility not found', 404, 'STORAGE_FACILITY_NOT_FOUND')
  }
  return updated
}

async function deleteStorageFacility(id, actorId = null) {
  const deleted = await storageFacilityRepository.softDeleteById(id, actorId)
  if (!deleted) {
    throw new AppError('Storage facility not found', 404, 'STORAGE_FACILITY_NOT_FOUND')
  }
  return deleted
}

async function setStorageFacilityStatus(id, status, actorId = null) {
  const updated = await storageFacilityRepository.updateStatusById(id, parseBoolean(status, true), actorId)
  if (!updated) {
    throw new AppError('Storage facility not found', 404, 'STORAGE_FACILITY_NOT_FOUND')
  }
  return updated
}

module.exports = {
  FACILITY_WEEK_MIN,
  FACILITY_WEEK_MAX,
  listStorageFacilities,
  listActiveStorageFacilities,
  getStorageFacilityById,
  createStorageFacility,
  updateStorageFacility,
  deleteStorageFacility,
  setStorageFacilityStatus,
}
