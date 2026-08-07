const fs = require('fs')
const path = require('path')

const jwt = require('jsonwebtoken')
const { createRemoteJWKSet, jwtVerify } = require('jose')

const AppError = require('../core/errors/AppError')

/**
 * Server-side verification of Sign in with Apple identity tokens (mobile flow).
 *
 * The identity token is the source of truth: it is verified against Apple's
 * published JWKS (signature), plus issuer, audience and expiry. Nothing the
 * mobile app sends — `user.name`, `user.email`, any Apple user id — is trusted
 * for authentication.
 *
 * The identity token, the authorization code and the Apple private key are all
 * credentials: none of them is ever logged or echoed into an error message.
 */

const APPLE_ISSUER = 'https://appleid.apple.com'
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token'

/**
 * Audiences we accept. For native Sign in with Apple the `aud` is the app's
 * **bundle ID**; the web flow uses the Services ID instead, so both are allowed:
 *
 *   APPLE_MOBILE_CLIENT_IDS  comma-separated iOS/Android bundle IDs (optional)
 *   APPLE_CLIENT_ID          Services ID already used by the web OAuth flow
 */
function getAcceptedAudiences () {
  const audiences = String(process.env.APPLE_MOBILE_CLIENT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const servicesId = String(process.env.APPLE_CLIENT_ID || '').trim()
  if (servicesId) audiences.push(servicesId)

  return [...new Set(audiences)]
}

// createRemoteJWKSet caches Apple's keys in-process and refetches only when an
// unknown `kid` appears (with its own cooldown), so key rotation is handled
// without hardcoding or re-downloading keys per login.
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

function isConfigured () {
  return getAcceptedAudiences().length > 0
}

/** Apple's own relay addresses are normal, usable emails — never rewrite them. */
function isPrivateRelayEmail (email) {
  return /@privaterelay\.appleid\.com$/i.test(String(email || ''))
}

/**
 * @param {string} identityToken raw Apple identity token from the app
 * @returns {Promise<{appleId: string, email: string|null, emailVerified: boolean,
 *   isPrivateRelay: boolean, audience: string|null}>}
 * @throws {AppError} operational error with a client-safe message
 */
async function verifyAppleIdentityToken (identityToken) {
  const audience = getAcceptedAudiences()
  if (!audience.length) {
    // Same wording the web OAuth routes use when a strategy is unconfigured.
    throw new AppError('Apple sign in is not configured yet', 503, 'APPLE_NOT_CONFIGURED')
  }

  let payload
  try {
    // Verifies signature against Apple's JWKS + issuer + audience + exp/nbf.
    const verified = await jwtVerify(String(identityToken), getJwks(), {
      issuer: APPLE_ISSUER,
      audience,
      clockTolerance: 30,
    })
    payload = verified.payload
  } catch (error) {
    // jose's code/message says which check failed (signature, aud, exp…). Kept
    // for the server log on a separate property so it cannot leak via `message`.
    const failure = new AppError('Apple sign in failed. Please try again.', 401, 'APPLE_TOKEN_INVALID')
    failure.verificationReason = error?.code || error?.message || 'verification failed'
    throw failure
  }

  if (!payload.sub) {
    throw new AppError('Apple sign in failed. Please try again.', 401, 'APPLE_TOKEN_INVALID')
  }

  const email = payload.email ? String(payload.email).trim().toLowerCase() : null

  // Apple sends email_verified as a boolean or the string "true".
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true'

  return {
    appleId: String(payload.sub),
    // An unverified address is never used for linking or creation (see the service).
    email: email && emailVerified ? email : null,
    unverifiedEmail: email && !emailVerified ? email : null,
    emailVerified,
    isPrivateRelay: isPrivateRelayEmail(email),
    audience: typeof payload.aud === 'string' ? payload.aud : Array.isArray(payload.aud) ? payload.aud[0] : null,
  }
}

/** Reads the Apple .p8 signing key from env, matching auth/passport.js conventions. */
function readApplePrivateKey () {
  if (process.env.APPLE_PRIVATE_KEY) {
    return String(process.env.APPLE_PRIVATE_KEY).replace(/\\n/g, '\n')
  }
  if (process.env.APPLE_PRIVATE_KEY_PATH) {
    const keyPath = path.resolve(__dirname, '..', process.env.APPLE_PRIVATE_KEY_PATH)
    return fs.readFileSync(keyPath, 'utf8')
  }
  return null
}

function canExchangeAuthorizationCode () {
  return Boolean(process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && readApplePrivateKey())
}

/**
 * Apple's "client secret" is a short-lived ES256 JWT signed with the .p8 key —
 * the key itself never leaves the server and is never sent to the app.
 */
function buildAppleClientSecret (clientId) {
  const privateKey = readApplePrivateKey()
  if (!privateKey) throw new AppError('Apple sign in is not configured yet', 503, 'APPLE_NOT_CONFIGURED')

  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    keyid: process.env.APPLE_KEY_ID,
    issuer: process.env.APPLE_TEAM_ID,
    audience: APPLE_ISSUER,
    subject: clientId,
    expiresIn: '5m',
  })
}

/**
 * Exchanges the one-time authorization code at Apple's token endpoint. Used as a
 * cross-check on the identity token, never as the identity itself.
 *
 * Returns the `sub` from the id_token Apple hands back, so the caller can confirm
 * it is the same user. Codes are single-use and expire in ~5 minutes, so a
 * failure here is not by itself evidence of an attack — see the route.
 *
 * @returns {Promise<{sub: string|null, email: string|null}>}
 */
async function exchangeAppleAuthorizationCode (authorizationCode, clientId) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: buildAppleClientSecret(clientId),
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
    const failure = new AppError('Apple sign in failed. Please try again.', 401, 'APPLE_CODE_INVALID')
    failure.verificationReason = `${response.status} ${appleError}`
    throw failure
  }

  const tokens = await response.json()
  // The response's id_token comes straight from Apple over TLS; decoding is
  // enough to read `sub` for the cross-check (it is not used to authenticate).
  const decoded = tokens?.id_token ? jwt.decode(tokens.id_token) : null

  return {
    sub: decoded?.sub ? String(decoded.sub) : null,
    email: decoded?.email ? String(decoded.email).trim().toLowerCase() : null,
  }
}

module.exports = {
  verifyAppleIdentityToken,
  exchangeAppleAuthorizationCode,
  canExchangeAuthorizationCode,
  getAcceptedAudiences,
  isConfigured,
  isPrivateRelayEmail,
  APPLE_ISSUER,
  APPLE_JWKS_URL,
  APPLE_TOKEN_URL,
}
