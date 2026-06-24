const emirateService = require('../../../../core/services/emirateService')
const apiResponse = require('../../../../utils/apiResponse')
const { toEmirateDto, toEmirateListDto } = require('../../../../dto/emirate.dto')

/**
 * GET /api/v1/web/emirates
 * Public list of active emirates for dropdowns / form fields.
 */
async function listActiveEmirates(req, res) {
  try {
    const emirates = await emirateService.listActiveEmirates()
    return apiResponse.success(res, 'Active emirates fetched successfully', toEmirateListDto(emirates))
  } catch (error) {
    console.error('[emirates.controller] listActiveEmirates:', error)
    return apiResponse.error(res, error.message || 'Error fetching emirates', null, error.statusCode || 500)
  }
}

/**
 * GET /api/v1/web/emirates/:id
 */
async function getEmirateById(req, res) {
  try {
    const emirate = await emirateService.getEmirateById(req.params.id)
    return apiResponse.success(res, 'Emirate fetched successfully', toEmirateDto(emirate))
  } catch (error) {
    console.error('[emirates.controller] getEmirateById:', error)
    return apiResponse.error(res, error.message || 'Error fetching emirate', null, error.statusCode || 500)
  }
}

module.exports = {
  listActiveEmirates,
  getEmirateById,
}
