const ProductDraft = require('../models/ProductDraft')

/**
 * Treat as "empty" for merge purposes so step saves never wipe earlier steps.
 */
function isEmptyValue(value) {
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    Object.keys(value).length === 0
  ) {
    return true
  }
  return false
}

/**
 * Deep-merge `incoming` onto `existing`, skipping empty incoming values so
 * other steps' data is preserved.
 */
function mergeSkipEmpty(existing, incoming) {
  if (incoming === undefined) return existing
  if (isEmptyValue(incoming) && !isEmptyValue(existing)) return existing

  if (
    incoming &&
    typeof incoming === 'object' &&
    !Array.isArray(incoming) &&
    !(incoming instanceof Date)
  ) {
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {}
    for (const [key, value] of Object.entries(incoming)) {
      if (value === undefined) continue
      base[key] = mergeSkipEmpty(base[key], value)
    }
    return base
  }

  // Arrays / scalars: replace only when incoming is non-empty
  if (isEmptyValue(incoming)) return existing
  return incoming
}

function serializeMediaMeta(payload = {}) {
  const videoFile = payload.videoFile || payload.videoMeta || null
  const imageFiles = Array.isArray(payload.imageFiles)
    ? payload.imageFiles
    : Array.isArray(payload.imageMeta)
      ? payload.imageMeta
      : null

  const patch = {}

  if (videoFile === null && payload.hasVideo === false) {
    patch.hasVideo = false
    patch.videoMeta = null
  } else if (videoFile && typeof videoFile === 'object') {
    patch.hasVideo = true
    patch.videoMeta = {
      name: videoFile.name || videoFile.fileName || null,
      size: typeof videoFile.size === 'number' ? videoFile.size : null,
      type: videoFile.type || videoFile.mimeType || null,
    }
  } else if (typeof payload.hasVideo === 'boolean') {
    patch.hasVideo = payload.hasVideo
  }

  if (imageFiles) {
    const meta = imageFiles
      .map((img) => {
        if (!img || typeof img !== 'object') return null
        return {
          name: img.name || img.fileName || null,
          size: typeof img.size === 'number' ? img.size : null,
          type: img.type || img.mimeType || null,
          isScreenshot: Boolean(img.isScreenshot),
        }
      })
      .filter(Boolean)
    patch.imageMeta = meta
    patch.imageCount = meta.length
  } else if (typeof payload.imageCount === 'number') {
    patch.imageCount = payload.imageCount
  }

  return patch
}

/**
 * Build a $set-safe patch from a client payload without wiping other steps.
 */
function buildMergedPatch(existingDoc, payload = {}) {
  const existing = existingDoc?.toObject?.() || existingDoc || {}
  const patch = {
    lastSavedAt: new Date(),
  }

  if (payload.currentStep != null && Number.isFinite(Number(payload.currentStep))) {
    patch.currentStep = Number(payload.currentStep)
  }
  if (payload.lastSavedStep != null && Number.isFinite(Number(payload.lastSavedStep))) {
    patch.lastSavedStep = Number(payload.lastSavedStep)
  } else if (payload.currentStep != null) {
    patch.lastSavedStep = Number(payload.currentStep)
  }
  if (payload.categoryLevel != null && Number.isFinite(Number(payload.categoryLevel))) {
    patch.categoryLevel = Number(payload.categoryLevel)
  }

  if (payload.selectedPath !== undefined) {
    patch.selectedPath = mergeSkipEmpty(existing.selectedPath, payload.selectedPath)
  }
  if (payload.selectedCategory !== undefined) {
    patch.selectedCategory = mergeSkipEmpty(existing.selectedCategory, payload.selectedCategory)
  }
  if (payload.formValues !== undefined && typeof payload.formValues === 'object') {
    patch.formValues = mergeSkipEmpty(existing.formValues || {}, payload.formValues)
  }
  if (payload.dynamicFormValues !== undefined && typeof payload.dynamicFormValues === 'object') {
    patch.dynamicFormValues = mergeSkipEmpty(
      existing.dynamicFormValues || {},
      payload.dynamicFormValues
    )
  }

  Object.assign(patch, serializeMediaMeta(payload))

  return patch
}

/**
 * Create or update the user's single live draft.
 * Prefer updating by draftId when provided; otherwise upsert the active draft.
 */
async function upsertDraft({ userId, draftId, payload }) {
  if (!userId) {
    const err = new Error('userId is required')
    err.status = 400
    throw err
  }

  let draft = null

  if (draftId) {
    draft = await ProductDraft.findOne({ _id: draftId, userId, status: 'draft' })
    if (!draft) {
      const err = new Error('Draft not found')
      err.status = 404
      throw err
    }
  } else {
    draft = await ProductDraft.findOne({ userId, status: 'draft' })
  }

  const patch = buildMergedPatch(draft, payload)

  if (draft) {
    Object.assign(draft, patch)
    await draft.save()
    return draft
  }

  try {
    draft = await ProductDraft.create({
      userId,
      status: 'draft',
      ...patch,
      formValues: patch.formValues || {},
      dynamicFormValues: patch.dynamicFormValues || {},
      selectedPath: patch.selectedPath || [],
    })
    return draft
  } catch (err) {
    // Race on unique partial index — retry as update
    if (err && err.code === 11000) {
      const existing = await ProductDraft.findOne({ userId, status: 'draft' })
      if (!existing) throw err
      const retryPatch = buildMergedPatch(existing, payload)
      Object.assign(existing, retryPatch)
      await existing.save()
      return existing
    }
    throw err
  }
}

async function getDraftById({ userId, draftId }) {
  const draft = await ProductDraft.findOne({ _id: draftId, userId, status: 'draft' })
  if (!draft) {
    const err = new Error('Draft not found')
    err.status = 404
    throw err
  }
  return draft
}

async function getCurrentDraft(userId) {
  return ProductDraft.findOne({ userId, status: 'draft' }).sort({ updatedAt: -1 })
}

async function listDrafts(userId) {
  return ProductDraft.find({ userId, status: 'draft' }).sort({ updatedAt: -1 })
}

/**
 * Mark draft published after a successful product create, or soft-discard.
 * Idempotent: if the draft is already published, return it instead of 404.
 */
async function markPublished({ userId, draftId, productId }) {
  const liveQuery = draftId
    ? { _id: draftId, userId, status: 'draft' }
    : { userId, status: 'draft' }

  let draft = await ProductDraft.findOneAndUpdate(
    liveQuery,
    {
      $set: {
        status: 'published',
        productId: productId || null,
        publishedAt: new Date(),
        lastSavedAt: new Date(),
      },
    },
    { new: true, sort: { updatedAt: -1 } }
  )

  if (draft) return draft

  // Already published (e.g. product create + client both called) — treat as success.
  if (draftId) {
    draft = await ProductDraft.findOne({ _id: draftId, userId, status: 'published' })
    if (draft) {
      if (productId && !draft.productId) {
        draft.productId = productId
        draft.publishedAt = draft.publishedAt || new Date()
        await draft.save()
      }
      return draft
    }
  }

  return null
}

async function discardDraft({ userId, draftId }) {
  const query = draftId
    ? { _id: draftId, userId, status: 'draft' }
    : { userId, status: 'draft' }

  const draft = await ProductDraft.findOneAndUpdate(
    query,
    {
      $set: {
        status: 'discarded',
        lastSavedAt: new Date(),
      },
    },
    { new: true, sort: { updatedAt: -1 } }
  )

  return draft
}

async function deleteDraft({ userId, draftId }) {
  const query = draftId
    ? { _id: draftId, userId }
    : { userId, status: 'draft' }

  const result = await ProductDraft.deleteOne(query)
  return result.deletedCount > 0
}

module.exports = {
  isEmptyValue,
  mergeSkipEmpty,
  buildMergedPatch,
  upsertDraft,
  getDraftById,
  getCurrentDraft,
  listDrafts,
  markPublished,
  discardDraft,
  deleteDraft,
}
