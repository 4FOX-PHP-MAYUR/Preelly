const { body, query } = require('express-validator')

const dynamicOptionsQueryRules = [
  query('tableName').exists().withMessage('tableName is required').isString().trim().notEmpty(),
  query('valueColumn').optional().isString().trim(),
  query('labelColumn').optional().isString().trim(),
  query('parentColumn').optional().isString().trim(),
  query('statusColumn').optional().isString().trim(),
  query('sortColumn').optional().isString().trim(),
  query('slugColumn').optional().isString().trim(),
  query('deletedColumn').optional().isString().trim(),
  query('parentValue').optional().isString().trim(),
]

const dynamicOptionsBodyRules = [
  body('tableName').exists().withMessage('tableName is required').isString().trim().notEmpty(),
  body('valueColumn').optional().isString().trim(),
  body('labelColumn').optional().isString().trim(),
  body('parentColumn').optional().isString().trim(),
  body('statusColumn').optional().isString().trim(),
  body('sortColumn').optional().isString().trim(),
  body('slugColumn').optional().isString().trim(),
  body('deletedColumn').optional().isString().trim(),
  body('parentValue').optional(),
  body('conditions').optional().isObject(),
  body('activeValue').optional(),
]

module.exports = {
  dynamicOptionsQueryRules,
  dynamicOptionsBodyRules,
}
