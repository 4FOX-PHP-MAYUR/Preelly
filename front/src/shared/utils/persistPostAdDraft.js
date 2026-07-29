/**
 * Background sync helpers for Post Your Ad → productDraft API.
 * Failures are logged and never thrown to the UI — local IndexedDB remains
 * the source of truth for media blobs and the wizard keeps working offline.
 */

import { productDraftService } from '@shared/services/api'
import { savePostAdDraft, setPostAdDraftId } from '@shared/utils/postAdDraftStore'

function isFileLike(value) {
  return (
    (typeof File !== 'undefined' && value instanceof File) ||
    (typeof Blob !== 'undefined' && value instanceof Blob)
  )
}

/** Strip File/Blob values so the payload is JSON-safe. */
export function toServerDraftPayload(localDraft = {}) {
  const formValues = { ...(localDraft.formValues || {}) }
  Object.keys(formValues).forEach((key) => {
    if (isFileLike(formValues[key])) delete formValues[key]
  })

  const videoFile = localDraft.videoFile
  const imageFiles = Array.isArray(localDraft.imageFiles) ? localDraft.imageFiles : []

  return {
    currentStep: localDraft.currentStep,
    lastSavedStep: localDraft.lastSavedStep ?? localDraft.currentStep,
    categoryLevel: localDraft.categoryLevel,
    selectedPath: localDraft.selectedPath || [],
    selectedCategory: localDraft.selectedCategory || null,
    formValues,
    dynamicFormValues: localDraft.dynamicFormValues || {},
    hasVideo: Boolean(videoFile),
    videoMeta: videoFile
      ? {
          name: videoFile.name || null,
          size: typeof videoFile.size === 'number' ? videoFile.size : null,
          type: videoFile.type || null,
        }
      : null,
    imageCount: imageFiles.length,
    imageMeta: imageFiles.map((img) => ({
      name: img?.name || null,
      size: typeof img?.size === 'number' ? img.size : null,
      type: img?.type || null,
      isScreenshot: Boolean(img?.isScreenshot),
    })),
  }
}

/**
 * Save locally (IndexedDB) and upsert productDraft on the server.
 * Returns the server draftId (or previous id on failure).
 */
export async function persistPostAdDraft({ userId, draftId, localDraft }) {
  if (!userId || !localDraft) return draftId || null

  const withId = { ...localDraft, draftId: draftId || localDraft.draftId || null }
  await savePostAdDraft(userId, withId)

  try {
    const payload = toServerDraftPayload(withId)
    const res = await productDraftService.upsertDraft({
      draftId: withId.draftId || null,
      ...payload,
    })
    const nextId = res?.data?.draftId || res?.data?.data?._id || res?.data?._id || withId.draftId
    if (nextId && String(nextId) !== String(withId.draftId || '')) {
      await setPostAdDraftId(userId, nextId)
    }
    return nextId || null
  } catch (err) {
    console.error('[persistPostAdDraft] server sync failed:', err?.message || err)
    return withId.draftId || null
  }
}

/** Load server draft when IndexedDB is empty (e.g. new device / cleared storage). */
export async function loadServerPostAdDraft() {
  try {
    const res = await productDraftService.getCurrentDraft()
    return res?.data?.data || null
  } catch (err) {
    console.error('[loadServerPostAdDraft] failed:', err?.message || err)
    return null
  }
}

export async function markPostAdDraftPublished({ draftId, productId }) {
  try {
    if (draftId) {
      await productDraftService.markPublished(draftId, { productId })
      return
    }
    // Fallback: mark whatever live draft exists via upsert-less publish path
    const current = await loadServerPostAdDraft()
    if (current?._id) {
      await productDraftService.markPublished(current._id, { productId })
    }
  } catch (err) {
    console.error('[markPostAdDraftPublished] failed:', err?.message || err)
  }
}

export async function discardServerPostAdDraft(draftId) {
  try {
    if (draftId) {
      await productDraftService.deleteDraft(draftId, { soft: true })
      return
    }
    await productDraftService.deleteCurrentDraft({ soft: true })
  } catch (err) {
    console.error('[discardServerPostAdDraft] failed:', err?.message || err)
  }
}
