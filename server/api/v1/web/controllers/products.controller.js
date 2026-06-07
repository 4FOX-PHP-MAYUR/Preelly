/**
 * Web products controller — same service, richer DTO output.
 */
const { validationResult } = require('express-validator')
const productService = require('../../../../core/services/productService')
const webProductDto = require('../../../../dto/web/product.dto')
const asyncHandler = require('../../../../core/errors/asyncHandler')
const apiResponse = require('../../../../utils/apiResponse')
const AppError = require('../../../../core/errors/AppError')

const list = asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    })
  }

  const result = await productService.listProducts(req.query, {
    userId: req.user?._id,
  })

  const items = result.items.map(webProductDto.listItem)
  return apiResponse.success(res, 'Products fetched', { items }, result.meta)
})

const getById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id, {
    userId: req.user?._id,
  })

  if (product.status !== 'active' && String(product.user?._id) !== String(req.user?._id)) {
    throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND')
  }

  return apiResponse.success(res, 'Product fetched', webProductDto.detail(product))
})

module.exports = { list, getById }
