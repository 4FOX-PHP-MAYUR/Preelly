const { body, param, query } = require('express-validator')

const mongoIdParamRules = [
  param('id').exists().withMessage('id is required').isMongoId().withMessage('Invalid id'),
]

const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
  query('search').optional().isString().trim(),
  query('status').optional().isIn(['active', 'inactive', 'all']).withMessage('Invalid status filter'),
  query('sortBy').optional().isIn(['name', 'slug', 'status', 'createdAt', 'updatedAt']),
  query('sortDir').optional().isIn(['asc', 'desc']),
]

const createEmirateRules = [
  body('name').exists().withMessage('name is required').isString().trim().notEmpty(),
  body('slug').optional().isString().trim(),
  body('status').optional().isBoolean().withMessage('status must be a boolean'),
]

const updateEmirateRules = [
  ...mongoIdParamRules,
  body('name').optional().isString().trim().notEmpty(),
  body('slug').optional().isString().trim(),
  body('status').optional().isBoolean(),
]

const statusRules = [
  ...mongoIdParamRules,
  body('status').exists().withMessage('status is required').isBoolean(),
]

module.exports = {
  mongoIdParamRules,
  listQueryRules,
  createEmirateRules,
  updateEmirateRules,
  statusRules,
}
