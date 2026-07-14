const express = require('express')
const router = express.Router()
const { query } = require('express-validator')
const checkoutController = require('../controllers/checkout.controller')
const authMiddleware = require('../../../../middleware/auth')
const validateRequest = require('../../../../middleware/validateRequest')

const summaryRules = [
  query('productId').exists().withMessage('productId is required').isMongoId().withMessage('Invalid productId'),
  query('packageId').optional().isMongoId().withMessage('Invalid packageId'),
  query('storageFacilityId').optional().isMongoId().withMessage('Invalid storageFacilityId'),
]

/**
 * @openapi
 * /api/v1/web/checkout/summary:
 *   get:
 *     tags: [Web - Checkout]
 *     summary: Order summary for the post-ad checkout
 *     description: >
 *       Returns the listing being promoted plus the priced order summary for the selected
 *       package. The seller is charged for the package (not the listing price). VAT comes
 *       from the package and applies to package + storage facility. Owner only.
 *     parameters:
 *       - name: productId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: packageId
 *         in: query
 *         schema: { type: string }
 *       - name: storageFacility
 *         in: query
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: Checkout summary fetched successfully
 *       403:
 *         description: Not the listing owner
 *       404:
 *         description: Product or package not found
 */
router.get('/summary', authMiddleware, summaryRules, validateRequest, checkoutController.getCheckoutSummary)

module.exports = router
