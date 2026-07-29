import { hasFieldFunction } from './dynamicFormFieldFunction'
import { hasNestedOptions } from './nestedFieldOptions'
import { firstValue, isEmptyValue } from './dynamicFormCascade'

/**
 * FormField scoping is a 3-level category chain:
 *   categoryId -> categoryFilterId (child of categoryId) -> childCategoryId
 * Admin-configured fields can be attached to any level, and the deeper levels are
 * only fetched once the seller has picked the category that identifies them.
 *
 * A field represents descending that chain when its options come from the Category
 * collection AND it is a plain single-level picker. Nested-tree fields (Make &
 * Model) and cascade sources (anything with a functionName) are excluded: their
 * tableName "categories" only sources their own options, it does not mean the
 * seller moved deeper in the FormField scope.
 */
const CATEGORY_SOURCED_TABLES = new Set(['categories', 'category'])

export function isScopePickerField(field) {
  if (!CATEGORY_SOURCED_TABLES.has(String(field?.tableName || '').trim().toLowerCase())) return false
  return !hasNestedOptions(field) && !hasFieldFunction(field)
}

export function scopeValueOf(value) {
  const raw = firstValue(value)
  return raw ? String(raw) : null
}

/**
 * The scope implied by values that are already set — used when a saved product or
 * draft is loaded, since those values never passed through the interactive setter
 * that widens the scope. Fields are read in definition order (formStep, then
 * fieldOrder, as the API returns them): the first scope picker with a value fills
 * `categoryFilterId`, the next fills `childCategoryId`.
 *
 * @returns {{ categoryFilterId: string|null, childCategoryId: string|null }}
 */
export function deriveScopeFromValues({ allFields, values }) {
  const picked = []
  ;(allFields || []).forEach((field) => {
    if (!isScopePickerField(field)) return
    const value = values?.[field.fieldName]
    if (isEmptyValue(value)) return
    const scopeValue = scopeValueOf(value)
    if (scopeValue) picked.push(scopeValue)
  })

  return {
    categoryFilterId: picked[0] || null,
    childCategoryId: picked[1] || null,
  }
}
