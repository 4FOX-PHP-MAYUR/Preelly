const express = require('express')
const router = express.Router()
const { getDynamicForm } = require('../controllers/dynamicForm.controller')

// POST /api/v1/web/dynamic-form
router.post('/', getDynamicForm)

module.exports = router
