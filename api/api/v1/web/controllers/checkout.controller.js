const checkoutService = require('../../../../core/services/checkoutService')
const apiResponse = require('../../../../utils/apiResponse')

/**
 * GET /api/v1/web/checkout/summary?productId=&packageId=&storageFacility=true|false
 * Order summary for the post-ad checkout. All money is computed server-side.
 */
async function getCheckoutSummary(req, res) {
  try {
    const { productId, packageId, storageFacilityId } = req.query
    const summary = await checkoutService.getCheckoutSummary({
      productId,
      packageId,
      storageFacilityId: storageFacilityId || null,
      userId: req.user?._id,
    })
    return apiResponse.success(res, 'Checkout summary fetched successfully', summary)
  } catch (error) {
    console.error('[checkout.controller] getCheckoutSummary:', error)
    return apiResponse.error(res, error.message || 'Error building checkout summary', null, error.statusCode || 500)
  }
}

module.exports = {
  getCheckoutSummary,
}
