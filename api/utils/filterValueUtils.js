/**
 * Parse multiselect filter values from request body (string or JSON array).
 */

function parseJSONField(field) {
  if (!field) return null
  if (typeof field === 'object') return field
  try {
    return JSON.parse(field)
  } catch {
    return field
  }
}

function parseFilterValues(raw) {
  const parsed = parseJSONField(raw)
  if (Array.isArray(parsed)) {
    return parsed.map((v) => String(v).trim()).filter(Boolean)
  }
  const s = String(raw || '').trim()
  return s ? [s] : []
}

module.exports = { parseFilterValues, parseJSONField }
