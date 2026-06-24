/**
 * Apply transcript / AI extraction data to category filter dropdowns (Step 4).
 * Filters load when the category is picked (Step 2), but transcription runs later (Step 3),
 * so this helper must run both when filters load and again after transcribe completes.
 */

import {
  matchExplicitOption,
  matchValueToFilterOption,
  FILTER_FIELD_KEY_MAP,
  VEHICLE_FORM_KEYS,
  buildFilterSelectionsFromVehicleData,
} from './vehicleFilterMatching'
import { toFilterArray, mergeFilterValues } from './filterValueUtils'
import { isAdsPostedFilterRoot } from './adsPostedFilter'

function normalizeStr(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[\s\-_]+/g, ' ')
    .trim()
}

function matchChildNode(rawValue, children) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null
  const asStr = String(rawValue)

  const byId = children.find((c) => String(c._id) === asStr)
  if (byId) return byId

  const norm = normalizeStr(rawValue)
  if (!norm) return null

  const byName = children.find((c) => normalizeStr(c.name) === norm)
  if (byName) return byName

  return (
    children.find((c) => {
      const n = normalizeStr(c.name)
      return n.length >= 3 && (norm.includes(n) || n.includes(norm))
    }) || null
  )
}

const AI_FIELD_MAP = {
  body_type: 'bodyType',
  fuel_type: 'fuelType',
  transmission: 'transmission',
  doors: 'doors',
  condition: 'condition',
  brand: 'brand',
  make: 'make',
  color: 'color',
  regional_spec: 'regionalSpec',
  seller_type: 'sellerType',
  interior_color: 'interiorColor',
  exterior_color: 'color',
  steering_side: 'steeringSide',
  export_status: 'exportStatus',
  seats: 'seatingCapacity',
  engine_cc: 'engineSize',
  mileage_km: 'mileage',
  location_city: 'city',
}

function buildProductDataIndex(formValues, extractedData, aiExtraction, transcript) {
  const merged = { ...(formValues || {}) }

  // Include current vehicle form fields (set by AI prefill via setValue).
  for (const key of VEHICLE_FORM_KEYS) {
    let fv = formValues?.[key]
    if (Array.isArray(fv)) {
      fv = fv.length ? (fv.length === 1 ? fv[0] : fv.join(', ')) : ''
    }
    if (fv !== undefined && fv !== null && fv !== '') {
      merged[key] = fv
    }
  }

  if (extractedData && typeof extractedData === 'object') {
    Object.entries(extractedData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        merged[key] = value
      }
    })
    if (extractedData.colorSource) merged.colorSource = extractedData.colorSource
    if (extractedData.interiorColorSource) merged.interiorColorSource = extractedData.interiorColorSource
  }

  if (aiExtraction && typeof aiExtraction === 'object') {
    const aiDisplay = aiExtraction.display_data || {}
    const aiFilter = aiExtraction.filter_data || {}
    const aiFormValues = aiExtraction.form_values || {}

    Object.entries(aiFormValues).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        merged[key] = value
      }
    })

    Object.entries(AI_FIELD_MAP).forEach(([aiKey, formKey]) => {
      const val = aiDisplay[aiKey] !== undefined ? aiDisplay[aiKey] : aiFilter[aiKey]
      if (val !== undefined && val !== null && val !== '') {
        merged[formKey] = val
      }
    })

    // Pre-built filter selections from AI mapping service.
    const filterSelections = aiExtraction.filter_selections
    if (filterSelections && typeof filterSelections === 'object') {
      Object.entries(filterSelections).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          merged[key] = value
        }
      })
    }

    const profileFeatures =
      aiExtraction?.enrichment?.profile?.features ||
      aiExtraction?.specifications?.features ||
      aiFormValues.features
    if (Array.isArray(profileFeatures) && profileFeatures.length) {
      merged.features = profileFeatures
    }
  }

  const titleText = normalizeStr(merged.title || '')
  const descText = normalizeStr(merged.description || '')
  const transcriptText = normalizeStr(transcript || '')
  const featureText = Array.isArray(merged.features)
    ? merged.features.map((f) => normalizeStr(f)).join(' ')
    : ''
  const searchableText = `${titleText} ${descText} ${transcriptText} ${featureText}`.trim()

  return { merged, searchableText }
}

function resolveRootFieldKey(root) {
  return `filter_${String(root.slug || root._id)}`
}

function findRootForFieldKey(fieldKey, rootFilters) {
  const rootSlug = fieldKey.replace(/^filter_/, '')
  return rootFilters.find((r) => String(r.slug || r._id) === rootSlug) || null
}

function applyValueToFilter({
  root,
  fieldKey,
  rawValue,
  childrenByParent,
  getValues,
  setValue,
  source,
  force = false,
}) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return false

  const explicitOpts = Array.isArray(root.options) ? root.options.filter(Boolean) : []
  if (explicitOpts.length) {
    const incoming = toFilterArray(rawValue)
    const matchedValues = incoming
      .map((v) => matchValueToFilterOption(v, explicitOpts, root.name))
      .filter(Boolean)
    if (!matchedValues.length) return false

    const next = force
      ? matchedValues
      : mergeFilterValues(getValues(fieldKey), matchedValues)
    setValue(fieldKey, next, { shouldDirty: true, shouldTouch: true })
    console.log(`[PostAd] Auto-filled ${fieldKey} = ${JSON.stringify(next)} (${source})`)
    return true
  }

  const children = childrenByParent.get(String(root._id)) || []
  const incomingList = toFilterArray(rawValue)
  if (children.length && incomingList.length) {
    const matchedIds = []
    for (const v of incomingList) {
      const childMatch = matchChildNode(v, children)
      if (childMatch) matchedIds.push(String(childMatch._id))
    }
    if (matchedIds.length) {
      const next = force
        ? matchedIds
        : mergeFilterValues(getValues(fieldKey), matchedIds)
      setValue(fieldKey, next, { shouldDirty: true, shouldTouch: true })
      console.log(`[PostAd] Auto-filled ${fieldKey} = ${JSON.stringify(matchedIds)} (${source})`)
      return true
    }
  }

  const childMatch = matchChildNode(rawValue, children)
  if (childMatch) {
    const id = String(childMatch._id)
    const next = force ? [id] : mergeFilterValues(getValues(fieldKey), id)
    setValue(fieldKey, next, { shouldDirty: true, shouldTouch: true })
    console.log(`[PostAd] Auto-filled ${fieldKey} = "${childMatch.name}" (${source})`)
    return true
  }
  return false
}

/**
 * @param {object} opts
 * @param {Array} opts.filters - category filter list from API
 * @param {Function} opts.getValues
 * @param {Function} opts.setValue
 * @param {Record<string,string>|null|undefined} [opts.suggestedFilters]
 * @param {object|null|undefined} [opts.extractedData]
 * @param {object|null|undefined} [opts.aiExtraction]
 * @param {string|null|undefined} [opts.transcript]
 * @param {boolean} [opts.force] - overwrite existing filter values
 */
export function applyTranscriptFilterSelections({
  filters,
  getValues,
  setValue,
  suggestedFilters,
  extractedData,
  aiExtraction,
  transcript,
  force = false,
}) {
  const list = Array.isArray(filters) ? filters : []
  if (!list.length) return

  const rootFilters = list.filter((f) => !f.parentId)
  const childrenByParent = new Map()
  list.forEach((f) => {
    const pid = f.parentId ? String(f.parentId) : null
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
    childrenByParent.get(pid).push(f)
  })

  const formValues = getValues()
  const resolvedExtracted = extractedData ?? formValues.__extractedData ?? null
  const resolvedTranscript = transcript ?? formValues.__transcript ?? ''
  const resolvedSuggested = suggestedFilters ?? formValues.__suggestedFilters ?? null
  const resolvedAi = aiExtraction ?? formValues.__aiListingExtraction ?? null

  const { merged, searchableText } = buildProductDataIndex(
    formValues,
    resolvedExtracted,
    resolvedAi,
    resolvedTranscript,
  )

  // 0) Build filter selections from mapped vehicle form data (handles range buckets like engine cc).
  const derivedSelections = buildFilterSelectionsFromVehicleData(list, merged)
  for (const [fieldKey, value] of Object.entries(derivedSelections)) {
    const root = findRootForFieldKey(fieldKey, rootFilters)
    if (!root || isAdsPostedFilterRoot(root)) continue
    applyValueToFilter({
      root,
      fieldKey,
      rawValue: value,
      childrenByParent,
      getValues,
      setValue,
      source: 'vehicle data mapping',
      force,
    })
  }

  // 1) Apply server-suggested filter selections (from transcribe API).
  if (resolvedSuggested && typeof resolvedSuggested === 'object') {
    for (const [fieldKey, value] of Object.entries(resolvedSuggested)) {
      if (!fieldKey.startsWith('filter_')) continue
      const root = findRootForFieldKey(fieldKey, rootFilters)
      if (!root || isAdsPostedFilterRoot(root)) continue
      applyValueToFilter({
        root,
        fieldKey,
        rawValue: value,
        childrenByParent,
        getValues,
        setValue,
        source: 'transcript suggestion',
        force,
      })
    }
  }

  // 2) Apply filter_* keys from extracted transcript JSON and AI filter_selections.
  const filterKeySources = [resolvedExtracted, resolvedAi?.filter_selections, merged]
  for (const sourceObj of filterKeySources) {
    if (!sourceObj || typeof sourceObj !== 'object') continue
    for (const root of rootFilters) {
      if (isAdsPostedFilterRoot(root)) continue
      const fieldKey = resolveRootFieldKey(root)
      const slug = String(root.slug || root._id)
      const candidates = [
        sourceObj[fieldKey],
        root.slug ? sourceObj[`filter_${root.slug}`] : null,
        sourceObj[slug],
      ].filter((v) => v !== undefined && v !== null && v !== '')

      for (const rawValue of candidates) {
        if (
          applyValueToFilter({
            root,
            fieldKey,
            rawValue,
            childrenByParent,
            getValues,
            setValue,
            source: 'extracted filter key',
            force,
          })
        ) {
          break
        }
      }
    }
  }

  // 3) Match product fields + transcript text against filter names/options.
  for (const root of rootFilters) {
    if (isAdsPostedFilterRoot(root)) continue

    const fieldKey = resolveRootFieldKey(root)
    if (toFilterArray(getValues(fieldKey)).length && !force) continue

    const explicitOpts = Array.isArray(root.options) ? root.options.filter(Boolean) : []
    const children = childrenByParent.get(String(root._id)) || []
    const normalizedRootName = normalizeStr(root.name)
    const productFieldKeys = FILTER_FIELD_KEY_MAP[normalizedRootName] || []

    let rawValue = null
    for (const fk of productFieldKeys) {
      const fv = merged[fk]
      if (fv !== undefined && fv !== null && fv !== '') {
        rawValue = fv
        break
      }
    }

    if (rawValue) {
      applyValueToFilter({
        root,
        fieldKey,
        rawValue,
        childrenByParent,
        getValues,
        setValue,
        source: 'product field match',
        force,
      })
      continue
    }

    const isColorFilter = /color|colour/.test(normalizedRootName)
    if (isColorFilter && merged.colorSource !== 'video_vision') {
      // Avoid matching random color words in feature lists; use spoken color or vision only.
      continue
    }

    if (explicitOpts.length) {
      const fromTextMatches = explicitOpts.filter((opt) => {
        const n = normalizeStr(opt)
        return n.length >= 3 && searchableText.includes(n)
      })
      if (fromTextMatches.length) {
        const next = force
          ? fromTextMatches
          : mergeFilterValues(getValues(fieldKey), fromTextMatches)
        setValue(fieldKey, next, { shouldDirty: true, shouldTouch: true })
        console.log(`[PostAd] Auto-filled ${fieldKey} = ${JSON.stringify(next)} (transcript text match)`)
      }
    } else if (children.length) {
      const matchedIds = children
        .filter((child) => {
          const n = normalizeStr(child.name)
          return n.length >= 3 && searchableText.includes(n)
        })
        .map((child) => String(child._id))
      if (matchedIds.length) {
        const next = force
          ? matchedIds
          : mergeFilterValues(getValues(fieldKey), matchedIds)
        setValue(fieldKey, next, { shouldDirty: true, shouldTouch: true })
        console.log(`[PostAd] Auto-filled ${fieldKey} = ${JSON.stringify(next)} (transcript text match)`)
      }
    }
  }
}

export { buildFilterSelectionsFromVehicleData, matchValueToFilterOption }
