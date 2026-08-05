const { body, param, query } = require('express-validator')

const mongoIdParamRules = [
  param('id').exists().withMessage('id is required').isMongoId().withMessage('Invalid id'),
]

const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
  query('search').optional().isString().trim(),
  query('slug').optional().isString().trim(),
  query('status').optional().isIn(['active', 'inactive', 'all']).withMessage('Invalid status filter'),
  query('fromDate').optional().isISO8601().withMessage('fromDate must be a valid date'),
  query('toDate').optional().isISO8601().withMessage('toDate must be a valid date'),
  query('sortBy').optional().isIn(['pageTitle', 'pageSlug', 'displayOrder', 'status', 'createdAt', 'updatedAt']),
  query('sortDir').optional().isIn(['asc', 'desc']),
]

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const pageTitleRule = (chain) =>
  chain
    .isString()
    .withMessage('pageTitle must be a string')
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Page title must be between 2 and 150 characters')

const pageSlugRule = (chain) =>
  chain
    .isString()
    .withMessage('pageSlug must be a string')
    .trim()
    .toLowerCase()
    .matches(slugPattern)
    .withMessage('Slug may only contain lowercase letters, numbers and hyphens')

const headingRule = (chain) =>
  chain
    .isString()
    .withMessage('heading must be a string')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Heading must be between 1 and 200 characters')

const descriptionRule = (chain) =>
  chain.isString().withMessage('description must be a string').notEmpty().withMessage('Description is required')

// Payloads arrive as multipart/form-data (optional banner image upload), so every scalar is a string here.
const createPageRules = [
  pageTitleRule(body('pageTitle').exists().withMessage('pageTitle is required')),
  pageSlugRule(body('pageSlug').optional({ checkFalsy: true })),
  headingRule(body('heading').exists().withMessage('heading is required')),
  descriptionRule(body('description').exists().withMessage('description is required')),
  body('metaTitle').optional().isString().trim().isLength({ max: 70 }).withMessage('Meta title should not exceed 70 characters'),
  body('metaDescription').optional().isString().trim().isLength({ max: 160 }).withMessage('Meta description should not exceed 160 characters'),
  body('metaKeywords').optional().isString().trim(),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be 0 or greater'),
  body('status').optional().isBoolean().withMessage('status must be a boolean'),
]

const updatePageRules = [
  ...mongoIdParamRules,
  pageTitleRule(body('pageTitle').optional()),
  pageSlugRule(body('pageSlug').optional({ checkFalsy: true })),
  headingRule(body('heading').optional()),
  descriptionRule(body('description').optional()),
  body('metaTitle').optional().isString().trim().isLength({ max: 70 }),
  body('metaDescription').optional().isString().trim().isLength({ max: 160 }),
  body('metaKeywords').optional().isString().trim(),
  body('displayOrder').optional().isInt({ min: 0 }),
  body('status').optional().isBoolean(),
  body('clearPageBannerImage').optional().isBoolean(),
]

const statusRules = [
  ...mongoIdParamRules,
  body('status').exists().withMessage('status is required').isBoolean(),
]

const slugParamRules = [
  param('slug').exists().withMessage('slug is required').isString().trim(),
]

module.exports = {
  mongoIdParamRules,
  listQueryRules,
  createPageRules,
  updatePageRules,
  statusRules,
  slugParamRules,
}
