const express = require('express')
const router = express.Router()
const packagesController = require('../controllers/packages.controller')
const { mongoIdParamRules } = require('../../../../core/validators/package.validator')
const validateRequest = require('../../../../middleware/validateRequest')

/**
 * @openapi
 * /api/v1/web/packages:
 *   get:
 *     tags: [Web - Packages]
 *     summary: List active packages
 *     description: Returns all active, non-deleted packages sorted by displayOrder. Powers the post-ad "Select a package" step.
 *     responses:
 *       200:
 *         description: Active packages fetched successfully
 */
router.get('/', packagesController.listActivePackages)

/**
 * @openapi
 * /api/v1/web/packages/{id}:
 *   get:
 *     tags: [Web - Packages]
 *     summary: Get package by id
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Package fetched successfully
 *       404:
 *         description: Package not found
 */
router.get('/:id', mongoIdParamRules, validateRequest, packagesController.getPackageById)

module.exports = router
