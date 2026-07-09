const { Types } = require('mongoose')
const FormField = require('../../../../models/FormField')
const Category = require('../../../../models/Category')
const { isRegisteredTable, normalizeTableName } = require('../../../../config/dynamicTableRegistry')
const { buildActiveFormFieldsQuery, mergeScopedFormFields } = require('../../../../utils/formFieldScope')
const { isSelectionFieldType } = require('../../../../utils/formFieldTypes')
const { loadOptionsForFormFields } = require('../../../../core/services/dynamicTableOptionsService')
const { hasFieldFunction, callFieldFunction } = require('../../../../core/services/formFieldFunctions')

/**
 * POST /api/v1/web/dynamic-form
 * Body: { categoryId: string, categoryFilterId?: string, childCategoryId?: string }
 *
 * Option-based fields load options dynamically from registered tables via
 * dynamicTableOptionsService. Legacy filters/categories behaviour is preserved
 * when no custom tableConfig is provided.
 */
async function getDynamicForm(req, res) {
  try {
    const { categoryId, categoryFilterId, childCategoryId } = req.body

    if (!categoryId || !Types.ObjectId.isValid(String(categoryId))) {
      return res.status(400).json({ message: 'Valid categoryId is required' })
    }

    const rawFieldRows = await FormField.find(
      buildActiveFormFieldsQuery(categoryId, categoryFilterId, childCategoryId)
    )
      .populate('fieldTypeId', 'fieldValue')
      .populate('filterId', 'name slug filterType options')
      .sort({ formStep: 1, fieldOrder: 1 })
      .lean()
    const rawFields = mergeScopedFormFields(rawFieldRows)

    const categoryDoc = await Category.findById(categoryId).select('name slug').lean()

    if (!rawFields.length) {
      return res.json({
        categoryId,
        categoryName: categoryDoc?.name || null,
        totalSteps: 0,
        steps: [],
      })
    }

    const optionsLoader = await loadOptionsForFormFields(rawFields, { categoryBridgeLogic: false })

    const builtFields = rawFields.map((f) => {
      const fieldTypeValue = f.fieldTypeId?.fieldValue || 'text'
      const needsOptions = isSelectionFieldType(fieldTypeValue)
      const tableName = f.tableName || ''
      const normalizedTable = normalizeTableName(tableName)

      const field = {
        id: String(f._id),
        fieldName: f.fieldName,
        fieldTitle: f.fieldTitle,
        placeholder: f.placeholder || '',
        fieldType: fieldTypeValue,
        formStep: f.formStep ?? 1,
        fieldOrder: f.fieldOrder ?? 0,
        validation: f.validation || '',
        tableName: isRegisteredTable(normalizedTable) ? normalizedTable : tableName,
        tableConfig: f.tableConfig || null,
        functionName: f.functionName || '',
        functionForField: f.functionForField || '',
      }

      if (needsOptions) {
        field.options = optionsLoader.resolveOptions(f)
      }

      return field
    })

    const stepsMap = new Map()
    for (const field of builtFields) {
      const step = field.formStep || 1
      if (!stepsMap.has(step)) stepsMap.set(step, [])
      stepsMap.get(step).push(field)
    }

    const steps = [...stepsMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([step, fields]) => ({ step, fields }))

    res.json({
      categoryId,
      categoryName: categoryDoc?.name || null,
      totalSteps: steps.length,
      steps,
    })
  } catch (error) {
    console.error('Error fetching dynamic form:', error)
    res.status(500).json({ message: 'Error fetching dynamic form configuration' })
  }
}

/**
 * POST /api/v1/web/dynamic-form/field-function
 * Body: { functionName: string, params: Record<string, string> }
 *
 * Generic invoker for FormField.functionName — resolves a field's options from
 * the current values of the fields it depends on (functionForField). See
 * core/services/formFieldFunctions.js for the registry of callable functions.
 */
async function callFormFieldFunction(req, res) {
  try {
    const { functionName, params } = req.body

    if (!functionName || typeof functionName !== 'string') {
      return res.status(400).json({ message: 'functionName is required' })
    }
    if (!hasFieldFunction(functionName)) {
      return res.status(404).json({ message: `Unknown function "${functionName}"` })
    }

    const options = await callFieldFunction(functionName, params && typeof params === 'object' ? params : {})
    res.json({ options })
  } catch (error) {
    console.error('Error calling form field function:', error)
    res.status(500).json({ message: 'Error calling form field function' })
  }
}

module.exports = { getDynamicForm, callFormFieldFunction }
