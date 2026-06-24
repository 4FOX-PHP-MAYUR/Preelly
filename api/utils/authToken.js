const jwt = require('jsonwebtoken')

const getCookieName = () => process.env.JWT_COOKIE_NAME || 'token'

function getAuthTokensFromRequest(req) {
  const tokens = []
  const seen = new Set()
  const add = (value) => {
    const token = String(value || '').trim()
    if (!token || seen.has(token)) return
    seen.add(token)
    tokens.push(token)
  }

  const authHeader = req.headers.authorization || ''
  if (authHeader.startsWith('Bearer ')) add(authHeader.slice(7))
  else if (authHeader) add(authHeader)

  const cookieToken = req.cookies?.[getCookieName()]
  if (cookieToken) add(cookieToken)

  return tokens
}

/**
 * First token only (legacy) — prefer getAuthTokensFromRequest when Bearer may be stale.
 */
function getJwtFromRequest(req) {
  const tokens = getAuthTokensFromRequest(req)
  return tokens[0] || null
}

function getUserIdFromRequest(req, secret = process.env.JWT_SECRET || 'your-secret-key') {
  for (const token of getAuthTokensFromRequest(req)) {
    try {
      const decoded = jwt.verify(token, secret)
      const userId = decoded.userId || decoded.id || null
      if (userId) return userId
    } catch {
      // try next token (e.g. cookie after invalid Bearer)
    }
  }
  return null
}

module.exports = {
  getJwtFromRequest,
  getAuthTokensFromRequest,
  getUserIdFromRequest,
  getCookieName,
}
