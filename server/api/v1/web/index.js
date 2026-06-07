const express = require('express')
const router = express.Router()

router.use('/products', require('./routes/products.routes'))
router.use('/dynamic-form', require('./routes/dynamicForm.routes'))

// Future modules:
// router.use('/user', require('./routes/user.routes'))
// router.use('/feed', require('./routes/feed.routes'))
// router.use('/admin', require('./routes/admin.routes'))

module.exports = router
