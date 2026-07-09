/**
 * Persists an in-progress "Post Your Ad" draft (form values, video, photos) to
 * IndexedDB so a refresh — or leaving the page and coming back — restores it.
 * IndexedDB (not localStorage/sessionStorage) is required here because it can
 * store File/Blob objects directly via structured clone; the uploaded video and
 * photos can't be persisted any other way in the browser.
 */

const DB_NAME = 'preelly-post-ad-drafts'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function draftKey(userId) {
  return `post-ad:${userId || 'anonymous'}`
}

export async function savePostAdDraft(userId, draft) {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ ...draft, savedAt: Date.now() }, draftKey(userId))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (err) {
    console.error('[postAdDraftStore] Failed to save draft:', err)
  }
}

export async function loadPostAdDraft(userId) {
  try {
    const db = await openDb()
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(draftKey(userId))
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return result
  } catch (err) {
    console.error('[postAdDraftStore] Failed to load draft:', err)
    return null
  }
}

export async function clearPostAdDraft(userId) {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(draftKey(userId))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (err) {
    console.error('[postAdDraftStore] Failed to clear draft:', err)
  }
}
