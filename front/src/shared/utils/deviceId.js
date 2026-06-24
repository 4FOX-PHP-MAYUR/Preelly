/**
 * Persistent device identifier for search history tracking.
 * Sent as `device-id` header on global search API requests.
 */
const STORAGE_KEY = 'device_id'

export function getDeviceId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `web-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    return `web-fallback-${Date.now()}`
  }
}
