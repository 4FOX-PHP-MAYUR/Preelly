const express = require('express')
const router = express.Router()
const { Types } = require('mongoose')
const FormField = require('../models/FormField')
const Category = require('../models/Category')
const { isRegisteredTable, normalizeTableName } = require('../config/dynamicTableRegistry')
const { buildActiveFormFieldsQuery, mergeScopedFormFields } = require('../utils/formFieldScope')
const { isSelectionFieldType } = require('../utils/formFieldTypes')
const { loadOptionsForFormFields } = require('../core/services/dynamicTableOptionsService')

/**
 * POST /api/dynamic-form
 *
 * Legacy route — delegates option loading to dynamicTableOptionsService while
 * preserving bridge-category logic for tableName = categories.
 */
router.post('/dynamic-form', async (req, res) => {
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

    if (!rawFields.length) {
      const categoryDoc = await Category.findById(categoryId).select('name slug').lean()
      return res.json({
        categoryId,
        categoryName: categoryDoc?.name || null,
        totalSteps: 0,
        steps: [],
      })
    }

    const optionsLoader = await loadOptionsForFormFields(rawFields, { categoryBridgeLogic: true })

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
        fieldType: f.fieldTypeId?.fieldValue || 'text',
        formStep: f.formStep ?? 1,
        fieldOrder: f.fieldOrder ?? 0,
        validation: f.validation || '',
        tableName: isRegisteredTable(normalizedTable) ? normalizedTable : tableName,
        tableConfig: f.tableConfig || null,
        functionName: f.functionName || '',
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

    const categoryDoc = await Category.findById(categoryId).select('name slug').lean()

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
})

module.exports = router
