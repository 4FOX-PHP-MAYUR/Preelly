const { Types } = require('mongoose')
const FormField = require('../../../../models/FormField')
const Filter = require('../../../../models/Filter')
const Category = require('../../../../models/Category')

const VALID_TABLE_NAMES = new Set(['filters', 'categories'])

/**
 * Build nested option nodes for a category subtree rooted at `rootParentId`.
 * Each node: { value, label, slug, children[] }. Leaf nodes get children: [].
 */
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
    return siblings.map(cat => ({
      value: String(cat._id),
      label: cat.name,
      slug: cat.slug || '',
      children: buildNodes(cat._id),
    }))
  }

  return buildNodes(rootParentId)
}

/**
 * Fetch every active descendant of the given parent category IDs in one query.
 * Uses the `path` array (ancestor chain) to avoid recursive DB round-trips.
 */
async function fetchCategoryDescendants(parentIds) {
  if (!parentIds.length) return []

  const parentObjectIds = parentIds.map(id => new Types.ObjectId(id))
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

// Broad match so user-defined labels like "Select", "Dropdown", "Radio Button" all work
function isSelectionFieldType(fieldValue) {
  const v = (fieldValue || '').toLowerCase().replace(/[\s_-]/g, '')
  return (
    v.includes('dropdown') ||
    v.includes('select') ||
    v.includes('radio') ||
    v.includes('checkbox') ||
    v.includes('multiselect') ||
    v.includes('choice')
  )
}

/**
 * POST /api/v1/web/dynamic-form
 * Body: { categoryId: string }
 *
 * Response:
 * {
 *   categoryId, categoryName, totalSteps,
 *   steps: [{ step, fields: [{ id, fieldName, fieldTitle, placeholder,
 *             fieldType, formStep, fieldOrder, validation, tableName,
 *             functionName, options? [{ value, label, slug, children[] }] }] }]
 * }
 */
async function getDynamicForm(req, res) {
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

    const categoryDoc = await Category.findById(categoryId).select('name slug').lean()

    if (!rawFields.length) {
      return res.json({
        categoryId,
        categoryName: categoryDoc?.name || null,
        totalSteps: 0,
        steps: [],
      })
    }

    // ── 2. Partition fields that need options by tableName ──────────────────────
    const filterFields = []
    const categoryFields = []

    for (const f of rawFields) {
      if (!isSelectionFieldType(f.fieldTypeId?.fieldValue)) continue
      if (f.tableName === 'filters') filterFields.push(f)
      else if (f.tableName === 'categories') categoryFields.push(f)
    }

    // ── 3. Bulk-fetch filter children (avoids N+1) ─────────────────────────────
    const filterChildrenMap = new Map() // filterId string → options[]

    if (filterFields.length) {
      const uniqueFilterIds = [
        ...new Set(
          filterFields.map(f => f.filterId?._id).filter(Boolean).map(id => String(id))
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

      // Fallback: use filter's own options[] array when no children exist
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

    // ── 4. Bulk-fetch full category hierarchy via categoryId (avoids N+1) ───────
    // For tableName = 'categories': fetch all descendants of the field's categoryId
    // and return a nested tree (parent → child → sub-child → …) with empty
    // children arrays on leaf nodes.
    const catOptionsMap = new Map() // categoryId string → options[]

    if (categoryFields.length) {
      const uniqueCategoryIds = [
        ...new Set(
          categoryFields
            .map(f => String(f.categoryId))
            .filter(Boolean)
        ),
      ]

      const allDescendants = await fetchCategoryDescendants(uniqueCategoryIds)

      for (const parentId of uniqueCategoryIds) {
        catOptionsMap.set(
          parentId,
          buildCategoryOptionsTree(allDescendants, parentId)
        )
      }
    }

    // ── 5. Build clean field objects ───────────────────────────────────────────
    const builtFields = rawFields.map(f => {
      const fieldTypeValue = f.fieldTypeId?.fieldValue || 'text'
      const needsOptions = isSelectionFieldType(fieldTypeValue)
      const tableName = f.tableName || ''

      const field = {
        id: String(f._id),
        fieldName: f.fieldName,
        fieldTitle: f.fieldTitle,
        placeholder: f.placeholder || '',
        fieldType: fieldTypeValue,
        formStep: f.formStep ?? 1,
        fieldOrder: f.fieldOrder ?? 0,
        validation: f.validation || '',
        tableName: VALID_TABLE_NAMES.has(tableName) ? tableName : '',
        functionName: f.functionName || '',
      }

      if (needsOptions) {
        if (tableName === 'filters') {
          field.options = filterChildrenMap.get(String(f.filterId?._id || '')) || []
        } else if (tableName === 'categories') {
          field.options = catOptionsMap.get(String(f.categoryId)) || []
        } else {
          field.options = []
        }
      }

      return field
    })

    // ── 6. Group by formStep ───────────────────────────────────────────────────
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

module.exports = { getDynamicForm }
