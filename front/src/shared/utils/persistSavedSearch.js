import { userService } from '@shared/services/api'

/**
 * Silently upsert a My Search record for a logged-in user.
 * Never throws — callers can fire-and-forget without changing page UX.
 */
export function persistSavedSearch(payload) {
  if (!payload) return Promise.resolve(null)
  return userService.addSavedSearch(payload).catch((err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('persistSavedSearch failed:', err?.response?.data?.message || err.message)
    }
    return null
  })
}

/** Build a saved-search payload from the hierarchical /search category builder. */
export function buildCategorySearchSavePayload({
  selectedPath = [],
  categoryPathNames = [],
  selectedFilterIds = [],
  filterValues = {},
  listingUrl = '/search',
  passthroughParams = {},
} = {}) {
  const pathNames = (categoryPathNames || []).map(String).filter(Boolean)
  const leafName = pathNames[pathNames.length - 1] || pathNames[0] || 'Search'
  const rootName = pathNames[0] || leafName
  const queryText = String(passthroughParams.q || '').trim()
  const location = String(passthroughParams.location || '').trim()
  const minPrice = passthroughParams.minPrice != null ? String(passthroughParams.minPrice) : ''
  const maxPrice = passthroughParams.maxPrice != null ? String(passthroughParams.maxPrice) : ''
  const sortBy = String(passthroughParams.sortBy || 'newest')

  const tags = []
  tags.push(location ? location.toUpperCase() : 'ALL CITIES')
  if (minPrice || maxPrice) tags.push(`PRICE: ${minPrice || '0'}–${maxPrice || '∞'}`)
  if (selectedFilterIds?.length) tags.push(`FILTERS: ${selectedFilterIds.length}`)
  Object.entries(filterValues || {}).forEach(([id, value]) => {
    if (value == null || value === '') return
    tags.push(`${String(id).slice(0, 12).toUpperCase()}: ${String(value).toUpperCase()}`)
  })

  return {
    title: `My ${leafName} Search`,
    searchName: `My ${leafName} Search`,
    categoryPath: pathNames.length ? pathNames : [leafName],
    categoryId: selectedPath[0] || null,
    categoryName: rootName,
    subcategoryId: selectedPath[1] || null,
    subCategoryId: selectedPath[1] || null,
    subCategoryName: pathNames[1] || '',
    query: queryText,
    keyword: queryText,
    searchType: selectedFilterIds?.length || Object.keys(filterValues || {}).length
      ? 'filtered'
      : queryText
        ? 'mixed'
        : 'category',
    filters: {
      location,
      minPrice,
      maxPrice,
      sortBy,
      tags: tags.slice(0, 12),
      extra: {
        filterIds: selectedFilterIds,
        filterValues,
        categoryPathIds: selectedPath,
      },
    },
    selectedFilters: {
      location,
      minPrice,
      maxPrice,
      sortBy,
      tags: tags.slice(0, 12),
      filterIds: selectedFilterIds,
      filterValues,
      categoryPathIds: selectedPath,
      keywords: queryText,
    },
    sortOption: sortBy,
    location,
    searchUrl: listingUrl || '/search',
    notifyEnabled: true,
    notificationEnabled: true,
    emailNotificationEnabled: true,
    pushNotificationEnabled: true,
    platform: 'web',
    isLoggedIn: true,
  }
}

/** Build a saved-search payload from keyword/category results on /search. */
export function buildResultsSearchSavePayload({
  searchQuery = '',
  categoryId = null,
  subcategoryId = null,
  categoryName = '',
  categoryPathNames = [],
  city = '',
  minPrice = '',
  maxPrice = '',
  keywords = '',
  sortBy = 'newest',
  searchUrl = '/search',
  urlParams = {},
} = {}) {
  const pathNames = (categoryPathNames || []).map(String).filter(Boolean)
  const catName = categoryName || pathNames[0] || searchQuery || 'Search'
  const queryText = [searchQuery, keywords].map((s) => String(s || '').trim()).filter(Boolean).join(' ').trim()
  const tags = []
  tags.push(city ? String(city).toUpperCase() : 'ALL CITIES')
  if (minPrice || maxPrice) tags.push(`PRICE: ${minPrice || '0'}–${maxPrice || '∞'}`)
  if (keywords) tags.push(`KEYWORDS: ${String(keywords).trim().toUpperCase()}`)
  if (sortBy && sortBy !== 'newest') tags.push(`SORT: ${String(sortBy).toUpperCase()}`)

  return {
    title: `My ${catName} Search`,
    searchName: `My ${catName} Search`,
    categoryPath: pathNames.length ? pathNames : [catName],
    categoryId: categoryId || null,
    categoryName: pathNames[0] || catName,
    subcategoryId: subcategoryId || null,
    subCategoryId: subcategoryId || null,
    subCategoryName: pathNames[1] || '',
    query: queryText || searchQuery,
    keyword: queryText || searchQuery,
    searchType: categoryId && queryText ? 'mixed' : categoryId ? 'category' : 'keyword',
    filters: {
      location: city || '',
      minPrice: minPrice != null ? String(minPrice) : '',
      maxPrice: maxPrice != null ? String(maxPrice) : '',
      sortBy: sortBy || 'newest',
      tags,
      extra: { keywords: keywords || '', rawQuery: searchQuery, urlParams },
    },
    selectedFilters: {
      location: city || '',
      minPrice: minPrice || '',
      maxPrice: maxPrice || '',
      sortBy,
      tags,
      keywords: keywords || '',
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
      urlParams,
    },
    sortOption: sortBy || 'newest',
    location: city || '',
    searchUrl: searchUrl || '/search',
    notifyEnabled: true,
    notificationEnabled: true,
    emailNotificationEnabled: true,
    pushNotificationEnabled: true,
    platform: 'web',
    isLoggedIn: true,
  }
}
