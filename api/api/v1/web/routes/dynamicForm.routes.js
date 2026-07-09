const express = require('express')
const router = express.Router()
const { getDynamicForm, callFormFieldFunction } = require('../controllers/dynamicForm.controller')

// POST /api/v1/web/dynamic-form
router.post('/', getDynamicForm)

// POST /api/v1/web/dynamic-form/field-function
router.post('/field-function', callFormFieldFunction)

module.exports = router
