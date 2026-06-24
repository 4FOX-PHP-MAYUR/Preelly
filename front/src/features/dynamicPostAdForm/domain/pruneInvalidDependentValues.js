import { getDefaultValueForField } from './getDefaultValueForField'
import { resolveFieldOptions } from './resolveFieldOptions'

export function pruneInvalidDependentValues(fields, formData) {
  const next = { ...(formData || {}) }

  if (!Array.isArray(fields)) return next

  for (const field of fields) {
    if (!field) continue
    if (field.type !== 'select' && field.type !== 'radio') continue

    const hasDependentOptions =
      field.options &&
      typeof field.options === 'object' &&
      !Array.isArray(field.options) &&
      field.options.dependsOn &&
      field.options.values

    if (!hasDependentOptions) continue

    const allowed = resolveFieldOptions(field, next)
    const currentValue = next?.[field.name]
    if (currentValue === '' || currentValue === null || currentValue === undefined) continue

    if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(currentValue)) {
      next[field.name] = getDefaultValueForField(field)
    }

    if (Array.isArray(allowed) && allowed.length === 0) {
      next[field.name] = getDefaultValueForField(field)
    }
  }

  return next
}

