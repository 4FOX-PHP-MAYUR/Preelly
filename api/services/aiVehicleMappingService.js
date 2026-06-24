/**
 * Centralized AI vehicle listing mapping service.
 * Converts unstructured transcript / extracted JSON into validated form-ready values.
 */

const axios = require('axios')
const crypto = require('crypto')
const {
  getVehicleConfig,
  resolveVehicleType,
  CONDITION_OPTIONS,
  TRANSMISSION_OPTIONS,
  FUEL_TYPE_OPTIONS,
  BODY_TYPE_OPTIONS,
  DOORS_OPTIONS,
  SELLER_TYPE_OPTIONS,
  REGIONAL_SPEC_OPTIONS,
  STEERING_SIDE_OPTIONS,
  EXPORT_STATUS_OPTIONS,
  HORSEPOWER_RANGES,
  ENGINE_CAPACITY_RANGES,
  CYLINDER_OPTIONS,
  WARRANTY_OPTIONS,
} = require('../config/vehicleFieldMappingConfig')
const { lookupVehicleSpecs } = require('../data/vehicleSpecDatabase')
const { buildFilterSelectionsFromVehicleData } = require('../utils/vehicleFilterMatching')
const { mergeFilterSelectionMaps, normalizeFilterSelections } = require('../utils/filterSelectionMerge')
const { enrichVehicleProfile } = require('./vehicleEnrichmentService')

const cache = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY || ''
}

function normalizeEnum(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s) return null
  return s.toLowerCase().replace(/[\s\-_]+/g, '_')
}

function normalizeStr(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s || null
}

function parseNumberOrNull(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/,/g, '')
  if (!s) return null
  const rangeMatch = s.match(/(-?\d+(?:\.\d+)?)\s*(?:-|to)\s*(-?\d+(?:\.\d+)?)/i)
  if (rangeMatch) {
    const a = Number(rangeMatch[1])
    const b = Number(rangeMatch[2])
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.round((a + b) / 2)
  }
  const numMatch = s.match(/-?\d+(?:\.\d+)?/)
  if (!numMatch) return null
  const n = Number(numMatch[0])
  return Number.isFinite(n) ? n : null
}

function parseEngineCcOrNull(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().toLowerCase()
  if (!s) return null
  if (s.includes('cc')) return parseNumberOrNull(s)
  if (s.includes('l')) {
    const liters = parseNumberOrNull(s.replace(/l/g, ''))
    if (liters === null) return null
    return Math.round(liters * 1000)
  }
  return parseNumberOrNull(s)
}

function parseBoolean(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : null
  const s = String(v).trim().toLowerCase()
  if (!s) return null
  if (['true', 'yes', 'y', '1', 'accident free', 'no accidents'].includes(s)) return true
  if (['false', 'no', 'n', '0', 'accident', 'accidents'].includes(s)) return false
  return null
}

function parseStrictJson(content) {
  if (!content || typeof content !== 'string') throw new Error('AI returned empty content')
  const trimmed = content.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('AI returned non-JSON content')
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))
  }
}

function matchEnumOption(raw, options) {
  if (raw === null || raw === undefined || raw === '') return null
  const norm = String(raw).trim().toLowerCase().replace(/[\s\-_]+/g, ' ')
  if (!norm) return null

  const exact = options.find((o) => String(o).trim().toLowerCase() === norm)
  if (exact) return exact

  const token = norm.replace(/\s+/g, '_')
  const tokenMatch = options.find((o) => String(o).trim().toLowerCase().replace(/[\s\-_]+/g, '_') === token)
  if (tokenMatch) return tokenMatch

  const partial = options.find((o) => {
    const n = String(o).trim().toLowerCase()
    return n.length >= 3 && (norm.includes(n) || n.includes(norm))
  })
  return partial || null
}

function matchRangeOption(raw, ranges) {
  if (raw === null || raw === undefined || raw === '') return null
  const asStr = String(raw).trim()
  const direct = matchEnumOption(asStr, ranges)
  if (direct) return direct

  const num = parseNumberOrNull(asStr)
  if (num === null) return null

  if (ranges === HORSEPOWER_RANGES) {
    if (num < 100) return '0-99 HP'
    if (num < 200) return '100-199 HP'
    if (num < 300) return '200-299 HP'
    if (num < 400) return '300-399 HP'
    if (num < 500) return '400-499 HP'
    return '500+ HP'
  }

  if (ranges === ENGINE_CAPACITY_RANGES) {
    if (num < 1000) return '0-999 cc'
    if (num < 1500) return '1000-1499 cc'
    if (num < 2000) return '1500-1999 cc'
    if (num < 2500) return '2000-2499 cc'
    if (num < 3000) return '2500-2999 cc'
    if (num < 4000) return '3000-3999 cc'
    return '4000+ cc'
  }

  return null
}

const CONDITION_MAP = {
  brand_new: 'Brand New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  excellent: 'Like New',
  new: 'Brand New',
  used: 'Good',
}

const TRANSMISSION_MAP = {
  manual: 'Manual',
  automatic: 'Automatic',
  cvt: 'CVT',
  semi_automatic: 'Semi-Automatic',
}

const FUEL_MAP = {
  petrol: 'Petrol',
  gasoline: 'Petrol',
  diesel: 'Diesel',
  electric: 'Electric',
  hybrid: 'Hybrid',
  cng: 'CNG',
  lpg: 'LPG',
  other: 'Other',
}

const BODY_MAP = {
  suv: 'SUV',
  sedan: 'Sedan',
  hatchback: 'Hatchback',
  coupe: 'Coupe',
  convertible: 'Convertible',
  wagon: 'Wagon',
  pickup: 'Pickup',
  truck: 'Pickup',
}

const REGIONAL_MAP = {
  gcc: 'GCC',
  gulf: 'GCC',
  uae: 'GCC',
  american: 'American',
  usa: 'American',
  us: 'American',
  canadian: 'Canadian',
  canada: 'Canadian',
  european: 'European',
  europe: 'European',
  japanese: 'Japanese',
  japan: 'Japanese',
  korean: 'Korean',
  korea: 'Korean',
  chinese: 'Chinese',
  china: 'Chinese',
}

function inferRegionalSpecFromText(text) {
  const t = String(text || '').toLowerCase()
  if (/\bgcc\b|\bgulf\b|\buae\b|\bdubai\b|\babu dhabi\b/.test(t)) return 'GCC'
  if (/\bamerican\b|\busa\b|\bus spec\b/.test(t)) return 'American'
  if (/\bcanadian\b|\bcanada\b/.test(t)) return 'Canadian'
  if (/\beuropean\b|\beuro spec\b|\beu spec\b/.test(t)) return 'European'
  if (/\bjapanese\b|\bjdm\b/.test(t)) return 'Japanese'
  if (/\bkorean\b/.test(t)) return 'Korean'
  if (/\bchinese\b/.test(t)) return 'Chinese'
  return null
}

function buildAiPrompt(vehicleType) {
  const config = getVehicleConfig(vehicleType)
  const fieldList = config.fields.map((f) => f.key).filter((k, i, arr) => arr.indexOf(k) === i)

  return `You are an advanced AI system for a marketplace vehicle listing platform.

Convert unstructured user input (video transcript and/or extracted JSON) into structured, normalized ${config.label.toLowerCase()} listing data.

Return STRICT JSON only with this structure:
{
  "extracted": { "<field_key>": <value>, ... },
  "inferred": { "<field_key>": <value>, ... },
  "confidence": { "<field_key>": <0-100 integer>, ... },
  "specifications": { "<key>": <value>, ... }
}

RULES:
1. Put values EXPLICITLY stated in the input under "extracted" with confidence 90-100.
2. Put values reasonably inferred from make/model/year/trim/title/description under "inferred" with confidence 50-89.
3. Do NOT hallucinate — if unsure, omit the field entirely. Never infer exterior/interior paint color.
4. Normalize enums to these exact display values where applicable:
   - condition: ${CONDITION_OPTIONS.join(', ')}
   - transmission: ${TRANSMISSION_OPTIONS.join(', ')}
   - fuelType: ${FUEL_TYPE_OPTIONS.join(', ')}
   - bodyType: ${BODY_TYPE_OPTIONS.join(', ')}
   - doors: ${DOORS_OPTIONS.join(', ')}
   - sellerType: ${SELLER_TYPE_OPTIONS.join(', ')}
   - regionalSpec: ${REGIONAL_SPEC_OPTIONS.join(', ')}
   - steeringSide: ${STEERING_SIDE_OPTIONS.join(', ')}
   - exportStatus: ${EXPORT_STATUS_OPTIONS.join(', ')}
   - warranty: ${WARRANTY_OPTIONS.join(', ')}
   - cylinders: ${CYLINDER_OPTIONS.join(', ')}
5. For engineSize use format like "2000cc" or "2.0L". For horsepower use number or range like "268 HP".
6. Map mileage/kilometers to "mileage" as a number in km.
7. Map brand to both "brand" and "make".
8. Infer regionalSpec from phrases like "GCC Spec", "American Spec", "JDM", etc.

TARGET FIELDS (include all that apply):
${fieldList.join(', ')}

Vehicle type: ${config.label}`
}

function flattenRawInput(raw) {
  const flat = {}
  if (!raw || typeof raw !== 'object') return flat

  const merge = (obj) => {
    if (!obj || typeof obj !== 'object') return
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== '') flat[k] = v
    }
  }

  merge(raw)
  merge(raw.extracted)
  merge(raw.inferred)
  merge(raw.display_data)
  merge(raw.filter_data)
  merge(raw.form_values)

  return flat
}

function pickRawValue(flat, fieldDef) {
  for (const key of fieldDef.aiKeys || [fieldDef.key]) {
    if (flat[key] !== undefined && flat[key] !== null && flat[key] !== '') {
      return flat[key]
    }
  }
  return null
}

function validateField(fieldDef, rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return { valid: false, value: null, reason: 'empty' }
  }

  switch (fieldDef.type) {
    case 'number': {
      const n = parseNumberOrNull(rawValue)
      if (n === null) return { valid: false, value: null, reason: 'invalid_number' }
      if (fieldDef.key === 'year' && (n < 1900 || n > new Date().getFullYear() + 2)) {
        return { valid: false, value: null, reason: 'year_out_of_range' }
      }
      if (fieldDef.key === 'mileage' && n < 0) return { valid: false, value: null, reason: 'negative_mileage' }
      if (fieldDef.key === 'price' && n <= 0) return { valid: false, value: null, reason: 'invalid_price' }
      return { valid: true, value: n }
    }
    case 'boolean': {
      const b = parseBoolean(rawValue)
      if (b === null) return { valid: false, value: null, reason: 'invalid_boolean' }
      return { valid: true, value: b }
    }
    case 'enum': {
      let matched = matchEnumOption(rawValue, fieldDef.options || [])

      if (!matched && fieldDef.key === 'condition') {
        const e = normalizeEnum(rawValue)
        matched = CONDITION_MAP[e] || matchEnumOption(CONDITION_MAP[e], fieldDef.options)
      }
      if (!matched && fieldDef.key === 'transmission') {
        matched = TRANSMISSION_MAP[normalizeEnum(rawValue)]
      }
      if (!matched && fieldDef.key === 'fuelType') {
        matched = FUEL_MAP[normalizeEnum(rawValue)]
      }
      if (!matched && fieldDef.key === 'bodyType') {
        matched = BODY_MAP[normalizeEnum(rawValue)]
      }
      if (!matched && fieldDef.key === 'regionalSpec') {
        matched = REGIONAL_MAP[normalizeEnum(rawValue)] || matchEnumOption(rawValue, REGIONAL_SPEC_OPTIONS)
      }

      if (!matched) return { valid: false, value: null, reason: 'enum_mismatch' }
      return { valid: true, value: matched }
    }
    case 'range': {
      const matched = matchRangeOption(rawValue, fieldDef.options || [])
      if (!matched) return { valid: false, value: null, reason: 'range_mismatch' }
      return { valid: true, value: matched }
    }
    default: {
      const s = normalizeStr(rawValue)
      if (!s) return { valid: false, value: null, reason: 'empty_string' }
      return { valid: true, value: s }
    }
  }
}

function formatEngineSize(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return `${Math.round(value)}cc`
  const s = String(value).trim()
  if (/cc|l/i.test(s)) return s
  const cc = parseEngineCcOrNull(s)
  return cc !== null ? `${cc}cc` : s
}

function buildLegacyDisplayData(formValues) {
  return {
    brand: formValues.brand || formValues.make || null,
    model: formValues.model || null,
    year: formValues.year ?? null,
    price: formValues.price ?? null,
    currency: formValues.currency ? String(formValues.currency).toUpperCase() : null,
    location_city: formValues.city || null,
    mileage_km: formValues.mileage ?? null,
    engine_cc: parseEngineCcOrNull(formValues.engineSize) ?? formValues.engineSize ?? null,
    horsepower: parseNumberOrNull(formValues.horsepower) ?? formValues.horsepower ?? null,
    transmission: formValues.transmission || null,
    fuel_type: formValues.fuelType || null,
    body_type: formValues.bodyType || null,
    condition: formValues.condition || null,
    accident_free: formValues.accident_free ?? null,
    regional_spec: formValues.regionalSpec || null,
    seller_type: formValues.sellerType || null,
    seats: formValues.seatingCapacity ?? null,
    doors: formValues.doors || null,
    interior_color: formValues.interiorColor || null,
    exterior_color: formValues.color || null,
    steering_side: formValues.steeringSide || null,
    export_status: formValues.exportStatus || null,
    warranty: formValues.warranty || null,
    cylinders: formValues.cylinders || null,
    trim: formValues.trim || null,
    drivetrain: formValues.drivetrain || null,
  }
}

function buildLegacyFilterData(displayData) {
  const toFilterEnum = (v) => {
    const s = v === null || v === undefined ? '' : String(v).trim()
    if (!s) return null
    return s.toLowerCase().replace(/[\s\-_]+/g, '_')
  }
  const toFilterString = (v) => {
    const s = v === null || v === undefined ? '' : String(v).trim()
    return s ? s.toLowerCase() : null
  }

  return {
    brand: toFilterString(displayData.brand),
    model: toFilterString(displayData.model),
    year: parseNumberOrNull(displayData.year),
    price: parseNumberOrNull(displayData.price),
    currency: displayData.currency ? String(displayData.currency).toLowerCase() : null,
    location_city: toFilterString(displayData.location_city),
    mileage_km: parseNumberOrNull(displayData.mileage_km),
    engine_cc: parseEngineCcOrNull(displayData.engine_cc),
    horsepower: parseNumberOrNull(displayData.horsepower),
    transmission: toFilterEnum(displayData.transmission),
    fuel_type: toFilterEnum(displayData.fuel_type),
    body_type: toFilterEnum(displayData.body_type),
    condition: toFilterEnum(displayData.condition),
    accident_free: typeof displayData.accident_free === 'boolean' ? displayData.accident_free : null,
    regional_spec: toFilterEnum(displayData.regional_spec),
    seller_type: toFilterEnum(displayData.seller_type),
    doors: displayData.doors ? String(displayData.doors) : null,
    seats: parseNumberOrNull(displayData.seats),
  }
}

function normalizeConfidenceScores(confidence, fieldKeys) {
  const out = {}
  for (const key of fieldKeys) {
    const v = confidence?.[key]
    if (typeof v === 'number' && Number.isFinite(v)) {
      // Accept 0-1 or 0-100
      const scaled = v <= 1 ? Math.round(v * 100) : Math.round(v)
      out[key] = Math.max(0, Math.min(100, scaled))
    } else {
      out[key] = null
    }
  }
  return out
}

function confidenceToLegacyScale(confidence100) {
  const out = {}
  for (const [k, v] of Object.entries(confidence100 || {})) {
    out[k] = typeof v === 'number' ? v / 100 : null
  }
  // Map form keys to legacy AI keys for backward compat UI
  const legacyKeyMap = {
    make: 'brand',
    brand: 'brand',
    mileage: 'mileage_km',
    city: 'location_city',
    fuelType: 'fuel_type',
    bodyType: 'body_type',
    engineSize: 'engine_cc',
    seatingCapacity: 'seats',
    regionalSpec: 'regional_spec',
    sellerType: 'seller_type',
  }
  for (const [formKey, legacyKey] of Object.entries(legacyKeyMap)) {
    if (confidence100[formKey] !== undefined && out[legacyKey] === undefined) {
      out[legacyKey] = confidence100[formKey] / 100
    }
  }
  return out
}

function getCacheKey(input) {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

async function callOpenAiForVehicleMapping({ input_text, extractedData, vehicleType }) {
  const apiKey = getOpenAiKey()
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const userContent = [
    `Transcript / input text:\n${String(input_text).trim()}`,
    extractedData && Object.keys(extractedData).length
      ? `\nPreviously extracted JSON:\n${JSON.stringify(extractedData, null, 2)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildAiPrompt(vehicleType) },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 2000,
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
  return parseStrictJson(String(content))
}

/**
 * Main entry: map vehicle listing data from transcript + optional pre-extracted JSON.
 *
 * @param {object} opts
 * @param {string} opts.input_text
 * @param {object} [opts.extractedData] - from /video/transcribe generic extraction
 * @param {string} [opts.vehicleType] - cars|motorcycles|bicycles
 * @param {string} [opts.subcategoryName]
 * @param {string} [opts.categoryName]
 */
async function mapVehicleListingData({
  input_text,
  extractedData = null,
  vehicleType = null,
  subcategoryName = '',
  categoryName = '',
  categoryFilters = null,
} = {}) {
  const safeInput = input_text ? String(input_text).trim() : ''
  if (!safeInput && (!extractedData || !Object.keys(extractedData).length)) {
    throw new Error('input_text or extractedData is required')
  }

  const resolvedType = vehicleType || resolveVehicleType(subcategoryName, categoryName)
  const config = getVehicleConfig(resolvedType)

  const cacheInput = { safeInput, extractedData, resolvedType }
  const cacheKey = getCacheKey(cacheInput)
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.value
  }

  const debugLog = {
    vehicleType: resolvedType,
    inputLength: safeInput.length,
    hadPriorExtraction: Boolean(extractedData && Object.keys(extractedData).length),
    extractedValues: {},
    inferredValues: {},
    specDatabaseValues: {},
    validatedValues: {},
    rejectedValues: {},
    confidence: {},
  }

  let aiRaw = { extracted: {}, inferred: {}, confidence: {}, specifications: {} }
  let enrichmentResult = null

  const hasExtractedIdentity =
    extractedData &&
    (extractedData.brand || extractedData.make) &&
    extractedData.model

  // Step 4: Vehicle enrichment — local DB → cache → OpenAI (uses brand + model + year + title).
  if (hasExtractedIdentity) {
    try {
      enrichmentResult = await enrichVehicleProfile({
        extractedData,
        input_text: safeInput,
        categoryFilters,
        vehicleType: resolvedType,
      })
    } catch (err) {
      console.error('[aiVehicleMapping] Vehicle enrichment failed:', err.message)
    }
  }

  // Fallback transcript mapping when enrichment unavailable and transcript exists.
  if (!enrichmentResult?.profile && safeInput) {
    try {
      aiRaw = await callOpenAiForVehicleMapping({
        input_text: safeInput,
        extractedData,
        vehicleType: resolvedType,
      })
    } catch (err) {
      console.error('[aiVehicleMapping] OpenAI call failed:', err.message)
    }
  }

  const flat = {
    ...flattenRawInput(extractedData),
    ...(enrichmentResult?.form_flat || {}),
    ...flattenRawInput(aiRaw.extracted),
    ...flattenRawInput(aiRaw.inferred),
  }

  const extractedFields = new Set()
  const inferredFields = new Set()
  const unknownFields = []
  const formValues = {}
  const confidence100 = normalizeConfidenceScores(aiRaw.confidence || {}, [])

  // Track which keys came from extracted vs inferred
  if (aiRaw.extracted) {
    for (const k of Object.keys(aiRaw.extracted)) extractedFields.add(k)
  }
  if (aiRaw.inferred) {
    for (const k of Object.keys(aiRaw.inferred)) inferredFields.add(k)
  }
  if (extractedData) {
    for (const k of Object.keys(extractedData)) {
      if (!inferredFields.has(k)) extractedFields.add(k)
    }
  }

  if (enrichmentResult?.enriched_fields) {
    for (const k of enrichmentResult.enriched_fields) {
      inferredFields.add(k)
    }
  }
  if (enrichmentResult?.transcription_fields) {
    for (const k of enrichmentResult.transcription_fields) {
      extractedFields.add(k)
    }
  }

  if (enrichmentResult?.confidence) {
    confidence100._overall = enrichmentResult.confidence
  }

  // Apply spec database inference for missing inferrable fields
  const brand = flat.brand || flat.make
  const model = flat.model
  const year = flat.year
  const specLookup = lookupVehicleSpecs({ brand, make: brand, model, year })
  if (specLookup) {
    const { _source, _lookupKey, ...specs } = specLookup
    debugLog.specDatabaseValues = { ...specs, _lookupKey }
    for (const [specKey, specVal] of Object.entries(specs)) {
      const fieldDef = config.fields.find((f) => f.key === specKey)
      if (!fieldDef || !fieldDef.inferrable) continue
      if (pickRawValue(flat, fieldDef) !== null) continue
      flat[specKey] = specVal
      inferredFields.add(specKey)
      if (confidence100[specKey] === undefined) confidence100[specKey] = 70
    }
  }

  // Heuristic regional spec from title/text
  if (!flat.regionalSpec && !flat.regional_spec) {
    const regional = inferRegionalSpecFromText(`${safeInput} ${flat.title || ''}`)
    if (regional) {
      flat.regionalSpec = regional
      inferredFields.add('regionalSpec')
      confidence100.regionalSpec = confidence100.regionalSpec ?? 85
    }
  }

  // Sync brand/make
  if (flat.brand && !flat.make) flat.make = flat.brand
  if (flat.make && !flat.brand) flat.brand = flat.make
  if (flat.mileage_km && !flat.mileage) flat.mileage = flat.mileage_km
  if (flat.kilometers && !flat.mileage) flat.mileage = flat.kilometers
  if (flat.location_city && !flat.city) flat.city = flat.location_city

  const seenFormKeys = new Set()

  for (const fieldDef of config.fields) {
    if (seenFormKeys.has(fieldDef.key)) continue
    seenFormKeys.add(fieldDef.key)

    const rawValue = pickRawValue(flat, fieldDef)
    if (rawValue === null) continue

    const { valid, value, reason } = validateField(fieldDef, rawValue)
    if (!valid) {
      debugLog.rejectedValues[fieldDef.key] = { raw: rawValue, reason }
      unknownFields.push(fieldDef.key)
      continue
    }

    let finalValue = value
    if (fieldDef.key === 'engineSize') finalValue = formatEngineSize(value)
    if (fieldDef.key === 'regionalSpec' && !formValues.targetMarket) {
      formValues.targetMarket = String(value)
    }
    if (fieldDef.key === 'targetMarket' && !formValues.regionalSpec) {
      const regional = matchEnumOption(value, REGIONAL_SPEC_OPTIONS) || inferRegionalSpecFromText(value)
      if (regional) formValues.regionalSpec = regional
    }

    formValues[fieldDef.key] = finalValue
    debugLog.validatedValues[fieldDef.key] = finalValue

    const isExtracted = (fieldDef.aiKeys || []).some((k) => extractedFields.has(k)) || extractedFields.has(fieldDef.key)
    const isInferred = (fieldDef.aiKeys || []).some((k) => inferredFields.has(k)) || inferredFields.has(fieldDef.key)

    if (isExtracted) {
      debugLog.extractedValues[fieldDef.key] = finalValue
      if (confidence100[fieldDef.key] === undefined) confidence100[fieldDef.key] = 95
    } else if (isInferred) {
      debugLog.inferredValues[fieldDef.key] = finalValue
      if (confidence100[fieldDef.key] === undefined) confidence100[fieldDef.key] = 75
    }
  }

  // Mirror brand -> make in form values
  if (formValues.brand && !formValues.make) formValues.make = formValues.brand
  if (formValues.make && !formValues.brand) formValues.brand = formValues.make

  const allFieldKeys = config.fields.map((f) => f.key).filter((k, i, arr) => arr.indexOf(k) === i)
  const fullConfidence = normalizeConfidenceScores(confidence100, allFieldKeys)
  debugLog.confidence = fullConfidence

  const display_data = buildLegacyDisplayData(formValues)
  const filter_data = buildLegacyFilterData(display_data)

  const missing_fields = []
  for (const key of config.legacyRequiredFields || []) {
    const displayVal = display_data[key]
    const filterVal = filter_data[key]
    const val = displayVal !== null && displayVal !== undefined && displayVal !== '' ? displayVal : filterVal
    if (val === null || val === undefined || val === '') missing_fields.push(key)
  }

  const extracted_field_list = Object.keys(debugLog.extractedValues)
  const ai_inferred_field_list = Object.keys(debugLog.inferredValues).filter(
    (k) => !extracted_field_list.includes(k),
  )

  const mappedFilterSelections = buildFilterSelectionsFromVehicleData(categoryFilters, formValues)
  const filter_selections = mergeFilterSelectionMaps(
    enrichmentResult?.filter_selections || {},
    mappedFilterSelections,
  )
  debugLog.filter_selections = filter_selections
  debugLog.enrichment = enrichmentResult?.debug_log || null

  const result = {
    vehicle_type: resolvedType,
    form_values: formValues,
    display_data,
    filter_data,
    filter_selections: normalizeFilterSelections(filter_selections),
    enrichment: enrichmentResult
      ? {
          source: enrichmentResult.source,
          confidence: enrichmentResult.confidence,
          profile: enrichmentResult.profile,
          vehicleSpecifications: enrichmentResult.vehicleSpecifications,
          specifications: enrichmentResult.specifications,
          transcription_fields: enrichmentResult.transcription_fields,
          enriched_fields: enrichmentResult.enriched_fields,
          not_found_fields: enrichmentResult.not_found_fields,
        }
      : null,
    vehicleSpecifications: enrichmentResult?.vehicleSpecifications || null,
    specifications: {
      ...(enrichmentResult?.specifications || {}),
      ...(aiRaw.specifications || {}),
    },
    missing_fields,
    confidence: confidenceToLegacyScale(fullConfidence),
    confidence_scores: fullConfidence,
    extracted_fields: extracted_field_list,
    ai_inferred_fields: ai_inferred_field_list,
    unknown_fields: [...new Set(unknownFields)],
    debug_log: debugLog,
  }

  console.log('[aiVehicleMapping] Mapping complete:', {
    vehicleType: resolvedType,
    extracted: extracted_field_list.length,
    inferred: ai_inferred_field_list.length,
    validated: Object.keys(formValues).length,
    missing: missing_fields.length,
  })
  console.log('[aiVehicleMapping] Extracted:', debugLog.extractedValues)
  console.log('[aiVehicleMapping] Inferred:', debugLog.inferredValues)
  console.log('[aiVehicleMapping] Confidence:', fullConfidence)
  console.log('[aiVehicleMapping] Final form_values:', formValues)

  cache.set(cacheKey, { createdAt: Date.now(), value: result })
  return result
}

function getFallbackMappingResult(vehicleType = 'cars') {
  const config = getVehicleConfig(vehicleType)
  const confidence = {}
  for (const key of config.legacyRequiredFields || []) confidence[key] = null

  return {
    vehicle_type: vehicleType,
    form_values: {},
    display_data: {},
    filter_data: {},
    filter_selections: {},
    enrichment: null,
    specifications: {},
    missing_fields: [...(config.legacyRequiredFields || [])],
    confidence,
    confidence_scores: {},
    extracted_fields: [],
    ai_inferred_fields: [],
    unknown_fields: [],
    debug_log: { fallback: true },
  }
}

module.exports = {
  mapVehicleListingData,
  getFallbackMappingResult,
  validateField,
  resolveVehicleType,
}
