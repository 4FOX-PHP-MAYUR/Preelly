const { body, param, query } = require('express-validator')

const PRICE_TYPES = ['FIXED', 'STARTING_FROM', 'FREE']

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
    .isIn(['serviceName', 'price', 'priceType', 'displayOrder', 'status', 'createdAt', 'updatedAt']),
  query('sortDir').optional().isIn(['asc', 'desc']),
]

const serviceNameRule = (chain) =>
  chain
    .isString()
    .withMessage('serviceName must be a string')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Service name must be at least 2 characters')
    .isLength({ max: 120 })
    .withMessage('Service name cannot exceed 120 characters')

const createCheckoutServiceRules = [
  serviceNameRule(body('serviceName').exists().withMessage('serviceName is required')),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description too long'),
  body('priceType').optional().isIn(PRICE_TYPES).withMessage('Invalid price type'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  body('learnMoreUrl').optional().isString().trim(),
  body('buttonText').optional().isString().isLength({ max: 60 }).withMessage('Button text too long'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be 0 or greater'),
  body('isDefault').optional().isBoolean().withMessage('isDefault must be a boolean'),
  body('status').optional().isBoolean().withMessage('status must be a boolean'),
]

const updateCheckoutServiceRules = [
  ...mongoIdParamRules,
  serviceNameRule(body('serviceName').optional()),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description too long'),
  body('priceType').optional().isIn(PRICE_TYPES).withMessage('Invalid price type'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  body('learnMoreUrl').optional().isString().trim(),
  body('buttonText').optional().isString().isLength({ max: 60 }).withMessage('Button text too long'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be 0 or greater'),
  body('isDefault').optional().isBoolean(),
  body('status').optional().isBoolean(),
]

const statusRules = [
  ...mongoIdParamRules,
  body('status').exists().withMessage('status is required').isBoolean(),
]

module.exports = {
  mongoIdParamRules,
  listQueryRules,
  createCheckoutServiceRules,
  updateCheckoutServiceRules,
  statusRules,
}
