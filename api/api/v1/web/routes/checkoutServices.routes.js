const express = require('express')
const router = express.Router()
const checkoutServicesController = require('../controllers/checkoutServices.controller')

/**
 * @openapi
 * /api/v1/web/checkout-services:
 *   get:
 *     tags: [Web - Checkout Services]
 *     summary: List active checkout services
 *     description: Returns active, non-deleted checkout services sorted by displayOrder, each with its highlights. Powers the add-on cards on the checkout page.
 *     responses:
 *       200:
 *         description: Active checkout services fetched successfully
 */
router.get('/', checkoutServicesController.listActiveCheckoutServices)

module.exports = router
