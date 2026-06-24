const express = require('express')
const router = express.Router()
const formFieldOptionsController = require('../controllers/formFieldOptions.controller')
const {
  dynamicOptionsQueryRules,
  dynamicOptionsBodyRules,
} = require('../../../../core/validators/formFieldOptions.validator')
const validateRequest = require('../../../../middleware/validateRequest')

/**
 * @openapi
 * /api/v1/web/form-field-options/tables:
 *   get:
 *     tags: [Web - Form Fields]
 *     summary: List registered option source tables
 *     description: Returns whitelisted MongoDB collections that can be used as form-field option sources.
 */
router.get('/tables', formFieldOptionsController.listRegisteredOptionTables)

/**
 * @openapi
 * /api/v1/web/form-field-options:
 *   get:
 *     tags: [Web - Form Fields]
 *     summary: Fetch dynamic form field options (query params)
 *     description: |
 *       Loads dropdown options from a registered table using column configuration.
 *       Supports parent-child filtering via `parentValue` when `parentColumn` is configured.
 *
 *       **Example:**
 *       ```
 *       GET /api/v1/web/form-field-options?tableName=emirates&valueColumn=id&labelColumn=name&statusColumn=status&sortColumn=name
 *       ```
 *   post:
 *     tags: [Web - Form Fields]
 *     summary: Fetch dynamic form field options (JSON body)
 */
router.get('/', dynamicOptionsQueryRules, validateRequest, formFieldOptionsController.getFormFieldOptions)
router.post('/', dynamicOptionsBodyRules, validateRequest, formFieldOptionsController.getFormFieldOptions)

module.exports = router
