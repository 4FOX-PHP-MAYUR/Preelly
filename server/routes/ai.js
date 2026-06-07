const express = require('express')
const authMiddleware = require('../middleware/auth')
const { enhanceListingDescription } = require('../services/aiDescriptionEnhancementService')
const { extractCarListingData, getFallbackResult } = require('../services/aiListingExtractor')
const { enrichVehicleProfile } = require('../services/vehicleEnrichmentService')

const router = express.Router()

// @route   POST /api/ai/enhance-description
// @desc    Enhance listing description using AI
// @access  Private (requires auth)
router.post('/ai/enhance-description', authMiddleware, async (req, res) => {
  try {
    const { title, description, category } = req.body || {}
    const enhanced = await enhanceListingDescription({ title, description, category })
    res.json({ enhancedDescription: enhanced })
  } catch (error) {
    res.status(500).json({
      message: error?.message || 'Failed to enhance description',
    })
  }
})

// @route   POST /api/listings/ai-extract
// @desc    Extract structured normalized car listing data from text/transcript
// @access  Private (requires auth)
router.post('/listings/ai-extract', authMiddleware, async (req, res) => {
  try {
    const {
      input_text,
      extracted_data: extractedData,
      vehicle_type: vehicleType,
      subcategory_name: subcategoryName,
      category_name: categoryName,
      category_filters: categoryFilters,
    } = req.body || {}

    const hasText = input_text && typeof input_text === 'string' && input_text.trim()
    const hasExtracted =
      extractedData && typeof extractedData === 'object' && Object.keys(extractedData).length > 0

    if (!hasText && !hasExtracted) {
      return res.status(400).json({
        message: 'input_text or extracted_data is required',
      })
    }

    const extracted = await extractCarListingData({
      input_text: hasText ? input_text.trim() : '',
      extractedData: hasExtracted ? extractedData : null,
      vehicleType: vehicleType || null,
      subcategoryName: subcategoryName || '',
      categoryName: categoryName || '',
      categoryFilters: Array.isArray(categoryFilters) ? categoryFilters : null,
    })
    return res.json(extracted)
  } catch (error) {
    console.error('[ai-extract] Failed:', error)
    const vehicleType = req.body?.vehicle_type || 'cars'
    return res.json(getFallbackResult(vehicleType))
  }
})

// @route   POST /api/listings/vehicle-enrich
// @desc    Enrich basic extracted vehicle data into full specification profile
// @access  Private (requires auth)
router.post('/listings/vehicle-enrich', authMiddleware, async (req, res) => {
  try {
    const {
      extracted_data: extractedData,
      input_text: inputText,
      vehicle_type: vehicleType,
      category_filters: categoryFilters,
    } = req.body || {}

    if (!extractedData || typeof extractedData !== 'object' || !Object.keys(extractedData).length) {
      return res.status(400).json({ message: 'extracted_data is required' })
    }

    const enriched = await enrichVehicleProfile({
      extractedData,
      input_text: inputText || '',
      categoryFilters: Array.isArray(categoryFilters) ? categoryFilters : null,
      vehicleType: vehicleType || 'cars',
    })

    return res.json(enriched)
  } catch (error) {
    console.error('[vehicle-enrich] Failed:', error)
    return res.status(500).json({
      message: error?.message || 'Failed to enrich vehicle profile',
    })
  }
})

module.exports = router

