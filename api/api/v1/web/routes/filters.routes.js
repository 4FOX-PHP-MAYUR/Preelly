const express = require('express')
const router = express.Router()
const filtersController = require('../controllers/filters.controller')
const { categoryIdParamRules } = require('../../../../core/validators/filter.validator')
const validateRequest = require('../../../../middleware/validateRequest')

/**
 * @openapi
 * /api/v1/web/filters/{categoryId}:
 *   get:
 *     tags: [Web - Filters]
 *     summary: Get all active filters for a category and its subcategories
 *     description: |
 *       Returns grouped filter definitions with deduplicated active values for the given category
 *       and all active descendant categories. Filters are sorted by `sortOrder`, then name.
 *
 *       **Example:**
 *       ```bash
 *       curl -s http://localhost:8029/api/v1/web/filters/507f1f77bcf86cd799439011
 *       ```
 *     parameters:
 *       - name: categoryId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *         description: MongoDB ObjectId of the category
 *     responses:
 *       200:
 *         description: Category filters fetched successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Category filters fetched successfully
 *               data:
 *                 categoryId: "507f1f77bcf86cd799439011"
 *                 filters:
 *                   - filterId: "507f191e810c19729de860ea"
 *                     filterName: "Property Type"
 *                     slug: "property-type"
 *                     values:
 *                       - id: "507f191e810c19729de860eb"
 *                         name: "Apartment"
 *                       - id: "507f191e810c19729de860ec"
 *                         name: "Villa"
 *       400:
 *         description: Invalid category ID
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.get('/:categoryId', categoryIdParamRules, validateRequest, filtersController.getFiltersByCategoryId)

module.exports = router
