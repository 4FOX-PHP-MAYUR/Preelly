/**
 * Shared category DTOs for web and mobile v1 endpoints.
 */

/**
 * Shape a single category document (complete fields, no subcategories key).
 * @param {object} category
 */
function categoryDetail(category) {
  if (!category) return null
  const { subcategories, children, ...rest } = category
  return rest
}

/**
 * Shape property categories list with nested subcategories.
 * @param {object[]} categories — output from categoryService.getPropertyCategories
 */
function propertyCategoriesList(categories) {
  if (!Array.isArray(categories)) return []

  return categories.map((parent) => ({
    ...categoryDetail(parent),
    subcategories: Array.isArray(parent.subcategories)
      ? parent.subcategories.map(categoryDetail)
      : [],
  }))
}

module.exports = {
  categoryDetail,
  propertyCategoriesList,
}
