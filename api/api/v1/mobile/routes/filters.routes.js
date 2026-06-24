const express = require('express')
const router = express.Router()
const filtersController = require('../controllers/filters.controller')
const { categoryIdParamRules } = require('../../../../core/validators/filter.validator')
const validateRequest = require('../../../../middleware/validateRequest')

/**
 * @openapi
 * /api/v1/mobile/filters/{categoryId}:
 *   get:
 *     tags: [Mobile - Filters]
 *     summary: Get all active filters for a category and its subcategories
 *     parameters:
 *       - name: categoryId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *     responses:
 *       200:
 *         description: Category filters fetched successfully
 *       400:
 *         description: Invalid category ID
 *       404:
 *         description: Category not found
 */
router.get('/:categoryId', categoryIdParamRules, validateRequest, filtersController.getFiltersByCategoryId)

module.exports = router
