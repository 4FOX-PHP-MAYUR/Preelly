const { body, param, query } = require('express-validator')

const DISCOUNT_TYPES = ['percentage', 'fixed']

const mongoIdParamRules = [
  param('id').exists().withMessage('id is required').isMongoId().withMessage('Invalid id'),
]

const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
  query('search').optional().isString().trim(),
  query('status').optional().isIn(['active', 'inactive', 'all']).withMessage('Invalid status filter'),
  query('sortBy')
    .optional()
    .isIn(['couponName', 'couponCode', 'discountValue', 'validFrom', 'validTill', 'status', 'createdAt', 'updatedAt']),
  query('sortDir').optional().isIn(['asc', 'desc']),
]

const createBuyerCouponRules = [
  body('couponName').isString().trim().notEmpty().withMessage('Coupon name is required')
    .isLength({ max: 100 }).withMessage('Coupon name cannot exceed 100 characters'),
  body('couponCode').isString().trim().notEmpty().withMessage('Coupon code is required')
    .isLength({ max: 20 }).withMessage('Coupon code cannot exceed 20 characters')
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('Coupon code cannot contain spaces or special characters'),
  body('description').optional({ nullable: true }).isString(),
  body('discountType').isIn(DISCOUNT_TYPES).withMessage('Invalid discount type'),
  body('discountValue').isFloat({ gt: 0 }).withMessage('Discount value must be greater than 0'),
  body('minimumOrderAmount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('maximumDiscountAmount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('usageLimit').optional({ nullable: true }).isInt({ min: 1 }),
  body('usageLimitPerBuyer').optional({ nullable: true }).isInt({ min: 1 }),
  body('validFrom').notEmpty().withMessage('Valid from is required').isISO8601().withMessage('Invalid valid from'),
  body('validTill').notEmpty().withMessage('Valid till is required').isISO8601().withMessage('Invalid valid till'),
  body('checkoutServiceIds').isArray({ min: 1 }).withMessage('Select at least one checkout service'),
  body('checkoutServiceIds.*').isMongoId().withMessage('Invalid checkout service id'),
  body('status').optional().isBoolean(),
]

// Updates reuse the create rules but every field is optional.
const updateBuyerCouponRules = [
  ...mongoIdParamRules,
  body('couponName').optional().isString().trim().isLength({ max: 100 }),
  body('couponCode').optional().isString().trim().isLength({ max: 20 })
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('Coupon code cannot contain spaces or special characters'),
  body('description').optional({ nullable: true }).isString(),
  body('discountType').optional().isIn(DISCOUNT_TYPES),
  body('discountValue').optional().isFloat({ gt: 0 }),
  body('minimumOrderAmount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('maximumDiscountAmount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('usageLimit').optional({ nullable: true }).isInt({ min: 1 }),
  body('usageLimitPerBuyer').optional({ nullable: true }).isInt({ min: 1 }),
  body('validFrom').optional().isISO8601(),
  body('validTill').optional().isISO8601(),
  body('checkoutServiceIds').optional().isArray({ min: 1 }).withMessage('Select at least one checkout service'),
  body('checkoutServiceIds.*').optional().isMongoId(),
  body('status').optional().isBoolean(),
]

const statusRules = [
  ...mongoIdParamRules,
  body('status').exists().withMessage('status is required').isBoolean(),
]

const validateCouponRules = [
  body('couponCode').isString().trim().notEmpty().withMessage('Coupon code is required'),
  body('services').isArray({ min: 1 }).withMessage('Select a checkout service'),
  body('services.*.checkoutServiceId').isMongoId().withMessage('Invalid checkout service id'),
  body('services.*.amount').isFloat({ min: 0 }).withMessage('Invalid amount'),
]

const applyCouponRules = [
  ...validateCouponRules,
  body('orderId').optional({ nullable: true }).isString(),
]

module.exports = {
  mongoIdParamRules,
  listQueryRules,
  createBuyerCouponRules,
  updateBuyerCouponRules,
  statusRules,
  validateCouponRules,
  applyCouponRules,
}
