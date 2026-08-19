// Generic validator for admin-configured FormField.validation strings, which use
// Laravel-style pipe rules, e.g. "required|min:2|max:100|email" (see admin
// FormFieldFormPage "Validation Rules" field for the authoring convention).
//
// To support a new rule: add one entry to RULE_VALIDATORS. Nothing else needs to change —
// parseValidationRules/validateFieldValue are fully data-driven off that map.
//
// SIZE RULES — `min`/`max` measure LENGTH, always.
// Every dynamic form field posts a string, so "max:10" on a phone number has to
// mean ten characters. It previously switched to a numeric comparison whenever
// the value happened to parse as a number, which made "max:10" reject a valid
// 10-digit phone number with "Must be at most 10." — the value 8899999999 is
// indeed greater than 10, but that was never what the rule author meant.
// Use `min_value`/`max_value` when you actually want to bound the number.

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

/** Character count for scalars, item count for multi-selects. */
function sizeOf(value) {
  return Array.isArray(value) ? value.length : String(value).length
}

const DIGITS_ONLY = /^\d+$/

const RULE_VALIDATORS = {
  required: (value) => (isEmptyValue(value) ? 'This field is required.' : null),

  // Authored on 14 live fields purely as documentation that the field is not
  // required. Registered as an explicit no-op so it does not trip the
  // unknown-rule warning below.
  optional: () => null,

  email: (value) => {
    if (isEmptyValue(value)) return null
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? null : 'Enter a valid email address.'
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

  numeric: (value) => {
    if (isEmptyValue(value)) return null
    return Number.isNaN(Number(value)) ? 'Enter a valid number.' : null
  },

  integer: (value) => {
    if (isEmptyValue(value)) return null
    return Number.isInteger(Number(value)) ? null : 'Enter a whole number.'
  },

  // Exactly N digits — the right rule for phone numbers, OTPs and PIN codes.
  // Stricter than numeric: rejects "1e9", "-5" and "12.5", which all parse as
  // numbers but are not what a digit-count field means.
  digits: (value, param) => {
    if (isEmptyValue(value)) return null
    const count = Number(param)
    if (Number.isNaN(count)) return null
    const str = String(value)
    if (!DIGITS_ONLY.test(str)) return 'Enter digits only.'
    return str.length === count ? null : `Must be exactly ${count} digits.`
  },

  digits_between: (value, param) => {
    if (isEmptyValue(value)) return null
    const [lo, hi] = String(param || '').split(',').map((n) => Number(n.trim()))
    if (Number.isNaN(lo) || Number.isNaN(hi)) return null
    const str = String(value)
    if (!DIGITS_ONLY.test(str)) return 'Enter digits only.'
    return str.length >= lo && str.length <= hi ? null : `Must be between ${lo} and ${hi} digits.`
  },

  min: (value, param) => {
    if (isEmptyValue(value)) return null
    const limit = Number(param)
    if (Number.isNaN(limit)) return null
    if (Array.isArray(value)) return value.length >= limit ? null : `Select at least ${limit}.`
    return sizeOf(value) >= limit ? null : `Must be at least ${limit} characters.`
  },

  max: (value, param) => {
    if (isEmptyValue(value)) return null
    const limit = Number(param)
    if (Number.isNaN(limit)) return null
    if (Array.isArray(value)) return value.length <= limit ? null : `Select at most ${limit}.`
    return sizeOf(value) <= limit ? null : `Must be at most ${limit} characters.`
  },

  // Numeric bounds, opt-in and unambiguous — the behaviour `max` used to guess at.
  min_value: (value, param) => {
    if (isEmptyValue(value)) return null
    const limit = Number(param)
    if (Number.isNaN(limit)) return null
    const num = Number(value)
    if (Number.isNaN(num)) return 'Enter a valid number.'
    return num >= limit ? null : `Must be at least ${limit}.`
  },

  max_value: (value, param) => {
    if (isEmptyValue(value)) return null
    const limit = Number(param)
    if (Number.isNaN(limit)) return null
    const num = Number(value)
    if (Number.isNaN(num)) return 'Enter a valid number.'
    return num <= limit ? null : `Must be at most ${limit}.`
  },
}

// Admin-authored aliases. `number` is what rule authors reach for; without this
// it parses cleanly, matches nothing, and silently validates nothing at all.
RULE_VALIDATORS.number = RULE_VALIDATORS.numeric
RULE_VALIDATORS.int = RULE_VALIDATORS.integer

const warnedUnknownRules = new Set()

/**
 * Surfaces a misspelled rule instead of ignoring it. A typo like "numbber"
 * previously made the whole rule a no-op, so the field looked validated in the
 * admin UI while accepting anything — the failure mode is silence, which is why
 * this warns rather than staying quiet.
 */
function warnUnknownRule(name, field) {
  if (!import.meta.env?.DEV) return
  const key = `${name}:${field?.name || field?.label || '?'}`
  if (warnedUnknownRules.has(key)) return
  warnedUnknownRules.add(key)
  console.warn(
    `[dynamicFormValidation] Unknown rule "${name}" on field "${field?.label || field?.name || '?'}" — ` +
    `ignored. Known rules: ${Object.keys(RULE_VALIDATORS).sort().join(', ')}`
  )
}

export function validateFieldValue(field, value) {
  const rules = parseValidationRules(field?.validation)
  for (const rule of rules) {
    const validator = RULE_VALIDATORS[rule.name]
    if (!validator) {
      warnUnknownRule(rule.name, field)
      continue
    }
    const message = validator(value, rule.param)
    if (message) return message
  }
  return null
}
