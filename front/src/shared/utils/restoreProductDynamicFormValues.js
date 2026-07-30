import { FIELD_KIND, getFieldKind } from './dynamicFormFieldKind'

/**
 * Rebuilds the dynamicForm slice's values for an existing product being edited.
 *
 * On submit, each admin-configured field is written to the product under its own
 * `fieldName` (multi-select values comma-joined), and checkbox fields are ALSO
 * grouped into `features: [{ title, values }]` — see the submit path in
 * PostAdPage. This reverses that so the Summary/Basic Details steps show what the
 * seller actually saved.
 *
 * The backend lowercases incoming keys (productVehicleFields aliasing), so the
 * product is indexed case-insensitively before matching — across both top-level
 * paths and `additionalFields`.
 *
 * @param {object} product the loaded product
 * @param {Array<{ fieldName: string, fieldTitle?: string, fieldType?: string }>} fields
 * @returns {Record<string, string|string[]>} values keyed by fieldName
 */
/**
 * GET /api/products/:id serves `features` as a display presentation — same
 * `{ title, values }` shape, but `values` holds human labels ("4 Wheel Drive")
 * instead of the Filter ids the form stores. Restoring those labels verbatim gave
 * the right selection COUNT while no pill matched, since a pill compares against
 * its option's id. Translate anything that isn't already an option value.
 */
function toOptionValues(field, values) {
  const options = Array.isArray(field.options) ? field.options : []
  if (!options.length) return values.map(String)

  const valueSet = new Set(options.map((o) => String(o.value)))
  const idByLabel = new Map(
    options.map((o) => [String(o.label ?? '').trim().toLowerCase(), String(o.value)]),
  )

  return values.map((raw) => {
    const value = String(raw)
    if (valueSet.has(value)) return value
    return idByLabel.get(value.trim().toLowerCase()) || value
  })
}

export function restoreProductDynamicFormValues(product, fields) {
  if (!product || !Array.isArray(fields) || !fields.length) return {}

  // A field's value lands in one of two places depending on whether its
  // `fieldName` happens to be a Product schema path: schema paths are stored
  // top-level, everything else goes into the `additionalFields` map (see the
  // PUT /api/products/:id handler). Most admin-configured names are NOT schema
  // paths, so both have to be read or those fields look empty on edit.
  const byLowerKey = new Map()
  const indexInto = (source) => {
    if (!source) return
    const entries =
      typeof source.entries === 'function' && !Array.isArray(source)
        ? [...source.entries()]
        : Object.entries(source)
    entries.forEach(([key, value]) => {
      const lower = String(key).toLowerCase()
      // Top-level wins: additionalFields is the fallback location.
      if (!byLowerKey.has(lower) || byLowerKey.get(lower) === null || byLowerKey.get(lower) === '') {
        byLowerKey.set(lower, value)
      }
    })
  }
  indexInto(product)
  indexInto(product.additionalFields)

  // Checkbox fields were grouped by their display title, so index those too.
  const featuresByTitle = new Map()
  if (Array.isArray(product.features)) {
    product.features.forEach((group) => {
      if (!group || typeof group !== 'object') return
      const title = String(group.title || '').trim().toLowerCase()
      if (title && Array.isArray(group.values)) featuresByTitle.set(title, group.values)
    })
  }

  const restored = {}

  fields.forEach((field) => {
    const fieldName = field?.fieldName
    if (!fieldName) return

    const isMulti = getFieldKind(field.fieldType) === FIELD_KIND.CHECKBOX

    if (isMulti) {
      const title = String(field.fieldTitle || field.fieldName).trim().toLowerCase()
      const grouped = featuresByTitle.get(title)
      if (Array.isArray(grouped) && grouped.length) {
        restored[fieldName] = toOptionValues(field, grouped)
        return
      }
    }

    const raw = byLowerKey.get(String(fieldName).toLowerCase())
    if (raw === undefined || raw === null || raw === '') return

    if (Array.isArray(raw)) {
      const values = raw.map(String).filter(Boolean)
      if (values.length) restored[fieldName] = isMulti ? values : values[0]
      return
    }

    const text = String(raw)
    if (!text) return
    // Multi-selects were stored comma-joined; single fields keep the raw string.
    restored[fieldName] = isMulti
      ? text.split(',').map((v) => v.trim()).filter(Boolean)
      : text
  })

  return restored
}

export default restoreProductDynamicFormValues
