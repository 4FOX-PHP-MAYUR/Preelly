/**
 * Server-side vehicle value → DB filter option matching (mirrors src/utils/vehicleFilterMatching.js).
 */

function normalizeStr(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[\s\-_]+/g, ' ')
    .trim()
}

function parseNumberFromValue(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = String(v).trim().replace(/,/g, '')
  const numMatch = s.match(/-?\d+(?:\.\d+)?/)
  if (!numMatch) return null
  const n = Number(numMatch[0])
  return Number.isFinite(n) ? n : null
}

function parseCcFromValue(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
  const s = String(v).trim().toLowerCase()
  if (s.includes('cc')) {
    const n = parseNumberFromValue(s.replace(/cc/g, ''))
    return n !== null ? Math.round(n) : null
  }
  if (s.includes('l')) {
    const liters = parseNumberFromValue(s.replace(/l/g, ''))
    return liters !== null ? Math.round(liters * 1000) : null
  }
  return parseNumberFromValue(s)
}

function matchExplicitOption(rawValue, explicitOpts) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null
  const norm = normalizeStr(rawValue)
  if (!norm) return null
  const exact = explicitOpts.find((o) => normalizeStr(o) === norm)
  if (exact) return exact
  const partial = explicitOpts.find((o) => {
    const n = normalizeStr(o)
    return n.length >= 2 && (norm.includes(n) || n.includes(norm))
  })
  return partial || null
}

function matchEngineCapacityOption(rawValue, options) {
  const cc = parseCcFromValue(rawValue)
  if (cc === null) return null
  for (const opt of options) {
    const optStr = String(opt)
    const range = optStr.match(/(\d+)\s*-\s*(\d+)/)
    if (range) {
      const min = Number(range[1])
      const max = Number(range[2])
      if (cc >= min && cc <= max) return opt
    }
    const plus = optStr.match(/(\d+)\+/)
    if (plus && cc >= Number(plus[1])) return opt
  }
  return matchExplicitOption(String(cc), options)
}

function matchValueToFilterOption(rawValue, options, filterName = '') {
  if (!options?.length || rawValue === undefined || rawValue === null || rawValue === '') return null
  const name = normalizeStr(filterName)
  if (name.includes('engine capacity') || name.includes('engine size') || name.includes('engine cc')) {
    return matchEngineCapacityOption(rawValue, options)
  }
  return matchExplicitOption(rawValue, options)
}

const FILTER_FIELD_KEY_MAP = {
  condition: ['condition'],
  brand: ['brand', 'make'],
  make: ['make', 'brand'],
  color: ['color'],
  colour: ['color'],
  'body type': ['bodyType'],
  bodytype: ['bodyType'],
  'fuel type': ['fuelType'],
  fueltype: ['fuelType'],
  transmission: ['transmission'],
  doors: ['doors'],
  material: ['material'],
  'engine capacity': ['engineSize'],
  'engine capacity cc': ['engineSize'],
  enginesize: ['engineSize'],
  'engine size': ['engineSize'],
  'exterior color': ['color', 'exteriorColor'],
  exteriorcolor: ['color', 'exteriorColor'],
  'interior color': ['interiorColor'],
  interiorcolor: ['interiorColor'],
  'regional spec': ['regionalSpec', 'targetMarket'],
  'regional specs': ['regionalSpec', 'targetMarket'],
  regionalspec: ['regionalSpec', 'targetMarket'],
  'seller type': ['sellerType'],
  sellertype: ['sellerType'],
  'export status': ['exportStatus'],
  exportstatus: ['exportStatus'],
  'steering side': ['steeringSide'],
  steeringside: ['steeringSide'],
  warranty: ['warranty'],
  cylinders: ['cylinders'],
  horsepower: ['horsepower'],
  seats: ['seatingCapacity'],
  'seating capacity': ['seatingCapacity'],
  drivetrain: ['drivetrain'],
  badges: ['badges'],
  'comfort convenience': ['comfortFeatures', 'comfortConvenience'],
  'comfort & convenience': ['comfortFeatures', 'comfortConvenience'],
  'comfort features': ['comfortFeatures'],
  'driver assistance': ['driverAssistance'],
  'driver assistance safety': ['driverAssistance'],
  'driver assistance & safety': ['driverAssistance'],
  'entertainment features': ['entertainmentFeatures'],
  'entertainment technology': ['entertainmentFeatures'],
  'entertainment & technology': ['entertainmentFeatures'],
  exterior: ['exteriorFeatures'],
  'exterior features': ['exteriorFeatures'],
}

function buildFilterSelectionsFromVehicleData(filters, data) {
  const selections = {}
  const list = Array.isArray(filters) ? filters : []
  if (!list.length || !data) return selections

  const roots = list.filter((f) => !f.parentId)
  for (const root of roots) {
    const slug = String(root.slug || root._id)
    const fieldKey = `filter_${slug}`
    const explicitOpts = Array.isArray(root.options) ? root.options.filter(Boolean) : []
    if (!explicitOpts.length) continue

    const normalizedRootName = normalizeStr(root.name)
    const productFieldKeys = FILTER_FIELD_KEY_MAP[normalizedRootName] || []

    let rawValue = null
    for (const fk of productFieldKeys) {
      const fv = data[fk]
      if (fv !== undefined && fv !== null && fv !== '') {
        rawValue = fv
        break
      }
    }
    if (rawValue === null && data[fieldKey]) {
      rawValue = data[fieldKey]
    }

    if (rawValue !== null) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue]
      for (const rv of values) {
        const matched = matchValueToFilterOption(rv, explicitOpts, root.name)
        if (matched) {
          if (!selections[fieldKey]) selections[fieldKey] = []
          if (!selections[fieldKey].includes(matched)) selections[fieldKey].push(matched)
        }
      }
    }

    if (Array.isArray(data.features) && data.features.length) {
      for (const feature of data.features) {
        const matched = matchValueToFilterOption(feature, explicitOpts, root.name)
        if (matched) {
          if (!selections[fieldKey]) selections[fieldKey] = []
          if (!selections[fieldKey].includes(matched)) selections[fieldKey].push(matched)
        }
      }
    }
  }

  return selections
}

module.exports = {
  buildFilterSelectionsFromVehicleData,
  matchValueToFilterOption,
}
