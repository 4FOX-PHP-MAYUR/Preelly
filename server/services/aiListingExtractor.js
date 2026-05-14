const axios = require('axios')
const crypto = require('crypto')

// Backward-compatible fallback key (existing code used hardcoded keys).
// Prefer setting OPENAI_API_KEY in your environment for production use.
const FALLBACK_OPENAI_API_KEY =
  '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'

const REQUIRED_FIELDS = [
  'brand',
  'model',
  'year',
  'price',
  'currency',
  'location_city',
  'mileage_km',
  'engine_cc',
  'horsepower',
  'transmission',
  'fuel_type',
  'body_type',
  'condition',
  'accident_free',
]

// Must be used exactly as provided (prompt block copied verbatim).
const AI_LISTING_EXTRACTION_PROMPT = `You are an advanced AI system for a marketplace platform.

Your task is to convert unstructured user input into structured, normalized car listing data.

Return JSON with:
- display_data
- filter_data
- specifications
- missing_fields
- confidence

RULES:
- No hallucination
- Missing → null + add to missing_fields
- Normalize all values
- Strict JSON only

FILTER RULES:
- Numbers only
- Lowercase enums
- No ranges (use average)

REQUIRED FIELDS:
brand, model, year, price, currency, location_city, mileage_km,
engine_cc, horsepower, transmission, fuel_type, body_type,
condition, accident_free

[Keep structure identical to system spec]`

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY || FALLBACK_OPENAI_API_KEY
}

const normalizeEnum = (v) => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s) return null
  return s.toLowerCase().replace(/[\s\-_]+/g, '_')
}

const normalizeStringForFilter = (v) => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s) return null
  return s.toLowerCase()
}

const parseNumberOrNull = (v) => {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  if (!s) return null

  // Range like "100-120" / "100 to 120"
  const rangeMatch = s.match(/(-?\d+(?:\.\d+)?)\s*(?:-|to)\s*(-?\d+(?:\.\d+)?)/i)
  if (rangeMatch) {
    const a = Number(rangeMatch[1])
    const b = Number(rangeMatch[2])
    if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2
  }

  // Extract first number from strings like "1,500 km" or "2000cc"
  const numMatch = s.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!numMatch) return null
  const n = Number(numMatch[0])
  return Number.isFinite(n) ? n : null
}

const parseEngineCcOrNull = (v) => {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().toLowerCase()
  if (!s) return null
  // "2000cc"
  if (s.includes('cc')) return parseNumberOrNull(s)
  // "1.5l"
  if (s.includes('l')) {
    const liters = parseNumberOrNull(s.replace(/l/g, ''))
    if (liters === null) return null
    return Math.round(liters * 1000)
  }
  return parseNumberOrNull(s)
}

const normalizeBoolean = (v) => {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : null
  const s = String(v).trim().toLowerCase()
  if (!s) return null
  if (['true', 'yes', 'y', '1'].includes(s)) return true
  if (['false', 'no', 'n', '0'].includes(s)) return false
  return null
}

const parseStrictJson = (content) => {
  if (!content || typeof content !== 'string') throw new Error('AI returned empty content')
  const trimmed = content.trim()

  // Try direct parse first.
  try {
    return JSON.parse(trimmed)
  } catch {
    // Try to extract first JSON object substring.
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('AI returned non-JSON content')
    }
    const jsonStr = trimmed.slice(firstBrace, lastBrace + 1)
    return JSON.parse(jsonStr)
  }
}

const CONDITION_ENUM_TO_DISPLAY = {
  'brand_new': 'Brand New',
  'like_new': 'Like New',
  'good': 'Good',
  'fair': 'Fair',
  'poor': 'Poor',
}

const transmissionToDisplay = (v) => {
  const e = normalizeEnum(v)
  if (!e) return null
  const map = {
    manual: 'Manual',
    automatic: 'Automatic',
    cvt: 'CVT',
    semi_automatic: 'Semi-Automatic',
  }
  return map[e] || null
}

const fuelTypeToDisplay = (v) => {
  const e = normalizeEnum(v)
  if (!e) return null
  const map = {
    petrol: 'Petrol',
    diesel: 'Diesel',
    electric: 'Electric',
    hybrid: 'Hybrid',
    cng: 'CNG',
    lpg: 'LPG',
    other: 'Other',
  }
  return map[e] || null
}

const bodyTypeToDisplay = (v) => {
  const e = normalizeEnum(v)
  if (!e) return null
  const map = {
    suv: 'SUV',
    sedan: 'Sedan',
    hatchback: 'Hatchback',
    coupe: 'Coupe',
    convertible: 'Convertible',
    wagon: 'Wagon',
    pickup: 'Pickup',
  }
  return map[e] || null
}

const conditionToDisplay = (v) => {
  const e = normalizeEnum(v)
  if (!e) return null
  return CONDITION_ENUM_TO_DISPLAY[e] || null
}

// Cache to avoid duplicate processing for the same transcript.
const cache = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function getCacheKey(input_text) {
  return crypto.createHash('sha256').update(String(input_text)).digest('hex')
}

async function extractCarListingData({ input_text } = {}) {
  const apiKey = getOpenAiKey()
  if (!apiKey) throw new Error('OpenAI API key not configured')
  const safeInput = input_text ? String(input_text).trim() : ''
  if (!safeInput) throw new Error('input_text is required')

  const cacheKey = getCacheKey(safeInput)
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.value

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: AI_LISTING_EXTRACTION_PROMPT },
        { role: 'user', content: safeInput },
      ],
      temperature: 0.2,
      max_tokens: 1300,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    },
  )

  const content = response?.data?.choices?.[0]?.message?.content
  const parsed = parseStrictJson(String(content))

  const display_data = parsed?.display_data || {}
  const filter_data = parsed?.filter_data || {}
  const specifications = parsed?.specifications || {}
  const modelMissingFields = Array.isArray(parsed?.missing_fields) ? parsed.missing_fields : []
  const confidence = parsed?.confidence || {}

  // Enforce required field completeness (missing -> null).
  const mergedDisplay = { ...display_data }
  const mergedFilter = { ...filter_data }
  for (const key of REQUIRED_FIELDS) {
    if (mergedDisplay[key] === undefined) mergedDisplay[key] = null
    if (mergedFilter[key] === undefined) mergedFilter[key] = null
  }

  const missing_fields = []
  for (const key of REQUIRED_FIELDS) {
    const val =
      mergedDisplay[key] !== null && mergedDisplay[key] !== undefined ? mergedDisplay[key] : mergedFilter[key]
    if (val === null || val === undefined || val === '') missing_fields.push(key)
  }

  // Normalize filter_data for querying.
  const normalizedFilter = { ...mergedFilter }
  for (const numKey of ['year', 'price', 'mileage_km', 'engine_cc', 'horsepower']) {
    normalizedFilter[numKey] = numKey === 'engine_cc' ? parseEngineCcOrNull(mergedFilter[numKey]) : parseNumberOrNull(mergedFilter[numKey])
  }
  normalizedFilter.transmission = normalizeEnum(mergedFilter.transmission)
  normalizedFilter.fuel_type = normalizeEnum(mergedFilter.fuel_type)
  normalizedFilter.body_type = normalizeEnum(mergedFilter.body_type)
  normalizedFilter.condition = normalizeEnum(mergedFilter.condition)
  normalizedFilter.brand = normalizeStringForFilter(mergedFilter.brand)
  normalizedFilter.model = normalizeStringForFilter(mergedFilter.model)
  normalizedFilter.currency = mergedFilter.currency ? String(mergedFilter.currency).trim().toLowerCase() : null
  normalizedFilter.location_city = normalizeStringForFilter(mergedFilter.location_city)
  normalizedFilter.accident_free = normalizeBoolean(mergedFilter.accident_free)

  // Normalize display_data enums to match UI-friendly casing (best-effort).
  const normalizedDisplay = { ...mergedDisplay }
  normalizedDisplay.transmission = transmissionToDisplay(mergedDisplay.transmission) || mergedDisplay.transmission || null
  normalizedDisplay.fuel_type = fuelTypeToDisplay(mergedDisplay.fuel_type) || mergedDisplay.fuel_type || null
  normalizedDisplay.body_type = bodyTypeToDisplay(mergedDisplay.body_type) || mergedDisplay.body_type || null
  normalizedDisplay.condition = conditionToDisplay(mergedDisplay.condition) || mergedDisplay.condition || null

  // If the model left some values in filter_data only, backfill into display_data.
  for (const key of REQUIRED_FIELDS) {
    const dv = normalizedDisplay[key]
    const fv = normalizedFilter[key]
    const isMissing = dv === null || dv === undefined || dv === ''
    const hasValue = fv !== null && fv !== undefined && fv !== ''
    if (isMissing && hasValue) {
      if (key === 'transmission') normalizedDisplay.transmission = transmissionToDisplay(fv)
      else if (key === 'fuel_type') normalizedDisplay.fuel_type = fuelTypeToDisplay(fv)
      else if (key === 'body_type') normalizedDisplay.body_type = bodyTypeToDisplay(fv)
      else if (key === 'condition') normalizedDisplay.condition = conditionToDisplay(fv)
      else if (key === 'currency' && typeof fv === 'string') normalizedDisplay.currency = fv.toUpperCase()
      else normalizedDisplay[key] = fv
    }
  }

  // Ensure confidence object has required keys.
  const normalizedConfidence = { ...confidence }
  for (const key of REQUIRED_FIELDS) {
    const v = normalizedConfidence[key]
    if (typeof v === 'number' && Number.isFinite(v)) {
      normalizedConfidence[key] = Math.max(0, Math.min(1, v))
    } else if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v)
      normalizedConfidence[key] = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null
    } else {
      normalizedConfidence[key] = null
    }
  }

  const result = {
    display_data: normalizedDisplay,
    filter_data: normalizedFilter,
    specifications: specifications || {},
    missing_fields,
    confidence: normalizedConfidence,
  }

  cache.set(cacheKey, { createdAt: Date.now(), value: result })
  return result
}

function getFallbackResult() {
  const confidence = {}
  for (const key of REQUIRED_FIELDS) confidence[key] = null
  return {
    display_data: {},
    filter_data: {},
    specifications: {},
    missing_fields: [...REQUIRED_FIELDS],
    confidence,
  }
}

module.exports = { extractCarListingData, getFallbackResult, REQUIRED_FIELDS }

