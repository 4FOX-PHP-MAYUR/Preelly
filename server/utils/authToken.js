const getCookieName = () => process.env.JWT_COOKIE_NAME || 'token'

/**
 * Extract JWT from:
 * 1) `Authorization: Bearer <token>` header (current implementation)
 * 2) `httpOnly` cookie (used for social OAuth login)
 */
function getJwtFromRequest (req) {
  const authHeader = req.headers.authorization || ''
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim()
  if (authHeader) return authHeader.trim()

  // cookie-parser populates `req.cookies`
  const cookieToken = req.cookies?.[getCookieName()]
  if (cookieToken) return String(cookieToken).trim()

  return null
}

module.exports = { getJwtFromRequest, getCookieName }

