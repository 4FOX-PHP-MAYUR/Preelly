const express = require('express')
const router = express.Router()
const mobileRouter = require('./mobile')
const webRouter = require('./web')

/**
 * API v1 entry — mounts platform-specific routers.
 *
 * /api/v1/mobile/*  → Mobile application
 * /api/v1/web/*     → Website + admin panel
 */
router.use('/mobile', mobileRouter)
router.use('/web', webRouter)

module.exports = router
