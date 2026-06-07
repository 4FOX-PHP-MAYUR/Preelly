const express = require('express')
const router = express.Router()
const { Types } = require('mongoose')
const FormField = require('../models/FormField')
const Filter = require('../models/Filter')
const Category = require('../models/Category')

// Field types that require an options list
const SELECTION_TYPES = new Set([
  'dropdown', 'select', 'radio', 'checkbox', 'multiselect', 'multi-select',
])

const VALID_TABLE_NAMES = new Set(['filters', 'categories'])

/**
 * POST /api/dynamic-form
 *
 * Body:
 *   categoryId  (required) – ObjectId of the category to load form fields for
 *
 * Response:
 *   {
 *     categoryId: string,
 *     categoryName: string | null,
 *     totalSteps: number,
 *     steps: [
 *       {
 *         step: number,
 *         fields: [
 *           {
 *             id: string,
 *             fieldName: string,
 *             fieldTitle: string,
 *             placeholder: string,
 *             fieldType: string,       // from FieldType.fieldValue
 *             formStep: number,
 *             fieldOrder: number,
 *             validation: string,
 *             tableName: string,
 *             functionName: string,
 *             options?: [{ value: string, label: string, slug: string }]
 *           }
 *         ]
 *       }
 *     ]
 *   }
 */
router.post('/dynamic-form', async (req, res) => {
  try {
    const { categoryId } = req.body

    if (!categoryId || !Types.ObjectId.isValid(String(categoryId))) {
      return res.status(400).json({ message: 'Valid categoryId is required' })
    }

    // ── 1. Fetch all active form fields with populated refs in one query ────────
    const rawFields = await FormField.find({
      categoryId: new Types.ObjectId(String(categoryId)),
      isActive: true,
      isDeleted: false,
    })
      .populate('fieldTypeId', 'fieldValue')
      .populate('filterId', 'name slug filterType options')
      .sort({ formStep: 1, fieldOrder: 1 })
      .lean()

    if (!rawFields.length) {
      const categoryDoc = await Category.findById(categoryId)
        .select('name slug')
        .lean()
      return res.json({
        categoryId,
        categoryName: categoryDoc?.name || null,
        totalSteps: 0,
        steps: [],
      })
    }

    // ── 2. Partition fields that need options ───────────────────────────────────
    const filterFields = []
    const categoryFields = []

    for (const f of rawFields) {
      const type = (f.fieldTypeId?.fieldValue || '').toLowerCase()
      if (!SELECTION_TYPES.has(type)) continue
      if (f.tableName === 'filters') filterFields.push(f)
      else if (f.tableName === 'categories') categoryFields.push(f)
    }

    // ── 3. Bulk-fetch filter children (avoids N+1) ─────────────────────────────
    const filterChildrenMap = new Map() // filterId string → options[]

    if (filterFields.length) {
      const uniqueFilterIds = [
        ...new Set(
          filterFields
            .map(f => f.filterId?._id)
            .filter(Boolean)
            .map(id => String(id))
        ),
      ]

      const filterChildren = await Filter.find({
        parentId: { $in: uniqueFilterIds.map(id => new Types.ObjectId(id)) },
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

      // Fallback: use the filter's own options[] array when no children exist
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
            f.filterId.options.map(o => ({ value: o, label: o, slug: '' }))
          )
        }
      }
    }

    // ── 4. Bulk-fetch category options (avoids N+1) ────────────────────────────
    // Logic: find the bridge category (child of field.categoryId whose name matches
    // field.fieldTitle), then return that bridge's children as options.
    const catOptionsMap = new Map() // `${categoryId}_${fieldTitle.lower}` → options[]

    if (categoryFields.length) {
      const parentCatIds = [
        ...new Set(categoryFields.map(f => String(f.categoryId)).filter(Boolean)),
      ]
      const fieldTitles = [
        ...new Set(categoryFields.map(f => (f.fieldTitle || '').trim()).filter(Boolean)),
      ]

      // Find bridge categories: children of field.categoryId whose name matches fieldTitle
      const bridgeCategories = await Category.find({
        parentId: { $in: parentCatIds.map(id => new Types.ObjectId(id)) },
        name: {
          $in: fieldTitles.map(
            t => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
          ),
        },
        isDeleted: false,
        isActive: true,
      })
        .select('_id name parentId')
        .lean()

      if (bridgeCategories.length) {
        // Bulk-fetch all children of bridge categories in one query
        const bridgeIds = bridgeCategories.map(c => c._id)
        const leafCategories = await Category.find({
          parentId: { $in: bridgeIds },
          isDeleted: false,
          isActive: true,
        })
          .select('_id name slug parentId sortOrder')
          .sort({ sortOrder: 1, name: 1 })
          .lean()

        // Group leaf categories by their bridge parentId
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

        // Map composite key → options
        for (const bridge of bridgeCategories) {
          const key = `${String(bridge.parentId)}_${bridge.name.toLowerCase().trim()}`
          catOptionsMap.set(
            key,
            bridgeChildrenMap.get(String(bridge._id)) || []
          )
        }
      }
    }

    // ── 5. Build clean field objects ───────────────────────────────────────────
    const builtFields = rawFields.map(f => {
      const fieldType = (f.fieldTypeId?.fieldValue || 'text').toLowerCase()
      const isSelectionType = SELECTION_TYPES.has(fieldType)
      const tableName = f.tableName || ''

      const field = {
        id: String(f._id),
        fieldName: f.fieldName,
        fieldTitle: f.fieldTitle,
        placeholder: f.placeholder || '',
        fieldType: f.fieldTypeId?.fieldValue || 'text',
        formStep: f.formStep ?? 1,
        fieldOrder: f.fieldOrder ?? 0,
        validation: f.validation || '',
        tableName: VALID_TABLE_NAMES.has(tableName) ? tableName : '',
        functionName: f.functionName || '',
      }

      if (isSelectionType) {
        if (tableName === 'filters') {
          const fid = String(f.filterId?._id || '')
          field.options = filterChildrenMap.get(fid) || []
        } else if (tableName === 'categories') {
          const key = `${String(f.categoryId)}_${(f.fieldTitle || '').toLowerCase().trim()}`
          field.options = catOptionsMap.get(key) || []
        } else {
          field.options = []
        }
      }

      return field
    })

    // ── 6. Group fields by formStep ────────────────────────────────────────────
    const stepsMap = new Map()
    for (const field of builtFields) {
      const step = field.formStep || 1
      if (!stepsMap.has(step)) stepsMap.set(step, [])
      stepsMap.get(step).push(field)
    }

    const steps = [...stepsMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([step, fields]) => ({ step, fields }))

    // ── 7. Fetch category name for context ─────────────────────────────────────
    const categoryDoc = await Category.findById(categoryId)
      .select('name slug')
      .lean()

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
