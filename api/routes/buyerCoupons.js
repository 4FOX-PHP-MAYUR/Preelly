const express = require('express')
const router = express.Router()

const buyerCouponService = require('../core/services/buyerCouponService')
const buyerCouponValidator = require('../core/validators/buyerCoupon.validator')
const validateRequest = require('../middleware/validateRequest')
const adminMiddleware = require('../middleware/admin')
const authMiddleware = require('../middleware/auth')
const { toBuyerCouponDto, toPaginatedBuyerCouponsResponse } = require('../dto/buyerCoupon.dto')

/**
 * Buyer Coupon module — coupons that discount ONLY Checkout Service charges.
 *  - Admin CRUD is JWT + admin-gated.
 *  - /validate and /apply are JWT-gated (any signed-in buyer), used at checkout.
 */

// POST /api/buyer-coupon/validate — checkout-facing. Declared before /:id.
router.post(
  '/validate',
  authMiddleware,
  buyerCouponValidator.validateCouponRules,
  validateRequest,
  async (req, res) => {
    try {
      const result = await buyerCouponService.validateBuyerCoupon({
        couponCode: req.body.couponCode,
        userId: req.user?._id,
        services: req.body.services,
      })
      res.json({ success: true, message: result.message, data: result })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Coupon could not be applied',
        data: { valid: false, discountAmount: 0, finalAmount: null },
      })
    }
  }
)

// POST /api/buyer-coupon/apply — records a usage row after applying.
router.post(
  '/apply',
  authMiddleware,
  buyerCouponValidator.applyCouponRules,
  validateRequest,
  async (req, res) => {
    try {
      const result = await buyerCouponService.applyBuyerCoupon({
        couponCode: req.body.couponCode,
        userId: req.user?._id,
        orderId: req.body.orderId,
        checkoutServiceId: req.body.checkoutServiceId,
        services: req.body.services,
      })
      res.json({ success: true, message: result.message, data: result })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Coupon could not be applied',
        data: { valid: false, discountAmount: 0, finalAmount: null },
      })
    }
  }
)

// GET /api/buyer-coupon/list — paginated list with search + status filter
router.get(
  '/list',
  adminMiddleware,
  buyerCouponValidator.listQueryRules,
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        sortBy = 'createdAt',
        sortDir = 'desc',
      } = req.query

      const result = await buyerCouponService.listBuyerCoupons({
        page: Number(page),
        limit: Number(limit),
        search,
        status: status && status !== 'all' ? status : undefined,
        sortBy,
        sortDir,
      })
      res.json(toPaginatedBuyerCouponsResponse(result))
    } catch (error) {
      console.error('Error fetching buyer coupons:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error fetching buyer coupons' })
    }
  }
)

// POST /api/buyer-coupon/create
router.post(
  '/create',
  adminMiddleware,
  buyerCouponValidator.createBuyerCouponRules,
  validateRequest,
  async (req, res) => {
    try {
      const coupon = await buyerCouponService.createBuyerCoupon(req.body, req.user?._id)
      res.status(201).json(toBuyerCouponDto(coupon))
    } catch (error) {
      console.error('Error creating buyer coupon:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error creating buyer coupon' })
    }
  }
)

// PUT /api/buyer-coupon/update/:id
router.put(
  '/update/:id',
  adminMiddleware,
  buyerCouponValidator.updateBuyerCouponRules,
  validateRequest,
  async (req, res) => {
    try {
      const coupon = await buyerCouponService.updateBuyerCoupon(req.params.id, req.body, req.user?._id)
      res.json(toBuyerCouponDto(coupon))
    } catch (error) {
      console.error('Error updating buyer coupon:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error updating buyer coupon' })
    }
  }
)

// PATCH /api/buyer-coupon/status/:id — activate / deactivate
router.patch(
  '/status/:id',
  adminMiddleware,
  buyerCouponValidator.statusRules,
  validateRequest,
  async (req, res) => {
    try {
      const coupon = await buyerCouponService.setBuyerCouponStatus(req.params.id, req.body.status, req.user?._id)
      res.json({
        message: `Coupon ${coupon.status ? 'activated' : 'deactivated'}`,
        buyerCoupon: toBuyerCouponDto(coupon),
      })
    } catch (error) {
      console.error('Error updating buyer coupon status:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error updating buyer coupon status' })
    }
  }
)

// DELETE /api/buyer-coupon/:id — soft delete
router.delete(
  '/:id',
  adminMiddleware,
  buyerCouponValidator.mongoIdParamRules,
  validateRequest,
  async (req, res) => {
    try {
      await buyerCouponService.deleteBuyerCoupon(req.params.id, req.user?._id)
      res.json({ message: 'Buyer coupon deleted successfully' })
    } catch (error) {
      console.error('Error deleting buyer coupon:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error deleting buyer coupon' })
    }
  }
)

// GET /api/buyer-coupon/:id — details (declared last so it can't shadow the routes above)
router.get(
  '/:id',
  adminMiddleware,
  buyerCouponValidator.mongoIdParamRules,
  validateRequest,
  async (req, res) => {
    try {
      const coupon = await buyerCouponService.getBuyerCouponById(req.params.id)
      res.json(toBuyerCouponDto(coupon))
    } catch (error) {
      console.error('Error fetching buyer coupon:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error fetching buyer coupon' })
    }
  }
)

module.exports = router
