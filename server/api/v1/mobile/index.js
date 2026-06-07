const express = require('express')
const router = express.Router()

router.use('/products', require('./routes/products.routes'))

// Future modules:
// router.use('/user', require('./routes/user.routes'))
// router.use('/feed', require('./routes/feed.routes'))
// router.use('/chats', require('./routes/chats.routes'))

module.exports = router
