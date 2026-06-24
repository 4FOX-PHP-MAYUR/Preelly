const express = require('express')
const router = express.Router()
const categoriesController = require('../controllers/categories.controller')

/**
 * @openapi
 * /api/v1/web/categories/property-categories:
 *   get:
 *     tags: [Categories]
 *     summary: Get property categories with subcategories
 *     description: |
 *       Returns active, non-deleted property parent categories (level 1 under the Property root)
 *       each with their direct subcategories (level 2), sorted by `sortOrder`.
 *
 *       **Example:**
 *       ```bash
 *       curl -s http://localhost:8029/api/v1/web/categories/property-categories
 *       ```
 *     responses:
 *       200:
 *         description: Property categories fetched successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Property categories fetched successfully
 *               data:
 *                 - _id: "69bd3a36f8f72a46764ed476"
 *                   name: "Agent & Agency Search"
 *                   slug: "agent-agency-search"
 *                   parentId: "69bd2c49f8f72a46764e1671"
 *                   level: 1
 *                   path: ["69bd2c49f8f72a46764e1671"]
 *                   sortOrder: 0
 *                   isActive: true
 *                   isDeleted: false
 *                   icon: null
 *                   emoji: "📦"
 *                   count: 0
 *                   subcategories:
 *                     - _id: "69bd39e0f8f72a46764ed36c"
 *                       name: "Residential"
 *                       slug: "residential"
 *                       level: 2
 *       500:
 *         description: Server error
 */
router.get('/property-categories', categoriesController.getPropertyCategories)

module.exports = router
