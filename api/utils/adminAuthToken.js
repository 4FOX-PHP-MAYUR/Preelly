/**
 * Token extraction for the Admin Panel auth system. Deliberately separate
 * from api/utils/authToken.js (marketplace customers) — the two systems
 * must never read each other's tokens/cookies.
 */
const getAdminCookieName = () => process.env.ADMIN_JWT_COOKIE_NAME || 'admin_token'

function getAdminAuthTokensFromRequest(req) {
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

  const cookieToken = req.cookies?.[getAdminCookieName()]
  if (cookieToken) add(cookieToken)

  return tokens
}

module.exports = {
  getAdminCookieName,
  getAdminAuthTokensFromRequest,
}
