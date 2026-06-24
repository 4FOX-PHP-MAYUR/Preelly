const jwt = require('jsonwebtoken')
const User = require('../../models/User')
const { getAuthTokensFromRequest } = require('../../utils/authToken')

/**
 * Base JWT authentication — verifies token and attaches req.user.
 * Does not enforce auth; use requireAuth wrapper for protected routes.
 */
async function authenticate(req, res, next) {
  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key'
    const tokens = getAuthTokensFromRequest(req)

    if (!tokens.length) {
      req.user = null
      return next()
    }

    for (const token of tokens) {
      try {
        const decoded = jwt.verify(token, secret)
        const user = await User.findById(decoded.userId).select('-password')
        if (user) {
          req.user = user
          req.tokenPayload = decoded
          return next()
        }
      } catch {
        // try next credential
      }
    }

    req.user = null
    return next()
  } catch {
    req.user = null
    return next()
  }
}

/**
 * Require authenticated user — use after authenticate().
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    })
  }
  return next()
}

module.exports = { authenticate, requireAuth }
