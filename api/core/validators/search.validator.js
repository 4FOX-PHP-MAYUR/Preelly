const { query } = require('express-validator')
const {
  normalizeKeyword,
  SORT_OPTIONS,
  SUGGESTION_MIN_LENGTH,
} = require('../services/searchService')

const keywordQueryRules = [
  query('keyword')
    .exists({ checkFalsy: false })
    .withMessage('keyword is required')
    .bail()
    .isString()
    .withMessage('keyword must be a string')
    .bail()
    .customSanitizer((value) => normalizeKeyword(value))
    .custom((value) => {
      if (!value) {
        throw new Error('keyword cannot be empty or whitespace only')
      }
      return true
    }),
]

const globalSearchQueryRules = [
  ...keywordQueryRules,
  query('type')
    .optional()
    .isIn(['all', 'products', 'properties', 'categories', 'agents', 'agencies'])
    .withMessage('type must be one of: all, products, properties, categories, agents, agencies'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('perCategoryLimit').optional().isInt({ min: 1, max: 20 }).toInt(),
  query('sort')
    .optional()
    .isIn([...SORT_OPTIONS])
    .withMessage('sort must be one of: relevance, newest, oldest'),
  query('include')
    .optional()
    .isString()
    .withMessage('include must be a comma-separated string')
    .bail()
    .custom((value) => {
      const parts = String(value)
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
      const allowed = new Set(['recent', 'popular', 'suggestions'])
      const invalid = parts.filter((part) => !allowed.has(part))
      if (invalid.length) {
        throw new Error('include must contain only: recent, popular, suggestions')
      }
      return true
    }),
  query('popularLimit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('suggestionLimit').optional().isInt({ min: 1, max: 20 }).toInt(),
]

const suggestionsQueryRules = [
  query('keyword')
    .exists({ checkFalsy: false })
    .withMessage('keyword is required')
    .bail()
    .isString()
    .withMessage('keyword must be a string')
    .bail()
    .customSanitizer((value) => normalizeKeyword(value))
    .custom((value) => {
      if (!value) {
        throw new Error('keyword cannot be empty or whitespace only')
      }
      if (value.length < SUGGESTION_MIN_LENGTH) {
        throw new Error(`keyword must be at least ${SUGGESTION_MIN_LENGTH} characters`)
      }
      return true
    }),
  query('limit').optional().isInt({ min: 1, max: 20 }).toInt(),
]

const popularSearchQueryRules = [
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
]

module.exports = {
  keywordQueryRules,
  globalSearchQueryRules,
  suggestionsQueryRules,
  popularSearchQueryRules,
}
