const packageService = require('../../../../core/services/packageService')
const apiResponse = require('../../../../utils/apiResponse')
const { toPackageDto, toPackageListDto } = require('../../../../dto/package.dto')

/**
 * GET /api/v1/web/packages
 * Public list of active packages, ordered by displayOrder — powers the
 * "Select a package" step after a listing is submitted.
 */
async function listActivePackages(req, res) {
  try {
    const packages = await packageService.listActivePackages()
    return apiResponse.success(res, 'Active packages fetched successfully', toPackageListDto(packages))
  } catch (error) {
    console.error('[packages.controller] listActivePackages:', error)
    return apiResponse.error(res, error.message || 'Error fetching packages', null, error.statusCode || 500)
  }
}

/**
 * GET /api/v1/web/packages/:id
 */
async function getPackageById(req, res) {
  try {
    const pkg = await packageService.getPackageById(req.params.id)
    return apiResponse.success(res, 'Package fetched successfully', toPackageDto(pkg))
  } catch (error) {
    console.error('[packages.controller] getPackageById:', error)
    return apiResponse.error(res, error.message || 'Error fetching package', null, error.statusCode || 500)
  }
}

module.exports = {
  listActivePackages,
  getPackageById,
}
