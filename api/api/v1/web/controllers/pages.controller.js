const pageService = require('../../../../core/services/pageService')
const apiResponse = require('../../../../utils/apiResponse')
const { toPublicPageDto } = require('../../../../dto/page.dto')

/**
 * GET /api/v1/web/pages/:slug
 * Public reader for a single active, non-deleted page by slug — powers the
 * dynamic `/pages/:slug` route on the front site. Returns 404 when the slug
 * is unknown or the page is inactive.
 */
async function getPageBySlug(req, res) {
  try {
    const page = await pageService.getActivePageBySlug(req.params.slug)
    return apiResponse.success(res, 'Page fetched successfully', toPublicPageDto(page))
  } catch (error) {
    console.error('[pages.controller] getPageBySlug:', error)
    return apiResponse.error(res, error.message || 'Error fetching page', null, error.statusCode || 500)
  }
}

module.exports = {
  getPageBySlug,
}
