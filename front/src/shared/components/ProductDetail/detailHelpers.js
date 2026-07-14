const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/

export function formatPostedDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const day = date.getDate()
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th'
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const year = String(date.getFullYear()).slice(-2)
  return `${day}${suffix} ${month} ${year}`
}

export function formatCompactCount(value) {
  const n = Number(value || 0)
  if (!n) return '0'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function getOverviewTitle(categoryName) {
  const name = categoryName || ''
  if (/\b(motor|vehicle|car|auto)\b/i.test(name)) return 'Car Overview'
  if (/\b(property|real estate|villa|apartment|home)\b/i.test(name)) return 'Property Overview'
  if (name) return `${name} Overview`
  return 'Overview'
}

export function mapQuickViewRows(quickViewData) {
  if (!Array.isArray(quickViewData)) return []
  return quickViewData
    .map((entry) => ({
      label: entry.fieldTitle,
      value: Array.isArray(entry.fieldValues) ? entry.fieldValues.join(', ') : entry.fieldValue,
    }))
    .filter((row) => row.label && row.value != null && row.value !== '')
}

export function safeToString(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') {
    const s = v.trim()
    return s || null
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function isObjectIdString(v) {
  const s = safeToString(v)
  return Boolean(s && OBJECT_ID_RE.test(s))
}

export function pickDisplay(...candidates) {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === '') continue
    if (Array.isArray(candidate)) {
      const labels = candidate.map((item) => safeToString(item)).filter((item) => item && !isObjectIdString(item))
      if (labels.length) return labels.join(', ')
      continue
    }
    const s = safeToString(candidate)
    if (s && !isObjectIdString(s)) return s
  }
  return null
}

export function getAvailabilityStatus(product) {
  if (!product) return null
  if (product.isSold || product.status === 'sold') return { label: 'Sold', tone: 'sold' }
  if (product.status === 'paused') return { label: 'Reserved', tone: 'reserved' }
  if (product.status === 'active') return { label: 'Available', tone: 'available' }
  if (product.status) {
    const label = String(product.status).charAt(0).toUpperCase() + String(product.status).slice(1)
    return { label, tone: 'neutral' }
  }
  return null
}

export function isApprovedListing(product) {
  return Boolean(product && product.status === 'active' && !product.isSold)
}

export function isNegotiable(product) {
  return String(product?.priceType || '').toLowerCase() === 'negotiable'
}

function humanizeKey(key) {
  return String(key || '')
    .replace(/Id$/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

const OVERVIEW_LABELS = {
  engineCapacity: 'Engine Capacity',
  fuelType: 'Fuel Type',
  transmission: 'Transmission Type',
  bodyType: 'Body Type',
  doors: 'Doors',
  horsepower: 'Horsepower',
  kilometers: 'Kilometers',
  trim: 'Trim',
  seatingCapacity: 'Seating Capacity',
  interiorColor: 'Interior Color',
  warranty: 'Warranty',
  cylinders: 'No. of Cylinders',
  condition: 'Condition',
  city: 'City',
  regionalSpecs: 'Regional Specs',
  year: 'Year',
  exteriorColor: 'Exterior Color',
  steeringSide: 'Steering Side',
  isInsured: 'Insurance',
  model: 'Model',
  sellerType: 'Seller Type',
  targetMarket: 'Target Market',
  make: 'Make',
  brand: 'Brand',
  mileage: 'Mileage',
  vin: 'VIN',
  driveType: 'Drive Type',
  engine: 'Engine',
}

function formatOverviewValue(key, value) {
  if (value === null || value === undefined || value === '') return null
  if (key === 'kilometers' || key === 'mileage') {
    const n = Number(value)
    if (Number.isFinite(n)) return `${n.toLocaleString()} km`
    const s = safeToString(value)
    return s && !isObjectIdString(s) ? `${s} km` : null
  }
  if (key === 'horsepower') {
    const s = safeToString(value)
    if (!s || isObjectIdString(s)) return null
    return /hp/i.test(s) ? s : `${s} HP`
  }
  if (key === 'engineCapacity') {
    const s = safeToString(value)
    if (!s || isObjectIdString(s)) return null
    return /cc|hp|l/i.test(s) ? s : `${s} cc`
  }
  if (key === 'seatingCapacity') {
    const s = safeToString(value)
    if (!s || isObjectIdString(s)) return null
    return /seater/i.test(s) ? s : `${s} Seater`
  }
  return pickDisplay(value)
}

const OVERVIEW_SKIP_KEYS = new Set([
  'engineCapacityId',
  'fuelTypeId',
  'transmissionTypeId',
  'bodyTypeId',
  'doorsId',
  'horsepowerId',
  'trimId',
  'seatId',
  'interiorColorId',
  'warrantyId',
  'numberOfCylenderId',
])

export function buildOverviewItems(product) {
  if (!product) return []
  const items = []
  const seen = new Set()

  const add = (label, value) => {
    const formatted = typeof value === 'string' ? value : safeToString(value)
    if (!formatted || isObjectIdString(formatted)) return
    const key = label.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    items.push({ label, value: formatted })
  }

  const overview = product.carOverview
  if (overview && typeof overview === 'object') {
    for (const [key, raw] of Object.entries(overview)) {
      if (OVERVIEW_SKIP_KEYS.has(key)) continue
      const label = OVERVIEW_LABELS[key] || humanizeKey(key)
      const value = formatOverviewValue(key, raw)
      if (value) add(label, value)
    }
  }

  if (Array.isArray(product.productAttributes)) {
    for (const attr of product.productAttributes) {
      const label = attr?.label || attr?.fieldTitle || attr?.name
      const value = attr?.value ?? attr?.displayValue
      if (label && value != null && value !== '') add(label, String(value))
    }
  }

  if (Array.isArray(product.productMultiAttributes)) {
    for (const attr of product.productMultiAttributes) {
      const label = attr?.label || attr?.fieldTitle || attr?.name
      const values = attr?.values || attr?.value
      if (!label) continue
      const joined = Array.isArray(values)
        ? values.map((v) => safeToString(v)).filter(Boolean).join(', ')
        : safeToString(values)
      if (joined) add(label, joined)
    }
  }

  if (!items.length) {
    const fallbacks = [
      { label: 'Interior Color', value: pickDisplay(product.interiorColorIdValue, product.interiorColor) },
      { label: 'Horsepower', value: pickDisplay(product.horsepowerIdValue) },
      { label: 'Doors', value: pickDisplay(product.doorsIdValue, product.doors) },
      { label: 'Fuel Type', value: pickDisplay(product.fuelTypeIdValue, product.fuelType) },
      { label: 'Transmission Type', value: pickDisplay(product.transmissionTypeIdValue, product.transmission) },
      { label: 'Warranty', value: pickDisplay(product.warrantyIdValue, product.warranty) },
      { label: 'Trim', value: pickDisplay(product.trimIdValue, product.trim) },
      { label: 'Exterior Color', value: pickDisplay(product.exteriorColorIdValue, product.exteriorColor) },
      { label: 'Body Type', value: pickDisplay(product.bodyTypeIdValue, product.bodyType) },
      { label: 'No. of Cylinders', value: pickDisplay(product.numberOfCylenderIdValue) },
      { label: 'Seller Type', value: pickDisplay(product.sellerType) },
      { label: 'Target Market', value: pickDisplay(product.targetMarket) },
    ]
    for (const { label, value } of fallbacks) {
      if (value) add(label, value)
    }
  }

  return items
}

export function buildMetaChips(product) {
  if (!product) return []
  const chips = []

  const year = pickDisplay(product.year, product.carOverview?.year, product.yearIdValue)
  if (year) chips.push({ icon: 'calendar', label: year })

  const mileage = product.mileage ?? product.kilometers ?? product.carOverview?.kilometers
  if (mileage != null && mileage !== '') {
    const n = Number(mileage)
    chips.push({ icon: 'gauge', label: Number.isFinite(n) ? `${n.toLocaleString()} km` : String(mileage) })
  }

  const fuel = pickDisplay(product.fuelTypeIdValue, product.fuelType, product.carOverview?.fuelType)
  if (fuel) chips.push({ icon: 'fuel', label: fuel })

  const transmission = pickDisplay(
    product.transmissionTypeIdValue,
    product.transmission,
    product.carOverview?.transmission
  )
  if (transmission) chips.push({ icon: 'cog', label: transmission })

  const location = pickDisplay(
    product.location,
    product.locationAddress,
    [product.area, product.city, product.country].filter(Boolean).join(', ')
  )
  if (location) chips.push({ icon: 'mapPin', label: location })

  const posted = formatPostedDate(product.createdAt)
  if (posted) chips.push({ icon: 'clock', label: posted })

  if (product.views != null) chips.push({ icon: 'eye', label: `${formatCompactCount(product.views)} views` })

  if (product._id) chips.push({ icon: 'hash', label: `ID ${String(product._id).slice(-8).toUpperCase()}` })

  const condition = pickDisplay(product.condition, product.carOverview?.condition)
  if (condition) chips.push({ icon: 'tag', label: condition })

  return chips
}

export function buildLocationAddress(product) {
  if (!product) return null
  return (
    pickDisplay(product.locationAddress, product.locateYourItem, product.buildingStreetName) ||
    pickDisplay(product.location) ||
    [product.area, product.city, product.country].filter(Boolean).join(', ') ||
    null
  )
}

export function getSimilarSectionTitle(product) {
  const categoryName = product?.category?.name || ''
  if (/\b(motor|vehicle|car|auto)\b/i.test(categoryName)) return 'Similar Car'
  if (/\b(property|real estate|villa|apartment)\b/i.test(categoryName)) return 'Similar Listings'
  return categoryName ? `Similar ${categoryName}` : 'Similar Listings'
}

export function buildGalleryMedia(product, getMediaUrl) {
  const images = (product?.images || [])
    .map((img) => ({ type: 'image', url: getMediaUrl(img) }))
    .filter((m) => m.url)

  if (product?.video) {
    return [{ type: 'video', url: getMediaUrl(product.video) }, ...images]
  }
  return images
}

function normalizeFeatureItem(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') {
    const s = value.trim()
    return s && !OBJECT_ID_RE.test(s) ? s : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'object') {
    const label = value.label ?? value.value ?? value.name ?? value.title ?? value.displayValue
    if (label != null && String(label).trim()) {
      const s = String(label).trim()
      return OBJECT_ID_RE.test(s) ? null : s
    }
  }
  return null
}

function extractFeatureItems(rawItems) {
  if (Array.isArray(rawItems)) {
    return rawItems.map(normalizeFeatureItem).filter(Boolean)
  }
  if (typeof rawItems === 'string') {
    return rawItems
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  const single = normalizeFeatureItem(rawItems)
  return single ? [single] : []
}

function normalizeFeatureSection(section) {
  if (!section) return null

  if (typeof section === 'string') {
    const s = section.trim()
    return s ? { title: 'Features', items: [s] } : null
  }

  if (typeof section !== 'object') return null

  const title = pickDisplay(section.title, section.fieldTitle, section.name, section.label) || 'Features'
  const rawItems = section.values ?? section.items ?? section.fieldValues ?? section.features ?? []
  const items = extractFeatureItems(rawItems)

  return items.length ? { title, items } : null
}

function toTitleCaseKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function parseSpecificationFeatures(product) {
  const spec = product?.specifications
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    if (Array.isArray(spec) && spec.length && typeof spec[0] === 'string') {
      return [{ title: 'Features', items: spec.filter(Boolean).map(String) }]
    }
    return []
  }

  if (Array.isArray(spec.featureCategories)) {
    return spec.featureCategories
      .map((c) =>
        normalizeFeatureSection({
          title: c?.name || c?.title,
          values: c?.items,
        })
      )
      .filter(Boolean)
  }

  const nested = spec.features
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return Object.entries(nested)
      .map(([title, items]) => normalizeFeatureSection({ title: toTitleCaseKey(title), values: items }))
      .filter(Boolean)
  }

  const skip = new Set(['featureCategories', 'features', '_id', '__v', 'id'])
  const arrayEntries = Object.entries(spec).filter(
    ([k, v]) =>
      !skip.has(k) &&
      Array.isArray(v) &&
      v.length &&
      v.some((x) => x != null && String(x).trim() !== '')
  )
  if (arrayEntries.length) {
    return arrayEntries
      .map(([title, items]) => normalizeFeatureSection({ title: toTitleCaseKey(title), values: items }))
      .filter(Boolean)
  }

  const boolEntries = Object.entries(spec).filter(([, v]) => v === true)
  if (boolEntries.length) {
    return [{ title: 'Features', items: boolEntries.map(([k]) => toTitleCaseKey(k)) }]
  }

  return []
}

function parseDisplayDataFeatures(product) {
  const dd = product?.display_data
  if (dd && typeof dd === 'object' && Array.isArray(dd.feature_list)) {
    const items = dd.feature_list.filter(Boolean).map(String)
    if (items.length) return [{ title: 'Features', items }]
  }
  return []
}

/**
 * Parse the product `features` column: [{ title, values: string[] }].
 * Supports JSON string, object map, `items` alias, and resolved { label, value } objects.
 */
export function parseProductFeaturesColumn(features) {
  if (features === null || features === undefined || features === '') return []

  let raw = features
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      raw = JSON.parse(trimmed)
    } catch {
      const items = trimmed
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
      return items.length ? [{ title: 'Features', items }] : []
    }
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.entries(raw)
      .map(([title, value]) => normalizeFeatureSection({ title, values: value }))
      .filter(Boolean)
  }

  if (!Array.isArray(raw)) return []

  return raw.map(normalizeFeatureSection).filter(Boolean)
}

/** Direct parse of `product.features` array (same shape as reels panel). */
function parseProductFeaturesArray(features) {
  if (!Array.isArray(features) || !features.length) return []
  return features
    .map((section) =>
      normalizeFeatureSection({
        title: section?.title || section?.fieldTitle,
        values: section?.values ?? section?.items ?? section?.fieldValues,
      })
    )
    .filter(Boolean)
}

const VEHICLE_FEATURE_ORDER = [
  'driverassistancesafety',
  'entertainmenttechnology',
  'comfortconvenience',
  'exterior',
]

const FEATURE_SECTION_EXCLUDE_KEYS = new Set(['categorypath', 'categorypathid'])

function normalizeFeatureTitleKey(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function shouldExcludeFeatureSection(section) {
  const key = normalizeFeatureTitleKey(section?.title)
  const fieldKey = normalizeFeatureTitleKey(section?.fieldKey)
  return FEATURE_SECTION_EXCLUDE_KEYS.has(key) || FEATURE_SECTION_EXCLUDE_KEYS.has(fieldKey)
}

function pickBetterFeatureTitle(a, b) {
  if (!a) return b
  if (!b) return a
  if (a.includes('&') && !b.includes('&')) return a
  if (b.includes('&') && !a.includes('&')) return b
  return a.length >= b.length ? a : b
}

function sortFeatureSections(sections) {
  return [...sections].sort((a, b) => {
    const aKey = normalizeFeatureTitleKey(a.title)
    const bKey = normalizeFeatureTitleKey(b.title)
    const aIdx = VEHICLE_FEATURE_ORDER.indexOf(aKey)
    const bIdx = VEHICLE_FEATURE_ORDER.indexOf(bKey)
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
    if (aIdx !== -1) return -1
    if (bIdx !== -1) return 1
    return a.title.localeCompare(b.title)
  })
}

export function parseVehicleFeaturesFromProduct(product) {
  if (!Array.isArray(product?.vehicleFeatures) || !product.vehicleFeatures.length) return []
  return product.vehicleFeatures.map(normalizeFeatureSection).filter(Boolean)
}

export function parseProductMultiAttributesFeatures(product) {
  if (!Array.isArray(product?.productMultiAttributes)) return []
  return product.productMultiAttributes
    .filter((attr) => {
      const fieldKey = normalizeFeatureTitleKey(attr?.fieldKey)
      return !FEATURE_SECTION_EXCLUDE_KEYS.has(fieldKey)
    })
    .map((attr) =>
      normalizeFeatureSection({
        title: attr?.fieldTitle || attr?.label || attr?.name,
        values: attr?.fieldValues ?? attr?.values ?? attr?.value,
        fieldKey: attr?.fieldKey,
      })
    )
    .filter(Boolean)
}

const VEHICLE_FEATURE_CATEGORIES = [
  {
    title: 'Driver Assistance & Safety',
    keys: ['driverAssistanceSafetyIdValue', 'driverAssistanceSafetyId', 'driverAssistanceSafety'],
  },
  {
    title: 'Entertainment & Technology',
    keys: ['entertainmentTechnologyIdValue', 'entertainmentTechnologyId', 'entertainmentTechnology'],
  },
  {
    title: 'Comfort & Convenience',
    keys: ['comfortConvenienceIdValue', 'comfortConvenienceId', 'comfortConvenience'],
  },
  { title: 'Exterior', keys: ['exteriorIdValue', 'exteriorId', 'exterior'] },
]

export function parseVehicleIdValueFeatures(product) {
  if (!product) return []

  return VEHICLE_FEATURE_CATEGORIES.map(({ title, keys }) => {
    const items = []
    for (const key of keys) {
      const raw = product[key]
      if (raw == null || raw === '') continue
      items.push(...extractFeatureItems(raw))
    }
    const unique = [...new Set(items)]
    return unique.length ? { title, items: unique } : null
  }).filter(Boolean)
}

export function mergeFeatureSections(...groups) {
  const map = new Map()

  for (const group of groups) {
    if (!Array.isArray(group)) continue
    for (const section of group) {
      const normalized = normalizeFeatureSection(section)
      if (!normalized?.items?.length || shouldExcludeFeatureSection(normalized)) continue

      const key = normalizeFeatureTitleKey(normalized.title)
      if (!key) continue

      const existing = map.get(key)
      if (existing) {
        const mergedItems = [...new Set([...existing.items, ...normalized.items])]
        map.set(key, {
          title: pickBetterFeatureTitle(existing.title, normalized.title),
          items: mergedItems,
        })
      } else {
        map.set(key, normalized)
      }
    }
  }

  return sortFeatureSections(Array.from(map.values()))
}

/**
 * Resolve feature accordion sections for the listing/detail page.
 * Uses only the API-resolved `product.features` column (matched against filters).
 */
export function getFeatureSectionsFromProduct(product) {
  if (!product) return []
  return parseProductFeaturesArray(product.features)
}
