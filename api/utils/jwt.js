const jwt = require('jsonwebtoken')
const { isCookieSecure } = require('./cookieSecure')

function generateJwtToken (userId) {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn })
}

function getCookieOptions () {
  const secure = isCookieSecure()
  const sameSite = process.env.JWT_COOKIE_SAME_SITE || 'lax'
  const maxAgeMs = Number(process.env.JWT_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000) // default ~7d

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: maxAgeMs,
  }
}

function getCookieClearOptions () {
  // Express requires similar flags (path/secure/sameSite) to reliably clear cookies across environments.
  const secure = isCookieSecure()
  const sameSite = process.env.JWT_COOKIE_SAME_SITE || 'lax'
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  }
}

function getCookieName () {
  return process.env.JWT_COOKIE_NAME || 'token'
}

function setJwtCookie (res, token) {
  const cookieName = getCookieName()
  res.cookie(cookieName, token, getCookieOptions())
}

module.exports = { generateJwtToken, setJwtCookie, getCookieName, getCookieClearOptions }

