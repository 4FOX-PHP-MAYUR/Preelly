export function resolveFieldOptions(field, formData) {
  if (!field) return []
  if (field.type !== 'select' && field.type !== 'radio') return []

  const { options } = field
  if (!options) return []

  // Simple static list: options: ["A", "B"]
  if (Array.isArray(options)) return options

  // Dependent options:
  // options: { dependsOn: "brand", values: { "Toyota": ["Innova"] }, default: ["Other"] }
  if (typeof options === 'object' && options.dependsOn && options.values) {
    const dependsOnValue = formData?.[options.dependsOn]
    const resolved = options.values?.[dependsOnValue]
    if (Array.isArray(resolved)) return resolved

    const fallback = options.default
    return Array.isArray(fallback) ? fallback : []
  }

  return []
}

