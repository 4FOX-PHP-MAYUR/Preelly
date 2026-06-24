/**
 * Helpers for multiselect category filter values stored as string arrays.
 */

export function toFilterArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  if (value === undefined || value === null || value === '') return []
  return [String(value).trim()].filter(Boolean)
}

export function appendFilterValue(current, next) {
  const arr = toFilterArray(current)
  const n = String(next).trim()
  if (!n) return arr
  if (arr.includes(n)) return arr
  return [...arr, n]
}

export function mergeFilterValues(current, incoming) {
  const base = toFilterArray(current)
  const add = toFilterArray(incoming)
  const out = [...base]
  for (const v of add) {
    if (!out.includes(v)) out.push(v)
  }
  return out
}

export function hasFilterSelection(value) {
  return toFilterArray(value).length > 0
}

/** Normalize API filter_selections so every filter_* value is a string array. */
export function normalizeFilterSelections(selections = {}) {
  const out = {}
  if (!selections || typeof selections !== 'object') return out
  for (const [key, value] of Object.entries(selections)) {
    const arr = toFilterArray(value)
    if (arr.length) out[key] = arr
  }
  return out
}

/** Collapse multiselect form value to a single string for legacy product fields. */
export function scalarFromMultiSelect(value) {
  const arr = toFilterArray(value)
  if (!arr.length) return ''
  return arr.length === 1 ? arr[0] : arr.join(', ')
}
