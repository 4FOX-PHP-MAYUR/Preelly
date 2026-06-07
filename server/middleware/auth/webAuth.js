const { authenticate, requireAuth } = require('./authenticate')

/**
 * Web auth — Bearer header + HTTP-only cookie (existing SPA behavior).
 * Sets req.platform = 'web'.
 */
function webAuthenticate(req, res, next) {
  req.platform = 'web'
  req.authMode = 'bearer_or_cookie'
  return authenticate(req, res, next)
}

function webRequireAuth(req, res, next) {
  return requireAuth(req, res, next)
}

module.exports = { webAuthenticate, webRequireAuth }
