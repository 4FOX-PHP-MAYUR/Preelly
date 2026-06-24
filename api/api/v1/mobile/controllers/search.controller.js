const searchService = require('../../../../core/services/searchService')
const searchDto = require('../../../../dto/search.dto')
const asyncHandler = require('../../../../core/errors/asyncHandler')
const apiResponse = require('../../../../utils/apiResponse')

const search = asyncHandler(async (req, res) => {
  const result = await searchService.globalSearch(req.query.keyword, req.query, req)
  const results = searchDto.globalSearchResponse(result.results, 'mobile')
  const data = { results }

  if (result.extras) {
    data.extras = result.extras
  }

  return apiResponse.success(res, 'Search results fetched', data, result.meta)
})

const recent = asyncHandler(async (req, res) => {
  const data = await searchService.getRecentSearches(req)
  return apiResponse.success(res, 'Recent searches fetched', data)
})

const clearRecent = asyncHandler(async (req, res) => {
  const data = await searchService.clearRecentSearches(req)
  return apiResponse.success(res, 'Recent searches cleared', data)
})

const popular = asyncHandler(async (req, res) => {
  const data = await searchService.getPopularSearches(req.query)
  return apiResponse.success(res, 'Popular searches fetched', data)
})

const suggestions = asyncHandler(async (req, res) => {
  const data = await searchService.getSearchSuggestions(req.query.keyword, req, req.query)
  return apiResponse.success(res, 'Search suggestions fetched', data)
})

module.exports = { search, recent, clearRecent, popular, suggestions }
