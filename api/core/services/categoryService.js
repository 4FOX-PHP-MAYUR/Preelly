const AppError = require('../errors/AppError')
const categoryRepository = require('../repositories/categoryRepository')

function sortBySortOrder(a, b) {
  const sortDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  if (sortDiff !== 0) return sortDiff
  return String(a.name || '').localeCompare(String(b.name || ''))
}

/**
 * Build a two-level tree: parent categories with nested subcategories.
 * Operates on a flat list in O(n) — no additional DB calls.
 *
 * @param {object[]} flatCategories — lean Category documents (levels 1 & 2)
 * @param {import('mongoose').Types.ObjectId|string} rootId — Property root _id
 * @returns {object[]}
 */
function buildParentSubcategoryTree(flatCategories, rootId) {
  if (!flatCategories || !flatCategories.length) return []

  const rootIdStr = String(rootId)
  const subcategoriesByParent = new Map()

  for (const category of flatCategories) {
    const parentIdStr = category.parentId ? String(category.parentId) : null
    if (!parentIdStr || parentIdStr === rootIdStr) continue

    if (!subcategoriesByParent.has(parentIdStr)) {
      subcategoriesByParent.set(parentIdStr, [])
    }
    subcategoriesByParent.get(parentIdStr).push(category)
  }

  for (const siblings of subcategoriesByParent.values()) {
    siblings.sort(sortBySortOrder)
  }

  const parents = flatCategories
    .filter((category) => String(category.parentId) === rootIdStr)
    .sort(sortBySortOrder)

  return parents.map((parent) => ({
    ...parent,
    subcategories: subcategoriesByParent.get(String(parent._id)) || [],
  }))
}

/**
 * Fetch property parent categories with their direct subcategories.
 * Single root lookup + single descendants query (no N+1).
 *
 * @returns {Promise<object[]>}
 */
async function getPropertyCategories() {
  try {
    const propertyRoot = await categoryRepository.findPropertyRoot()
    if (!propertyRoot) return []

    const flatCategories = await categoryRepository.findCategoriesUnderRootByLevels(
      propertyRoot._id,
      [1, 2],
    )

    return buildParentSubcategoryTree(flatCategories, propertyRoot._id)
  } catch (error) {
    if (error.name === 'CastError') {
      throw new AppError('Invalid category data', 400, 'INVALID_CATEGORY_DATA')
    }
    throw error
  }
}

/**
 * Fetch classified parent categories with their direct subcategories.
 * Single root lookup + single aggregation query (no N+1).
 *
 * @returns {Promise<object[]>}
 */
async function getClassifiedCategories() {
  try {
    const classifiedRoot = await categoryRepository.findClassifiedRoot()
    if (!classifiedRoot) return []

    return categoryRepository.getClassifiedCategories(classifiedRoot._id)
  } catch (error) {
    if (error.name === 'CastError') {
      throw new AppError('Invalid category data', 400, 'INVALID_CATEGORY_DATA')
    }
    throw error
  }
}

module.exports = {
  getPropertyCategories,
  getClassifiedCategories,
  buildParentSubcategoryTree,
  sortBySortOrder,
}
