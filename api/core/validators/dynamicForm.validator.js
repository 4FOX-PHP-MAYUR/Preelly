/**
 * Validation rules for the getDynamicForm endpoint.
 * Uses express-validator — same pattern as product.validator.js.
 */
const { query } = require('express-validator')

/**
 * Rules applied to GET /api/v1/web/dynamic-form?categoryId=<id>
 *
 * categoryId — required, must be a valid 24-char hex MongoDB ObjectId.
 */
const getDynamicFormRules = [
  query('categoryId')
    .notEmpty()
    .withMessage('categoryId is required')
    .isMongoId()
    .withMessage('categoryId must be a valid MongoDB ObjectId'),
]

module.exports = { getDynamicFormRules }
