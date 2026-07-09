/**
 * Resolves Product reference fields (ObjectIds) to human-readable labels for detail APIs.
 *
 * Relationship resolution:
 * 1. Discover ObjectId refs from the Product Mongoose schema (not hardcoded field names).
 * 2. Load FormField metadata (fieldTitle, tableName, field type) for the product category scope.
 * 3. Map tableName / schema ref → master collection (Filter, Category; extensible registry).
 * 4. Batch-fetch active, non-deleted master records (no N+1).
 * 5. Emit productAttributes (single-select) and productMultiAttributes (multi-select).
 */
const mongoose = require('mongoose')
const Product = require('../models/Product')
const FormField = require('../models/FormField')
const Filter = require('../models/Filter')
const Category = require('../models/Category')
const { buildRefSourceRegistry, normalizeTableName: registryNormalizeTableName } = require('../config/dynamicTableRegistry')
const { VEHICLE_LISTING_FIELDS, normalizeRequestKey } = require('./productVehicleFields')

const MULTI_FIELD_TYPES = new Set(['checkbox', 'multiselect', 'multi-select'])

/** Master tables used to resolve stored IDs → display labels. Built from dynamicTableRegistry. */
const REF_SOURCE_REGISTRY = buildRefSourceRegistry()

/** Product paths that are refs but not user-facing listing attributes. */
const EXCLUDED_FIELD_KEYS = new Set([
  'seller',
  'likes',
  'selectedFilters', // aggregate of filter IDs; individual form fields hold readable refs
  'rejectionDetails.rejectedBy',
  'videoStream.jobId',
])

let cachedSchemaRefPaths = null
let cachedQuickViewSelectFields = null

const QUICK_VIEW_FORM_FIELD_CACHE_TTL_MS = Number(
  process.env.QUICK_VIEW_FORM_FIELD_CACHE_TTL_MS || 5 * 60 * 1000
)
const quickViewFormFieldCache = new Map()

function toIdString(value) {
  if (value == null || value === '') return null
  if (typeof value === 'object' && value._id != null) return String(value._id)
  return String(value).trim() || null
}

function isEmptyValue(value) {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function isObjectIdString(value) {
  const str = toIdString(value)
  return Boolean(str && mongoose.Types.ObjectId.isValid(str))
}

function humanizeFieldKey(fieldKey) {
  const base = String(fieldKey || '').replace(/Id$/, '')
  return base
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function normalizeTableName(tableName) {
  return registryNormalizeTableName(tableName)
}

function resolveRefSource(tableName, schemaRef) {
  const fromTable = REF_SOURCE_REGISTRY[normalizeTableName(tableName)]
  if (fromTable) return fromTable
  if (schemaRef && REF_SOURCE_REGISTRY[schemaRef]) return REF_SOURCE_REGISTRY[schemaRef]
  return null
}

function getActiveRecordQuery(modelName, refSource = null) {
  const defaults = refSource?.defaults || REF_SOURCE_REGISTRY[modelName]?.defaults

  if (defaults?.deletedColumn) {
    const query = { [defaults.deletedColumn]: false }
    if (defaults.statusColumn) {
      if (defaults.inactiveStatusQuery) {
        query[defaults.statusColumn] = defaults.inactiveStatusQuery
      } else {
        query[defaults.statusColumn] = defaults.activeValue ?? true
      }
    }
    return query
  }

  if (modelName === 'Filter') {
    return { isDeleted: { $ne: true }, isActive: { $ne: false } }
  }
  if (modelName === 'Category') {
    return { isDeleted: false, isActive: true }
  }
  if (modelName === 'Emirate') {
    return { isDeleted: false, status: true }
  }
  return {}
}

/**
 * Walk Product schema once and cache ObjectId reference paths.
 * @returns {Array<{ fieldKey: string, ref: string, multi: boolean }>}
 */
function isObjectIdSchemaType(schemaType) {
  return schemaType?.instance === 'ObjectId' || schemaType?.instance === 'ObjectID'
}

function getProductSchemaRefPaths() {
  if (cachedSchemaRefPaths) return cachedSchemaRefPaths

  const paths = []
  for (const [fieldKey, schemaType] of Object.entries(Product.schema.paths)) {
    if (EXCLUDED_FIELD_KEYS.has(fieldKey)) continue

    if (isObjectIdSchemaType(schemaType) && schemaType.options?.ref) {
      paths.push({
        fieldKey,
        ref: schemaType.options.ref,
        multi: false,
      })
      continue
    }

    const embedded = schemaType.embeddedSchemaType || schemaType.caster
    if (
      schemaType.instance === 'Array' &&
      isObjectIdSchemaType(embedded) &&
      embedded.options?.ref
    ) {
      paths.push({
        fieldKey,
        ref: embedded.options.ref,
        multi: true,
      })
    }
  }

  cachedSchemaRefPaths = paths
  return paths
}

function resolveCanonicalFieldKey(fieldKey) {
  if (!fieldKey) return fieldKey
  if (VEHICLE_LISTING_FIELDS[fieldKey]) return fieldKey
  const normalized = normalizeRequestKey(fieldKey)
  if (normalized) return normalized
  return fieldKey
}

function collectCategoryScopeIds(product = {}) {
  const ids = new Set()
  const add = (value) => {
    const id = toIdString(value)
    if (id && mongoose.Types.ObjectId.isValid(id)) ids.add(id)
  }

  add(product.category)
  add(product.subcategory)
  if (Array.isArray(product.categoryPath)) {
    for (const item of product.categoryPath) add(item)
  }

  return [...ids].map((id) => new mongoose.Types.ObjectId(id))
}

function getProductFieldValue(product, fieldKey) {
  if (!product || !fieldKey) return undefined

  const keysToTry = [...new Set([fieldKey, resolveCanonicalFieldKey(fieldKey)].filter(Boolean))]
  const lowerField = String(fieldKey).toLowerCase()

  for (const key of keysToTry) {
    if (key.includes('.')) {
      const value = key
        .split('.')
        .reduce((acc, part) => (acc == null ? undefined : acc[part]), product)
      if (value !== undefined) return value
      continue
    }
    if (product[key] !== undefined) return product[key]
  }

  const additional = flattenAdditionalFields(product)
  for (const key of keysToTry) {
    if (additional[key] !== undefined) return additional[key]
  }

  for (const [key, value] of Object.entries(additional)) {
    if (key.toLowerCase() === lowerField) return value
  }

  for (const key of Object.keys(product)) {
    if (key.toLowerCase() === lowerField && product[key] !== undefined) {
      return product[key]
    }
  }

  return undefined
}

function flattenAdditionalFields(product = {}) {
  const raw = product.additionalFields
  if (!raw) return {}
  if (raw instanceof Map) return Object.fromEntries(raw.entries())
  if (typeof raw === 'object') return raw
  return {}
}

function splitRawList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => toIdString(v)).filter(Boolean)
  }
  const raw = String(value).trim()
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((v) => toIdString(v)).filter(Boolean)
      }
    } catch {
      // fall through
    }
  }
  return raw.split(',').map((v) => v.trim()).filter(Boolean)
}

function normalizeToIdList(rawValue, isMulti) {
  if (isEmptyValue(rawValue)) return []

  if (isMulti || Array.isArray(rawValue)) {
    return splitRawList(rawValue).filter((id) => isObjectIdString(id))
  }

  const id = toIdString(rawValue)
  return id && isObjectIdString(id) ? [id] : []
}

function resolvePopulatedDisplayName(rawValue) {
  if (rawValue && typeof rawValue === 'object' && rawValue.name) {
    return String(rawValue.name).trim() || null
  }
  return null
}

function inferIsMulti(fieldKey, rawValue, formConfig, schemaPath) {
  if (formConfig?.isMulti) return true
  const canonicalKey = resolveCanonicalFieldKey(fieldKey)
  if (VEHICLE_LISTING_FIELDS[canonicalKey]?.multi) return true
  if (schemaPath?.multi) return true
  if (Array.isArray(rawValue)) return true
  return false
}

function inferRefModel(fieldKey, formConfig, schemaPath) {
  const fromForm = resolveRefSource(formConfig?.tableName, null)
  if (fromForm) return fromForm

  const canonicalKey = resolveCanonicalFieldKey(fieldKey)
  const vehicleConfig = VEHICLE_LISTING_FIELDS[canonicalKey]
  if (vehicleConfig?.type === 'objectId' && vehicleConfig.ref) {
    return resolveRefSource(null, vehicleConfig.ref)
  }

  return resolveRefSource(null, schemaPath?.ref)
}

function shouldIncludeField(fieldKey, rawValue, refSource) {
  if (isEmptyValue(rawValue)) return false
  if (!refSource) return false

  const populatedName = resolvePopulatedDisplayName(rawValue)
  if (populatedName) return true

  const isMulti = Array.isArray(rawValue)
  if (isMulti) {
    const ids = normalizeToIdList(rawValue, true)
    return ids.length > 0 || splitRawList(rawValue).some((v) => isObjectIdString(v))
  }

  return isObjectIdString(rawValue)
}

/**
 * Load form field metadata for all categories in the product hierarchy scope.
 * Later definitions for the same fieldName win (more specific category overrides).
 */
async function loadFormFieldConfigMap(categoryIds) {
  if (!categoryIds.length) return new Map()

  const rows = await FormField.find({
    categoryId: { $in: categoryIds },
    isActive: true,
    isDeleted: false,
  })
    .populate('fieldTypeId', 'fieldValue')
    .sort({ formStep: 1, fieldOrder: 1 })
    .lean()

  const map = new Map()
  for (const row of rows) {
    const fieldType = (row.fieldTypeId?.fieldValue || '').toLowerCase()
    map.set(row.fieldName, {
      fieldTitle: row.fieldTitle,
      tableName: normalizeTableName(row.tableName),
      fieldOrder: row.fieldOrder ?? 0,
      formStep: row.formStep ?? 1,
      fieldType,
      isMulti: MULTI_FIELD_TYPES.has(fieldType),
    })
  }
  return map
}

function buildFieldDefinitions(product, formFieldMap, schemaRefPaths) {
  const schemaByKey = new Map(schemaRefPaths.map((p) => [p.fieldKey, p]))
  const keys = new Set([
    ...formFieldMap.keys(),
    ...schemaRefPaths.map((p) => p.fieldKey),
    ...Object.keys(VEHICLE_LISTING_FIELDS).filter((k) => VEHICLE_LISTING_FIELDS[k].type === 'objectId'),
    ...Object.keys(flattenAdditionalFields(product)),
  ])

  const defs = []

  for (const fieldKey of keys) {
    const rawValue = getProductFieldValue(product, fieldKey)
    const formConfig = formFieldMap.get(fieldKey) || null
    const schemaPath = schemaByKey.get(fieldKey) || null
    const refSource = inferRefModel(fieldKey, formConfig, schemaPath)

    if (!shouldIncludeField(fieldKey, rawValue, refSource)) continue

    const isMulti = inferIsMulti(fieldKey, rawValue, formConfig, schemaPath)
    defs.push({
      fieldKey,
      fieldTitle: formConfig?.fieldTitle || humanizeFieldKey(fieldKey),
      formStep: formConfig?.formStep ?? 999,
      fieldOrder: formConfig?.fieldOrder ?? 999,
      refSource,
      isMulti,
      rawValue,
    })
  }

  defs.sort((a, b) => a.formStep - b.formStep || a.fieldOrder - b.fieldOrder || a.fieldKey.localeCompare(b.fieldKey))
  return defs
}

async function batchLoadDisplayMaps(idsByModel) {
  const maps = {}

  await Promise.all(
    Object.entries(idsByModel).map(async ([modelName, idSet]) => {
      if (!idSet.size) {
        maps[modelName] = new Map()
        return
      }

      const source = REF_SOURCE_REGISTRY[modelName]
      if (!source) {
        maps[modelName] = new Map()
        return
      }

      const objectIds = [...idSet]
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id))

      if (!objectIds.length) {
        maps[modelName] = new Map()
        return
      }

      const displayField = source.displayField || 'name'
      const docs = await source
        .getModel()
        .find({ _id: { $in: objectIds }, ...getActiveRecordQuery(modelName, source) })
        .select(`_id ${displayField}`)
        .lean()

      maps[modelName] = new Map(
        docs.map((doc) => [String(doc._id), doc[displayField] || null]).filter(([, name]) => name)
      )
    })
  )

  return maps
}

function resolveIdsToLabels(ids, modelName, lookupMaps) {
  const map = lookupMaps[modelName] || new Map()
  return ids.map((id) => map.get(String(id)) || null).filter((label) => label != null && label !== '')
}

function resolveFieldPresentation(def, lookupMaps) {
  const populated = resolvePopulatedDisplayName(def.rawValue)
  if (populated && !def.isMulti) {
    return { single: populated, multi: null }
  }

  if (def.isMulti || Array.isArray(def.rawValue)) {
    const ids = normalizeToIdList(def.rawValue, true)
    if (!ids.length) return { single: null, multi: [] }

    const labels = resolveIdsToLabels(ids, def.refSource.modelName, lookupMaps)
    return { single: null, multi: labels }
  }

  const ids = normalizeToIdList(def.rawValue, false)
  if (!ids.length) return { single: null, multi: null }

  const labels = resolveIdsToLabels(ids, def.refSource.modelName, lookupMaps)
  return { single: labels[0] || null, multi: null }
}

function getQuickViewProductSelectFields() {
  if (cachedQuickViewSelectFields) return cachedQuickViewSelectFields

  const refKeys = getProductSchemaRefPaths().map((p) => p.fieldKey)
  cachedQuickViewSelectFields = [
    'category',
    'subcategory',
    'categoryPath',
    'additionalFields',
    ...refKeys,
  ]
  return cachedQuickViewSelectFields
}

function buildQuickViewFormFieldConfigEntry(row) {
  const fieldType = (row.fieldTypeId?.fieldValue || '').toLowerCase()
  return {
    fieldTitle: row.fieldTitle,
    tableName: normalizeTableName(row.tableName),
    fieldOrder: row.fieldOrder ?? 0,
    formStep: row.formStep ?? 1,
    fieldType,
    isMulti: MULTI_FIELD_TYPES.has(fieldType),
  }
}

function buildQuickViewFormFieldMapForProduct(quickViewRows, product) {
  const scopeIds = new Set(collectCategoryScopeIds(product).map(String))
  const map = new Map()

  for (const row of quickViewRows) {
    if (!scopeIds.has(String(row.categoryId))) continue
    map.set(row.fieldName, buildQuickViewFormFieldConfigEntry(row))
  }

  return map
}

async function loadQuickViewFormFieldRows(categoryIds) {
  if (!categoryIds.length) return []

  const cacheKey = categoryIds.map(String).sort().join('|')
  const cached = quickViewFormFieldCache.get(cacheKey)
  if (cached && Date.now() - cached.at < QUICK_VIEW_FORM_FIELD_CACHE_TTL_MS) {
    return cached.rows
  }

  const rows = await FormField.find({
    categoryId: { $in: categoryIds },
    isActive: true,
    isDeleted: false,
    showOnQuickView: true,
  })
    .populate('fieldTypeId', 'fieldValue')
    .sort({ formStep: 1, fieldOrder: 1 })
    .lean()

  quickViewFormFieldCache.set(cacheKey, { at: Date.now(), rows })
  return rows
}

function buildQuickViewFieldDefinitions(product, formFieldMap, schemaRefPaths) {
  const schemaByKey = new Map(schemaRefPaths.map((p) => [p.fieldKey, p]))
  const defs = []

  for (const [fieldKey, formConfig] of formFieldMap) {
    const canonicalFieldKey = resolveCanonicalFieldKey(fieldKey)
    const rawValue = getProductFieldValue(product, fieldKey)
    if (isEmptyValue(rawValue)) continue

    const schemaPath = schemaByKey.get(canonicalFieldKey) || schemaByKey.get(fieldKey) || null
    const refSource = inferRefModel(fieldKey, formConfig, schemaPath)
    const isMulti = inferIsMulti(fieldKey, rawValue, formConfig, schemaPath)

    if (refSource) {
      if (!shouldIncludeField(fieldKey, rawValue, refSource)) continue
    } else if (isMulti) {
      const values = splitRawList(rawValue).map((v) => String(v).trim()).filter(Boolean)
      if (!values.length) continue
    } else if (rawValue == null || rawValue === '') {
      continue
    }

    defs.push({
      fieldKey: canonicalFieldKey,
      fieldTitle: formConfig.fieldTitle || humanizeFieldKey(canonicalFieldKey),
      formStep: formConfig.formStep ?? 999,
      fieldOrder: formConfig.fieldOrder ?? 999,
      refSource,
      isMulti,
      rawValue,
    })
  }

  defs.sort(
    (a, b) =>
      a.formStep - b.formStep ||
      a.fieldOrder - b.fieldOrder ||
      a.fieldKey.localeCompare(b.fieldKey)
  )
  return defs
}

function resolveRawFieldPresentation(def) {
  if (def.isMulti || Array.isArray(def.rawValue)) {
    const values = splitRawList(def.rawValue)
      .map((v) => String(v).trim())
      .filter((v) => v !== '')
    return { single: null, multi: values.length ? values : [] }
  }

  const populated = resolvePopulatedDisplayName(def.rawValue)
  if (populated) return { single: populated, multi: null }

  if (def.rawValue != null && typeof def.rawValue === 'object') {
    return { single: null, multi: null }
  }

  const single = def.rawValue == null ? null : String(def.rawValue).trim()
  return { single: single || null, multi: null }
}

function resolveQuickViewEntries(defs, lookupMaps) {
  const quickViewData = []

  for (const def of defs) {
    const { single, multi } = def.refSource
      ? resolveFieldPresentation(def, lookupMaps)
      : resolveRawFieldPresentation(def)

    if (def.isMulti || Array.isArray(def.rawValue)) {
      if (!multi?.length) continue
      quickViewData.push({
        fieldKey: def.fieldKey,
        fieldTitle: def.fieldTitle,
        fieldValues: multi,
      })
      continue
    }

    if (single == null || single === '') continue
    quickViewData.push({
      fieldKey: def.fieldKey,
      fieldTitle: def.fieldTitle,
      fieldValue: single,
    })
  }

  return quickViewData
}

/**
 * Build quickViewData for a batch of products (feed APIs). Batches DB lookups — no N+1.
 * @param {object[]} products
 * @returns {Promise<object[][]>}
 */
async function buildQuickViewDataForProducts(products = []) {
  if (!Array.isArray(products) || products.length === 0) return []

  try {
    const schemaRefPaths = getProductSchemaRefPaths()
    const selectFields = getQuickViewProductSelectFields()

    const productIds = products
      .map((p) => toIdString(p?._id))
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id))

    const dbById = new Map()
    if (productIds.length) {
      const docs = await Product.find({ _id: { $in: productIds } })
        .select(selectFields.join(' '))
        .lean()
      for (const doc of docs) dbById.set(String(doc._id), doc)
    }

    const mergedProducts = products.map((product) => {
      const stored = dbById.get(String(product._id)) || {}
      return { ...stored, ...product }
    })

    const allCategoryIds = [
      ...new Set(mergedProducts.flatMap((product) => collectCategoryScopeIds(product).map(String))),
    ]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id))

    const quickViewRows = await loadQuickViewFormFieldRows(allCategoryIds)
    const allDefs = mergedProducts.map((product) =>
      buildQuickViewFieldDefinitions(
        product,
        buildQuickViewFormFieldMapForProduct(quickViewRows, product),
        schemaRefPaths
      )
    )

    const idsByModel = {}
    for (const modelName of Object.keys(REF_SOURCE_REGISTRY)) {
      if (REF_SOURCE_REGISTRY[modelName]?.modelName === modelName) {
        idsByModel[modelName] = new Set()
      }
    }
    if (!idsByModel.Filter) idsByModel.Filter = new Set()
    if (!idsByModel.Category) idsByModel.Category = new Set()
    if (!idsByModel.Emirate) idsByModel.Emirate = new Set()
    for (const defs of allDefs) {
      for (const def of defs) {
        if (!def.refSource) continue
        const ids = normalizeToIdList(def.rawValue, def.isMulti)
        for (const id of ids) {
          if (def.refSource?.modelName && idsByModel[def.refSource.modelName]) {
            idsByModel[def.refSource.modelName].add(id)
          }
        }
      }
    }

    const lookupMaps = await batchLoadDisplayMaps(idsByModel)
    return allDefs.map((defs) => resolveQuickViewEntries(defs, lookupMaps))
  } catch (err) {
    console.error('[productAttributesResolver] Failed to build quickViewData:', err)
    return products.map(() => [])
  }
}

/**
 * Build the "features" list for a batch of products: every checkbox/multi-select
 * admin-configured FormField for the product's category scope, resolved to display
 * labels, as [{ title, values }] — regardless of `showOnQuickView` (unlike
 * quickViewData above), since a multi-select field is inherently a feature list no
 * matter whether it's also flagged for the quick-view/"Car Overview" summary. Driven
 * purely by field type, so any category — including ones added later — works with no
 * extra configuration.
 * @param {object[]} products
 * @returns {Promise<Array<{ title: string, values: string[] }>[]>}
 */
async function buildFeaturesForProducts(products = []) {
  if (!Array.isArray(products) || products.length === 0) return []

  try {
    const schemaRefPaths = getProductSchemaRefPaths()
    const selectFields = getQuickViewProductSelectFields()

    const productIds = products
      .map((p) => toIdString(p?._id))
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id))

    const dbById = new Map()
    if (productIds.length) {
      const docs = await Product.find({ _id: { $in: productIds } })
        .select(selectFields.join(' '))
        .lean()
      for (const doc of docs) dbById.set(String(doc._id), doc)
    }

    const mergedProducts = products.map((product) => {
      const stored = dbById.get(String(product._id)) || {}
      return { ...stored, ...product }
    })

    const allCategoryIds = [
      ...new Set(mergedProducts.flatMap((product) => collectCategoryScopeIds(product).map(String))),
    ]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id))

    const multiSelectRows = allCategoryIds.length
      ? await FormField.find({
          categoryId: { $in: allCategoryIds },
          isActive: true,
          isDeleted: false,
        })
          .populate('fieldTypeId', 'fieldValue')
          .sort({ formStep: 1, fieldOrder: 1 })
          .lean()
          .then((rows) =>
            rows.filter((row) => MULTI_FIELD_TYPES.has((row.fieldTypeId?.fieldValue || '').toLowerCase()))
          )
      : []

    const allDefs = mergedProducts.map((product) =>
      buildQuickViewFieldDefinitions(
        product,
        buildQuickViewFormFieldMapForProduct(multiSelectRows, product),
        schemaRefPaths
      )
    )

    const idsByModel = {}
    for (const modelName of Object.keys(REF_SOURCE_REGISTRY)) {
      if (REF_SOURCE_REGISTRY[modelName]?.modelName === modelName) {
        idsByModel[modelName] = new Set()
      }
    }
    if (!idsByModel.Filter) idsByModel.Filter = new Set()
    if (!idsByModel.Category) idsByModel.Category = new Set()
    if (!idsByModel.Emirate) idsByModel.Emirate = new Set()
    for (const defs of allDefs) {
      for (const def of defs) {
        if (!def.refSource) continue
        const ids = normalizeToIdList(def.rawValue, def.isMulti)
        for (const id of ids) {
          if (def.refSource?.modelName && idsByModel[def.refSource.modelName]) {
            idsByModel[def.refSource.modelName].add(id)
          }
        }
      }
    }

    const lookupMaps = await batchLoadDisplayMaps(idsByModel)

    return allDefs.map((defs) =>
      resolveQuickViewEntries(defs, lookupMaps)
        .filter((entry) => Array.isArray(entry.fieldValues) && entry.fieldValues.length)
        .map((entry) => ({ title: entry.fieldTitle, values: entry.fieldValues }))
    )
  } catch (err) {
    console.error('[productAttributesResolver] Failed to build features:', err)
    return products.map(() => [])
  }
}

/**
 * Build quickViewData array for a single product.
 * @param {object} product
 * @returns {Promise<object[]>}
 */
async function buildQuickViewDataPresentation(product = {}) {
  const [quickViewData = []] = await buildQuickViewDataForProducts([product])
  return quickViewData
}

/**
 * Build structured product attribute arrays for product detail responses.
 * @param {object} product - Plain or lean product document
 * @returns {Promise<{ productAttributes: Array, productMultiAttributes: Array }>}
 */
async function buildProductAttributesPresentation(product = {}) {
  try {
    const categoryIds = collectCategoryScopeIds(product)
    const [formFieldMap, schemaRefPaths] = await Promise.all([
      loadFormFieldConfigMap(categoryIds),
      Promise.resolve(getProductSchemaRefPaths()),
    ])

    const fieldDefs = buildFieldDefinitions(product, formFieldMap, schemaRefPaths)

    const idsByModel = {}
    for (const modelName of Object.keys(REF_SOURCE_REGISTRY)) {
      if (REF_SOURCE_REGISTRY[modelName]?.modelName === modelName) {
        idsByModel[modelName] = new Set()
      }
    }
    if (!idsByModel.Filter) idsByModel.Filter = new Set()
    if (!idsByModel.Category) idsByModel.Category = new Set()
    if (!idsByModel.Emirate) idsByModel.Emirate = new Set()
    for (const def of fieldDefs) {
      const ids = normalizeToIdList(def.rawValue, def.isMulti)
      for (const id of ids) {
        if (def.refSource?.modelName && idsByModel[def.refSource.modelName]) {
          idsByModel[def.refSource.modelName].add(id)
        }
      }
    }

    const lookupMaps = await batchLoadDisplayMaps(idsByModel)

    const productAttributes = []
    const productMultiAttributes = []

    for (const def of fieldDefs) {
      const { single, multi } = resolveFieldPresentation(def, lookupMaps)

      if (def.isMulti || Array.isArray(def.rawValue)) {
        if (!multi?.length) continue
        productMultiAttributes.push({
          fieldKey: def.fieldKey,
          fieldTitle: def.fieldTitle,
          fieldValues: multi,
        })
        continue
      }

      if (single == null || single === '') continue
      productAttributes.push({
        fieldKey: def.fieldKey,
        fieldTitle: def.fieldTitle,
        fieldValue: single,
      })
    }

    return { productAttributes, productMultiAttributes }
  } catch (err) {
    console.error('[productAttributesResolver] Failed to resolve product attributes:', err)
    return { productAttributes: [], productMultiAttributes: [] }
  }
}

module.exports = {
  buildProductAttributesPresentation,
  buildQuickViewDataPresentation,
  buildQuickViewDataForProducts,
  buildFeaturesForProducts,
  getProductSchemaRefPaths,
  REF_SOURCE_REGISTRY,
}
