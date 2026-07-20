const checkoutServiceService = require('../../../../core/services/checkoutServiceService')
const apiResponse = require('../../../../utils/apiResponse')
const { toCheckoutServiceListDto } = require('../../../../dto/checkoutService.dto')

/**
 * GET /api/v1/web/checkout-services
 * Public list of active checkout services (Pay Through Preelly, Pick & Drop, …),
 * ordered by displayOrder — powers the add-on cards on the cart/checkout page.
 */
async function listActiveCheckoutServices(req, res) {
  try {
    const services = await checkoutServiceService.listActiveCheckoutServices()
    return apiResponse.success(
      res,
      'Active checkout services fetched successfully',
      toCheckoutServiceListDto(services)
    )
  } catch (error) {
    console.error('[checkoutServices.controller] listActiveCheckoutServices:', error)
    return apiResponse.error(res, error.message || 'Error fetching checkout services', null, error.statusCode || 500)
  }
}

module.exports = {
  listActiveCheckoutServices,
}
