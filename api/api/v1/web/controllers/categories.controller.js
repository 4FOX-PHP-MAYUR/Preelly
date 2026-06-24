const categoryService = require('../../../../core/services/categoryService')
const categoryDto = require('../../../../dto/category.dto')
const asyncHandler = require('../../../../core/errors/asyncHandler')
const apiResponse = require('../../../../utils/apiResponse')

/**
 * GET /api/v1/web/categories/property-categories
 * Returns property parent categories with nested subcategories.
 */
const getPropertyCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.getPropertyCategories()
  return apiResponse.success(
    res,
    'Property categories fetched successfully',
    categoryDto.propertyCategoriesList(categories),
  )
})

/**
 * GET /api/v1/classifieds/categories
 * Returns classified parent categories with nested subcategories.
 */
const getClassifiedCategories = async (req, res) => {
  try {
    const categories = await categoryService.getClassifiedCategories()
    return apiResponse.success(
      res,
      'Classified categories fetched successfully',
      categoryDto.propertyCategoriesList(categories),
    )
  } catch (error) {
    console.error('[getClassifiedCategories]', error.stack || error)
    return apiResponse.error(res, 'Failed to fetch classified categories', null, 500)
  }
}

module.exports = { getPropertyCategories, getClassifiedCategories }
