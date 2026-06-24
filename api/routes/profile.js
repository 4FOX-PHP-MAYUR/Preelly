const express = require('express')
const authMiddleware = require('../middleware/auth')

const router = express.Router()

// Protected route example:
// GET /api/profile
router.get('/profile', authMiddleware, async (req, res) => {
  // `authMiddleware` already attaches `req.user`
  res.json(req.user)
})

module.exports = router

