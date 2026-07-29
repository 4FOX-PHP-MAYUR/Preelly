const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { getAuthTokensFromRequest } = require('../utils/authToken')

// Same token resolution as middleware/auth.js, but never rejects the request.
// Public content routes use this so they can apply per-viewer rules (block
// filtering) when a visitor is signed in, while staying open to anonymous users.
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key'
    const tokens = getAuthTokensFromRequest(req)

    for (const token of tokens) {
      try {
        const decoded = jwt.verify(token, secret)
        const user = await User.findById(decoded.userId).select('-password')
        if (user) {
          req.user = user
          break
        }
      } catch {
        // ignore and try the next credential — anonymous access stays valid
      }
    }
  } catch {
    // never block the request on an auth failure
  }
  next()
}

module.exports = optionalAuthMiddleware
