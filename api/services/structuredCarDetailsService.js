/**
 * Normalize listing details into a consistent, platform-friendly shape.
 * This is intentionally deterministic: it relies on the submitted fields
 * (which may themselves be auto-filled from video transcript extraction).
 */

const CONDITION_ENUM = ['Brand New', 'Like New', 'Good', 'Fair', 'Poor']

const normalizeCondition = (value) => {
  if (!value) return null
  const s = String(value).trim()
  if (CONDITION_ENUM.includes(s)) return s

  // Common transcript/AI variants -> canonical enum.
  const map = {
    'brand new': 'Brand New',
    'like new': 'Like New',
    'good': 'Good',
    'fair': 'Fair',
    'poor': 'Poor',
    excellent: 'Like New',
    used: 'Good',
    worn: 'Fair',
    damaged: 'Poor',
    new: 'Brand New',
  }
  return map[s.toLowerCase()] || null
}

const safeNumber = (v) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function extractStructuredCarDetails({ title, brand, model, year, price, currency, condition, raw }) {
  return {
    title: title ? String(title).trim() : null,
    brand: brand ? String(brand).trim() : null,
    model: model ? String(model).trim() : null,
    year: year !== undefined && year !== null ? safeNumber(year) : null,
    price: price !== undefined && price !== null ? safeNumber(price) : null,
    currency: currency ? String(currency).trim().toUpperCase() : 'USD',
    condition: normalizeCondition(condition) || condition || null,
    raw: raw || null,
  }
}

module.exports = { extractStructuredCarDetails, normalizeCondition, CONDITION_ENUM }

