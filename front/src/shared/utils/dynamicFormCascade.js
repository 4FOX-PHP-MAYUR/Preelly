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
 * Nested-tree sources that feed a dependent dropdown by convention rather than by an
 * admin-configured functionName: `brandid`'s options already carry each brand's models
 * in `children`, which are exactly the `modelid` dropdown's options. Only applies when
 * the source really is a nested tree — a flat `brandid` (tableName "filters") keeps
 * whatever the form fetch resolved for `modelid`.
 */
const NESTED_CASCADE_TARGETS = { brandid: 'modelid' }

/** The fieldName `sourceField` feeds, or null when it drives no cascade. */
function resolveCascadeTargetName(sourceField) {
  if (hasFieldFunction(sourceField)) {
    const declared = parseFunctionForFieldNames(sourceField.functionForField)[0]
    return declared || deriveFunctionTargetFieldName(sourceField.functionName)
  }
  if (!hasNestedOptions(sourceField)) return null
  return NESTED_CASCADE_TARGETS[String(sourceField.fieldName || '').toLowerCase()] || null
}

/**
 * The field `sourceField` feeds. For a functionName-driven field that's whatever
 * `functionForField` declares, else it's derived from the function's own name
 * ("getTrimByID" -> "trim"); for a nested tree without a functionName it's the
 * conventional pairing above (brandid -> modelid).
 */
export function findCascadeTargetField(sourceField, allFields) {
  const targetName = resolveCascadeTargetName(sourceField)
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
    const targetField = findCascadeTargetField(sourceField, allFields)
    if (!targetField) return
    // Already resolved (or in flight) — leave it alone.
    if (computedOptions?.[targetField.fieldName] !== undefined) return

    const value = values?.[sourceField.fieldName]
    const nestedOptions = nestedCascadeOptions(sourceField, value)
    // A nested source with nothing picked still resolves — to no options — so the
    // dependent dropdown shows its placeholder rather than a list that belongs to no
    // selection. A server-computed cascade has nothing to call yet, so it waits.
    if (isEmptyValue(value) && !nestedOptions) return

    pending.push({ sourceField, targetField, value, nestedOptions })
  })
  return pending
}
