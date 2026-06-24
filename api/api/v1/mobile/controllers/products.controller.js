/**
 * Mobile products controller — thin layer over shared productService.
 */
const { validationResult } = require('express-validator')
const productService = require('../../../../core/services/productService')
const mobileProductDto = require('../../../../dto/mobile/product.dto')
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

  const items = result.items.map(mobileProductDto.listItem)
  return apiResponse.success(res, 'Products fetched', { items }, result.meta)
})

const getById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id, {
    userId: req.user?._id,
    enrichVehicleFields: true,
  })

  if (product.status !== 'active' && String(product.seller?._id || product.user?._id) !== String(req.user?._id)) {
    throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND')
  }

  return apiResponse.success(res, 'Product fetched', mobileProductDto.detail(product))
})

module.exports = { list, getById }
