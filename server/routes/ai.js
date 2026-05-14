const express = require('express')
const authMiddleware = require('../middleware/auth')
const { enhanceListingDescription } = require('../services/aiDescriptionEnhancementService')
const { extractCarListingData, getFallbackResult } = require('../services/aiListingExtractor')

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
    const { input_text } = req.body || {}
    if (!input_text || typeof input_text !== 'string' || !input_text.trim()) {
      return res.status(400).json({
        message: 'input_text is required',
      })
    }

    const extracted = await extractCarListingData({ input_text })
    return res.json(extracted)
  } catch (error) {
    console.error('[ai-extract] Failed:', error)
    return res.json(getFallbackResult())
  }
})

module.exports = router

