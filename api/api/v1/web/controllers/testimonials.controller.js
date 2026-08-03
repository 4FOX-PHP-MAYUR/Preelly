const testimonialService = require('../../../../core/services/testimonialService')
const apiResponse = require('../../../../utils/apiResponse')
const { toTestimonialListDto } = require('../../../../dto/testimonial.dto')

/**
 * GET /api/v1/web/testimonials
 * Public list of active testimonials, ordered by displayOrder then latest
 * created date — powers the Testimonials section on the public site.
 */
async function listActiveTestimonials(req, res) {
  try {
    const testimonials = await testimonialService.listActiveTestimonials()
    return apiResponse.success(
      res,
      'Active testimonials fetched successfully',
      toTestimonialListDto(testimonials)
    )
  } catch (error) {
    console.error('[testimonials.controller] listActiveTestimonials:', error)
    return apiResponse.error(res, error.message || 'Error fetching testimonials', null, error.statusCode || 500)
  }
}

module.exports = {
  listActiveTestimonials,
}
