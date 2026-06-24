/**
 * dynamicFormService — business logic for getDynamicForm.
 *
 * Responsibilities:
 *  1. Fetch active, non-deleted DynamicFormFields for a categoryId.
 *  2. Batch-fetch filter child options for every field that has a valid filterId.
 *  3. Group fields by their formStep, sorting steps numerically / alphabetically.
 */

const { Types } = require('mongoose')
const DynamicFormField = require('../../models/DynamicFormField')
const Filter = require('../../models/Filter')
const AppError = require('../errors/AppError')

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if `value` is a non-empty, non-zero value that is a valid
 * MongoDB ObjectId string.  Covers null / '' / 0 / undefined guard from requirements.
 */
function isValidFilterId(value) {
  if (value === null || value === undefined || value === '' || value === 0) return false
  return Types.ObjectId.isValid(String(value))
}

/**
 * Extract a leading integer from a step label so "Step 2" sorts before "Step 10".
 * Returns null when no integer prefix is found (falls back to string compare).
 */
function extractLeadingNumber(str) {
  const match = String(str || '').match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}

/**
 * Sort step-group entries: numeric if both labels contain a leading number,
 * otherwise alphabetical.  Empty / undefined steps are placed last.
 */
function compareSteps(a, b) {
  // Empty steps go last
  if (!a && b) return 1
  if (a && !b) return -1
  if (!a && !b) return 0

  const nA = extractLeadingNumber(a)
  const nB = extractLeadingNumber(b)

  if (nA !== null && nB !== null) return nA - nB
  return String(a).localeCompare(String(b))
}

// ─────────────────────────────────────────────────────────────────────────────
// Core service functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch, enrich, and return all dynamic form fields for a category.
 *
 * @param {string} categoryId — validated MongoDB ObjectId string
 * @returns {Promise<Array>} enriched field documents (with filterOptions attached)
 * @throws {AppError} 400 if categoryId format is invalid (defensive check)
 */
async function fetchFormFields(categoryId) {
  if (!isValidFilterId(categoryId)) {
    throw new AppError('Invalid categoryId', 400, 'INVALID_CATEGORY_ID')
  }

  const catObjectId = new Types.ObjectId(String(categoryId))

  // ── Step 1: Fetch all matching fields ──────────────────────────────────────
  // Query conditions:
  //   • categoryId  = provided value
  //   • isDeleted   = false   (exclude soft-deleted records)
  //   • isActive    = true    (active records only)
  // Sort:
  //   • fieldOrder ASC — primary sort (DB-level, index-assisted)
  // Populate:
  //   • fieldTypeId → { _id, fieldValue }
  //   • filterId    → { _id, name, colorCode, thumbImage }
  // Performance: .lean() returns plain JS objects; avoids Mongoose document overhead.
  const fields = await DynamicFormField.find({
    categoryId: catObjectId,
    isDeleted: false,
    isActive: true,
  })
    .populate('fieldTypeId', 'fieldValue')
    .populate('filterId', 'name colorCode thumbImage slug')
    .sort({ fieldOrder: 1 })
    .lean()

  if (!fields.length) return []

  // ── Step 2: Batch-fetch filter child options (single DB round-trip) ─────────
  // Collect all distinct, valid filterIds from the result set.
  const filterIdSet = new Set()
  for (const field of fields) {
    // filterId may be a populated object or a raw ObjectId after .lean()
    const rawId = field.filterId?._id ?? field.filterId
    if (isValidFilterId(rawId)) {
      filterIdSet.add(String(rawId))
    }
  }

  // Build a parentId → children[] map with a single aggregated query.
  // Requirements: parentId = filterId, isDeleted = false, isActive = true, sorted by sortOrder ASC
  const filterOptionsByParent = new Map()

  if (filterIdSet.size > 0) {
    const parentObjectIds = [...filterIdSet].map((id) => new Types.ObjectId(id))

    const allOptions = await Filter.find({
      parentId: { $in: parentObjectIds },
      isDeleted: false,
      isActive: true,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean()

    // Group by parentId string for O(1) lookup per field
    for (const opt of allOptions) {
      const key = String(opt.parentId)
      if (!filterOptionsByParent.has(key)) filterOptionsByParent.set(key, [])
      filterOptionsByParent.get(key).push(opt)
    }
  }

  // ── Step 3: Attach filterOptions to each field ─────────────────────────────
  return fields.map((field) => {
    const rawId = field.filterId?._id ?? field.filterId
    const filterOptions =
      isValidFilterId(rawId)
        ? filterOptionsByParent.get(String(rawId)) || []
        : []

    return { ...field, filterOptions }
  })
}

/**
 * Group an enriched fields array by formStep, returning an ordered array of
 * step objects ready for the API response.
 *
 * Steps with no formStep label are placed under 'General'.
 * Steps are ordered numerically when possible ("Step 1" < "Step 2"), else alphabetically.
 *
 * @param {Array} fields — output of fetchFormFields()
 * @returns {{ step: string, fields: Array }[]}
 */
function groupByStep(fields) {
  // Build an insertion-ordered Map: step label → fields[]
  const stepMap = new Map()

  for (const field of fields) {
    const stepKey =
      field.formStep && String(field.formStep).trim()
        ? String(field.formStep).trim()
        : 'General'

    if (!stepMap.has(stepKey)) stepMap.set(stepKey, [])
    stepMap.get(stepKey).push(field)
  }

  // Convert to array and sort step labels
  return [...stepMap.entries()]
    .sort(([a], [b]) => compareSteps(a, b))
    .map(([step, stepFields]) => ({ step, fields: stepFields }))
}

module.exports = { fetchFormFields, groupByStep }
