const express = require('express')
const router = express.Router()
const searchController = require('../controllers/search.controller')
const { mobileAuthenticate } = require('../../../../middleware/auth/mobileAuth')
const { requireDeviceId } = require('../../../../middleware/deviceId')
const {
  globalSearchQueryRules,
  suggestionsQueryRules,
  popularSearchQueryRules,
} = require('../../../../core/validators/search.validator')
const validateRequest = require('../../../../middleware/validateRequest')

router.use(mobileAuthenticate)
router.use(requireDeviceId)

/**
 * @openapi
 * /api/v1/mobile/search:
 *   get:
 *     tags: [Mobile - Search]
 *     summary: Global search across products, categories, agents, and agencies
 *     parameters:
 *       - name: device-id
 *         in: header
 *         required: true
 *         schema: { type: string }
 *       - name: keyword
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *           enum: [all, products, properties, categories, agents, agencies]
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *           enum: [relevance, newest, oldest]
 *       - name: include
 *         in: query
 *         description: Comma-separated extras to include (recent, popular, suggestions)
 *         schema: { type: string, example: "recent,popular,suggestions" }
 *       - name: X-Platform
 *         in: header
 *         schema: { type: string, enum: [ios, android] }
 *     responses:
 *       200:
 *         description: Categorized search results with optional extras
 *       400:
 *         description: Validation error or missing device-id
 */
router.get('/', globalSearchQueryRules, validateRequest, searchController.search)

/**
 * @openapi
 * /api/v1/mobile/search/recent:
 *   get:
 *     tags: [Mobile - Search]
 *     summary: Recent searches for the current user or device
 *   delete:
 *     tags: [Mobile - Search]
 *     summary: Clear recent searches for the current user or device
 */
router.get('/recent', searchController.recent)
router.delete('/recent', searchController.clearRecent)

/**
 * @openapi
 * /api/v1/mobile/search/popular:
 *   get:
 *     tags: [Mobile - Search]
 *     summary: Most searched keywords sorted by search count
 */
router.get('/popular', popularSearchQueryRules, validateRequest, searchController.popular)

/**
 * @openapi
 * /api/v1/mobile/search/suggestions:
 *   get:
 *     tags: [Mobile - Search]
 *     summary: Fast autocomplete suggestions (min 2 characters)
 */
router.get('/suggestions', suggestionsQueryRules, validateRequest, searchController.suggestions)

module.exports = router
