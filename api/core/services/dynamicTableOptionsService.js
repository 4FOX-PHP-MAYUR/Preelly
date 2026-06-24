/**
 * Dynamic table options service — loads dropdown/select options from any registered MongoDB collection.
 *
 * Major refactor: replaces hardcoded filters/categories switches with a configurable,
 * registry-based query builder. Legacy filters/categories behaviour is preserved via
 * dedicated legacy handlers for backward compatibility.
 */
const { Types } = require('mongoose')
const Filter = require('../../models/Filter')
const Category = require('../../models/Category')
const AppError = require('../errors/AppError')
const {
  getRegistryEntry,
  normalizeTableName,
  isRegisteredTable,
} = require('../../config/dynamicTableRegistry')
const { isSelectionFieldType } = require('../../utils/formFieldTypes')

const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const OPTIONS_CACHE_TTL_MS = Number(process.env.DYNAMIC_TABLE_OPTIONS_CACHE_TTL_MS || 2 * 60 * 1000)
const optionsCache = new Map()

// ─────────────────────────────────────────────────────────────────────────────
// Validation & config resolution
// ─────────────────────────────────────────────────────────────────────────────

function normalizeColumnName(column) {
  const col = String(column || '').trim()
  if (!col) return ''
  if (col === 'id' || col === 'Id' || col === 'ID') return '_id'
  return col
}

function assertSafeIdentifier(name, label) {
  const value = String(name || '').trim()
  if (!value) return
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new AppError(
      `Invalid ${label}: "${value}". Only letters, numbers, and underscores are allowed.`,
      400,
      'INVALID_COLUMN_NAME'
    )
  }
}

function getModelSchemaPaths(model) {
  return new Set(Object.keys(model.schema.paths))
}

function resolveTableConfig(field = {}) {
  const tableName = normalizeTableName(field.tableName)
  if (!tableName) return null

  const registryEntry = getRegistryEntry(tableName)
  if (!registryEntry) return null

  const userConfig = field.tableConfig && typeof field.tableConfig === 'object'
    ? field.tableConfig
    : {}

  const merged = {
    tableName,
    modelName: registryEntry.modelName,
    collectionName: registryEntry.collectionName || tableName,
    legacyHandler: registryEntry.legacyHandler || null,
    valueColumn: normalizeColumnName(userConfig.valueColumn || registryEntry.defaults?.valueColumn || '_id'),
    labelColumn: normalizeColumnName(userConfig.labelColumn || registryEntry.defaults?.labelColumn || 'name'),
    parentColumn: normalizeColumnName(userConfig.parentColumn || registryEntry.defaults?.parentColumn || ''),
    statusColumn: normalizeColumnName(userConfig.statusColumn || registryEntry.defaults?.statusColumn || ''),
    sortColumn: normalizeColumnName(userConfig.sortColumn || registryEntry.defaults?.sortColumn || ''),
    slugColumn: normalizeColumnName(userConfig.slugColumn || registryEntry.defaults?.slugColumn || 'slug'),
    deletedColumn: normalizeColumnName(userConfig.deletedColumn || registryEntry.defaults?.deletedColumn || 'isDeleted'),
    activeValue: userConfig.activeValue !== undefined && userConfig.activeValue !== null
      ? userConfig.activeValue
      : registryEntry.defaults?.activeValue ?? true,
    inactiveStatusQuery: registryEntry.defaults?.inactiveStatusQuery ?? null,
    conditions: userConfig.conditions && typeof userConfig.conditions === 'object'
      ? userConfig.conditions
      : null,
  }

  return merged
}

function validateTableConfig(config) {
  if (!config?.tableName) {
    throw new AppError('tableName is required for dynamic option loading', 400, 'MISSING_TABLE_NAME')
  }

  const registryEntry = getRegistryEntry(config.tableName)
  if (!registryEntry) {
    throw new AppError(
      `Table "${config.tableName}" is not registered for dynamic option loading`,
      400,
      'TABLE_NOT_REGISTERED'
    )
  }

  const model = registryEntry.getModel()
  if (!model) {
    throw new AppError(`Model for table "${config.tableName}" is unavailable`, 500, 'MODEL_UNAVAILABLE')
  }

  const schemaPaths = getModelSchemaPaths(model)
  const columnsToCheck = [
    ['valueColumn', config.valueColumn],
    ['labelColumn', config.labelColumn],
    ['parentColumn', config.parentColumn],
    ['statusColumn', config.statusColumn],
    ['sortColumn', config.sortColumn],
    ['slugColumn', config.slugColumn],
    ['deletedColumn', config.deletedColumn],
  ]

  for (const [label, column] of columnsToCheck) {
    if (!column) continue
    assertSafeIdentifier(column, label)
    if (!schemaPaths.has(column)) {
      throw new AppError(
        `Column "${column}" does not exist on table "${config.tableName}"`,
        400,
        'INVALID_COLUMN'
      )
    }
  }

  return { model, config, registryEntry }
}

function usesLegacyHandler(config, field = {}) {
  if (!config?.legacyHandler) return false
  const userConfig = field.tableConfig
  const hasCustomConfig = userConfig && typeof userConfig === 'object' && (
    userConfig.valueColumn ||
    userConfig.labelColumn ||
    userConfig.parentColumn ||
    userConfig.statusColumn ||
    userConfig.sortColumn ||
    userConfig.slugColumn ||
    userConfig.deletedColumn ||
    userConfig.conditions
  )
  return !hasCustomConfig
}

// ─────────────────────────────────────────────────────────────────────────────
// Query building
// ─────────────────────────────────────────────────────────────────────────────

function buildDeletedFilter(config) {
  if (!config.deletedColumn) return {}
  return { [config.deletedColumn]: false }
}

function buildStatusFilter(config) {
  if (!config.statusColumn) return {}

  if (config.inactiveStatusQuery) {
    return { [config.statusColumn]: config.inactiveStatusQuery }
  }

  return { [config.statusColumn]: config.activeValue }
}

function buildParentFilter(config, parentValue) {
  if (!config.parentColumn) return {}
  if (parentValue === undefined || parentValue === null || parentValue === '') {
    return { [config.parentColumn]: null }
  }
  if (!Types.ObjectId.isValid(String(parentValue))) {
    return { [config.parentColumn]: parentValue }
  }
  return { [config.parentColumn]: new Types.ObjectId(String(parentValue)) }
}

function buildDynamicQuery(config, { parentValue } = {}) {
  const query = {
    ...buildDeletedFilter(config),
    ...buildStatusFilter(config),
  }

  if (config.parentColumn) {
    Object.assign(query, buildParentFilter(config, parentValue))
  }

  if (config.conditions && typeof config.conditions === 'object') {
    Object.assign(query, config.conditions)
  }

  return query
}

function buildSort(config) {
  if (!config.sortColumn) {
    return config.labelColumn ? { [config.labelColumn]: 1 } : { _id: 1 }
  }
  return { [config.sortColumn]: 1, [config.labelColumn || 'name']: 1 }
}

function buildSelectFields(config) {
  const fields = new Set(['_id', config.valueColumn, config.labelColumn])
  if (config.slugColumn) fields.add(config.slugColumn)
  if (config.parentColumn) fields.add(config.parentColumn)
  if (config.sortColumn) fields.add(config.sortColumn)
  return [...fields].join(' ')
}

function mapDocToOption(doc, config) {
  const valueCol = config.valueColumn || '_id'
  const labelCol = config.labelColumn || 'name'
  const slugCol = config.slugColumn

  const rawValue = doc[valueCol] ?? doc._id
  const label = doc[labelCol]
  if (label == null || label === '') return null

  const option = {
    value: String(rawValue),
    label: String(label),
    slug: slugCol && doc[slugCol] != null ? String(doc[slugCol]) : '',
  }

  if (config.parentColumn && doc[config.parentColumn] != null) {
    option.parentValue = String(doc[config.parentColumn])
  }

  return option
}

function getCacheKey(prefix, payload) {
  return `${prefix}:${JSON.stringify(payload)}`
}

function getCachedOptions(key) {
  const entry = optionsCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > OPTIONS_CACHE_TTL_MS) {
    optionsCache.delete(key)
    return null
  }
  return entry.data
}

function setCachedOptions(key, data) {
  optionsCache.set(key, { at: Date.now(), data })
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy handlers (backward compatible)
// ─────────────────────────────────────────────────────────────────────────────

function buildCategoryOptionsTree(categories, rootParentId) {
  const byParent = new Map()
  for (const cat of categories) {
    const pid = String(cat.parentId)
    if (!byParent.has(pid)) byParent.set(pid, [])
    byParent.get(pid).push(cat)
  }

  for (const siblings of byParent.values()) {
    siblings.sort(
      (a, b) =>
        (Number(a.sortOrder) - Number(b.sortOrder)) ||
        String(a.name || '').localeCompare(String(b.name || ''))
    )
  }

  function buildNodes(parentId) {
    const siblings = byParent.get(String(parentId)) || []
    return siblings.map((cat) => ({
      value: String(cat._id),
      label: cat.name,
      slug: cat.slug || '',
      children: buildNodes(cat._id),
    }))
  }

  return buildNodes(rootParentId)
}

async function fetchCategoryDescendants(parentIds) {
  if (!parentIds.length) return []

  const parentObjectIds = parentIds.map((id) => new Types.ObjectId(id))
  return Category.find({
    $or: [
      { path: { $in: parentObjectIds } },
      { parentId: { $in: parentObjectIds } },
    ],
    isDeleted: false,
    isActive: true,
  })
    .select('_id name slug parentId sortOrder')
    .sort({ sortOrder: 1, name: 1 })
    .lean()
}

async function buildLegacyFilterOptionsMap(filterFields) {
  const filterChildrenMap = new Map()

  if (!filterFields.length) return filterChildrenMap

  const uniqueFilterIds = [
    ...new Set(
      filterFields.map((f) => f.filterId?._id).filter(Boolean).map((id) => String(id))
    ),
  ]

  const filterChildren = await Filter.find({
    parentId: { $in: uniqueFilterIds.map((id) => new Types.ObjectId(id)) },
    isDeleted: false,
    isActive: true,
  })
    .select('_id name slug parentId sortOrder')
    .sort({ sortOrder: 1, name: 1 })
    .lean()

  for (const child of filterChildren) {
    const pid = String(child.parentId)
    if (!filterChildrenMap.has(pid)) filterChildrenMap.set(pid, [])
    filterChildrenMap.get(pid).push({
      value: String(child._id),
      label: child.name,
      slug: child.slug || '',
    })
  }

  for (const f of filterFields) {
    const fid = String(f.filterId?._id || '')
    if (
      fid &&
      !filterChildrenMap.has(fid) &&
      Array.isArray(f.filterId?.options) &&
      f.filterId.options.length
    ) {
      filterChildrenMap.set(
        fid,
        f.filterId.options.map((o) => ({ value: o, label: o, slug: '' }))
      )
    }
  }

  return filterChildrenMap
}

async function buildLegacyCategoryOptionsMap(categoryFields, { useBridgeLogic = false } = {}) {
  const catOptionsMap = new Map()

  if (!categoryFields.length) return catOptionsMap

  if (useBridgeLogic) {
    const parentCatIds = [
      ...new Set(categoryFields.map((f) => String(f.categoryId)).filter(Boolean)),
    ]
    const fieldTitles = [
      ...new Set(categoryFields.map((f) => (f.fieldTitle || '').trim()).filter(Boolean)),
    ]

    const bridgeCategories = await Category.find({
      parentId: { $in: parentCatIds.map((id) => new Types.ObjectId(id)) },
      name: {
        $in: fieldTitles.map(
          (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        ),
      },
      isDeleted: false,
      isActive: true,
    })
      .select('_id name parentId')
      .lean()

    if (bridgeCategories.length) {
      const bridgeIds = bridgeCategories.map((c) => c._id)
      const leafCategories = await Category.find({
        parentId: { $in: bridgeIds },
        isDeleted: false,
        isActive: true,
      })
        .select('_id name slug parentId sortOrder')
        .sort({ sortOrder: 1, name: 1 })
        .lean()

      const bridgeChildrenMap = new Map()
      for (const leaf of leafCategories) {
        const pid = String(leaf.parentId)
        if (!bridgeChildrenMap.has(pid)) bridgeChildrenMap.set(pid, [])
        bridgeChildrenMap.get(pid).push({
          value: String(leaf._id),
          label: leaf.name,
          slug: leaf.slug || '',
        })
      }

      for (const bridge of bridgeCategories) {
        const key = `${String(bridge.parentId)}_${bridge.name.toLowerCase().trim()}`
        catOptionsMap.set(key, bridgeChildrenMap.get(String(bridge._id)) || [])
      }
    }

    return catOptionsMap
  }

  const uniqueCategoryIds = [
    ...new Set(categoryFields.map((f) => String(f.categoryId)).filter(Boolean)),
  ]

  const allDescendants = await fetchCategoryDescendants(uniqueCategoryIds)

  for (const parentId of uniqueCategoryIds) {
    catOptionsMap.set(parentId, buildCategoryOptionsTree(allDescendants, parentId))
  }

  return catOptionsMap
}

function resolveLegacyFilterOptions(field, filterChildrenMap) {
  return filterChildrenMap.get(String(field.filterId?._id || '')) || []
}

function resolveLegacyCategoryOptions(field, catOptionsMap, { useBridgeLogic = false } = {}) {
  if (useBridgeLogic) {
    const key = `${String(field.categoryId)}_${(field.fieldTitle || '').toLowerCase().trim()}`
    return catOptionsMap.get(key) || []
  }
  return catOptionsMap.get(String(field.categoryId)) || []
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic (generic) option loading
// ─────────────────────────────────────────────────────────────────────────────

async function fetchDynamicOptions(config, { parentValue } = {}) {
  validateTableConfig(config)

  const cacheKey = getCacheKey('dynamic-options', { config, parentValue })
  const cached = getCachedOptions(cacheKey)
  if (cached) return cached

  const { model } = validateTableConfig(config)
  const query = buildDynamicQuery(config, { parentValue })
  const sort = buildSort(config)
  const select = buildSelectFields(config)

  const docs = await model.find(query).select(select).sort(sort).lean()
  const options = docs.map((doc) => mapDocToOption(doc, config)).filter(Boolean)

  setCachedOptions(cacheKey, options)
  return options
}

/**
 * Bulk-load dynamic options grouped by a cache key derived from config + parent context.
 */
async function bulkLoadDynamicOptions(fields) {
  const optionsMap = new Map()
  const groups = new Map()

  for (const field of fields) {
    const config = resolveTableConfig(field)
    if (!config || usesLegacyHandler(config, field)) continue

    let parentValue = null
    if (config.legacyHandler === 'filters' && field.filterId?._id) {
      parentValue = String(field.filterId._id)
    } else if (config.parentColumn && field.filterId?._id) {
      parentValue = String(field.filterId._id)
    }

    const groupKey = JSON.stringify({ config, parentValue })
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { config, parentValue, fieldKeys: [] })
    }
    groups.get(groupKey).fieldKeys.push(String(field._id))
  }

  await Promise.all(
    [...groups.values()].map(async ({ config, parentValue, fieldKeys }) => {
      try {
        const options = await fetchDynamicOptions(config, { parentValue })
        for (const fieldKey of fieldKeys) {
          optionsMap.set(fieldKey, options)
        }
      } catch (err) {
        console.error(
          `[dynamicTableOptionsService] Failed to load options for table "${config.tableName}":`,
          err.message
        )
        for (const fieldKey of fieldKeys) {
          optionsMap.set(fieldKey, [])
        }
      }
    })
  )

  return optionsMap
}

/**
 * Load options for all selection fields on a dynamic form.
 * Preserves legacy filters/categories behaviour; uses dynamic loader for other registered tables.
 */
async function loadOptionsForFormFields(rawFields, { categoryBridgeLogic = false } = {}) {
  const selectionFields = rawFields.filter((f) =>
    isSelectionFieldType(f.fieldTypeId?.fieldValue)
  )

  const legacyFilterFields = []
  const legacyCategoryFields = []
  const dynamicFields = []

  for (const field of selectionFields) {
    const config = resolveTableConfig(field)
    if (!config) continue

    if (config.legacyHandler === 'filters' && usesLegacyHandler(config, field)) {
      legacyFilterFields.push(field)
    } else if (config.legacyHandler === 'categories' && usesLegacyHandler(config, field)) {
      legacyCategoryFields.push(field)
    } else {
      dynamicFields.push(field)
    }
  }

  const [filterChildrenMap, catOptionsMap, dynamicOptionsMap] = await Promise.all([
    buildLegacyFilterOptionsMap(legacyFilterFields),
    buildLegacyCategoryOptionsMap(legacyCategoryFields, { useBridgeLogic: categoryBridgeLogic }),
    bulkLoadDynamicOptions(dynamicFields),
  ])

  return {
    filterChildrenMap,
    catOptionsMap,
    dynamicOptionsMap,
    resolveOptions(field) {
      const config = resolveTableConfig(field)
      if (!config) return []

      if (config.legacyHandler === 'filters' && usesLegacyHandler(config, field)) {
        return resolveLegacyFilterOptions(field, filterChildrenMap)
      }
      if (config.legacyHandler === 'categories' && usesLegacyHandler(config, field)) {
        return resolveLegacyCategoryOptions(field, catOptionsMap, { useBridgeLogic: categoryBridgeLogic })
      }

      return dynamicOptionsMap.get(String(field._id)) || []
    },
  }
}

function isValidTableName(tableName) {
  return isRegisteredTable(tableName)
}

function clearOptionsCache() {
  optionsCache.clear()
}

module.exports = {
  normalizeColumnName,
  resolveTableConfig,
  validateTableConfig,
  buildDynamicQuery,
  buildSort,
  fetchDynamicOptions,
  loadOptionsForFormFields,
  isValidTableName,
  isSelectionFieldType,
  clearOptionsCache,
  usesLegacyHandler,
}
