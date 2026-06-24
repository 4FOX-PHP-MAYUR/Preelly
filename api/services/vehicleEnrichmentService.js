/**
 * Vehicle Enrichment Service
 *
 * After basic transcription extraction, identifies the exact vehicle variant
 * and returns a complete specification profile (local DB → Mongo cache → OpenAI).
 */

const axios = require('axios')
const crypto = require('crypto')
const VehicleSpecCache = require('../models/VehicleSpecCache')
const VehicleAiLog = require('../models/VehicleAiLog')
const { lookupVehicleSpecs } = require('../data/vehicleSpecDatabase')
const { buildVehicleSpecifications } = require('../utils/vehicleSpecifications')
const {
  getVehicleConfig,
  BODY_TYPE_OPTIONS,
  TRANSMISSION_OPTIONS,
  FUEL_TYPE_OPTIONS,
  REGIONAL_SPEC_OPTIONS,
  STEERING_SIDE_OPTIONS,
  DRIVETRAIN_OPTIONS,
  ENGINE_CAPACITY_RANGES,
  HORSEPOWER_RANGES,
  CYLINDER_OPTIONS,
} = require('../config/vehicleFieldMappingConfig')
const { buildFilterSelectionsFromVehicleData } = require('../utils/vehicleFilterMatching')
const { mergeFilterSelectionMaps } = require('../utils/filterSelectionMerge')

const memoryCache = new Map()
const pendingEnrichment = new Map()
const MEMORY_CACHE_TTL_MS = 60 * 60 * 1000

async function logAiResponse({
  operation,
  cacheKey,
  brand,
  model,
  year,
  variant,
  requestPayload,
  responsePayload,
  source,
  success,
  errorMessage,
  durationMs,
}) {
  try {
    await VehicleAiLog.create({
      operation,
      cacheKey,
      brand,
      model,
      year: parseNumber(year),
      variant: variant || null,
      requestPayload,
      responsePayload,
      source,
      success: success !== false,
      errorMessage: errorMessage || null,
      durationMs: durationMs ?? null,
    })
  } catch (err) {
    console.error('[vehicleEnrichment] AI log write failed:', err.message)
  }
}

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY || ''
}

function normalizeKeyPart(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, ' ')
}

function buildCacheKey({ brand, model, year, variant, title }) {
  const parts = [
    normalizeKeyPart(brand),
    normalizeKeyPart(model),
    year ? String(year) : '',
    normalizeKeyPart(variant || ''),
    normalizeKeyPart(title || '').slice(0, 80),
  ]
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex')
}

function parseStrictJson(content) {
  if (!content || typeof content !== 'string') throw new Error('OpenAI returned empty content')
  const trimmed = content.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const first = trimmed.indexOf('{')
    const last = trimmed.lastIndexOf('}')
    if (first === -1 || last <= first) throw new Error('OpenAI returned non-JSON content')
    return JSON.parse(trimmed.slice(first, last + 1))
  }
}

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}

function normalizeEnumValue(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s || null
}

function matchEnumOption(raw, options) {
  if (!raw || !options?.length) return null
  const norm = String(raw).trim().toLowerCase()
  const exact = options.find((o) => String(o).trim().toLowerCase() === norm)
  if (exact) return exact
  const partial = options.find((o) => {
    const n = String(o).trim().toLowerCase()
    return n.length >= 3 && (norm.includes(n) || n.includes(norm))
  })
  return partial || null
}

function ccToRange(cc) {
  const n = parseNumber(cc)
  if (n === null) return null
  if (n < 1000) return '0-999 cc'
  if (n < 1500) return '1000-1499 cc'
  if (n < 2000) return '1500-1999 cc'
  if (n < 2500) return '2000-2499 cc'
  if (n < 3000) return '2500-2999 cc'
  if (n < 4000) return '3000-3999 cc'
  return '4000+ cc'
}

function hpToRange(hp) {
  const n = parseNumber(hp)
  if (n === null) return null
  if (n < 100) return '0-99 HP'
  if (n < 200) return '100-199 HP'
  if (n < 300) return '200-299 HP'
  if (n < 400) return '300-399 HP'
  if (n < 500) return '400-499 HP'
  return '500+ HP'
}

function inferRegionalSpecFromText(text) {
  const t = String(text || '').toLowerCase()
  if (/\bgcc\b|\bgulf\b|\buae\b/.test(t)) return 'GCC'
  if (/\bamerican\b|\busa\b/.test(t)) return 'American'
  if (/\bjapanese\b|\bjdm\b/.test(t)) return 'Japanese'
  if (/\beuropean\b|\beu spec\b/.test(t)) return 'European'
  return null
}

function normalizeSteeringSide(v) {
  if (!v) return null
  const s = String(v).toLowerCase()
  if (s.includes('left')) return 'Left Hand Drive'
  if (s.includes('right')) return 'Right Hand Drive'
  return matchEnumOption(v, STEERING_SIDE_OPTIONS)
}

function buildFilterOptionsSection(categoryFilters) {
  if (!Array.isArray(categoryFilters) || !categoryFilters.length) return ''
  const roots = categoryFilters.filter((f) => !f.parentId && Array.isArray(f.options) && f.options.length)
  if (!roots.length) return ''
  const lines = ['\nPLATFORM FILTER OPTIONS (use EXACT option strings when possible):']
  for (const root of roots.slice(0, 25)) {
    lines.push(`- ${root.name}: ${root.options.slice(0, 30).join(', ')}`)
  }
  return lines.join('\n')
}

function buildEnrichmentPrompt({ extractedData, input_text, categoryFilters, vehicleType }) {
  const config = getVehicleConfig(vehicleType || 'cars')
  const filterSection = buildFilterOptionsSection(categoryFilters)
  const brand = extractedData?.brand || extractedData?.make
  const model = extractedData?.model
  const year = extractedData?.year
  const variant = extractedData?.variant || extractedData?.trim
  const variantMissing = !variant

  return `You are an expert automotive data specialist for a vehicle marketplace.

Based on the following vehicle, return complete OEM specifications in valid JSON only.

Brand: ${brand || ''}
Model: ${model || ''}
Variant: ${variant || '(not provided — infer closest GCC/UAE market trim for this model year)'}
Year: ${year || ''}

${input_text ? `TRANSCRIPT CONTEXT (spoken facts only — do not limit specs to this):\n${String(input_text).slice(0, 1200)}` : ''}

${variantMissing ? 'VARIANT RULE: Variant was not spoken. Match using brand + model + year. Return the closest possible trim; set matchQuality to "closest" and lower confidence.' : 'VARIANT RULE: Match the exact trim when possible; set matchQuality to "exact".'}

Use platform enums where applicable:
- bodyType: ${BODY_TYPE_OPTIONS.join(', ')}
- transmission: ${TRANSMISSION_OPTIONS.join(', ')}
- fuelType: ${FUEL_TYPE_OPTIONS.join(', ')}
- regionalSpec: ${REGIONAL_SPEC_OPTIONS.join(', ')}
- steeringSide: ${STEERING_SIDE_OPTIONS.join(', ')}
- drivetrain: ${DRIVETRAIN_OPTIONS.join(', ')}

Return strict JSON only:
{
  "brand": "",
  "model": "",
  "year": 0,
  "variant": "",
  "generation": "",
  "vehicleType": "",
  "bodyType": "",
  "transmission": "",
  "fuelType": "",
  "engineCapacity": 0,
  "engineCapacityRange": "",
  "horsepower": 0,
  "horsepowerRange": "",
  "torque": 0,
  "cylinders": 0,
  "doors": 0,
  "seats": 0,
  "drivetrain": "",
  "steeringSide": "",
  "regionalSpec": "",
  "topSpeed": "",
  "fuelTankCapacity": "",
  "kerbWeight": "",
  "airbags": "",
  "dimensions": {
    "length": "",
    "width": "",
    "height": "",
    "wheelbase": "",
    "groundClearance": ""
  },
  "safetyFeatures": [],
  "features": [],
  "matchQuality": "exact|closest|unknown",
  "confidence": 0
}
${filterSection}

Vehicle category: ${config.label}`
}

async function callOpenAiEnrichment({ extractedData, input_text, categoryFilters, vehicleType, cacheKey }) {
  const apiKey = getOpenAiKey()
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const started = Date.now()
  const brand = extractedData?.brand || extractedData?.make
  const prompt = buildEnrichmentPrompt({ extractedData, input_text, categoryFilters, vehicleType })

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You identify exact vehicle variants and return structured JSON specifications for marketplace listings. JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.15,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
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

  await logAiResponse({
    operation: 'enrichment',
    cacheKey,
    brand,
    model: extractedData?.model,
    year: extractedData?.year,
    variant: extractedData?.variant || extractedData?.trim,
    requestPayload: { extractedData, vehicleType, promptLength: prompt.length },
    responsePayload: parsed,
    source: 'openai',
    success: true,
    durationMs: Date.now() - started,
  })

  return parsed
}

function localDbToProfile(localSpec, extractedData) {
  const title = extractedData?.title || ''
  const regional = inferRegionalSpecFromText(title) || extractedData?.regionalSpec || null
  const engineCc = parseNumber(localSpec.engineSize?.replace?.(/cc/i, '') || localSpec.engineSize)
  return {
    brand: extractedData?.brand || extractedData?.make,
    model: extractedData?.model,
    year: extractedData?.year,
    variant: localSpec.variant || extractedData?.variant || extractedData?.trim || null,
    generation: localSpec.generation || null,
    vehicleType: localSpec.bodyType || null,
    bodyType: localSpec.bodyType || null,
    transmission: localSpec.transmission || null,
    fuelType: localSpec.fuelType || null,
    engineCapacity: engineCc,
    engineCapacityRange: engineCc ? ccToRange(engineCc) : null,
    horsepower: parseNumber(localSpec.horsepower),
    horsepowerRange: localSpec.horsepower ? hpToRange(localSpec.horsepower) : null,
    cylinders: parseNumber(localSpec.cylinders),
    doors: parseNumber(localSpec.doors),
    seats: localSpec.seatingCapacity || null,
    drivetrain: localSpec.drivetrain || null,
    steeringSide: localSpec.steeringSide || 'Left Hand Drive',
    regionalSpec: regional,
    features: Array.isArray(localSpec.features) ? localSpec.features : [],
    confidence: 85,
  }
}

function validateAndNormalizeProfile(raw, extractedData) {
  const profile = { ...(raw || {}) }
  const out = {}

  out.brand = normalizeEnumValue(profile.brand || extractedData?.brand || extractedData?.make)
  out.model = normalizeEnumValue(profile.model || extractedData?.model)
  out.year = parseNumber(profile.year ?? extractedData?.year)
  out.variant = normalizeEnumValue(profile.variant || profile.trim || extractedData?.variant || extractedData?.trim)
  out.generation = normalizeEnumValue(profile.generation)
  out.vehicleType = normalizeEnumValue(profile.vehicleType || profile.bodyType)

  out.bodyType = matchEnumOption(profile.bodyType, BODY_TYPE_OPTIONS)
  out.transmission = matchEnumOption(profile.transmission, TRANSMISSION_OPTIONS)
  out.fuelType = matchEnumOption(profile.fuelType, FUEL_TYPE_OPTIONS)
  out.regionalSpec =
    matchEnumOption(profile.regionalSpec, REGIONAL_SPEC_OPTIONS) ||
    inferRegionalSpecFromText(extractedData?.title || '') ||
    null
  out.steeringSide = normalizeSteeringSide(profile.steeringSide)
  out.drivetrain = matchEnumOption(profile.drivetrain, DRIVETRAIN_OPTIONS)

  const engineCc = parseNumber(profile.engineCapacity ?? profile.engine_cc)
  out.engineCapacity = engineCc
  out.engineCapacityRange =
    matchEnumOption(profile.engineCapacityRange, ENGINE_CAPACITY_RANGES) || (engineCc ? ccToRange(engineCc) : null)

  const hp = parseNumber(profile.horsepower)
  out.horsepower = hp
  out.horsepowerRange =
    matchEnumOption(profile.horsepowerRange, HORSEPOWER_RANGES) || (hp ? hpToRange(hp) : null)

  const cyl = parseNumber(profile.cylinders)
  out.cylinders = cyl !== null ? String(cyl) : matchEnumOption(profile.cylinders, CYLINDER_OPTIONS)

  const doors = parseNumber(profile.doors)
  out.doors = doors !== null ? String(doors) : normalizeEnumValue(profile.doors)

  out.seats = parseNumber(profile.seats ?? profile.seatingCapacity)
  out.seatingCapacity = out.seats

  out.features = Array.isArray(profile.features)
    ? profile.features.map((f) => String(f).trim()).filter(Boolean)
    : []

  out.safetyFeatures = Array.isArray(profile.safetyFeatures)
    ? profile.safetyFeatures.map((f) => String(f).trim()).filter(Boolean)
    : []

  out.torque = parseNumber(profile.torque)
  out.topSpeed = normalizeEnumValue(profile.topSpeed)
  out.fuelTankCapacity = normalizeEnumValue(profile.fuelTankCapacity)
  out.kerbWeight = normalizeEnumValue(profile.kerbWeight)
  out.airbags = normalizeEnumValue(profile.airbags)
  out.matchQuality = normalizeEnumValue(profile.matchQuality) || null

  const dims = profile.dimensions && typeof profile.dimensions === 'object' ? profile.dimensions : {}
  out.dimensions = {
    length: normalizeEnumValue(dims.length || profile.length),
    width: normalizeEnumValue(dims.width || profile.width),
    height: normalizeEnumValue(dims.height || profile.height),
    wheelbase: normalizeEnumValue(dims.wheelbase || profile.wheelbase),
    groundClearance: normalizeEnumValue(dims.groundClearance || profile.ground_clearance),
  }

  const conf = parseNumber(profile.confidence)
  let baseConf = conf !== null ? Math.max(0, Math.min(100, Math.round(conf))) : 75
  if (out.matchQuality === 'closest') baseConf = Math.min(baseConf, 70)
  if (out.matchQuality === 'unknown') baseConf = Math.min(baseConf, 50)
  out.confidence = baseConf

  return out
}

function profileToFormFlat(profile, extractedData) {
  const flat = {}

  if (extractedData?.title) flat.title = extractedData.title
  if (extractedData?.description) flat.description = extractedData.description
  if (extractedData?.price !== undefined) flat.price = extractedData.price
  if (extractedData?.currency) flat.currency = extractedData.currency
  if (extractedData?.condition) flat.condition = extractedData.condition
  if (extractedData?.kilometers !== undefined) flat.mileage = extractedData.kilometers
  if (extractedData?.mileage !== undefined) flat.mileage = extractedData.mileage

  if (profile.brand) {
    flat.brand = profile.brand
    flat.make = profile.brand
  }
  if (profile.model) flat.model = profile.model
  if (profile.year) flat.year = profile.year
  if (profile.variant) flat.trim = profile.variant
  if (profile.bodyType) flat.bodyType = profile.bodyType
  if (profile.transmission) flat.transmission = profile.transmission
  if (profile.fuelType) flat.fuelType = profile.fuelType
  if (profile.regionalSpec) {
    flat.regionalSpec = profile.regionalSpec
    flat.targetMarket = profile.regionalSpec
  }
  if (profile.steeringSide) flat.steeringSide = profile.steeringSide
  if (profile.drivetrain) flat.drivetrain = profile.drivetrain
  if (profile.seats) flat.seatingCapacity = profile.seats
  if (profile.doors) flat.doors = profile.doors
  if (profile.cylinders) flat.cylinders = profile.cylinders
  if (profile.engineCapacity) flat.engineSize = `${Math.round(profile.engineCapacity)}cc`
  if (profile.horsepower) flat.horsepower = `${profile.horsepower} HP`
  if (profile.torque) flat.torque = `${profile.torque} Nm`
  if (profile.topSpeed) flat.topSpeed = profile.topSpeed
  if (profile.fuelTankCapacity) flat.fuelTankCapacity = profile.fuelTankCapacity
  if (profile.kerbWeight) flat.kerbWeight = profile.kerbWeight
  if (profile.airbags) flat.airbags = profile.airbags
  if (profile.features?.length) flat.features = profile.features
  if (profile.safetyFeatures?.length) flat.safetyFeatures = profile.safetyFeatures
  if (profile.dimensions) flat.dimensions = profile.dimensions

  return flat
}

function normalizeStr(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[\s\-_]+/g, ' ')
    .trim()
}

function matchFeaturesToFilterSelections(categoryFilters, features) {
  const selections = {}
  if (!Array.isArray(categoryFilters) || !categoryFilters?.length || !features?.length) return selections

  const featureRoots = categoryFilters.filter((f) => {
    if (f.parentId) return false
    const name = normalizeStr(f.name)
    return (
      name.includes('comfort') ||
      name.includes('convenience') ||
      name.includes('driver assistance') ||
      name.includes('safety') ||
      name.includes('entertainment') ||
      name.includes('technology') ||
      name.includes('exterior') ||
      name.includes('badge') ||
      name.includes('feature')
    )
  })

  for (const root of featureRoots) {
    const slug = String(root.slug || root._id)
    const fieldKey = `filter_${slug}`
    const opts = Array.isArray(root.options) ? root.options.filter(Boolean) : []
    if (!opts.length) continue

    const matched = []
    for (const feature of features) {
      const fn = normalizeStr(feature)
      if (!fn) continue
      const opt = opts.find((o) => {
        const on = normalizeStr(o)
        return on === fn || on.includes(fn) || fn.includes(on)
      })
      if (opt && !matched.includes(opt)) matched.push(opt)
    }

    if (matched.length) selections[fieldKey] = matched
  }

  return selections
}

function classifyFields(extractedData, profile, config) {
  const transcriptionFields = []
  const enrichedFields = []
  const notFoundFields = []

  const transcriptKeys = new Set(Object.keys(extractedData || {}).filter((k) => {
    const v = extractedData[k]
    return v !== undefined && v !== null && v !== ''
  }))

  const profileFormFlat = profileToFormFlat(profile, {})

  for (const fieldDef of config.fields) {
    const key = fieldDef.key
    const fromTranscript = (fieldDef.aiKeys || [key]).some((k) => transcriptKeys.has(k)) || transcriptKeys.has(key)
    const enrichedVal = profileFormFlat[key]
    const hasEnriched = enrichedVal !== undefined && enrichedVal !== null && enrichedVal !== ''

    if (fromTranscript) {
      transcriptionFields.push(key)
    } else if (hasEnriched) {
      enrichedFields.push(key)
    } else if (fieldDef.inferrable !== false) {
      notFoundFields.push(key)
    }
  }

  if (profile.features?.length) enrichedFields.push('features')

  return {
    transcription_fields: [...new Set(transcriptionFields)],
    enriched_fields: [...new Set(enrichedFields.filter((k) => !transcriptionFields.includes(k)))],
    not_found_fields: [...new Set(notFoundFields.filter((k) => !transcriptionFields.includes(k) && !enrichedFields.includes(k)))],
  }
}

/**
 * @param {object} opts
 * @param {object} opts.extractedData - basic fields from transcription
 * @param {string} [opts.input_text]
 * @param {Array} [opts.categoryFilters]
 * @param {string} [opts.vehicleType]
 */
async function runEnrichmentPipeline({
  extractedData,
  input_text,
  categoryFilters,
  vehicleType,
  cacheKey,
  debugLog,
}) {
  const brand = extractedData?.brand || extractedData?.make
  const model = extractedData?.model
  const year = extractedData?.year
  const variant = extractedData?.variant || extractedData?.trim

  let source = 'openai'
  let rawProfile = null

  const localSpec = lookupVehicleSpecs({ brand, make: brand, model, year })
  if (localSpec) {
    rawProfile = localDbToProfile(localSpec, extractedData)
    source = 'local_db'
    debugLog.source = 'local_db'
    console.log('[vehicleEnrichment] Using local DB spec:', localSpec._lookupKey)
  }

  if (!rawProfile) {
    try {
      const cached = await VehicleSpecCache.findOne({ cacheKey }).lean()
      if (cached?.profile) {
        rawProfile = cached.profile
        source = cached.source || 'cache'
        debugLog.source = 'cache'
        console.log('[vehicleEnrichment] Using MongoDB cache:', cacheKey)
      }
    } catch (err) {
      console.error('[vehicleEnrichment] Cache lookup failed:', err.message)
    }
  }

  // Variant-missing fallback: try cache keyed without variant / fuzzy brand+model+year
  if (!rawProfile && !variant) {
    try {
      const fallbackKey = buildCacheKey({ brand, model, year, variant: '', title: '' })
      if (fallbackKey !== cacheKey) {
        const cachedFallback = await VehicleSpecCache.findOne({ cacheKey: fallbackKey }).lean()
        if (cachedFallback?.profile) {
          rawProfile = { ...cachedFallback.profile, matchQuality: 'closest' }
          source = cachedFallback.source || 'cache'
          debugLog.source = 'cache_fallback'
          debugLog.variantFallback = true
        }
      }
      if (!rawProfile) {
        const fuzzy = await VehicleSpecCache.findOne({
          brand: normalizeKeyPart(brand),
          model: normalizeKeyPart(model),
          year: parseNumber(year),
        })
          .sort({ updatedAt: -1 })
          .lean()
        if (fuzzy?.profile) {
          rawProfile = { ...fuzzy.profile, matchQuality: 'closest' }
          source = fuzzy.source || 'cache'
          debugLog.source = 'cache_fuzzy'
          debugLog.variantFallback = true
        }
      }
    } catch (err) {
      console.error('[vehicleEnrichment] Variant fallback cache lookup failed:', err.message)
    }
  }

  if (!rawProfile) {
    try {
      debugLog.openAiCalled = true
      rawProfile = await callOpenAiEnrichment({
        extractedData,
        input_text,
        categoryFilters,
        vehicleType,
        cacheKey,
      })
      source = 'openai'
      debugLog.source = 'openai'

      try {
        await VehicleSpecCache.findOneAndUpdate(
          { cacheKey },
          {
            cacheKey,
            brand: normalizeKeyPart(brand),
            model: normalizeKeyPart(model),
            year: parseNumber(year),
            variant: rawProfile?.variant || variant || null,
            generation: rawProfile?.generation || null,
            profile: rawProfile,
            confidence: parseNumber(rawProfile?.confidence),
            source: 'openai',
          },
          { upsert: true, new: true },
        )
      } catch (saveErr) {
        console.error('[vehicleEnrichment] Failed to save cache:', saveErr.message)
      }
    } catch (err) {
      console.error('[vehicleEnrichment] OpenAI enrichment failed:', err.message)
      await logAiResponse({
        operation: 'enrichment',
        cacheKey,
        brand,
        model,
        year,
        variant,
        requestPayload: { extractedData },
        responsePayload: null,
        source: 'openai',
        success: false,
        errorMessage: err.message,
      })
      if (localSpec) {
        rawProfile = localDbToProfile(localSpec, extractedData)
        source = 'local_db'
      }
    }
  }

  return { rawProfile, source, localSpec }
}

async function enrichVehicleProfile({
  extractedData = {},
  input_text = '',
  categoryFilters = null,
  vehicleType = 'cars',
} = {}) {
  const brand = extractedData?.brand || extractedData?.make
  const model = extractedData?.model
  const year = extractedData?.year
  const config = getVehicleConfig(vehicleType)

  const debugLog = {
    brand,
    model,
    year,
    source: null,
    cacheKey: null,
    openAiCalled: false,
    variantFallback: false,
  }

  if (!brand || !model) {
    return {
      profile: null,
      form_flat: {},
      filter_selections: {},
      feature_filter_selections: {},
      vehicleSpecifications: null,
      source: 'none',
      confidence: null,
      transcription_fields: Object.keys(extractedData || {}),
      enriched_fields: [],
      not_found_fields: [],
      debug_log: debugLog,
    }
  }

  const cacheKey = buildCacheKey({
    brand,
    model,
    year,
    variant: extractedData?.variant || extractedData?.trim,
    title: extractedData?.title,
  })
  debugLog.cacheKey = cacheKey

  const memCached = memoryCache.get(cacheKey)
  if (memCached && Date.now() - memCached.createdAt < MEMORY_CACHE_TTL_MS) {
    debugLog.source = memCached.value.source
    return memCached.value
  }

  if (pendingEnrichment.has(cacheKey)) {
    return pendingEnrichment.get(cacheKey)
  }

  const pipelinePromise = (async () => {
    const { rawProfile, source } = await runEnrichmentPipeline({
      extractedData,
      input_text,
      categoryFilters,
      vehicleType,
      cacheKey,
      debugLog,
    })

    if (!rawProfile) {
      const classification = classifyFields(extractedData, {}, config)
      return {
        profile: null,
        form_flat: profileToFormFlat({}, extractedData),
        filter_selections: {},
        feature_filter_selections: {},
        vehicleSpecifications: buildVehicleSpecifications(
          validateAndNormalizeProfile({}, extractedData),
          extractedData,
          { source: 'none' },
        ),
        source: 'none',
        confidence: null,
        ...classification,
        debug_log: debugLog,
      }
    }

    const profile = validateAndNormalizeProfile(rawProfile, extractedData)
    const form_flat = profileToFormFlat(profile, extractedData)
    const vehicleSpecifications = buildVehicleSpecifications(profile, extractedData, {
      source,
      confidence: profile.confidence,
    })

    const specFilterSelections = buildFilterSelectionsFromVehicleData(categoryFilters, form_flat)
    const featureFilterSelections = matchFeaturesToFilterSelections(categoryFilters, [
      ...(profile.features || []),
      ...(profile.safetyFeatures || []),
    ])
    const filter_selections = mergeFilterSelectionMaps(specFilterSelections, featureFilterSelections)

    const classification = classifyFields(extractedData, profile, config)

    const result = {
      profile,
      form_flat,
      filter_selections,
      feature_filter_selections: featureFilterSelections,
      vehicleSpecifications,
      source,
      confidence: profile.confidence,
      specifications: {
        generation: profile.generation,
        vehicleType: profile.vehicleType,
        variant: profile.variant,
        matchQuality: profile.matchQuality,
        features: profile.features,
        safetyFeatures: profile.safetyFeatures,
        dimensions: profile.dimensions,
        engineCapacityRange: profile.engineCapacityRange,
        horsepowerRange: profile.horsepowerRange,
        torque: profile.torque,
        topSpeed: profile.topSpeed,
        fuelTankCapacity: profile.fuelTankCapacity,
        kerbWeight: profile.kerbWeight,
        airbags: profile.airbags,
      },
      ...classification,
      debug_log: debugLog,
    }

    console.log('[vehicleEnrichment] Enrichment complete:', {
      source,
      confidence: profile.confidence,
      enriched: classification.enriched_fields.length,
      transcription: classification.transcription_fields.length,
      filters: Object.keys(filter_selections).length,
    })

    memoryCache.set(cacheKey, { createdAt: Date.now(), value: result })
    return result
  })()

  pendingEnrichment.set(cacheKey, pipelinePromise)
  try {
    return await pipelinePromise
  } finally {
    pendingEnrichment.delete(cacheKey)
  }
}

module.exports = {
  enrichVehicleProfile,
  validateAndNormalizeProfile,
  profileToFormFlat,
  matchFeaturesToFilterSelections,
  buildCacheKey,
}
