const express = require('express')
const router = express.Router()
const productsController = require('../controllers/products.controller')
const { webAuthenticate } = require('../../../../middleware/auth/webAuth')
const { listQueryRules, productIdParam } = require('../../../../core/validators/product.validator')
const validateRequest = require('../../../../middleware/validateRequest')
const validateObjectId = require('../../../../middleware/validateObjectId')

router.use(webAuthenticate)

/**
 * @openapi
 * /api/v1/web/products:
 *   get:
 *     tags: [Web - Products]
 *     summary: List products (web-optimized)
 */
router.get('/', listQueryRules, validateRequest, productsController.list)

/**
 * @openapi
 * /api/v1/web/products/{id}:
 *   get:
 *     tags: [Web - Products]
 *     summary: Get product detail (web)
 */
router.get('/:id', productIdParam, validateRequest, validateObjectId('id'), productsController.getById)

module.exports = router
