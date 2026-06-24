/**
 * Whitelist registry for dynamic form-field option sources.
 *
 * Only collections registered here can be queried by the dynamic options service.
 * Add new master tables by registering their Mongoose model and default column mapping.
 *
 * Column names use Mongoose schema paths (_id for document id; "id" is normalized to _id).
 */
const Filter = require('../models/Filter')
const Category = require('../models/Category')
const Emirate = require('../models/Emirate')

const DYNAMIC_TABLE_REGISTRY = {
  filters: {
    modelName: 'Filter',
    collectionName: 'filters',
    getModel: () => Filter,
    legacyHandler: 'filters',
    defaults: {
      valueColumn: '_id',
      labelColumn: 'name',
      parentColumn: 'parentId',
      statusColumn: 'isActive',
      sortColumn: 'sortOrder',
      slugColumn: 'slug',
      deletedColumn: 'isDeleted',
      activeValue: true,
      inactiveStatusQuery: { $ne: false },
    },
    displayField: 'name',
  },
  filter: {
    modelName: 'Filter',
    collectionName: 'filters',
    getModel: () => Filter,
    legacyHandler: 'filters',
    defaults: {
      valueColumn: '_id',
      labelColumn: 'name',
      parentColumn: 'parentId',
      statusColumn: 'isActive',
      sortColumn: 'sortOrder',
      slugColumn: 'slug',
      deletedColumn: 'isDeleted',
      activeValue: true,
      inactiveStatusQuery: { $ne: false },
    },
    displayField: 'name',
  },
  categories: {
    modelName: 'Category',
    collectionName: 'categories',
    getModel: () => Category,
    legacyHandler: 'categories',
    defaults: {
      valueColumn: '_id',
      labelColumn: 'name',
      parentColumn: 'parentId',
      statusColumn: 'isActive',
      sortColumn: 'sortOrder',
      slugColumn: 'slug',
      deletedColumn: 'isDeleted',
      activeValue: true,
      inactiveStatusQuery: { $ne: false },
    },
    displayField: 'name',
  },
  category: {
    modelName: 'Category',
    collectionName: 'categories',
    getModel: () => Category,
    legacyHandler: 'categories',
    defaults: {
      valueColumn: '_id',
      labelColumn: 'name',
      parentColumn: 'parentId',
      statusColumn: 'isActive',
      sortColumn: 'sortOrder',
      slugColumn: 'slug',
      deletedColumn: 'isDeleted',
      activeValue: true,
      inactiveStatusQuery: { $ne: false },
    },
    displayField: 'name',
  },
  emirates: {
    modelName: 'Emirate',
    collectionName: 'emirates',
    getModel: () => Emirate,
    defaults: {
      valueColumn: '_id',
      labelColumn: 'name',
      statusColumn: 'status',
      sortColumn: 'name',
      slugColumn: 'slug',
      deletedColumn: 'isDeleted',
      activeValue: true,
    },
    displayField: 'name',
  },
  emirate: {
    modelName: 'Emirate',
    collectionName: 'emirates',
    getModel: () => Emirate,
    defaults: {
      valueColumn: '_id',
      labelColumn: 'name',
      statusColumn: 'status',
      sortColumn: 'name',
      slugColumn: 'slug',
      deletedColumn: 'isDeleted',
      activeValue: true,
    },
    displayField: 'name',
  },
}

function normalizeTableName(tableName) {
  return String(tableName || '').trim().toLowerCase()
}

function getRegistryEntry(tableName) {
  return DYNAMIC_TABLE_REGISTRY[normalizeTableName(tableName)] || null
}

function isRegisteredTable(tableName) {
  return Boolean(getRegistryEntry(tableName))
}

function listRegisteredTables() {
  const seen = new Set()
  const tables = []

  for (const [key, entry] of Object.entries(DYNAMIC_TABLE_REGISTRY)) {
    const name = entry.collectionName || key
    if (seen.has(name)) continue
    seen.add(name)
    tables.push({
      tableName: name,
      modelName: entry.modelName,
      defaults: { ...entry.defaults },
      legacyHandler: entry.legacyHandler || null,
    })
  }

  return tables.sort((a, b) => a.tableName.localeCompare(b.tableName))
}

/**
 * Build REF_SOURCE_REGISTRY entries for product attribute resolution.
 */
function buildRefSourceRegistry() {
  const registry = {}
  for (const entry of Object.values(DYNAMIC_TABLE_REGISTRY)) {
    const key = entry.modelName
    if (!registry[key]) {
      registry[key] = {
        modelName: entry.modelName,
        getModel: entry.getModel,
        displayField: entry.displayField || entry.defaults?.labelColumn || 'name',
        defaults: entry.defaults,
      }
    }
    for (const alias of [entry.collectionName, entry.modelName, entry.modelName.toLowerCase()]) {
      if (alias) {
        registry[alias] = registry[key]
        registry[normalizeTableName(alias)] = registry[key]
      }
    }
  }
  return registry
}

module.exports = {
  DYNAMIC_TABLE_REGISTRY,
  normalizeTableName,
  getRegistryEntry,
  isRegisteredTable,
  listRegisteredTables,
  buildRefSourceRegistry,
}
