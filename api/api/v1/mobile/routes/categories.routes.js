const express = require('express')
const router = express.Router()
const categoriesController = require('../controllers/categories.controller')

/**
 * @openapi
 * /api/v1/mobile/categories/property-categories:
 *   get:
 *     tags: [Categories]
 *     summary: Get property categories with subcategories (mobile)
 *     description: |
 *       Same payload as the web endpoint. Public — no authentication required.
 *
 *       **Example:**
 *       ```bash
 *       curl -s http://localhost:8029/api/v1/mobile/categories/property-categories
 *       ```
 *     responses:
 *       200:
 *         description: Property categories fetched successfully
 */
router.get('/property-categories', categoriesController.getPropertyCategories)

module.exports = router
