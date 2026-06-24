const AppError = require('../errors/AppError')
const filterRepository = require('../repositories/filterRepository')
const { sortBySortOrder } = require('./categoryService')

/**
 * Merge flat filter documents by _id.
 * @param {object[][]} filterLists
 * @returns {object[]}
 */
function mergeFiltersById(...filterLists) {
  const byId = new Map()
  for (const list of filterLists) {
    for (const filter of list) {
      byId.set(String(filter._id), filter)
    }
  }
  return [...byId.values()]
}

/**
 * Build grouped filter response from a flat list of active filter documents.
 * Roots are merged by slug; values are deduplicated by id.
 *
 * @param {object[]} flatFilters
 * @returns {object[]}
 */
function groupFiltersForResponse(flatFilters) {
  const list = Array.isArray(flatFilters) ? flatFilters : []
  if (!list.length) return []

  const byId = new Map(list.map((filter) => [String(filter._id), filter]))
  const childrenByParent = new Map()

  list.forEach((filter) => {
    const parentId = filter.parentId ? String(filter.parentId) : null
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
    childrenByParent.get(parentId).push(filter)
  })

  const roots = (childrenByParent.get(null) || []).slice().sort(sortBySortOrder)
  const groupsBySlug = new Map()

  for (const root of roots) {
    const slug = String(root.slug || root._id)
    const explicitOptions = Array.isArray(root.options) ? root.options.filter(Boolean) : []
    const children = (childrenByParent.get(String(root._id)) || []).slice().sort(sortBySortOrder)

    let values = []
    if (explicitOptions.length) {
      values = explicitOptions.map((option) => {
        const child = children.find((entry) => String(entry.name).trim() === String(option).trim())
        return {
          id: child ? String(child._id) : String(option),
          name: String(option),
          sortOrder: child?.sortOrder ?? 0,
        }
      })
    } else if (children.length) {
      values = children.map((child) => ({
        id: String(child._id),
        name: child.name,
        sortOrder: child.sortOrder ?? 0,
      }))
    }

    if (!values.length) continue

    const valuesMap = new Map()
    for (const value of values) {
      if (!valuesMap.has(value.id)) valuesMap.set(value.id, value)
    }

    if (groupsBySlug.has(slug)) {
      const existing = groupsBySlug.get(slug)
      for (const value of valuesMap.values()) {
        if (!existing.valuesMap.has(value.id)) existing.valuesMap.set(value.id, value)
      }
      if (sortBySortOrder(root, existing.root) < 0) {
        existing.root = root
      }
    } else {
      groupsBySlug.set(slug, { root, valuesMap })
    }
  }

  return [...groupsBySlug.values()]
    .map(({ root, valuesMap }) => ({
      filterId: String(root._id),
      filterName: root.name,
      slug: root.slug,
      sortOrder: root.sortOrder ?? 0,
      values: [...valuesMap.values()]
        .sort((a, b) => sortBySortOrder(a, b))
        .map(({ id, name }) => ({ id, name })),
    }))
    .sort(sortBySortOrder)
    .map(({ sortOrder, ...rest }) => rest)
}

/**
 * Fetch all active filters (with values) for a category and its subcategories.
 *
 * @param {string} categoryId
 * @returns {Promise<{ categoryId: string, filters: object[] }>}
 */
async function getFiltersByCategoryId(categoryId) {
  try {
    const category = await filterRepository.findActiveCategoryById(categoryId)
    if (!category) {
      throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND')
    }

    const scopedCategories = await filterRepository.findScopedCategories(categoryId)
    const scopedCategoryIds = scopedCategories.map((entry) => entry._id)

    const [directFilters, linkedFilterIds] = await Promise.all([
      filterRepository.findDirectScopedFilters(scopedCategories),
      filterRepository.findLinkedFilterIds(scopedCategoryIds),
    ])

    const linkedFilters = await filterRepository.findFiltersByIds(linkedFilterIds)
    const seedFilters = mergeFiltersById(directFilters, linkedFilters)
    const seedIds = seedFilters.map((filter) => String(filter._id))

    const expandedFilters = seedIds.length
      ? await filterRepository.expandFilterDescendants(seedIds)
      : []

    const allFilters = mergeFiltersById(seedFilters, expandedFilters)
    const filters = groupFiltersForResponse(allFilters)

    return {
      categoryId: String(category._id),
      filters,
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error.name === 'CastError') {
      throw new AppError('Invalid category ID', 400, 'INVALID_CATEGORY_ID')
    }
    throw error
  }
}

module.exports = {
  getFiltersByCategoryId,
  groupFiltersForResponse,
  mergeFiltersById,
}
