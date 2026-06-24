/**
 * Last watched reel – persist and resume across visits.
 * Uses localStorage for everyone; syncs to backend for logged-in users.
 */

const LOCAL_STORAGE_PREFIX = 'reels_last_index'

export function getReelsStorageKey(categoryId, subcategoryId) {
  return categoryId ? `${LOCAL_STORAGE_PREFIX}_${categoryId}_${subcategoryId || ''}` : LOCAL_STORAGE_PREFIX
}

/**
 * Get saved reel index for a feed (localStorage only – used before we have auth/API).
 */
export function getLocalReelsIndex(feedKey) {
  try {
    const raw = localStorage.getItem(feedKey)
    const n = parseInt(raw, 10)
    return Number.isNaN(n) || n < 0 ? null : n
  } catch {
    return null
  }
}

/**
 * Save reel index locally. Always call this when the user changes reels.
 */
export function setLocalReelsIndex(feedKey, index) {
  try {
    localStorage.setItem(feedKey, String(index))
  } catch (_) {}
}

/**
 * Get saved reel index: from backend if logged in and API succeeds, else from localStorage.
 * @param {string} feedKey - e.g. 'reels_last_index' or 'reels_last_index_categoryId_subId'
 * @param {boolean} isAuthenticated
 * @param {Function} fetchFromApi - () => Promise<{ reelsProgress: Record<string, number> }>
 * @returns {Promise<number | null>} - saved index or null
 */
export async function getSavedReelIndex(feedKey, isAuthenticated, fetchFromApi) {
  const fromLocal = getLocalReelsIndex(feedKey)

  if (!isAuthenticated || !fetchFromApi) {
    return fromLocal
  }

  try {
    const res = await fetchFromApi()
    const progress = res?.data?.reelsProgress
    if (progress && typeof progress === 'object' && typeof progress[feedKey] === 'number' && progress[feedKey] >= 0) {
      return progress[feedKey]
    }
  } catch (_) {}

  return fromLocal
}

/**
 * Persist reel index: always to localStorage; also to backend when logged in.
 */
export async function saveReelIndex(feedKey, index, isAuthenticated, saveToApi) {
  setLocalReelsIndex(feedKey, index)
  if (isAuthenticated && saveToApi) {
    try {
      await saveToApi(feedKey, index)
    } catch (_) {}
  }
}
