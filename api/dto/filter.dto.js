/**
 * Shared filter DTOs for web and mobile v1 endpoints.
 */

/**
 * Shape category filters response payload.
 * @param {{ categoryId: string, filters: object[] }} payload
 */
function categoryFiltersResponse(payload) {
  if (!payload) {
    return {
      categoryId: null,
      filters: [],
    }
  }

  return {
    categoryId: String(payload.categoryId),
    filters: Array.isArray(payload.filters)
      ? payload.filters.map((filter) => ({
          filterId: String(filter.filterId),
          filterName: filter.filterName,
          slug: filter.slug,
          values: Array.isArray(filter.values)
            ? filter.values.map((value) => ({
                id: String(value.id),
                name: value.name,
              }))
            : [],
        }))
      : [],
  }
}

module.exports = {
  categoryFiltersResponse,
}
