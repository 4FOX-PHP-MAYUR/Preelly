/**
 * Filter matching service: resolves category filter values from product data
 * (transcript-extracted fields, product title, etc.).
 *
 * Used by:
 *  - POST /api/video/transcribe  (return suggested filter selections)
 *  - POST /api/products           (fallback auto-resolve when no filter_* sent)
 */

const mongoose = require('mongoose')

function normalize(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, ' ')
}

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Given product data and a category scope, fetch the category's filters and
 * try to match child-filter names against:
 *   1. Known product fields (condition, transmission, fuelType, brand, color, etc.)
 *   2. The product title / description text
 *
 * @param {object}  opts
 * @param {object}  opts.productData - { title, description, condition, brand, color, transmission, fuelType, make, model, ... }
 * @param {string}  [opts.categoryId]
 * @param {string}  [opts.subcategoryId]
 * @param {string}  [opts.childCategoryId]
 * @param {object}  opts.models - { Filter, Category, CategoryFilter }
 * @returns {Promise<{ filterSelections: Record<string,string>, matchedFilterIds: string[], matchDetails: Array }>}
 *   filterSelections:  { "filter_<slug>": "<child filter _id or option value>", ... }
 *   matchedFilterIds:  flat array of all matched filter ObjectId strings (for DB storage)
 *   matchDetails:      [{ rootName, fieldKey, matchedValue, matchSource }, ...]
 */
async function resolveFiltersFromProductData({
  productData,
  categoryId,
  subcategoryId,
  childCategoryId,
  models,
}) {
  const { Filter, Category, CategoryFilter } = models
  const filterSelections = {}
  const matchedFilterIds = []
  const matchDetails = []

  const scopeId = childCategoryId || subcategoryId || categoryId
  if (!scopeId || !mongoose.Types.ObjectId.isValid(String(scopeId))) {
    return { filterSelections, matchedFilterIds, matchDetails }
  }

  const selectedLevelObjId = new mongoose.Types.ObjectId(String(scopeId))

  let levelQuery
  if (childCategoryId) levelQuery = { childCategoryId: selectedLevelObjId }
  else if (subcategoryId) levelQuery = { subcategoryId: selectedLevelObjId }
  else levelQuery = { categoryId: selectedLevelObjId }

  const directFilters = await Filter.find({
    ...levelQuery,
    isDeleted: { $ne: true },
    isActive: { $ne: false },
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean()

  const scopedCategories = await Category.find({
    isDeleted: false,
    $or: [{ _id: selectedLevelObjId }, { path: selectedLevelObjId }],
  })
    .select('_id')
    .lean()
  const scopedCategoryIds = scopedCategories.map((c) => c._id)
  const links = await CategoryFilter.find({ categoryId: { $in: scopedCategoryIds } })
    .select('filterId')
    .lean()
  const linkedFilterIds = [...new Set(links.map((l) => String(l.filterId)))]

  let linkedFilters = []
  if (linkedFilterIds.length) {
    linkedFilters = await Filter.find({
      _id: { $in: linkedFilterIds.map((id) => new mongoose.Types.ObjectId(id)) },
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean()
  }

  const byId = new Map()
  for (const f of [...directFilters, ...linkedFilters]) {
    byId.set(String(f._id), f)
  }
  const allFilters = [...byId.values()]

  if (!allFilters.length) return { filterSelections, matchedFilterIds, matchDetails }

  const childrenByParent = new Map()
  allFilters.forEach((f) => {
    const pid = f.parentId ? String(f.parentId) : null
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
    childrenByParent.get(pid).push(f)
  })

  const roots = (childrenByParent.get(null) || []).sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  )

  const productFieldValues = buildProductFieldIndex(productData)

  const titleText = normalize(productData.title || '')
  const descText = normalize(productData.description || '')
  const searchableText = `${titleText} ${descText}`

  for (const root of roots) {
    const rootId = String(root._id)
    const rootSlug = String(root.slug || rootId)
    const fieldKey = `filter_${rootSlug}`

    const explicitOptions = Array.isArray(root.options) ? root.options.filter(Boolean) : []

    if (explicitOptions.length) {
      const match = matchAgainstOptions(explicitOptions, productFieldValues, searchableText, root.name)
      if (match) {
        filterSelections[fieldKey] = match.value
        matchedFilterIds.push(rootId)
        matchDetails.push({
          rootName: root.name,
          fieldKey,
          matchedValue: match.value,
          matchSource: match.source,
        })
      }
      continue
    }

    const children = childrenByParent.get(rootId) || []
    if (!children.length) continue

    const childNames = children.map((c) => ({
      id: String(c._id),
      name: c.name,
      normalized: normalize(c.name),
    }))

    const match = matchAgainstChildren(childNames, productFieldValues, searchableText, root.name)
    if (match) {
      filterSelections[fieldKey] = match.id
      matchedFilterIds.push(rootId)
      matchedFilterIds.push(match.id)
      matchDetails.push({
        rootName: root.name,
        fieldKey,
        matchedValue: match.name,
        matchedId: match.id,
        matchSource: match.source,
      })
    }
  }

  return { filterSelections, matchedFilterIds, matchDetails }
}

/**
 * Build an index of normalized product field values for fast matching.
 */
function buildProductFieldIndex(data) {
  const fields = {}
  const keys = [
    'condition',
    'brand',
    'make',
    'model',
    'color',
    'material',
    'transmission',
    'fuelType',
    'bodyType',
    'drivetrain',
    'engineSize',
    'storageCapacity',
    'ram',
    'operatingSystem',
    'size',
    'warranty',
    'year',
    'mileage',
    'seatingCapacity',
    'cushionType',
    'fabricType',
    'bedSize',
    'bedType',
    'shoeType',
    'watchType',
    'applianceType',
    'toolType',
    'plantType',
    'decorType',
    'bikeType',
    'doors',
    'networkType',
    'fit',
    'style',
    'season',
    'genre',
    'platform',
    'gameType',
    'gearType',
    'equipmentType',
    'assemblyStatus',
    'closureType',
  ]

  for (const key of keys) {
    const val = data[key]
    if (val !== undefined && val !== null && val !== '') {
      fields[key] = {
        raw: String(val),
        normalized: normalize(String(val)),
      }
    }
  }

  return fields
}

/**
 * Try to match explicit options (string list) against product fields, then against title/description.
 */
function matchAgainstOptions(options, productFields, searchableText, rootName) {
  const normalizedRoot = normalize(rootName)

  const fieldForRoot = guessFieldForRoot(normalizedRoot)

  if (fieldForRoot) {
    for (const fk of fieldForRoot) {
      const fieldVal = productFields[fk]
      if (!fieldVal) continue
      for (const opt of options) {
        if (normalize(opt) === fieldVal.normalized) {
          return { value: opt, source: `field:${fk}` }
        }
      }
    }
  }

  for (const fieldVal of Object.values(productFields)) {
    for (const opt of options) {
      if (normalize(opt) === fieldVal.normalized) {
        return { value: opt, source: 'field:any' }
      }
    }
  }

  for (const opt of options) {
    const normalizedOpt = normalize(opt)
    if (normalizedOpt.length >= 3 && searchableText.includes(normalizedOpt)) {
      return { value: opt, source: 'title_or_description' }
    }
  }

  return null
}

/**
 * Try to match child filter names against product fields, then against title/description.
 */
function matchAgainstChildren(childNames, productFields, searchableText, rootName) {
  const normalizedRoot = normalize(rootName)
  const fieldForRoot = guessFieldForRoot(normalizedRoot)

  if (fieldForRoot) {
    for (const fk of fieldForRoot) {
      const fieldVal = productFields[fk]
      if (!fieldVal) continue
      for (const child of childNames) {
        if (child.normalized === fieldVal.normalized) {
          return { id: child.id, name: child.name, source: `field:${fk}` }
        }
      }
    }
  }

  for (const [fk, fieldVal] of Object.entries(productFields)) {
    for (const child of childNames) {
      if (child.normalized === fieldVal.normalized) {
        return { id: child.id, name: child.name, source: `field:${fk}` }
      }
    }
  }

  for (const child of childNames) {
    if (child.normalized.length >= 3 && searchableText.includes(child.normalized)) {
      return { id: child.id, name: child.name, source: 'title_or_description' }
    }
  }

  return null
}

/**
 * Map common filter root names to likely product data field keys.
 * This prioritizes the right field when matching, e.g. a filter root named
 * "Condition" should first check `productData.condition`.
 */
function guessFieldForRoot(normalizedRootName) {
  const map = {
    condition: ['condition'],
    brand: ['brand', 'make'],
    make: ['make', 'brand'],
    manufacturer: ['make', 'brand'],
    color: ['color'],
    colour: ['color'],
    transmission: ['transmission'],
    'fuel type': ['fuelType'],
    fueltype: ['fuelType'],
    fuel: ['fuelType'],
    material: ['material'],
    'body type': ['bodyType'],
    bodytype: ['bodyType'],
    drivetrain: ['drivetrain'],
    'drive train': ['drivetrain'],
    'engine size': ['engineSize'],
    enginesize: ['engineSize'],
    storage: ['storageCapacity'],
    'storage capacity': ['storageCapacity'],
    ram: ['ram'],
    'operating system': ['operatingSystem'],
    os: ['operatingSystem'],
    size: ['size'],
    'bed size': ['bedSize'],
    'bed type': ['bedType'],
    'shoe type': ['shoeType'],
    'watch type': ['watchType'],
    doors: ['doors'],
    'seating capacity': ['seatingCapacity'],
    seats: ['seatingCapacity'],
    network: ['networkType'],
    'network type': ['networkType'],
    fit: ['fit'],
    style: ['style'],
    season: ['season'],
    model: ['model'],
    year: ['year'],
    mileage: ['mileage'],
    'assembly status': ['assemblyStatus'],
    assembly: ['assemblyStatus'],
    'cushion type': ['cushionType'],
    'fabric type': ['fabricType'],
    'closure type': ['closureType'],
    'appliance type': ['applianceType'],
    'tool type': ['toolType'],
    'plant type': ['plantType'],
    'decor type': ['decorType'],
    'bike type': ['bikeType'],
    genre: ['genre'],
    platform: ['platform'],
    'game type': ['gameType'],
    'gear type': ['gearType'],
    'equipment type': ['equipmentType'],
    warranty: ['warranty'],
  }

  return map[normalizedRootName] || null
}

module.exports = {
  resolveFiltersFromProductData,
}
