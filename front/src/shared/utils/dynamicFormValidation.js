// Generic validator for admin-configured FormField.validation strings, which use
// Laravel-style pipe rules, e.g. "required|min:2|max:100|email" (see admin
// FormFieldFormPage "Validation Rules" field for the authoring convention).
//
// To support a new rule: add one entry to RULE_VALIDATORS. Nothing else needs to change —
// parseValidationRules/validateFieldValue are fully data-driven off that map.

export function parseValidationRules(validationString) {
  return String(validationString || '')
    .split('|')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const [name, param] = rule.split(':')
      return { name: (name || '').trim().toLowerCase(), param: param !== undefined ? param.trim() : undefined }
    })
}

export function isFieldRequired(field) {
  return parseValidationRules(field?.validation).some((rule) => rule.name === 'required')
}

export function isEmptyValue(value) {
  if (value === undefined || value === null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'string') return value.trim() === ''
  return false
}

export function hasValue(value) {
  return !isEmptyValue(value)
}

const RULE_VALIDATORS = {
  required: (value) => (isEmptyValue(value) ? 'This field is required.' : null),
  email: (value) => {
    if (isEmptyValue(value)) return null
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? null : 'Enter a valid email address.'
  },
  numeric: (value) => {
    if (isEmptyValue(value)) return null
    return Number.isNaN(Number(value)) ? 'Enter a valid number.' : null
  },
  url: (value) => {
    if (isEmptyValue(value)) return null
    try {
      // eslint-disable-next-line no-new
      new URL(String(value))
      return null
    } catch {
      return 'Enter a valid URL.'
    }
  },
  min: (value, param) => {
    if (isEmptyValue(value)) return null
    const limit = Number(param)
    if (Number.isNaN(limit)) return null
    if (Array.isArray(value)) return value.length >= limit ? null : `Select at least ${limit}.`
    if (typeof value === 'string' && Number.isNaN(Number(value))) {
      return value.length >= limit ? null : `Must be at least ${limit} characters.`
    }
    return Number(value) >= limit ? null : `Must be at least ${limit}.`
  },
  max: (value, param) => {
    if (isEmptyValue(value)) return null
    const limit = Number(param)
    if (Number.isNaN(limit)) return null
    if (Array.isArray(value)) return value.length <= limit ? null : `Select at most ${limit}.`
    if (typeof value === 'string' && Number.isNaN(Number(value))) {
      return value.length <= limit ? null : `Must be at most ${limit} characters.`
    }
    return Number(value) <= limit ? null : `Must be at most ${limit}.`
  },
}

export function validateFieldValue(field, value) {
  const rules = parseValidationRules(field?.validation)
  for (const rule of rules) {
    const validator = RULE_VALIDATORS[rule.name]
    if (!validator) continue
    const message = validator(value, rule.param)
    if (message) return message
  }
  return null
}
