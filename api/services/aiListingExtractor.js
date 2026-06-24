/**
 * Car listing AI extractor — delegates to centralized aiVehicleMappingService.
 * Maintains backward-compatible { display_data, filter_data, missing_fields, confidence } contract.
 */

const {
  mapVehicleListingData,
  getFallbackMappingResult,
} = require('./aiVehicleMappingService')
const { getVehicleConfig } = require('../config/vehicleFieldMappingConfig')

const REQUIRED_FIELDS = getVehicleConfig('cars').legacyRequiredFields

async function extractCarListingData({
  input_text,
  extractedData = null,
  vehicleType = null,
  subcategoryName = '',
  categoryName = '',
  categoryFilters = null,
} = {}) {
  const result = await mapVehicleListingData({
    input_text,
    extractedData,
    vehicleType: vehicleType || 'cars',
    subcategoryName,
    categoryName,
    categoryFilters,
  })

  return {
    display_data: result.display_data,
    filter_data: result.filter_data,
    filter_selections: result.filter_selections,
    enrichment: result.enrichment,
    vehicleSpecifications: result.vehicleSpecifications,
    specifications: result.specifications,
    missing_fields: result.missing_fields,
    confidence: result.confidence,
    form_values: result.form_values,
    extracted_fields: result.extracted_fields,
    ai_inferred_fields: result.ai_inferred_fields,
    unknown_fields: result.unknown_fields,
    confidence_scores: result.confidence_scores,
    vehicle_type: result.vehicle_type,
    debug_log: result.debug_log,
  }
}

function getFallbackResult(vehicleType = 'cars') {
  const fallback = getFallbackMappingResult(vehicleType)
  return {
    display_data: fallback.display_data,
    filter_data: fallback.filter_data,
    filter_selections: fallback.filter_selections || {},
    enrichment: fallback.enrichment || null,
    specifications: fallback.specifications,
    missing_fields: fallback.missing_fields,
    confidence: fallback.confidence,
    form_values: fallback.form_values,
    extracted_fields: fallback.extracted_fields,
    ai_inferred_fields: fallback.ai_inferred_fields,
    unknown_fields: fallback.unknown_fields,
    confidence_scores: fallback.confidence_scores,
    vehicle_type: fallback.vehicle_type,
    debug_log: fallback.debug_log,
  }
}

module.exports = { extractCarListingData, getFallbackResult, REQUIRED_FIELDS }
