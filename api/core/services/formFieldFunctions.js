/**
 * Registry of named server-side functions that admin-configured FormFields can invoke
 * to compute their own options from other fields' current values.
 *
 * A FormField carries two admin-authored properties for this:
 *   - functionName: which function to call (must be registered below)
 *   - functionForField: a comma/pipe-delimited list of the *other* fieldNames this
 *     field depends on (e.g. "make,model") — the frontend re-calls the function with
 *     their current values whenever any of them changes.
 *
 * Add a new function by adding one entry to FIELD_FUNCTIONS. Each handler receives the
 * current values of the dependency fields (keyed by fieldName) and must resolve to an
 * options array: [{ value, label, slug? }].
 */
const { Types } = require('mongoose')
const Filter = require('../../models/Filter')

/**
 * getTrimByID — no dedicated Trim data source exists in this codebase yet. As a
 * reasonable default consistent with how the rest of the app models cascading
 * selections, this treats the *last* provided dependency value (typically the
 * selected Model) as a Filter _id and returns its children as trim options.
 * Swap this out once a real trim data source is defined.
 */
async function getTrimByID({ params }) {
  const values = Object.values(params || {}).filter(Boolean)
  const parentId = values[values.length - 1]
  if (!parentId || !Types.ObjectId.isValid(String(parentId))) return []

  const children = await Filter.find({ parentId, isActive: true, isDeleted: false })
    .select('_id name slug sortOrder')
    .sort({ sortOrder: 1, name: 1 })
    .lean()

  return children.map((c) => ({ value: String(c._id), label: c.name, slug: c.slug || '' }))
}

const FIELD_FUNCTIONS = {
  getTrimByID,
}

function hasFieldFunction(name) {
  return Object.prototype.hasOwnProperty.call(FIELD_FUNCTIONS, String(name || ''))
}

async function callFieldFunction(name, params) {
  const fn = FIELD_FUNCTIONS[name]
  if (!fn) return null
  const result = await fn({ params: params || {} })
  return Array.isArray(result) ? result : []
}

module.exports = {
  FIELD_FUNCTIONS,
  hasFieldFunction,
  callFieldFunction,
}
