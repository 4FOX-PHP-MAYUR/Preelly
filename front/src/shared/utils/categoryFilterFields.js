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

/**
 * Turn the flat filter list from the API into renderable fields:
 * `{ id, name, kind, required, options: [{ value, label, filterId }] }`.
 * Grouping (parent filter -> child filters / explicit options) is reused from
 * buildCategoryFilterGroups so the search page and the sidebar stay in sync.
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

  return [...fromGroups, ...fromTypedRoots]
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
