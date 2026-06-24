const AppError = require('../errors/AppError')
const emirateRepository = require('../repositories/emirateRepository')

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseStatus(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue
  return value !== false && value !== 'false' && value !== 0 && value !== '0'
}

async function listEmirates(params) {
  return emirateRepository.findPaginated(params)
}

async function listActiveEmirates() {
  const items = await emirateRepository.findActiveAll()
  return items
}

async function getEmirateById(id) {
  const emirate = await emirateRepository.findById(id)
  if (!emirate) {
    throw new AppError('Emirate not found', 404, 'EMIRATE_NOT_FOUND')
  }
  return emirate
}

async function createEmirate(payload) {
  const name = String(payload.name || '').trim()
  if (!name) {
    throw new AppError('Name is required', 400, 'VALIDATION_ERROR')
  }

  const slug = payload.slug ? slugify(payload.slug) : slugify(name)
  if (!slug) {
    throw new AppError('Slug is required', 400, 'VALIDATION_ERROR')
  }

  const existing = await emirateRepository.findBySlug(slug)
  if (existing) {
    throw new AppError('An emirate with this slug already exists', 400, 'DUPLICATE_SLUG')
  }

  return emirateRepository.create({
    name,
    slug,
    status: parseStatus(payload.status, true),
  })
}

async function updateEmirate(id, payload) {
  const existing = await emirateRepository.findById(id)
  if (!existing) {
    throw new AppError('Emirate not found', 404, 'EMIRATE_NOT_FOUND')
  }

  const updates = {}

  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim()
    if (!name) throw new AppError('Name cannot be empty', 400, 'VALIDATION_ERROR')
    updates.name = name
  }

  if (payload.slug !== undefined) {
    const slug = slugify(payload.slug)
    if (!slug) throw new AppError('Slug cannot be empty', 400, 'VALIDATION_ERROR')
    const dup = await emirateRepository.findBySlug(slug, id)
    if (dup) throw new AppError('An emirate with this slug already exists', 400, 'DUPLICATE_SLUG')
    updates.slug = slug
  } else if (payload.name !== undefined && !payload.slug) {
    updates.slug = slugify(updates.name)
  }

  if (payload.status !== undefined) {
    updates.status = parseStatus(payload.status, existing.status)
  }

  if (!Object.keys(updates).length) {
    return existing
  }

  const updated = await emirateRepository.updateById(id, updates)
  if (!updated) {
    throw new AppError('Emirate not found', 404, 'EMIRATE_NOT_FOUND')
  }
  return updated
}

async function deleteEmirate(id) {
  const deleted = await emirateRepository.softDeleteById(id)
  if (!deleted) {
    throw new AppError('Emirate not found', 404, 'EMIRATE_NOT_FOUND')
  }
  return deleted
}

async function setEmirateStatus(id, status) {
  const updated = await emirateRepository.updateStatusById(id, parseStatus(status, true))
  if (!updated) {
    throw new AppError('Emirate not found', 404, 'EMIRATE_NOT_FOUND')
  }
  return updated
}

module.exports = {
  listEmirates,
  listActiveEmirates,
  getEmirateById,
  createEmirate,
  updateEmirate,
  deleteEmirate,
  setEmirateStatus,
}
