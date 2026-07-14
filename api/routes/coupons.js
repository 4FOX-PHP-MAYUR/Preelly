const express = require('express')
const router = express.Router()

const couponService = require('../core/services/couponService')
const couponValidator = require('../core/validators/coupon.validator')
const validateRequest = require('../middleware/validateRequest')
const adminMiddleware = require('../middleware/admin')
const authMiddleware = require('../middleware/auth')
const { toCouponDto, toPaginatedCouponsResponse } = require('../dto/coupon.dto')

/**
 * Coupon module.
 *  - Admin CRUD is JWT + admin-gated.
 *  - /validate is JWT-gated (any signed-in user) and used by checkout.
 */

// POST /api/coupon/validate — checkout-facing. Declared before /:id so "validate"
// is never swallowed as an id.
router.post(
  '/validate',
  authMiddleware,
  couponValidator.validateCouponRules,
  validateRequest,
  async (req, res) => {
    try {
      const result = await couponService.validateCoupon({
        couponCode: req.body.couponCode,
        userId: req.user?._id,
        packageId: req.body.packageId,
        storageFacilityId: req.body.storageFacilityId,
        categoryId: req.body.categoryId,
        categoryIds: req.body.categoryIds,
        orderAmount: req.body.orderAmount,
      })
      res.json({ success: true, message: result.message, data: result })
    } catch (error) {
      // A rejected coupon is an expected outcome, not a server fault — return the
      // reason in the same shape so the UI can just show `message`.
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Coupon could not be applied',
        data: { valid: false, discountAmount: 0, finalAmount: null },
      })
    }
  }
)

// GET /api/coupon/generate-code — random unused code for the Add screen.
router.get('/generate-code', adminMiddleware, async (req, res) => {
  try {
    const couponCode = await couponService.generateUniqueCode()
    res.json({ success: true, message: 'Coupon code generated', data: { couponCode } })
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message })
  }
})

// GET /api/coupon/list — paginated list with search + filters
router.get(
  '/list',
  adminMiddleware,
  couponValidator.listQueryRules,
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        discountType,
        applicableType,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortDir = 'desc',
      } = req.query

      const result = await couponService.listCoupons({
        page: Number(page),
        limit: Number(limit),
        search,
        status: status && status !== 'all' ? status : undefined,
        discountType: discountType && discountType !== 'all' ? discountType : undefined,
        applicableType: applicableType && applicableType !== 'all' ? applicableType : undefined,
        startDate,
        endDate,
        sortBy,
        sortDir,
      })
      res.json(toPaginatedCouponsResponse(result))
    } catch (error) {
      console.error('Error fetching coupons:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error fetching coupons' })
    }
  }
)

// POST /api/coupon/create
router.post(
  '/create',
  adminMiddleware,
  couponValidator.createCouponRules,
  validateRequest,
  async (req, res) => {
    try {
      const coupon = await couponService.createCoupon(req.body, req.user?._id)
      res.status(201).json(toCouponDto(coupon))
    } catch (error) {
      console.error('Error creating coupon:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error creating coupon' })
    }
  }
)

// PUT /api/coupon/update/:id
router.put(
  '/update/:id',
  adminMiddleware,
  couponValidator.updateCouponRules,
  validateRequest,
  async (req, res) => {
    try {
      const coupon = await couponService.updateCoupon(req.params.id, req.body, req.user?._id)
      res.json(toCouponDto(coupon))
    } catch (error) {
      console.error('Error updating coupon:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error updating coupon' })
    }
  }
)

// PATCH /api/coupon/status/:id — activate / deactivate
router.patch(
  '/status/:id',
  adminMiddleware,
  couponValidator.statusRules,
  validateRequest,
  async (req, res) => {
    try {
      const coupon = await couponService.setCouponStatus(req.params.id, req.body.status, req.user?._id)
      res.json({
        message: `Coupon ${coupon.status ? 'activated' : 'deactivated'}`,
        coupon: toCouponDto(coupon),
      })
    } catch (error) {
      console.error('Error updating coupon status:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error updating coupon status' })
    }
  }
)

// DELETE /api/coupon/:id — soft delete
router.delete(
  '/:id',
  adminMiddleware,
  couponValidator.mongoIdParamRules,
  validateRequest,
  async (req, res) => {
    try {
      await couponService.deleteCoupon(req.params.id, req.user?._id)
      res.json({ message: 'Coupon deleted successfully' })
    } catch (error) {
      console.error('Error deleting coupon:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error deleting coupon' })
    }
  }
)

// GET /api/coupon/:id — details (declared last so it can't shadow the routes above)
router.get(
  '/:id',
  adminMiddleware,
  couponValidator.mongoIdParamRules,
  validateRequest,
  async (req, res) => {
    try {
      const coupon = await couponService.getCouponById(req.params.id)
      res.json(toCouponDto(coupon))
    } catch (error) {
      console.error('Error fetching coupon:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error fetching coupon' })
    }
  }
)

module.exports = router
