/**
 * Match AI / form vehicle values to DB category filter dropdown options.
 */

function normalizeStr(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[\s\-_]+/g, ' ')
    .trim()
}

function normalizeToken(s) {
  return normalizeStr(s).replace(/\s+/g, '_')
}

function parseNumberFromValue(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = String(v).trim().replace(/,/g, '')
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

function parseCcFromValue(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
  const s = String(v).trim().toLowerCase()
  if (s.includes('cc')) {
    const n = parseNumberFromValue(s.replace(/cc/g, ''))
    return n !== null ? Math.round(n) : null
  }
  if (/\d(\.\d)?\s*l/.test(s) || (s.includes('l') && !s.includes('cc'))) {
    const liters = parseNumberFromValue(s.replace(/l/g, ''))
    return liters !== null ? Math.round(liters * 1000) : null
  }
  const n = parseNumberFromValue(s)
  return n !== null ? Math.round(n) : null
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
    const under = optStr.match(/0\s*-\s*(\d+)/)
    if (under && cc <= Number(under[1])) return opt
  }

  return matchExplicitOption(`${cc} cc`, options) || matchExplicitOption(String(cc), options)
}

function matchHorsepowerOption(rawValue, options) {
  const hp = parseNumberFromValue(rawValue)
  if (hp === null) return matchExplicitOption(rawValue, options)

  for (const opt of options) {
    const optStr = String(opt)
    const range = optStr.match(/(\d+)\s*-\s*(\d+)/)
    if (range) {
      const min = Number(range[1])
      const max = Number(range[2])
      if (hp >= min && hp <= max) return opt
    }
    const plus = optStr.match(/(\d+)\+/)
    if (plus && hp >= Number(plus[1])) return opt
  }

  return matchExplicitOption(rawValue, options)
}

function matchDoorsOption(rawValue, options) {
  const direct = matchExplicitOption(rawValue, options)
  if (direct) return direct

  const num = parseNumberFromValue(rawValue)
  if (num === null) return null

  const numStr = String(num)
  return (
    options.find((opt) => {
      const n = normalizeStr(opt)
      return n === numStr || n.startsWith(`${numStr} `) || n.startsWith(`${numStr}/`) || n.includes(`${numStr} door`)
    }) || null
  )
}

const ENUM_ALIASES = {
  suv: ['suv', 'crossover', '4x4'],
  sedan: ['sedan', 'saloon'],
  hatchback: ['hatchback', 'hatch'],
  coupe: ['coupe', 'coupe'],
  convertible: ['convertible', 'cabrio', 'cabriolet'],
  wagon: ['wagon', 'estate', 'station wagon'],
  pickup: ['pickup', 'truck', 'ute'],
  petrol: ['petrol', 'gasoline', 'gas', 'benzine'],
  diesel: ['diesel'],
  electric: ['electric', 'ev'],
  hybrid: ['hybrid', 'phev', 'mild hybrid'],
  manual: ['manual', 'stick'],
  automatic: ['automatic', 'auto'],
  cvt: ['cvt'],
  semi_automatic: ['semi automatic', 'semi-automatic', 'semi auto'],
  gcc: ['gcc', 'gulf', 'uae', 'gulf spec'],
  american: ['american', 'usa', 'us spec'],
  japanese: ['japanese', 'jdm'],
  european: ['european', 'eu spec', 'euro spec'],
}

function matchEnumLikeOption(rawValue, options) {
  const direct = matchExplicitOption(rawValue, options)
  if (direct) return direct

  const norm = normalizeStr(rawValue)
  if (!norm) return null

  for (const opt of options) {
    const optNorm = normalizeStr(opt)
    if (optNorm && (norm.includes(optNorm) || optNorm.includes(norm))) return opt
  }

  for (const aliases of Object.values(ENUM_ALIASES)) {
    if (!aliases.some((a) => norm.includes(a) || a.includes(norm))) continue
    for (const opt of options) {
      const optNorm = normalizeStr(opt)
      if (aliases.some((a) => optNorm.includes(a) || a.includes(optNorm))) return opt
    }
  }

  return null
}

export function matchExplicitOption(rawValue, explicitOpts) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null
  const norm = normalizeStr(rawValue)
  if (!norm) return null

  const exact = explicitOpts.find((o) => normalizeStr(o) === norm)
  if (exact) return exact

  const token = normalizeToken(rawValue)
  const tokenMatch = explicitOpts.find((o) => normalizeToken(o) === token)
  if (tokenMatch) return tokenMatch

  const partial = explicitOpts.find((o) => {
    const n = normalizeStr(o)
    return n.length >= 2 && (norm.includes(n) || n.includes(norm))
  })
  return partial || null
}

/**
 * Match a raw vehicle value to one of the filter's explicit options.
 * @param {unknown} rawValue
 * @param {string[]} options
 * @param {string} [filterName]
 */
export function matchValueToFilterOption(rawValue, options, filterName = '') {
  if (!options?.length || rawValue === undefined || rawValue === null || rawValue === '') {
    return null
  }

  const name = normalizeStr(filterName)

  if (name.includes('engine capacity') || name.includes('engine size') || name.includes('engine cc')) {
    return matchEngineCapacityOption(rawValue, options)
  }
  if (name.includes('horsepower') || name.includes(' hp')) {
    return matchHorsepowerOption(rawValue, options)
  }
  if (name.includes('door')) {
    return matchDoorsOption(rawValue, options)
  }
  if (
    name.includes('body type') ||
    name.includes('fuel type') ||
    name.includes('transmission') ||
    name.includes('regional') ||
    name.includes('export') ||
    name.includes('steering') ||
    name.includes('seller')
  ) {
    return matchEnumLikeOption(rawValue, options)
  }

  return matchExplicitOption(rawValue, options) || matchEnumLikeOption(rawValue, options)
}

export const FILTER_FIELD_KEY_MAP = {
  condition: ['condition'],
  brand: ['brand', 'make'],
  make: ['make', 'brand'],
  color: ['color'],
  colour: ['color'],
  'exterior color': ['color', 'exteriorColor'],
  exteriorcolor: ['color', 'exteriorColor'],
  transmission: ['transmission'],
  'fuel type': ['fuelType'],
  fueltype: ['fuelType'],
  material: ['material'],
  'body type': ['bodyType'],
  bodytype: ['bodyType'],
  doors: ['doors'],
  size: ['size'],
  model: ['model'],
  badges: ['badges'],
  'comfort convenience': ['comfortConvenience', 'comfortFeatures'],
  'comfort & convenience': ['comfortConvenience', 'comfortFeatures'],
  'regional spec': ['regionalSpec', 'targetMarket'],
  'regional specs': ['regionalSpec', 'targetMarket'],
  regionalspec: ['regionalSpec', 'targetMarket'],
  'seller type': ['sellerType'],
  sellertype: ['sellerType'],
  seats: ['seatingCapacity'],
  'seating capacity': ['seatingCapacity'],
  'interior color': ['interiorColor'],
  interiorcolor: ['interiorColor'],
  horsepower: ['horsepower'],
  'engine capacity': ['engineSize'],
  'engine capacity cc': ['engineSize'],
  enginesize: ['engineSize'],
  'engine size': ['engineSize'],
  warranty: ['warranty'],
  cylinders: ['cylinders'],
  'no of cylinders': ['cylinders'],
  'number of cylinders': ['cylinders'],
  'steering side': ['steeringSide'],
  steeringside: ['steeringSide'],
  'export status': ['exportStatus'],
  exportstatus: ['exportStatus'],
  drivetrain: ['drivetrain'],
  'driver assistance': ['driverAssistance'],
  'driver assistance safety': ['driverAssistance'],
  'driver assistance & safety': ['driverAssistance'],
  'comfort features': ['comfortFeatures'],
  'entertainment features': ['entertainmentFeatures'],
  'entertainment technology': ['entertainmentFeatures'],
  'entertainment & technology': ['entertainmentFeatures'],
  exterior: ['exteriorFeatures'],
  'exterior features': ['exteriorFeatures'],
}

export const VEHICLE_FORM_KEYS = [
  'title',
  'description',
  'make',
  'brand',
  'model',
  'year',
  'price',
  'currency',
  'condition',
  'mileage',
  'bodyType',
  'fuelType',
  'transmission',
  'doors',
  'engineSize',
  'color',
  'regionalSpec',
  'targetMarket',
  'sellerType',
  'seatingCapacity',
  'interiorColor',
  'exportStatus',
  'horsepower',
  'cylinders',
  'warranty',
  'steeringSide',
  'driverAssistance',
  'comfortFeatures',
  'entertainmentFeatures',
  'exteriorFeatures',
  'badges',
  'trim',
  'drivetrain',
  'features',
]

/**
 * Build filter_<slug> selections from form/AI data and filter definitions.
 * @param {Array} filters
 * @param {Record<string, unknown>} data
 * @returns {Record<string, string>}
 */
export function buildFilterSelectionsFromVehicleData(filters, data) {
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

    if (rawValue === null) {
      // Match enrichment feature lists against multiselect filters (Comfort, Badges, etc.)
      if (Array.isArray(data.features) && data.features.length) {
        for (const feature of data.features) {
          const matched = matchValueToFilterOption(feature, explicitOpts, root.name)
          if (matched) {
            if (!selections[fieldKey]) selections[fieldKey] = []
            if (!selections[fieldKey].includes(matched)) selections[fieldKey].push(matched)
          }
        }
      }
      continue
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    for (const rv of values) {
      const matched = matchValueToFilterOption(rv, explicitOpts, root.name)
      if (matched) {
        if (!selections[fieldKey]) selections[fieldKey] = []
        if (!selections[fieldKey].includes(matched)) selections[fieldKey].push(matched)
      }
    }
  }

  return selections
}
