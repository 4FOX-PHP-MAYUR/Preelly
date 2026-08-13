import { categoryService } from '@shared/services/api'
import { buildCategoryFilterGroups } from '@shared/utils/buildCategoryFilterGroups'

/**
 * Shared model for the admin-configured category filters (`filters` collection,
 * served by GET /api/category-filters). Used by both the hierarchical search
 * page and the product-listing filter sidebar so the two always agree on which
 * filters exist for a category and how each one is rendered.
 */

/** Field kinds a filter can be rendered as. `chips` is the default look. */
export const FILTER_FIELD_KIND = {
  CHIPS: 'chips',
  DROPDOWN: 'dropdown',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
}

/** Field kinds whose value is a free-form string rather than a filter id. */
export const FREE_FORM_FIELD_KINDS = new Set([
  FILTER_FIELD_KIND.TEXT,
  FILTER_FIELD_KIND.NUMBER,
  FILTER_FIELD_KIND.DATE,
])

const FIELD_KIND_ALIASES = {
  dropdown: FILTER_FIELD_KIND.DROPDOWN,
  select: FILTER_FIELD_KIND.DROPDOWN,
  singleselect: FILTER_FIELD_KIND.DROPDOWN,
  radio: FILTER_FIELD_KIND.RADIO,
  radiobutton: FILTER_FIELD_KIND.RADIO,
  checkbox: FILTER_FIELD_KIND.CHECKBOX,
  multiselect: FILTER_FIELD_KIND.CHECKBOX,
  multicheckbox: FILTER_FIELD_KIND.CHECKBOX,
  chips: FILTER_FIELD_KIND.CHIPS,
  pill: FILTER_FIELD_KIND.CHIPS,
  text: FILTER_FIELD_KIND.TEXT,
  string: FILTER_FIELD_KIND.TEXT,
  textbox: FILTER_FIELD_KIND.TEXT,
  textfield: FILTER_FIELD_KIND.TEXT,
  number: FILTER_FIELD_KIND.NUMBER,
  numeric: FILTER_FIELD_KIND.NUMBER,
  integer: FILTER_FIELD_KIND.NUMBER,
  date: FILTER_FIELD_KIND.DATE,
  datepicker: FILTER_FIELD_KIND.DATE,
  datetime: FILTER_FIELD_KIND.DATE,
}

/**
 * Resolve a filter's admin-configured `filterType` to a field kind.
 * Filters without a configured type fall back to chips (multi-select) when they
 * have options, matching how the listing sidebar has always rendered them.
 */
export function resolveFilterFieldKind(filter, hasOptions) {
  const raw = String(filter?.filterType || '').trim().toLowerCase().replace(/[\s_-]/g, '')
  const mapped = FIELD_KIND_ALIASES[raw]
  if (mapped) return mapped
  return hasOptions ? FILTER_FIELD_KIND.CHIPS : FILTER_FIELD_KIND.TEXT
}

/** Filters are optional unless the admin configuration marks them required. */
function isFilterRequired(filter) {
  return Boolean(filter?.isRequired ?? filter?.required)
}

/** Case/space-insensitive key used to spot the same filter configured twice. */
function fieldMergeKey(field) {
  return String(field?.name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function optionMergeKey(option) {
  return String(option?.label ?? option?.value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Collapse filters that are the same thing configured more than once.
 *
 * Admins assign filters per subcategory, so a category-level page (no subcategory
 * chosen) gets one document per subcategory — e.g. Automotive returns three
 * "Regional Specs" and five "Year" filters, which rendered as three and five
 * identically-titled chip groups. They are indistinguishable to the user, so they
 * are merged by name here, with options unioned by label.
 *
 * Each merged option keeps every underlying filter id in `filterIds`, because a
 * product is tagged with the id belonging to ITS subcategory's copy. Selecting
 * "GCC" therefore has to send all three GCC ids; the API matches them with
 * `selectedFilters: { $in: … }`, so any one of them qualifies. Dropping the
 * others would silently hide listings from the other subcategories.
 */
function mergeDuplicateFields(fields) {
  const merged = new Map()

  for (const field of fields) {
    const key = fieldMergeKey(field)
    if (!key) continue

    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, {
        ...field,
        options: (field.options || []).map((opt) => ({
          ...opt,
          filterIds: [String(opt.filterId || opt.value)],
        })),
      })
      continue
    }

    // Union this copy's options into the group kept for that name.
    const byOption = new Map(existing.options.map((opt) => [optionMergeKey(opt), opt]))
    for (const opt of field.options || []) {
      const optKey = optionMergeKey(opt)
      const id = String(opt.filterId || opt.value)
      const seen = byOption.get(optKey)
      if (seen) {
        if (!seen.filterIds.includes(id)) seen.filterIds.push(id)
      } else {
        const added = { ...opt, filterIds: [id] }
        byOption.set(optKey, added)
        existing.options.push(added)
      }
    }
  }

  return [...merged.values()]
}

/**
 * Turn the flat filter list from the API into renderable fields:
 * `{ id, name, kind, required, options: [{ value, label, filterId, filterIds }] }`.
 * Grouping (parent filter -> child filters / explicit options) is reused from
 * buildCategoryFilterGroups so the search page and the sidebar stay in sync.
 * Filters configured once per subcategory are merged — see mergeDuplicateFields.
 */
export function buildCategoryFilterFields(filters) {
  const list = Array.isArray(filters) ? filters : []
  const groups = buildCategoryFilterGroups(list)
  const grouped = new Set(groups.map((g) => String(g.root._id)))

  const fromGroups = groups.map((group) => ({
    id: String(group.root._id),
    name: group.root.name,
    slug: group.root.slug || String(group.root._id),
    kind: resolveFilterFieldKind(group.root, true),
    required: isFilterRequired(group.root),
    options: group.options,
  }))

  // Root filters with no options at all are only renderable as a free-form
  // input, and only when the admin configured a field type for them.
  const fromTypedRoots = list
    .filter((f) => !f.parentId && !grouped.has(String(f._id)) && f.filterType)
    .map((f) => ({
      id: String(f._id),
      name: f.name,
      slug: f.slug || String(f._id),
      kind: resolveFilterFieldKind(f, false),
      required: isFilterRequired(f),
      options: [],
    }))
    .filter((field) => FREE_FORM_FIELD_KINDS.has(field.kind))

  return mergeDuplicateFields([...fromGroups, ...fromTypedRoots])
}

/**
 * Map a category path (root → leaf) onto the level params the
 * /api/category-filters endpoint understands.
 */
export function buildFilterLevelsFromPath(pathIds) {
  const path = (pathIds || []).map(String).filter(Boolean)
  if (!path.length) return null
  const levels = { categoryId: path[0] }
  if (path.length >= 2) levels.subcategoryId = path[1]
  if (path.length >= 3) levels.childCategoryId = path[path.length - 1]
  return levels
}

/**
 * Fetch the filters assigned to the final (leaf) category.
 *
 * Filters are assigned at whichever level the admin configured them on — a deep
 * leaf such as Motors > New Cars > Toyota > Land Cruiser > 4.0L usually has
 * none of its own while its ancestors do. So the deepest scope is tried first
 * and the path is walked upwards until a scope returns filters.
 *
 * @returns {Promise<{ filters: Array, scopePath: string[] }>}
 */
export async function fetchCategoryFiltersForPath(pathIds, config) {
  const path = (pathIds || []).map(String).filter(Boolean)
  if (!path.length) return { filters: [], scopePath: [] }

  for (let depth = path.length; depth >= 1; depth -= 1) {
    const scopePath = path.slice(0, depth)
    const levels = buildFilterLevelsFromPath(scopePath)
    const res = await categoryService.getCategoryFilters(levels, config)
    const filters = Array.isArray(res?.data?.filters) ? res.data.filters : []
    if (filters.length) return { filters, scopePath }
  }

  return { filters: [], scopePath: [] }
}
