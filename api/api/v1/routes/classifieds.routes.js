const express = require('express')
const router = express.Router()
const categoriesController = require('../web/controllers/categories.controller')

/**
 * @openapi
 * /api/v1/classifieds/categories:
 *   get:
 *     tags:
 *       - Categories
 *     summary: Get Classified Categories
 *     description: Returns classified categories with subcategories.
 *     responses:
 *       200:
 *         description: Classified categories fetched successfully
 *       500:
 *         description: Internal Server Error
 */
router.get('/categories', categoriesController.getClassifiedCategories)

module.exports = router
