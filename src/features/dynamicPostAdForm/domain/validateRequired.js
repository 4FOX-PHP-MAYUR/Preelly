export function validateRequired(fields, formData) {
  const nextErrors = {}
  const data = formData || {}

  if (!Array.isArray(fields)) return nextErrors

  for (const field of fields) {
    if (!field?.required) continue

    const value = data?.[field.name]
    const isEmptyString = typeof value === 'string' && value.trim() === ''

    let missing = false
    switch (field.type) {
      case 'checkbox':
        missing = value !== true
        break
      case 'file':
        if (field.multiple) missing = !Array.isArray(value) || value.length === 0
        else missing = !value
        break
      case 'number':
        if (value === '' || value === null || value === undefined) {
          missing = true
        } else {
          missing = Number.isNaN(Number(value))
        }
        break
      case 'radio':
      case 'select':
      case 'text':
      default:
        missing = isEmptyString || value === null || value === undefined
        break
    }

    if (missing) {
      nextErrors[field.name] = {
        message: `${field.label || field.name} is required`
      }
    }
  }

  return nextErrors
}

