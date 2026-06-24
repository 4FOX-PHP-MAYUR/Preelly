const express = require('express')
const router = express.Router()

router.use('/products', require('./routes/products.routes'))
router.use('/categories', require('./routes/categories.routes'))
router.use('/filters', require('./routes/filters.routes'))
router.use('/search', require('./routes/search.routes'))

// Future modules:
// router.use('/user', require('./routes/user.routes'))
// router.use('/feed', require('./routes/feed.routes'))
// router.use('/chats', require('./routes/chats.routes'))

module.exports = router
