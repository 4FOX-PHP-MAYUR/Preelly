import { hasNestedOptions } from './nestedFieldOptions'

/** Resolves a stored option value (id) to its admin-configured label, for display. */
export function resolveOptionLabel(options, rawValue) {
  if (!Array.isArray(options) || rawValue === undefined || rawValue === null || rawValue === '') return ''
  const match = options.find((opt) => String(opt.value) === String(rawValue))
  return match?.label ?? ''
}

/**
 * Turns a field's raw stored value into a display-ready string (or array of strings for
 * checkbox/multi-value fields). Falls back to the raw value when no matching option label
 * is found (e.g. free-text fields).
 */
export function resolveFieldDisplayValue(field, value, computedOptions) {
  if (value === undefined || value === null || value === '') return Array.isArray(value) ? [] : ''
  const options = computedOptions !== undefined ? computedOptions : hasNestedOptions(field) ? [] : field.options

  if (Array.isArray(value)) {
    return value.map((v) => resolveOptionLabel(options, v) || String(v)).filter(Boolean)
  }
  const label = resolveOptionLabel(options, value)
  return label || String(value)
}
