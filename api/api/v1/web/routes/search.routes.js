const express = require('express')
const router = express.Router()
const searchController = require('../controllers/search.controller')
const { webAuthenticate } = require('../../../../middleware/auth/webAuth')
const { requireDeviceId } = require('../../../../middleware/deviceId')
const {
  globalSearchQueryRules,
  suggestionsQueryRules,
  popularSearchQueryRules,
} = require('../../../../core/validators/search.validator')
const validateRequest = require('../../../../middleware/validateRequest')

router.use(webAuthenticate)
router.use(requireDeviceId)

/**
 * @openapi
 * /api/v1/web/search:
 *   get:
 *     tags: [Web - Search]
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
 *       - name: popularLimit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *       - name: suggestionLimit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 20 }
 *     responses:
 *       200:
 *         description: Categorized search results with optional extras
 *       400:
 *         description: Validation error or missing device-id
 */
router.get('/', globalSearchQueryRules, validateRequest, searchController.search)

/**
 * @openapi
 * /api/v1/web/search/recent:
 *   get:
 *     tags: [Web - Search]
 *     summary: Recent searches for the current user or device
 *     responses:
 *       200:
 *         description: Up to 10 deduplicated recent keywords
 *   delete:
 *     tags: [Web - Search]
 *     summary: Clear recent searches for the current user or device
 *     responses:
 *       200:
 *         description: Recent searches cleared
 */
router.get('/recent', searchController.recent)
router.delete('/recent', searchController.clearRecent)

/**
 * @openapi
 * /api/v1/web/search/popular:
 *   get:
 *     tags: [Web - Search]
 *     summary: Most searched keywords sorted by search count
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *     responses:
 *       200:
 *         description: Popular search keywords with analytics metadata
 */
router.get('/popular', popularSearchQueryRules, validateRequest, searchController.popular)

/**
 * @openapi
 * /api/v1/web/search/suggestions:
 *   get:
 *     tags: [Web - Search]
 *     summary: Fast autocomplete suggestions (min 2 characters)
 *     parameters:
 *       - name: keyword
 *         in: query
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 20, default: 10 }
 *     responses:
 *       200:
 *         description: Relevance-ranked suggestions
 *       400:
 *         description: Keyword too short or validation error
 */
router.get('/suggestions', suggestionsQueryRules, validateRequest, searchController.suggestions)

module.exports = router
