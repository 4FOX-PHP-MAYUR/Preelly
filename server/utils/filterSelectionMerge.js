/**
 * Merge category filter selections — all values stored as arrays (multiselect).
 */

function toArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  if (value === undefined || value === null || value === '') return []
  const s = String(value).trim()
  if (!s) return []
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean)
    } catch {
      // fall through
    }
  }
  if (s.includes(',')) {
    return s
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return [s]
}

/** Ensure every filter_<slug> value is an array (never a bare scalar). */
function normalizeFilterSelections(selections = {}) {
  const out = {}
  if (!selections || typeof selections !== 'object') return out
  for (const [key, value] of Object.entries(selections)) {
    const arr = toArray(value)
    if (arr.length) out[key] = arr
  }
  return out
}

function mergeFilterSelectionMaps(base = {}, incoming = {}) {
  const out = normalizeFilterSelections(base)
  for (const [key, value] of Object.entries(incoming || {})) {
    const merged = [...new Set([...toArray(out[key]), ...toArray(value)])]
    if (merged.length) out[key] = merged
  }
  return out
}

module.exports = {
  toArray,
  normalizeFilterSelections,
  mergeFilterSelectionMaps,
}
