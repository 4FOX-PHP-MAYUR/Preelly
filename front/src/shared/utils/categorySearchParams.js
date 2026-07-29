/**
 * URL parameter contract shared by the hierarchical search page (/search) and
 * the product listing page (/categories/:categoryId/products).
 *
 * The listing URL is the single source of truth for the whole selection, so a
 * refresh (or a shared link) restores the category hierarchy, every filter and
 * the sort/price/keyword state exactly as the user left it.
 */

/** Comma-separated category ids, root → leaf. */
export const CATEGORY_PATH_PARAM = 'categoryPath'
/** Comma-separated selected filter ids (consumed by GET /api/products). */
export const FILTER_IDS_PARAM = 'filterIds'
/** Free-form filter values (text/number/date fields) as `filterId:value` pairs. */
export const FILTER_VALUES_PARAM = 'filterValues'

const PAIR_SEPARATOR = '~'
const KEY_VALUE_SEPARATOR = ':'

export function parseIdList(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function serializeIdList(ids) {
  return (ids || []).map((id) => String(id).trim()).filter(Boolean).join(',')
}

/** `{ [filterId]: value }` → `id:value~id:value` (values are URI-encoded). */
export function serializeFilterValues(values) {
  return Object.entries(values || {})
    .filter(([, value]) => value !== '' && value != null)
    .map(([id, value]) => `${encodeURIComponent(id)}${KEY_VALUE_SEPARATOR}${encodeURIComponent(value)}`)
    .join(PAIR_SEPARATOR)
}

export function parseFilterValues(raw) {
  const out = {}
  String(raw || '')
    .split(PAIR_SEPARATOR)
    .filter(Boolean)
    .forEach((pair) => {
      const index = pair.indexOf(KEY_VALUE_SEPARATOR)
      if (index <= 0) return
      const id = decodeURIComponent(pair.slice(0, index))
      const value = decodeURIComponent(pair.slice(index + 1))
      if (id) out[id] = value
    })
  return out
}

/**
 * Search params carried from /search to the listing page. Values that are empty
 * are dropped so the URL only ever shows what the user actually picked.
 *
 * `categoryPath` positions 2..4 are also mapped onto the listing page's existing
 * `subcategoryId` / `brandId` / `modelId` / `trimId` params, which the products
 * API already matches against `product.categoryPath`.
 */
export function buildListingSearchParams({
  categoryPath = [],
  filterIds = [],
  filterValues = {},
  extraParams = {},
} = {}) {
  const path = (categoryPath || []).map(String).filter(Boolean)
  const params = new URLSearchParams()

  if (path.length) params.set(CATEGORY_PATH_PARAM, serializeIdList(path))
  if (path[1]) params.set('subcategoryId', path[1])
  if (path[2]) params.set('brandId', path[2])
  if (path[3]) params.set('modelId', path[3])
  if (path[4]) params.set('trimId', path[4])

  const ids = serializeIdList(filterIds)
  if (ids) params.set(FILTER_IDS_PARAM, ids)

  const values = serializeFilterValues(filterValues)
  if (values) params.set(FILTER_VALUES_PARAM, values)

  Object.entries(extraParams || {}).forEach(([key, value]) => {
    if (value === '' || value == null) return
    params.set(key, String(value))
  })

  return params
}

/** Full listing URL for a completed search. */
export function buildListingUrl(options) {
  const path = (options?.categoryPath || []).map(String).filter(Boolean)
  const leafId = path[path.length - 1]
  const query = buildListingSearchParams(options).toString()
  return `/categories/${leafId}/products${query ? `?${query}` : ''}`
}

/**
 * Read the shared selection back out of a listing URL.
 * `routeCategoryId` (the :categoryId route param) is the leaf fallback when no
 * explicit path was passed.
 */
export function parseListingSearchParams(search, routeCategoryId = '') {
  const params = new URLSearchParams(search || '')
  const explicitPath = parseIdList(params.get(CATEGORY_PATH_PARAM))
  const fallbackPath = [
    routeCategoryId,
    params.get('subcategoryId'),
    params.get('brandId'),
    params.get('modelId'),
    params.get('trimId'),
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean)

  return {
    categoryPath: explicitPath.length ? explicitPath : fallbackPath,
    filterIds: parseIdList(params.get(FILTER_IDS_PARAM)),
    filterValues: parseFilterValues(params.get(FILTER_VALUES_PARAM)),
  }
}
