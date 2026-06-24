function normalizeFileValue(field, value) {
  if (!value) return undefined

  if (field.multiple) {
    if (!Array.isArray(value) || value.length === 0) return undefined
    return value
      .map((f) => (f && typeof f === 'object' && 'name' in f ? f.name : ''))
      .filter(Boolean)
  }

  if (value && typeof value === 'object' && 'name' in value) return value.name
  if (typeof value === 'string') return value
  return undefined
}

function shouldIncludeText(value) {
  return typeof value === 'string' ? value.trim() !== '' : value !== null && value !== undefined
}

export function buildPostAdPayload(categoryId, fields, formData) {
  const data = {}
  const src = formData || {}

  if (!Array.isArray(fields)) {
    return { category: categoryId, data }
  }

  for (const field of fields) {
    const rawValue = src?.[field.name]

    switch (field.type) {
      case 'number': {
        if (rawValue === '' || rawValue === null || rawValue === undefined) break
        const num = Number(rawValue)
        if (!Number.isNaN(num)) data[field.name] = num
        break
      }
      case 'checkbox': {
        // For checkboxes, we keep the boolean value even if false.
        data[field.name] = rawValue === true
        break
      }
      case 'file': {
        const normalized = normalizeFileValue(field, rawValue)
        if (normalized !== undefined) data[field.name] = normalized
        break
      }
      case 'select':
      case 'radio':
      case 'text':
      default: {
        if (!shouldIncludeText(rawValue)) break
        data[field.name] = rawValue
        break
      }
    }
  }

  return {
    category: categoryId,
    data
  }
}

