const categoryService = require('../../../../core/services/categoryService')
const categoryDto = require('../../../../dto/category.dto')
const asyncHandler = require('../../../../core/errors/asyncHandler')
const apiResponse = require('../../../../utils/apiResponse')

/**
 * GET /api/v1/mobile/categories/property-categories
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

module.exports = { getPropertyCategories }
