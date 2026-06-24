const apiResponse = require('../../../../utils/apiResponse')
const {
  resolveTableConfig,
  fetchDynamicOptions,
} = require('../../../../core/services/dynamicTableOptionsService')
const { listRegisteredTables } = require('../../../../config/dynamicTableRegistry')
const AppError = require('../../../../core/errors/AppError')

function buildConfigFromRequest(source = {}) {
  const tableName = source.tableName
  const tableConfig = {
    valueColumn: source.valueColumn,
    labelColumn: source.labelColumn,
    parentColumn: source.parentColumn,
    statusColumn: source.statusColumn,
    sortColumn: source.sortColumn,
    slugColumn: source.slugColumn,
    deletedColumn: source.deletedColumn,
    activeValue: source.activeValue,
    conditions: source.conditions,
  }

  return resolveTableConfig({ tableName, tableConfig })
}

/**
 * GET /api/v1/web/form-field-options?tableName=emirates&...
 * POST /api/v1/web/form-field-options { tableName, valueColumn, ... }
 *
 * Loads options for dependent/cascading form fields at runtime.
 */
async function getFormFieldOptions(req, res) {
  try {
    const source = req.method === 'GET' ? req.query : req.body
    const config = buildConfigFromRequest(source)

    if (!config) {
      throw new AppError('Invalid or unregistered tableName', 400, 'TABLE_NOT_REGISTERED')
    }

    const parentValue = source.parentValue ?? source.parentId ?? null
    const options = await fetchDynamicOptions(config, { parentValue })

    return apiResponse.success(res, 'Options fetched successfully', {
      tableName: config.tableName,
      options,
      total: options.length,
    })
  } catch (error) {
    console.error('[formFieldOptions.controller] getFormFieldOptions:', error)
    return apiResponse.error(
      res,
      error.message || 'Error fetching form field options',
      error.code ? { code: error.code } : null,
      error.statusCode || 500
    )
  }
}

/**
 * GET /api/v1/web/form-field-options/tables
 * Lists registered tables available for form-field configuration.
 */
async function listRegisteredOptionTables(req, res) {
  try {
    return apiResponse.success(res, 'Registered tables fetched successfully', {
      tables: listRegisteredTables(),
    })
  } catch (error) {
    console.error('[formFieldOptions.controller] listRegisteredOptionTables:', error)
    return apiResponse.error(res, 'Error fetching registered tables', null, 500)
  }
}

module.exports = {
  getFormFieldOptions,
  listRegisteredOptionTables,
}
