const storageFacilityService = require('../../../../core/services/storageFacilityService')
const apiResponse = require('../../../../utils/apiResponse')
const { toStorageFacilityListDto } = require('../../../../dto/storageFacility.dto')

/**
 * GET /api/v1/web/storage-facilities
 * Public list of active storage facility durations (1 week, 2 weeks, …), ordered by
 * displayOrder — powers the Storage Facility tabs at checkout.
 */
async function listActiveStorageFacilities(req, res) {
  try {
    const facilities = await storageFacilityService.listActiveStorageFacilities()
    return apiResponse.success(
      res,
      'Active storage facilities fetched successfully',
      toStorageFacilityListDto(facilities)
    )
  } catch (error) {
    console.error('[storageFacilities.controller] listActiveStorageFacilities:', error)
    return apiResponse.error(res, error.message || 'Error fetching storage facilities', null, error.statusCode || 500)
  }
}

module.exports = {
  listActiveStorageFacilities,
}
