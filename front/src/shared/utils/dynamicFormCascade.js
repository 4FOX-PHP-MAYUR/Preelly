import { hasFieldFunction, parseFunctionForFieldNames } from './dynamicFormFieldFunction'
import { hasNestedOptions, deriveFunctionTargetFieldName } from './nestedFieldOptions'

/**
 * Cascade helpers for admin-configured fields whose options depend on another
 * field's value (e.g. "Make & Model" -> "Trim" via functionName "getTrimByID").
 *
 * Shared so the same resolution runs whether the value changed because the user
 * picked something, or because a saved product/draft was loaded into the form —
 * without either path re-implementing it.
 */

export function firstValue(value) {
  return Array.isArray(value) ? value[0] : value
}

export function isEmptyValue(value) {
  if (value === undefined || value === null || value === '') return true
  return Array.isArray(value) && value.length === 0
}

/**
 * The field that `sourceField`'s functionName feeds. Declared via
 * `functionForField`, else derived from the function's own name
 * ("getTrimByID" -> "trim").
 */
export function findCascadeTargetField(sourceField, allFields) {
  if (!hasFieldFunction(sourceField)) return null
  const declared = parseFunctionForFieldNames(sourceField.functionForField)[0]
  const targetName = declared || deriveFunctionTargetFieldName(sourceField.functionName)
  if (!targetName) return null
  return (
    (allFields || []).find(
      (f) => String(f.fieldName).toLowerCase() === String(targetName).toLowerCase(),
    ) || null
  )
}

/**
 * For a nested-tree source (options carry `children`), the target's options are
 * the selected node's children — already in the payload, so no network call.
 * Returns null when the source isn't a nested tree.
 */
export function nestedCascadeOptions(sourceField, value) {
  if (!hasNestedOptions(sourceField)) return null
  const selected = (sourceField.options || []).find(
    (opt) => String(opt.value) === String(firstValue(value)),
  )
  return selected?.children || []
}

/**
 * Params for a server-computed cascade: every dependency named by the field's
 * `functionForField`, taken from the current values.
 */
export function buildCascadeParams(dependentField, values) {
  const params = {}
  parseFunctionForFieldNames(dependentField.functionForField).forEach((depName) => {
    const depValue = values?.[depName]
    if (isEmptyValue(depValue)) return
    params[depName] = firstValue(depValue)
  })
  return params
}

/**
 * Fields that already hold a value and drive a cascade whose target has no
 * options resolved yet — i.e. the work that would have happened had the user
 * picked the value by hand. Used to hydrate a loaded product/draft.
 *
 * @returns {Array<{ sourceField: object, targetField: object, value: unknown, nestedOptions: Array|null }>}
 */
export function collectPendingCascades({ allFields, values, computedOptions }) {
  const pending = []
  ;(allFields || []).forEach((sourceField) => {
    if (!hasFieldFunction(sourceField)) return
    const value = values?.[sourceField.fieldName]
    if (isEmptyValue(value)) return

    const targetField = findCascadeTargetField(sourceField, allFields)
    if (!targetField) return
    // Already resolved (or in flight) — leave it alone.
    if (computedOptions?.[targetField.fieldName] !== undefined) return

    pending.push({
      sourceField,
      targetField,
      value,
      nestedOptions: nestedCascadeOptions(sourceField, value),
    })
  })
  return pending
}
