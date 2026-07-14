const AppError = require('../errors/AppError')
const packageRepository = require('../repositories/packageRepository')

const PACKAGE_NAME_MIN = 3
const PACKAGE_NAME_MAX = 100

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return value !== false && value !== 'false' && value !== 0 && value !== '0'
}

function parseNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

/** Normalizes the "add more" feature rows: trims, drops blanks, de-dupes. */
function normalizeFeatures(value) {
  if (value === undefined || value === null) return undefined
  const list = Array.isArray(value) ? value : [value]
  const cleaned = list
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
  return [...new Set(cleaned)]
}

function assertPackageName(value) {
  const name = String(value ?? '').trim()
  if (!name) {
    throw new AppError('Package name is required', 400, 'VALIDATION_ERROR')
  }
  if (name.length < PACKAGE_NAME_MIN) {
    throw new AppError(`Package name must be at least ${PACKAGE_NAME_MIN} characters`, 400, 'VALIDATION_ERROR')
  }
  if (name.length > PACKAGE_NAME_MAX) {
    throw new AppError(`Package name cannot exceed ${PACKAGE_NAME_MAX} characters`, 400, 'VALIDATION_ERROR')
  }
  return name
}

function assertPackageAmount(value) {
  const amount = parseNumber(value, NaN)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('Package amount must be greater than 0', 400, 'VALIDATION_ERROR')
  }
  return amount
}

/** vatAmount is a percentage of packageAmount, so it is bounded to 0–100. */
function assertVatAmount(value) {
  const vat = parseNumber(value, 0) ?? 0
  if (!Number.isFinite(vat) || vat < 0) {
    throw new AppError('VAT percentage cannot be negative', 400, 'VALIDATION_ERROR')
  }
  if (vat > 100) {
    throw new AppError('VAT percentage cannot exceed 100', 400, 'VALIDATION_ERROR')
  }
  return vat
}

function assertValidityDays(value) {
  if (value === undefined || value === null || value === '') return null
  const days = parseNumber(value, NaN)
  if (!Number.isFinite(days) || days < 1) {
    throw new AppError('Validity must be at least 1 day', 400, 'VALIDATION_ERROR')
  }
  return days
}

function assertDisplayOrder(value) {
  const order = parseNumber(value, 0) ?? 0
  if (order < 0) {
    throw new AppError('Display order cannot be negative', 400, 'VALIDATION_ERROR')
  }
  return order
}

async function listPackages(params) {
  return packageRepository.findPaginated(params)
}

async function listActivePackages() {
  return packageRepository.findActiveAll()
}

async function getPackageById(id) {
  const pkg = await packageRepository.findById(id)
  if (!pkg) {
    throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND')
  }
  return pkg
}

async function createPackage(payload, actorId = null) {
  const packageName = assertPackageName(payload.packageName)

  const duplicate = await packageRepository.findByName(packageName)
  if (duplicate) {
    throw new AppError('A package with this name already exists', 400, 'DUPLICATE_PACKAGE_NAME')
  }

  const isVatApplicable = parseBoolean(payload.isVatApplicable, false)

  return packageRepository.create({
    packageName,
    displayOrder: assertDisplayOrder(payload.displayOrder),
    packageAmount: assertPackageAmount(payload.packageAmount),
    isVatApplicable,
    vatAmount: isVatApplicable ? assertVatAmount(payload.vatAmount) : 0,
    validityDays: assertValidityDays(payload.validityDays),
    isRecomended: parseBoolean(payload.isRecomended, false),
    packageFeatures: normalizeFeatures(payload.packageFeatures) ?? [],
    status: parseBoolean(payload.status, true),
    createdBy: actorId,
    updatedBy: actorId,
  })
}

async function updatePackage(id, payload, actorId = null) {
  const existing = await packageRepository.findById(id)
  if (!existing) {
    throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND')
  }

  const updates = {}

  if (payload.packageName !== undefined) {
    const packageName = assertPackageName(payload.packageName)
    const duplicate = await packageRepository.findByName(packageName, id)
    if (duplicate) {
      throw new AppError('A package with this name already exists', 400, 'DUPLICATE_PACKAGE_NAME')
    }
    updates.packageName = packageName
  }

  if (payload.displayOrder !== undefined) {
    updates.displayOrder = assertDisplayOrder(payload.displayOrder)
  }

  if (payload.packageAmount !== undefined) {
    updates.packageAmount = assertPackageAmount(payload.packageAmount)
  }

  // VAT applicability and amount are coupled — resolve them together so
  // turning VAT off always clears any previously stored amount.
  const nextIsVatApplicable = payload.isVatApplicable !== undefined
    ? parseBoolean(payload.isVatApplicable, existing.isVatApplicable)
    : existing.isVatApplicable

  if (payload.isVatApplicable !== undefined) {
    updates.isVatApplicable = nextIsVatApplicable
  }

  if (payload.vatAmount !== undefined || payload.isVatApplicable !== undefined) {
    updates.vatAmount = nextIsVatApplicable
      ? assertVatAmount(payload.vatAmount !== undefined ? payload.vatAmount : existing.vatAmount)
      : 0
  }

  if (payload.validityDays !== undefined) {
    updates.validityDays = assertValidityDays(payload.validityDays)
  }

  if (payload.isRecomended !== undefined) {
    updates.isRecomended = parseBoolean(payload.isRecomended, existing.isRecomended)
  }

  if (payload.packageFeatures !== undefined) {
    updates.packageFeatures = normalizeFeatures(payload.packageFeatures) ?? []
  }

  if (payload.status !== undefined) {
    updates.status = parseBoolean(payload.status, existing.status)
  }

  if (!Object.keys(updates).length) {
    return existing
  }

  updates.updatedBy = actorId

  const updated = await packageRepository.updateById(id, updates)
  if (!updated) {
    throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND')
  }
  return updated
}

async function deletePackage(id, actorId = null) {
  const deleted = await packageRepository.softDeleteById(id, actorId)
  if (!deleted) {
    throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND')
  }
  return deleted
}

async function setPackageStatus(id, status, actorId = null) {
  const updated = await packageRepository.updateStatusById(id, parseBoolean(status, true), actorId)
  if (!updated) {
    throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND')
  }
  return updated
}

module.exports = {
  PACKAGE_NAME_MIN,
  PACKAGE_NAME_MAX,
  listPackages,
  listActivePackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  setPackageStatus,
}
