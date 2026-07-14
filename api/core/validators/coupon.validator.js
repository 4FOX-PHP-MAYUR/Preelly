const { body, param, query } = require('express-validator')
const {
  DISCOUNT_TYPES,
  APPLICABLE_TYPES,
  USER_ELIGIBILITY,
  COUPON_TYPES,
} = require('../../models/Coupon')

const mongoIdParamRules = [
  param('id').exists().withMessage('id is required').isMongoId().withMessage('Invalid id'),
]

const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
  query('search').optional().isString().trim(),
  query('status').optional().isIn(['active', 'inactive', 'all']),
  query('discountType').optional().isIn([...DISCOUNT_TYPES, 'all']),
  query('applicableType').optional().isIn([...APPLICABLE_TYPES, 'all']),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
  query('sortBy').optional().isString(),
  query('sortDir').optional().isIn(['asc', 'desc']),
]

const couponBodyRules = ({ partial = false } = {}) => {
  const required = (chain) => (partial ? chain.optional() : chain.exists().withMessage('is required'))

  return [
    required(body('couponName'))
      .isString().trim()
      .isLength({ min: 1 }).withMessage('Coupon name is required')
      .isLength({ max: 100 }).withMessage('Coupon name cannot exceed 100 characters'),

    required(body('couponCode'))
      .isString().trim()
      .isLength({ min: 1 }).withMessage('Coupon code is required')
      .isLength({ max: 20 }).withMessage('Coupon code cannot exceed 20 characters')
      .matches(/^[A-Za-z0-9_-]+$/).withMessage('Coupon code cannot contain spaces or special characters'),

    body('description').optional({ nullable: true }).isString().trim(),

    required(body('discountType')).isIn(DISCOUNT_TYPES).withMessage('Discount type must be percentage or fixed'),
    required(body('discountValue')).isFloat({ gt: 0 }).withMessage('Discount value must be greater than 0'),
    body('maximumDiscount').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Maximum discount must be greater than 0'),
    body('minimumOrderAmount').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Minimum order amount cannot be negative'),

    required(body('startDate')).isISO8601().withMessage('A valid start date is required'),
    required(body('endDate')).isISO8601().withMessage('A valid end date is required'),

    body('usageLimit').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Usage limit must be at least 1'),
    body('usagePerUser').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Usage per user must be at least 1'),

    body('applicableType').optional().isIn(APPLICABLE_TYPES).withMessage('Invalid "Applicable For" selection'),
    body('applicableIds').optional().isArray().withMessage('applicableIds must be an array'),
    body('applicableIds.*').optional().isMongoId().withMessage('Invalid id in applicableIds'),

    body('userEligibility').optional().isIn(USER_ELIGIBILITY),
    body('couponType').optional().isIn(COUPON_TYPES),
    body('assignedUsers').optional().isArray().withMessage('assignedUsers must be an array'),
    body('assignedUsers.*').optional().isMongoId().withMessage('Invalid user id in assignedUsers'),

    body('stackable').optional().isBoolean(),
    body('terms').optional({ nullable: true }).isString().trim(),
    body('status').optional().isBoolean(),
  ]
}

const createCouponRules = couponBodyRules({ partial: false })
const updateCouponRules = [...mongoIdParamRules, ...couponBodyRules({ partial: true })]

const statusRules = [
  ...mongoIdParamRules,
  body('status').exists().withMessage('status is required').isBoolean(),
]

const validateCouponRules = [
  body('couponCode').exists().withMessage('couponCode is required').isString().trim().notEmpty(),
  body('orderAmount').exists().withMessage('orderAmount is required').isFloat({ gt: 0 }).withMessage('orderAmount must be greater than 0'),
  body('packageId').optional({ nullable: true }).isMongoId().withMessage('Invalid packageId'),
  body('storageFacilityId').optional({ nullable: true }).isMongoId().withMessage('Invalid storageFacilityId'),
  body('categoryId').optional({ nullable: true }).isMongoId().withMessage('Invalid categoryId'),
  body('categoryIds').optional().isArray().withMessage('categoryIds must be an array'),
  body('categoryIds.*').optional().isMongoId().withMessage('Invalid id in categoryIds'),
]

module.exports = {
  mongoIdParamRules,
  listQueryRules,
  createCouponRules,
  updateCouponRules,
  statusRules,
  validateCouponRules,
}
