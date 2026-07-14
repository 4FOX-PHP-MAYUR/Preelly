const express = require('express')
const router = express.Router()
const storageFacilitiesController = require('../controllers/storageFacilities.controller')

/**
 * @openapi
 * /api/v1/web/storage-facilities:
 *   get:
 *     tags: [Web - Storage Facilities]
 *     summary: List active storage facility durations
 *     description: Returns active, non-deleted storage facilities sorted by displayOrder. Powers the Storage Facility add-on tabs at checkout.
 *     responses:
 *       200:
 *         description: Active storage facilities fetched successfully
 */
router.get('/', storageFacilitiesController.listActiveStorageFacilities)

module.exports = router
