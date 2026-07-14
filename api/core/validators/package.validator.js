const { body, param, query } = require('express-validator')

const mongoIdParamRules = [
  param('id').exists().withMessage('id is required').isMongoId().withMessage('Invalid id'),
]

const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
  query('search').optional().isString().trim(),
  query('status').optional().isIn(['active', 'inactive', 'all']).withMessage('Invalid status filter'),
  query('isRecomended').optional().isIn(['yes', 'no', 'all']).withMessage('Invalid recommended filter'),
  query('sortBy')
    .optional()
    .isIn(['packageName', 'displayOrder', 'packageAmount', 'validityDays', 'status', 'createdAt', 'updatedAt']),
  query('sortDir').optional().isIn(['asc', 'desc']),
]

const packageNameRule = (chain) =>
  chain
    .isString()
    .withMessage('packageName must be a string')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Package name must be at least 3 characters')
    .isLength({ max: 100 })
    .withMessage('Package name cannot exceed 100 characters')

const packageAmountRule = (chain) =>
  chain
    .isFloat({ gt: 0 })
    .withMessage('Package amount must be greater than 0')

const createPackageRules = [
  packageNameRule(body('packageName').exists().withMessage('packageName is required')),
  packageAmountRule(body('packageAmount').exists().withMessage('packageAmount is required')),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be 0 or greater'),
  body('isVatApplicable').optional().isBoolean().withMessage('isVatApplicable must be a boolean'),
  body('vatAmount')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('VAT percentage must be between 0 and 100'),
  body('validityDays').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Validity must be at least 1 day'),
  body('isRecomended').optional().isBoolean().withMessage('isRecomended must be a boolean'),
  body('packageFeatures').optional().isArray().withMessage('packageFeatures must be an array'),
  body('packageFeatures.*').optional().isString().trim(),
  body('status').optional().isBoolean().withMessage('status must be a boolean'),
]

const updatePackageRules = [
  ...mongoIdParamRules,
  packageNameRule(body('packageName').optional()),
  packageAmountRule(body('packageAmount').optional()),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be 0 or greater'),
  body('isVatApplicable').optional().isBoolean(),
  body('vatAmount')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('VAT percentage must be between 0 and 100'),
  body('validityDays').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Validity must be at least 1 day'),
  body('isRecomended').optional().isBoolean(),
  body('packageFeatures').optional().isArray().withMessage('packageFeatures must be an array'),
  body('packageFeatures.*').optional().isString().trim(),
  body('status').optional().isBoolean(),
]

const statusRules = [
  ...mongoIdParamRules,
  body('status').exists().withMessage('status is required').isBoolean(),
]

module.exports = {
  mongoIdParamRules,
  listQueryRules,
  createPackageRules,
  updatePackageRules,
  statusRules,
}
