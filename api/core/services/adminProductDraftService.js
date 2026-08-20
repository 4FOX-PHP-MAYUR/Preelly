const { Types } = require('mongoose')
const AppError = require('../errors/AppError')
const productDraftRepository = require('../repositories/productDraftRepository')
const User = require('../../models/User')
const Category = require('../../models/Category')
const Product = require('../../models/Product')

/**
 * Admin Panel business rules for the existing `productDraft` collection.
 *
 * The wizard writes `formValues` / `dynamicFormValues` as free-form Mixed maps,
 * so every admin write is sanitised (no `$`/dotted/prototype keys, bounded depth
 * and size) and merged onto what is already stored — an admin editing the title
 * must never drop the AI transcript, filter answers or media metadata that the
 * seller's flow put there.
 */

const STATUSES = productDraftRepository.STATUSES
const MAX_STEP = 20
const MAX_MIXED_KEYS = 400
const MAX_MIXED_DEPTH = 6
const MAX_STRING_LENGTH = 20000
const MAX_ARRAY_LENGTH = 200
/** Cap on ids resolved to names per request, so a hostile payload cannot fan out. */
const MAX_RESOLVED_IDS = 200

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
}

function isObjectIdLike(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
}

/**
 * Mongo rejects `$`-prefixed and dotted keys inside documents, and either can be
 * used to smuggle operators into a Mixed field — drop them rather than fail the
 * whole save, and drop prototype-polluting keys outright.
 */
function sanitizeMixedValue(value, depth = 0, counter = { keys: 0 }) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH)
  if (value instanceof Date) return value

  if (depth >= MAX_MIXED_DEPTH) return null

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeMixedValue(item, depth + 1, counter))
      .filter((item) => item !== undefined)
  }

  if (isPlainObject(value)) {
    const out = {}
    for (const [rawKey, rawValue] of Object.entries(value)) {
      const key = String(rawKey)
      if (!key || key.startsWith('$') || key.includes('.') || BLOCKED_KEYS.has(key)) continue
      if (counter.keys >= MAX_MIXED_KEYS) break
      counter.keys += 1
      out[key] = sanitizeMixedValue(rawValue, depth + 1, counter)
    }
    return out
  }

  return null
}

function assertMixedObject(value, label) {
  if (value === undefined || value === null) return {}
  if (typeof value === 'string') {
    // Multipart/urlencoded clients may send the map as a JSON string.
    try {
      const parsed = JSON.parse(value)
      if (!isPlainObject(parsed)) throw new Error('not an object')
      return sanitizeMixedValue(parsed)
    } catch {
      throw new AppError(`${label} must be a valid JSON object`, 400, 'VALIDATION_ERROR')
    }
  }
  if (!isPlainObject(value)) {
    throw new AppError(`${label} must be an object`, 400, 'VALIDATION_ERROR')
  }
  return sanitizeMixedValue(value)
}

function assertObjectId(value, label) {
  const id = String(value ?? '').trim()
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`${label} is not a valid id`, 400, 'VALIDATION_ERROR')
  }
  return id
}

async function assertUserExists(value) {
  const id = assertObjectId(value, 'User')
  const user = await User.findById(id).select('_id').lean()
  if (!user) {
    throw new AppError('Selected user does not exist', 404, 'USER_NOT_FOUND')
  }
  return id
}

async function assertCategoryExists(value) {
  const id = assertObjectId(value, 'Category')
  const category = await Category.findOne({ _id: id, isDeleted: false }).select('_id').lean()
  if (!category) {
    throw new AppError('Selected category does not exist', 404, 'CATEGORY_NOT_FOUND')
  }
  return id
}

async function assertProductExists(value) {
  const id = assertObjectId(value, 'Product')
  const product = await Product.findById(id).select('_id').lean()
  if (!product) {
    throw new AppError('Linked product does not exist', 404, 'PRODUCT_NOT_FOUND')
  }
  return id
}

function assertStatus(value) {
  const status = String(value ?? '').trim().toLowerCase()
  if (!STATUSES.includes(status)) {
    throw new AppError(`Status must be one of: ${STATUSES.join(', ')}`, 400, 'VALIDATION_ERROR')
  }
  return status
}

function assertStep(value, label) {
  const num = Number(value)
  if (!Number.isInteger(num) || num < 1 || num > MAX_STEP) {
    throw new AppError(`${label} must be a whole number between 1 and ${MAX_STEP}`, 400, 'VALIDATION_ERROR')
  }
  return num
}

function assertCategoryLevel(value) {
  const num = Number(value)
  if (!Number.isInteger(num) || num < 0 || num > MAX_STEP) {
    throw new AppError(`Category level must be a whole number between 0 and ${MAX_STEP}`, 400, 'VALIDATION_ERROR')
  }
  return num
}

async function assertSelectedPath(value) {
  if (value === undefined || value === null || value === '') return []
  let list = value
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value)
    } catch {
      list = value.split(',')
    }
  }
  if (!Array.isArray(list)) {
    throw new AppError('Category path must be a list of category ids', 400, 'VALIDATION_ERROR')
  }
  const ids = list
    .map((entry) => {
      if (isPlainObject(entry)) return String(entry._id || entry.id || '')
      return String(entry ?? '')
    })
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, MAX_STEP)

  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    await assertCategoryExists(id)
  }
  return ids
}

/**
 * The unique partial index (`userId` + status 'draft') allows one live draft per
 * user. Surface that as a clear conflict instead of a raw E11000.
 */
async function assertNoOtherLiveDraft(userId, excludeId = null) {
  const existing = await productDraftRepository.findLiveByUserId(userId, excludeId)
  if (existing) {
    throw new AppError(
      'This user already has an in-progress draft. Edit that draft, or set this one to Published/Discarded.',
      409,
      'DRAFT_ALREADY_EXISTS'
    )
  }
}

function mapDuplicateKeyError(error) {
  if (error && error.code === 11000) {
    return new AppError(
      'This user already has an in-progress draft. Edit that draft, or set this one to Published/Discarded.',
      409,
      'DRAFT_ALREADY_EXISTS'
    )
  }
  return error
}

/** Collect ObjectId-looking values so the UI can show names instead of raw ids. */
function collectIdCandidates(value, out = new Set(), depth = 0) {
  if (out.size >= MAX_RESOLVED_IDS || depth > MAX_MIXED_DEPTH) return out
  if (isObjectIdLike(value)) {
    out.add(value)
    return out
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectIdCandidates(item, out, depth + 1))
    return out
  }
  if (isPlainObject(value)) {
    Object.values(value).forEach((item) => collectIdCandidates(item, out, depth + 1))
  }
  return out
}

async function resolveCategoryNames(ids) {
  const list = [...new Set([...ids].filter(isObjectIdLike))].slice(0, MAX_RESOLVED_IDS)
  if (!list.length) return {}
  const categories = await Category.find({ _id: { $in: list } })
    .select('name slug level parentId')
    .lean()
  const map = {}
  categories.forEach((c) => {
    map[String(c._id)] = { id: String(c._id), name: c.name, slug: c.slug || null, level: c.level ?? null }
  })
  return map
}

async function listDrafts(params) {
  const result = await productDraftRepository.findPaginated(params)

  // One extra query per page turns the category ids stored on each draft into names.
  const ids = new Set()
  result.items.forEach((item) => {
    collectIdCandidates(item.selectedCategory, ids)
    collectIdCandidates(item.selectedPath, ids)
  })
  const categoryMap = await resolveCategoryNames(ids)

  return { ...result, categoryMap }
}

async function getDraftStatusCounts() {
  return productDraftRepository.countByStatus()
}

/** Pairs a single draft with the category names its ids resolve to. */
async function withCategoryMap(draft) {
  const ids = new Set()
  collectIdCandidates(draft.selectedCategory, ids)
  collectIdCandidates(draft.selectedPath, ids)
  collectIdCandidates(draft.formValues, ids)
  collectIdCandidates(draft.dynamicFormValues, ids)
  return { draft, categoryMap: await resolveCategoryNames(ids) }
}

async function getDraftById(id) {
  if (!Types.ObjectId.isValid(String(id))) {
    throw new AppError('Invalid draft id', 400, 'VALIDATION_ERROR')
  }
  const draft = await productDraftRepository.findById(id)
  if (!draft) {
    throw new AppError('Draft not found', 404, 'DRAFT_NOT_FOUND')
  }
  return withCategoryMap(draft)
}

async function createDraft(payload = {}) {
  const userId = await assertUserExists(payload.userId)
  const status = payload.status === undefined ? 'draft' : assertStatus(payload.status)

  if (status === 'draft') {
    await assertNoOtherLiveDraft(userId)
  }

  const currentStep = payload.currentStep === undefined ? 1 : assertStep(payload.currentStep, 'Current step')
  const lastSavedStep =
    payload.lastSavedStep === undefined || payload.lastSavedStep === null || payload.lastSavedStep === ''
      ? currentStep
      : assertStep(payload.lastSavedStep, 'Last saved step')

  const data = {
    userId,
    status,
    currentStep,
    lastSavedStep,
    categoryLevel: payload.categoryLevel === undefined ? 0 : assertCategoryLevel(payload.categoryLevel),
    selectedPath: await assertSelectedPath(payload.selectedPath),
    selectedCategory: payload.selectedCategory ? await assertCategoryExists(payload.selectedCategory) : null,
    formValues: assertMixedObject(payload.formValues, 'Form values'),
    dynamicFormValues: assertMixedObject(payload.dynamicFormValues, 'Dynamic form values'),
    lastSavedAt: new Date(),
  }

  if (payload.productId) {
    data.productId = await assertProductExists(payload.productId)
  }
  if (status === 'published') {
    data.publishedAt = new Date()
  }

  try {
    return await withCategoryMap(await productDraftRepository.create(data))
  } catch (error) {
    throw mapDuplicateKeyError(error)
  }
}

async function updateDraft(id, payload = {}) {
  if (!Types.ObjectId.isValid(String(id))) {
    throw new AppError('Invalid draft id', 400, 'VALIDATION_ERROR')
  }
  const existing = await productDraftRepository.findRawById(id)
  if (!existing) {
    throw new AppError('Draft not found', 404, 'DRAFT_NOT_FOUND')
  }

  const updates = {}

  if (payload.userId !== undefined) {
    updates.userId = await assertUserExists(payload.userId)
  }
  if (payload.status !== undefined) {
    updates.status = assertStatus(payload.status)
  }
  if (payload.currentStep !== undefined) {
    updates.currentStep = assertStep(payload.currentStep, 'Current step')
  }
  if (payload.lastSavedStep !== undefined) {
    updates.lastSavedStep =
      payload.lastSavedStep === null || payload.lastSavedStep === ''
        ? null
        : assertStep(payload.lastSavedStep, 'Last saved step')
  }
  if (payload.categoryLevel !== undefined) {
    updates.categoryLevel = assertCategoryLevel(payload.categoryLevel)
  }
  if (payload.selectedPath !== undefined) {
    updates.selectedPath = await assertSelectedPath(payload.selectedPath)
  }
  if (payload.selectedCategory !== undefined) {
    updates.selectedCategory = payload.selectedCategory
      ? await assertCategoryExists(payload.selectedCategory)
      : null
  }

  // Merge, never replace: the wizard stores dozens of keys the admin form does
  // not show, and a replace would silently discard them.
  if (payload.formValues !== undefined) {
    updates.formValues = {
      ...(isPlainObject(existing.formValues) ? existing.formValues : {}),
      ...assertMixedObject(payload.formValues, 'Form values'),
    }
  }
  if (payload.dynamicFormValues !== undefined) {
    updates.dynamicFormValues = {
      ...(isPlainObject(existing.dynamicFormValues) ? existing.dynamicFormValues : {}),
      ...assertMixedObject(payload.dynamicFormValues, 'Dynamic form values'),
    }
  }

  if (payload.productId !== undefined) {
    updates.productId = payload.productId ? await assertProductExists(payload.productId) : null
  }

  if (!Object.keys(updates).length) {
    return withCategoryMap(await productDraftRepository.findById(id))
  }

  // Re-check the one-live-draft-per-user rule whenever this edit could break it.
  const nextStatus = updates.status ?? existing.status
  const nextUserId = String(updates.userId ?? existing.userId)
  if (nextStatus === 'draft' && (updates.status !== undefined || updates.userId !== undefined)) {
    await assertNoOtherLiveDraft(nextUserId, id)
  }

  if (nextStatus === 'published' && !existing.publishedAt) {
    updates.publishedAt = new Date()
  }
  // Re-opening a draft clears the publish stamp; discarding keeps it as history.
  if (nextStatus === 'draft' && existing.publishedAt) {
    updates.publishedAt = null
  }

  updates.lastSavedAt = new Date()

  try {
    const updated = await productDraftRepository.updateById(id, updates)
    if (!updated) {
      throw new AppError('Draft not found', 404, 'DRAFT_NOT_FOUND')
    }
    return withCategoryMap(updated)
  } catch (error) {
    throw mapDuplicateKeyError(error)
  }
}

async function discardDraft(id) {
  if (!Types.ObjectId.isValid(String(id))) {
    throw new AppError('Invalid draft id', 400, 'VALIDATION_ERROR')
  }
  const existing = await productDraftRepository.findRawById(id)
  if (!existing) {
    throw new AppError('Draft not found', 404, 'DRAFT_NOT_FOUND')
  }
  // Already discarded — idempotent, so a double click is not an error.
  if (existing.status === 'discarded') {
    return withCategoryMap(await productDraftRepository.findById(id))
  }
  const discarded = await productDraftRepository.softDeleteById(id)
  if (!discarded) {
    throw new AppError('Draft not found', 404, 'DRAFT_NOT_FOUND')
  }
  return withCategoryMap(discarded)
}

async function deleteDraft(id) {
  if (!Types.ObjectId.isValid(String(id))) {
    throw new AppError('Invalid draft id', 400, 'VALIDATION_ERROR')
  }
  const deleted = await productDraftRepository.hardDeleteById(id)
  if (!deleted) {
    throw new AppError('Draft not found', 404, 'DRAFT_NOT_FOUND')
  }
  return true
}

module.exports = {
  STATUSES,
  MAX_STEP,
  sanitizeMixedValue,
  listDrafts,
  getDraftStatusCounts,
  getDraftById,
  createDraft,
  updateDraft,
  discardDraft,
  deleteDraft,
}
