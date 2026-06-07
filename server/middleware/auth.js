const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { getAuthTokensFromRequest } = require('../utils/authToken')

const authMiddleware = async (req, res, next) => {
  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key'
    const tokens = getAuthTokensFromRequest(req)

    if (!tokens.length) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    for (const token of tokens) {
      try {
        const decoded = jwt.verify(token, secret)
        const user = await User.findById(decoded.userId).select('-password')
        if (user) {
          req.user = user
          return next()
        }
      } catch {
        // try cookie / next credential
      }
    }

    return res.status(401).json({ message: 'Invalid or expired token' })
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

module.exports = authMiddleware
