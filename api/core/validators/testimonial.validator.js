const { body, param, query } = require('express-validator')

const mongoIdParamRules = [
  param('id').exists().withMessage('id is required').isMongoId().withMessage('Invalid id'),
]

const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
  query('search').optional().isString().trim(),
  query('status').optional().isIn(['active', 'inactive', 'all']).withMessage('Invalid status filter'),
  query('customerType').optional().isIn(['seller', 'buyer', 'all']).withMessage('Invalid customer type filter'),
  query('fromDate').optional().isISO8601().withMessage('fromDate must be a valid date'),
  query('toDate').optional().isISO8601().withMessage('toDate must be a valid date'),
  query('sortBy')
    .optional()
    .isIn(['testimonialName', 'customerType', 'rating', 'displayOrder', 'status', 'createdAt', 'updatedAt']),
  query('sortDir').optional().isIn(['asc', 'desc']),
]

const testimonialNameRule = (chain) =>
  chain
    .isString()
    .withMessage('testimonialName must be a string')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Testimonial name must be between 2 and 100 characters')

const customerTypeRule = (chain) =>
  chain.isIn(['seller', 'buyer']).withMessage('Customer type must be Seller or Buyer')

const testimonialTextRule = (chain) =>
  chain
    .isString()
    .withMessage('testimonial must be a string')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Testimonial must be between 10 and 2000 characters')

const ratingRule = (chain) =>
  chain.isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')

// Payloads arrive as multipart/form-data (profile image upload), so every scalar is a string here.
const createTestimonialRules = [
  testimonialNameRule(body('testimonialName').exists().withMessage('testimonialName is required')),
  customerTypeRule(body('customerType').exists().withMessage('customerType is required')),
  testimonialTextRule(body('testimonial').exists().withMessage('testimonial is required')),
  ratingRule(body('rating').exists().withMessage('rating is required')),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be 0 or greater'),
  body('status').optional().isBoolean().withMessage('status must be a boolean'),
]

const updateTestimonialRules = [
  ...mongoIdParamRules,
  testimonialNameRule(body('testimonialName').optional()),
  customerTypeRule(body('customerType').optional()),
  testimonialTextRule(body('testimonial').optional()),
  ratingRule(body('rating').optional()),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be 0 or greater'),
  body('status').optional().isBoolean(),
  body('clearProfileImage').optional().isBoolean(),
]

const statusRules = [
  ...mongoIdParamRules,
  body('status').exists().withMessage('status is required').isBoolean(),
]

module.exports = {
  mongoIdParamRules,
  listQueryRules,
  createTestimonialRules,
  updateTestimonialRules,
  statusRules,
}
