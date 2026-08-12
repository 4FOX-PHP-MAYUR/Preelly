const fs = require('fs')
const path = require('path')

const jwt = require('jsonwebtoken')
const { createRemoteJWKSet, jwtVerify } = require('jose')

const AppError = require('../core/errors/AppError')

/**
 * Sign in with Apple — **web only**.
 *
 * Deliberately separate from utils/appleIdToken.js (the mobile app's verifier):
 * its own env keys, its own accepted audience, its own signing key and its own
 * JWKS cache. The two flows share no configuration, so a change to the web
 * credentials cannot affect the app, and a token minted for one cannot be
 * replayed against the other's endpoint.
 *
 *   APPLE_WEB_CLIENT_ID          Services ID — the ONLY audience accepted here
 *   APPLE_WEB_TEAM_ID            Apple team that owns the signing key
 *   APPLE_WEB_KEY_ID             key id of the .p8
 *   APPLE_WEB_PRIVATE_KEY        .p8 contents (literal \n between lines), or
 *   APPLE_WEB_PRIVATE_KEY_PATH   path to the .p8, relative to api/
 *   APPLE_WEB_REQUIRE_AUTH_CODE  'true' to refuse a login whose code will not redeem
 *
 * Note that a browser token's `aud` is the Services ID while a native token's is
 * the app's bundle ID, so a mobile token fails the audience check here (and a web
 * token fails it there) — the isolation is enforced by Apple's own claim, not just
 * by having two routes.
 *
 * The identity token, the authorization code and the private key are credentials:
 * none of them is ever logged or echoed into an error message.
 */

const APPLE_ISSUER = 'https://appleid.apple.com'
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token'

/** The Services ID, and nothing else — no fallback to the mobile audiences. */
function getWebAudience () {
  return String(process.env.APPLE_WEB_CLIENT_ID || '').trim()
}

function isWebConfigured () {
  return Boolean(getWebAudience())
}

// Own key set: Apple's keys are public, but keeping the cache separate means the
// web flow never depends on the mobile module being loaded or configured.
let cachedJwks = null
function getJwks () {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL), {
      cacheMaxAge: 24 * 60 * 60 * 1000,
      cooldownDuration: 30 * 1000,
      timeoutDuration: 8 * 1000,
    })
  }
  return cachedJwks
}

/** Apple's own relay addresses are normal, usable emails — never rewrite them. */
function isPrivateRelayEmail (email) {
  return /@privaterelay\.appleid\.com$/i.test(String(email || ''))
}

/**
 * Verifies a browser identity token: signature against Apple's JWKS, issuer,
 * audience (the Services ID) and expiry. Nothing the browser sends alongside the
 * token is trusted.
 *
 * @param {string} identityToken raw `id_token` from the Apple JS popup
 * @returns {Promise<{appleId: string, email: string|null, unverifiedEmail: string|null,
 *   emailVerified: boolean, isPrivateRelay: boolean, audience: string|null}>}
 * @throws {AppError} operational error with a client-safe message
 */
async function verifyAppleWebIdentityToken (identityToken) {
  const audience = getWebAudience()
  if (!audience) {
    throw new AppError('Apple sign in is not configured yet', 503, 'APPLE_WEB_NOT_CONFIGURED')
  }

  let payload
  try {
    const verified = await jwtVerify(String(identityToken), getJwks(), {
      issuer: APPLE_ISSUER,
      audience,
      clockTolerance: 30,
    })
    payload = verified.payload
  } catch (error) {
    // Which check failed (signature, aud, exp…) is kept off `message` so it can
    // only ever reach the server log, never the browser.
    const failure = new AppError('Apple sign in failed. Please try again.', 401, 'APPLE_WEB_TOKEN_INVALID')
    failure.verificationReason = error?.code || error?.message || 'verification failed'
    throw failure
  }

  if (!payload.sub) {
    throw new AppError('Apple sign in failed. Please try again.', 401, 'APPLE_WEB_TOKEN_INVALID')
  }

  const email = payload.email ? String(payload.email).trim().toLowerCase() : null
  // Apple sends email_verified as a boolean or the string "true".
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true'

  return {
    appleId: String(payload.sub),
    // An unverified address is never used for linking or account creation.
    email: email && emailVerified ? email : null,
    unverifiedEmail: email && !emailVerified ? email : null,
    emailVerified,
    isPrivateRelay: isPrivateRelayEmail(email),
    audience: typeof payload.aud === 'string' ? payload.aud : Array.isArray(payload.aud) ? payload.aud[0] : null,
  }
}

/** Reads the web .p8 signing key. Separate key/path vars from the mobile flow. */
function readWebPrivateKey () {
  if (process.env.APPLE_WEB_PRIVATE_KEY) {
    return String(process.env.APPLE_WEB_PRIVATE_KEY).replace(/\\n/g, '\n')
  }
  if (process.env.APPLE_WEB_PRIVATE_KEY_PATH) {
    const keyPath = path.resolve(__dirname, '..', process.env.APPLE_WEB_PRIVATE_KEY_PATH)
    return fs.readFileSync(keyPath, 'utf8')
  }
  return null
}

function canExchangeWebAuthorizationCode () {
  return Boolean(process.env.APPLE_WEB_TEAM_ID && process.env.APPLE_WEB_KEY_ID && readWebPrivateKey())
}

/**
 * Apple's "client secret" is a short-lived ES256 JWT signed with the .p8 key — the
 * key itself never leaves the server and is never sent to the browser.
 */
function buildWebClientSecret () {
  const privateKey = readWebPrivateKey()
  if (!privateKey) throw new AppError('Apple sign in is not configured yet', 503, 'APPLE_WEB_NOT_CONFIGURED')

  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    keyid: process.env.APPLE_WEB_KEY_ID,
    issuer: process.env.APPLE_WEB_TEAM_ID,
    audience: APPLE_ISSUER,
    subject: getWebAudience(),
    expiresIn: '5m',
  })
}

/**
 * Redeems the popup's one-time authorization code at Apple as a cross-check on the
 * identity token — never as the identity itself. Codes are single-use and expire in
 * ~5 minutes, so a failure here is not on its own evidence of an attack; only a
 * `sub` mismatch is (see the route).
 *
 * @returns {Promise<{sub: string|null, email: string|null}>}
 */
async function exchangeAppleWebAuthorizationCode (authorizationCode) {
  const body = new URLSearchParams({
    client_id: getWebAudience(),
    client_secret: buildWebClientSecret(),
    code: String(authorizationCode),
    grant_type: 'authorization_code',
  })

  const response = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    // Apple replies { error: 'invalid_grant' } for reused/expired codes.
    let appleError = 'unknown_error'
    try {
      const parsed = await response.json()
      appleError = parsed?.error || appleError
    } catch {
      // non-JSON error body — keep the generic label
    }
    const failure = new AppError('Apple sign in failed. Please try again.', 401, 'APPLE_WEB_CODE_INVALID')
    failure.verificationReason = `${response.status} ${appleError}`
    throw failure
  }

  const tokens = await response.json()
  // The id_token here came straight from Apple over TLS; decoding is enough to read
  // `sub` for the cross-check (it is not used to authenticate).
  const decoded = tokens?.id_token ? jwt.decode(tokens.id_token) : null

  return {
    sub: decoded?.sub ? String(decoded.sub) : null,
    email: decoded?.email ? String(decoded.email).trim().toLowerCase() : null,
  }
}

module.exports = {
  verifyAppleWebIdentityToken,
  exchangeAppleWebAuthorizationCode,
  canExchangeWebAuthorizationCode,
  getWebAudience,
  isWebConfigured,
  isPrivateRelayEmail,
  APPLE_ISSUER,
  APPLE_JWKS_URL,
  APPLE_TOKEN_URL,
}
