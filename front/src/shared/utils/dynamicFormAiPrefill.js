/**
 * Generic, category-agnostic auto-fill for the dynamic post-ad form.
 *
 * The video transcription already extracts a listing's details (make, model, year,
 * mileage, body type, colour, condition, …) into several shapes. This module maps
 * those extracted values onto whatever admin-configured fields a category's dynamic
 * form happens to have — matching by field name/title (with synonyms) and resolving
 * free text to the matching dropdown option id. It never invents field mappings per
 * category, so it works for every category's form, not just vehicles.
 *
 * It only ever fills EMPTY fields, and returns undefined when it can't confidently
 * resolve a value — so it never clobbers a user's own input.
 */
import { FIELD_KIND, getFieldKind } from './dynamicFormFieldKind'

/** lowercase, strip everything but a-z0-9 — so "Body Type", "body_type", "bodyType" all collapse. */
export function norm(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Field token (normalized fieldName/fieldTitle) → candidate signal keys to look up.
// Dynamic field names often end in "id" (modelid, bodytypeid) — that's stripped first.
const FIELD_SYNONYMS = {
  model: ['model', 'makemodel', 'make', 'brand', 'variant'],
  makemodel: ['model', 'make', 'brand'],
  make: ['make', 'brand'],
  brand: ['brand', 'make'],
  // In this app's Motors setup, "Make & Model" lists makes and "Trim" lists the
  // models under the chosen make — so trim should also consider the model signal.
  trim: ['trim', 'variant', 'grade', 'model'],
  variant: ['variant', 'trim', 'model'],
  year: ['year', 'modelyear', 'manufactureyear'],
  regionalspecs: ['region', 'regionalspecs', 'specs', 'targetmarket'],
  region: ['region', 'regionalspecs', 'targetmarket'],
  bodytype: ['bodytype', 'body'],
  fueltype: ['fueltype', 'fuel'],
  transmission: ['transmission', 'transmissiontype', 'gearbox'],
  transmissiontype: ['transmission', 'transmissiontype'],
  kilometers: ['kilometers', 'mileage', 'mileagekm', 'odometer', 'kms', 'km'],
  mileage: ['mileage', 'kilometers', 'mileagekm'],
  doors: ['doors', 'numberofdoors'],
  numberofcylender: ['cylinders', 'numberofcylinders', 'cylinder'],
  cylinders: ['cylinders', 'numberofcylinders'],
  seats: ['seatingcapacity', 'seats', 'seat'],
  seat: ['seatingcapacity', 'seats'],
  seatingcapacity: ['seatingcapacity', 'seats'],
  exteriorcolor: ['exteriorcolor', 'color', 'colour', 'extcolor'],
  interiorcolor: ['interiorcolor', 'intcolor'],
  color: ['color', 'colour', 'exteriorcolor'],
  horsepower: ['horsepower', 'power', 'bhp', 'hp'],
  enginecapacity: ['enginecapacity', 'engine', 'enginecc', 'displacement', 'enginesize'],
  warranty: ['warranty'],
  steeringside: ['steeringside', 'steering'],
  sellertype: ['sellertype', 'seller'],
  condition: ['condition'],
  price: ['price', 'amount', 'productprice'],
  isinsured: ['insured', 'isinsured', 'insurance'],
  city: ['city', 'emirate', 'locationcity'],
  emirate: ['emirate', 'city', 'location'],
  material: ['material'],
  size: ['size'],
  storage: ['storage', 'storagecapacity'],
  ram: ['ram', 'memory'],
}

/** Recursively flattens an object of AI signals into a normalized `{ key: value }` map. */
function collectInto(map, source, depth = 0) {
  if (!source || typeof source !== 'object' || depth > 3) return
  Object.entries(source).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    if (Array.isArray(value)) return
    if (typeof value === 'object') {
      // A resolved-filter shape like { id, value } — index its display value under the key.
      if (value.value !== undefined && (typeof value.value === 'string' || typeof value.value === 'number')) {
        const k = norm(key)
        if (k && map[k] === undefined) map[k] = value.value
      }
      collectInto(map, value, depth + 1)
      return
    }
    const k = norm(key)
    if (k && map[k] === undefined) map[k] = value
  })
}

/**
 * Merges every AI/transcript source into one normalized lookup map.
 * @param {Array<object>} sources
 */
export function buildAiSignalMap(sources = []) {
  const map = {}
  sources.filter(Boolean).forEach((src) => collectInto(map, src))
  return map
}

/** Candidate signal keys for a field, most specific first. */
function candidateKeys(field) {
  const nameToken = norm(field.fieldName).replace(/id$/, '')
  const titleToken = norm(field.fieldTitle)
  const tokens = [nameToken, titleToken].filter(Boolean)
  const keys = []
  tokens.forEach((t) => {
    if (!keys.includes(t)) keys.push(t)
    ;(FIELD_SYNONYMS[t] || []).forEach((syn) => { if (!keys.includes(syn)) keys.push(syn) })
  })
  return keys
}

/** All present signal values for a field, in candidate-key priority order. */
function candidateSignals(field, signalMap) {
  const out = []
  for (const key of candidateKeys(field)) {
    const v = signalMap[key]
    if (v !== undefined && v !== null && v !== '') out.push(v)
  }
  return out
}

/**
 * Finds the option whose label matches `text`. Matches only the given options array
 * (its top level) — nested "Make & Model" fields render just their top level, so a
 * deep child match would return an unselectable value.
 */
function matchOption(options, text) {
  if (!Array.isArray(options)) return undefined
  const target = norm(text)
  if (!target) return undefined

  // Pass 1: exact normalized label (or value) match.
  const exact = options.find((opt) => norm(opt.label) === target || norm(opt.value) === target)
  if (exact) return exact

  // Pass 2: contains, only for specific-enough strings (avoid trivial matches).
  if (target.length < 2) return undefined
  return options.find((opt) => {
    const lbl = norm(opt.label)
    return lbl && (lbl.includes(target) || target.includes(lbl))
  })
}

/**
 * Resolves the value to set for a field from the AI signal map, or undefined if it
 * can't be confidently determined.
 * @returns {{ value: any } | undefined}  wrapped so a legitimately falsy value (e.g. 0) is distinguishable from "no match"
 */
export function resolveFieldPrefillValue(field, signalMap) {
  const kind = getFieldKind(field.fieldType)
  if (kind === FIELD_KIND.FILE || kind === FIELD_KIND.DATE) return undefined

  const signals = candidateSignals(field, signalMap)
  if (signals.length === 0) return undefined

  const hasOptions = Array.isArray(field.options) && field.options.length > 0

  // Option-backed fields (dropdown / radio / checkbox): try each candidate signal
  // against the options and take the first that resolves. This handles a "Make &
  // Model" dropdown that lists makes: the model signal won't match, but the make will.
  if (hasOptions) {
    for (const signal of signals) {
      const opt = matchOption(field.options, signal)
      if (opt) return { value: kind === FIELD_KIND.CHECKBOX ? [opt.value] : opt.value }
    }
    return undefined
  }

  const signal = signals[0]

  // Number fields: keep digits (and a decimal point) only.
  if (kind === FIELD_KIND.NUMBER) {
    const numeric = String(signal).replace(/[^0-9.]/g, '')
    if (!numeric) return undefined
    return { value: numeric }
  }

  // Free text / textarea: use the value as-is.
  if (kind === FIELD_KIND.TEXT || kind === FIELD_KIND.TEXTAREA) {
    return { value: String(signal) }
  }

  return undefined
}

/** True when a field currently holds no value. */
export function isFieldEmpty(value) {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  return false
}
