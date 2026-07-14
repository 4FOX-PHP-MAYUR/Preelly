const { body, param, query } = require('express-validator')

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
    .isIn(['facilityWeek', 'facilityAmount', 'displayOrder', 'status', 'createdAt', 'updatedAt']),
  query('sortDir').optional().isIn(['asc', 'desc']),
]

const facilityWeekRule = (chain) =>
  chain
    .isString()
    .withMessage('facilityWeek must be a string')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Facility week must be at least 3 characters')
    .isLength({ max: 100 })
    .withMessage('Facility week cannot exceed 100 characters')

const facilityAmountRule = (chain) =>
  chain.isFloat({ gt: 0 }).withMessage('Facility amount must be greater than 0')

// Payloads arrive as multipart/form-data (icon upload), so every scalar is a string here.
const createStorageFacilityRules = [
  facilityWeekRule(body('facilityWeek').exists().withMessage('facilityWeek is required')),
  facilityAmountRule(body('facilityAmount').exists().withMessage('facilityAmount is required')),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be 0 or greater'),
  body('status').optional().isBoolean().withMessage('status must be a boolean'),
]

const updateStorageFacilityRules = [
  ...mongoIdParamRules,
  facilityWeekRule(body('facilityWeek').optional()),
  facilityAmountRule(body('facilityAmount').optional()),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be 0 or greater'),
  body('status').optional().isBoolean(),
  body('clearImageIcon').optional().isBoolean(),
]

const statusRules = [
  ...mongoIdParamRules,
  body('status').exists().withMessage('status is required').isBoolean(),
]

module.exports = {
  mongoIdParamRules,
  listQueryRules,
  createStorageFacilityRules,
  updateStorageFacilityRules,
  statusRules,
}
