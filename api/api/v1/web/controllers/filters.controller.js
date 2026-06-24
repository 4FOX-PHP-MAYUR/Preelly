const filterService = require('../../../../core/services/filterService')
const filterDto = require('../../../../dto/filter.dto')
const asyncHandler = require('../../../../core/errors/asyncHandler')
const apiResponse = require('../../../../utils/apiResponse')

/**
 * GET /api/v1/web/filters/:categoryId
 * Returns active filters and values for a category and its subcategories.
 */
const getFiltersByCategoryId = asyncHandler(async (req, res) => {
  const { categoryId } = req.params
  const result = await filterService.getFiltersByCategoryId(categoryId)
  return apiResponse.success(
    res,
    'Category filters fetched successfully',
    filterDto.categoryFiltersResponse(result),
  )
})

module.exports = { getFiltersByCategoryId }
