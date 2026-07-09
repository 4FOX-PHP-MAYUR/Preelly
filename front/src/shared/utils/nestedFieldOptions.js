// Some category-sourced dynamic-form fields (tableName "categories") return a nested
// tree in `options`, e.g. a "Make & Model" field: [{ value, label, children: [{ value,
// label, children: [...trims] }] }]. These helpers work with that tree client-side —
// no extra network round-trip needed to read data that's already in the payload.

export function hasNestedOptions(field) {
  return Array.isArray(field?.options) && field.options.some((opt) => Array.isArray(opt?.children))
}

/**
 * Strips a nested tree down to its first level (e.g. just the Makes, not their Model
 * children) as a plain { value, label } list, for rendering as a single flat dropdown
 * instead of a multi-level cascade.
 */
export function flattenTopLevelOptions(options) {
  if (!Array.isArray(options)) return []
  return options.map(({ value, label }) => ({ value, label }))
}

/**
 * Derives a likely target fieldName from a functionName by convention, e.g.
 * "getTrimByID" -> "trim". Used when a field's own record doesn't declare an
 * explicit functionForField target.
 */
export function deriveFunctionTargetFieldName(functionName) {
  return String(functionName || '')
    .replace(/^get/i, '')
    .replace(/by\s*id$/i, '')
    .trim()
    .toLowerCase()
}
