const { body, param, query } = require('express-validator')

const STATUSES = ['draft', 'published', 'discarded']
const MAX_STEP = 20

const mongoIdParamRules = [
  param('id').exists().withMessage('id is required').isMongoId().withMessage('Invalid draft id'),
]

const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
  query('search').optional().isString().trim(),
  query('status').optional().isIn([...STATUSES, 'all']).withMessage('Invalid status filter'),
  query('userId').optional().isMongoId().withMessage('Invalid user filter'),
  query('hasVideo').optional().isIn(['yes', 'no', 'all']).withMessage('Invalid video filter'),
  query('step').optional().isInt({ min: 1, max: MAX_STEP }).withMessage(`step must be between 1 and ${MAX_STEP}`),
  query('fromDate').optional().isISO8601().withMessage('fromDate must be a valid date'),
  query('toDate').optional().isISO8601().withMessage('toDate must be a valid date'),
  query('sortBy')
    .optional()
    .isIn(['updatedAt', 'createdAt', 'lastSavedAt', 'currentStep', 'status', 'imageCount'])
    .withMessage('Invalid sort field'),
  query('sortDir').optional().isIn(['asc', 'desc']).withMessage('Invalid sort direction'),
]

const stepRule = (chain, label) =>
  chain.isInt({ min: 1, max: MAX_STEP }).withMessage(`${label} must be between 1 and ${MAX_STEP}`)

const createDraftRules = [
  body('userId').exists().withMessage('User is required').isMongoId().withMessage('Invalid user'),
  body('status').optional().isIn(STATUSES).withMessage(`status must be one of: ${STATUSES.join(', ')}`),
  stepRule(body('currentStep').optional(), 'Current step'),
  stepRule(body('lastSavedStep').optional({ nullable: true }), 'Last saved step'),
  body('categoryLevel')
    .optional()
    .isInt({ min: 0, max: MAX_STEP })
    .withMessage(`categoryLevel must be between 0 and ${MAX_STEP}`),
  body('selectedCategory').optional({ nullable: true }).custom((value) => {
    if (value === null || value === '') return true
    return /^[a-f\d]{24}$/i.test(String(value))
  }).withMessage('Invalid category'),
  body('productId').optional({ nullable: true }).custom((value) => {
    if (value === null || value === '') return true
    return /^[a-f\d]{24}$/i.test(String(value))
  }).withMessage('Invalid product'),
]

const updateDraftRules = [
  ...mongoIdParamRules,
  body('userId').optional().isMongoId().withMessage('Invalid user'),
  body('status').optional().isIn(STATUSES).withMessage(`status must be one of: ${STATUSES.join(', ')}`),
  stepRule(body('currentStep').optional(), 'Current step'),
  stepRule(body('lastSavedStep').optional({ nullable: true }), 'Last saved step'),
  body('categoryLevel')
    .optional()
    .isInt({ min: 0, max: MAX_STEP })
    .withMessage(`categoryLevel must be between 0 and ${MAX_STEP}`),
  body('selectedCategory').optional({ nullable: true }).custom((value) => {
    if (value === null || value === '') return true
    return /^[a-f\d]{24}$/i.test(String(value))
  }).withMessage('Invalid category'),
  body('productId').optional({ nullable: true }).custom((value) => {
    if (value === null || value === '') return true
    return /^[a-f\d]{24}$/i.test(String(value))
  }).withMessage('Invalid product'),
]

const deleteDraftRules = [
  ...mongoIdParamRules,
  query('soft').optional().isIn(['true', 'false']).withMessage('soft must be true or false'),
]

module.exports = {
  STATUSES,
  MAX_STEP,
  mongoIdParamRules,
  listQueryRules,
  createDraftRules,
  updateDraftRules,
  deleteDraftRules,
}
