const { authenticate, requireAuth } = require('./authenticate')
const { getAuthTokensFromRequest } = require('../../utils/authToken')

/**
 * Mobile auth — Bearer token only (no cookie fallback for API clarity).
 * Sets req.platform = 'mobile' for downstream logging/metrics.
 */
function mobileAuthenticate(req, res, next) {
  req.platform = 'mobile'
  req.authMode = 'bearer'

  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    req.user = null
    return next()
  }

  return authenticate(req, res, next)
}

function mobileRequireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Bearer token required',
      code: 'BEARER_REQUIRED',
    })
  }
  return requireAuth(req, res, next)
}

/**
 * Optional: reject web-issued tokens on mobile routes.
 */
function enforceMobileAudience(req, res, next) {
  if (!req.tokenPayload) return next()
  const aud = req.tokenPayload.aud
  if (aud && aud !== 'mobile' && process.env.ENFORCE_JWT_AUDIENCE === 'true') {
    return res.status(403).json({
      success: false,
      message: 'Token not valid for mobile platform',
      code: 'INVALID_AUDIENCE',
    })
  }
  return next()
}

module.exports = {
  mobileAuthenticate,
  mobileRequireAuth,
  enforceMobileAudience,
}
