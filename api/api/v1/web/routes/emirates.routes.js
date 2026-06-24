const express = require('express')
const router = express.Router()
const emiratesController = require('../controllers/emirates.controller')
const { mongoIdParamRules } = require('../../../../core/validators/emirate.validator')
const validateRequest = require('../../../../middleware/validateRequest')

/**
 * @openapi
 * /api/v1/web/emirates:
 *   get:
 *     tags: [Web - Emirates]
 *     summary: List active emirates
 *     description: Returns all active, non-deleted emirates sorted by name. Used by form-field dropdowns.
 *     responses:
 *       200:
 *         description: Active emirates fetched successfully
 */
router.get('/', emiratesController.listActiveEmirates)

/**
 * @openapi
 * /api/v1/web/emirates/{id}:
 *   get:
 *     tags: [Web - Emirates]
 *     summary: Get emirate by id
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Emirate fetched successfully
 *       404:
 *         description: Emirate not found
 */
router.get('/:id', mongoIdParamRules, validateRequest, emiratesController.getEmirateById)

module.exports = router
