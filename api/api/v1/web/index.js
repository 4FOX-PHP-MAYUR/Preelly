const express = require('express')
const router = express.Router()

router.use('/products', require('./routes/products.routes'))
router.use('/categories', require('./routes/categories.routes'))
router.use('/filters', require('./routes/filters.routes'))
router.use('/dynamic-form', require('./routes/dynamicForm.routes'))
router.use('/form-field-options', require('./routes/formFieldOptions.routes'))
router.use('/emirates', require('./routes/emirates.routes'))
router.use('/packages', require('./routes/packages.routes'))
router.use('/storage-facilities', require('./routes/storageFacilities.routes'))
router.use('/checkout', require('./routes/checkout.routes'))
router.use('/search', require('./routes/search.routes'))

// Future modules:
// router.use('/user', require('./routes/user.routes'))
// router.use('/feed', require('./routes/feed.routes'))
// router.use('/admin', require('./routes/admin.routes'))

module.exports = router
