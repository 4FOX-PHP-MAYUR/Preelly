const express = require('express')
const router = express.Router()
const productsController = require('../controllers/products.controller')
const { mobileAuthenticate, enforceMobileAudience } = require('../../../../middleware/auth/mobileAuth')
const { listQueryRules, productIdParam } = require('../../../../core/validators/product.validator')
const validateRequest = require('../../../../middleware/validateRequest')
const validateObjectId = require('../../../../middleware/validateObjectId')

router.use(mobileAuthenticate)
router.use(enforceMobileAudience)

/**
 * @openapi
 * /api/v1/mobile/products:
 *   get:
 *     tags: [Mobile - Products]
 *     summary: List products (mobile-optimized)
 */
router.get('/', listQueryRules, validateRequest, productsController.list)

/**
 * @openapi
 * /api/v1/mobile/products/{id}:
 *   get:
 *     tags: [Mobile - Products]
 *     summary: Get product detail (mobile)
 */
router.get('/:id', productIdParam, validateRequest, validateObjectId('id'), productsController.getById)

module.exports = router
