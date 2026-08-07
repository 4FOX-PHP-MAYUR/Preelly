const { OAuth2Client } = require('google-auth-library')

const AppError = require('../core/errors/AppError')

/**
 * Server-side verification of Google Sign-In ID tokens (mobile app flow).
 *
 * The mobile app performs Google Sign-In itself and posts only the ID token; we
 * never trust identity fields sent by the client. `verifyIdToken` checks the
 * token signature against Google's published certs, the audience, the issuer and
 * the expiry — so every profile field returned here comes from a token Google
 * signed.
 *
 * The ID token is a credential: it is never logged, and never echoed back in an
 * error message.
 */

// Google only ever issues ID tokens with one of these two `iss` values.
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']

/**
 * Audiences we accept. Google Sign-In on Android/iOS mints the ID token for the
 * client ID the app was configured with, which is usually the *web* client ID
 * (`serverClientId` on Android, the web client on iOS) but can also be a
 * platform-specific one — so this is a list:
 *
 *   GOOGLE_MOBILE_CLIENT_IDS  comma-separated Android/iOS client IDs (optional)
 *   GOOGLE_CLIENT_ID          the web client ID already used by the web OAuth flow
 */
function getAcceptedAudiences () {
  const fromMobile = String(process.env.GOOGLE_MOBILE_CLIENT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const webClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim()
  if (webClientId) fromMobile.push(webClientId)

  return [...new Set(fromMobile)]
}

// One client per process so Google's public certs are fetched once and cached
// by the library rather than on every login.
let cachedClient = null
function getClient () {
  if (!cachedClient) cachedClient = new OAuth2Client()
  return cachedClient
}

function isConfigured () {
  return getAcceptedAudiences().length > 0
}

/**
 * @param {string} idToken raw Google ID token from the mobile app
 * @returns {Promise<{googleId: string, email: string, emailVerified: boolean,
 *   firstName: string|null, lastName: string|null, fullName: string|null, picture: string|null}>}
 * @throws {AppError} operational error with a client-safe message
 */
async function verifyGoogleIdToken (idToken) {
  const audience = getAcceptedAudiences()
  if (!audience.length) {
    // Same wording the web OAuth routes use when the strategy is unconfigured.
    throw new AppError('Google sign in is not configured yet', 503, 'GOOGLE_NOT_CONFIGURED')
  }

  let ticket
  try {
    // Verifies signature + audience + expiry + issuer in one call.
    ticket = await getClient().verifyIdToken({ idToken: String(idToken), audience })
  } catch (error) {
    // The library's message distinguishes wrong audience / expiry / bad
    // signature. That detail is useful in our logs but is not returned to the
    // client, which always sees the same generic failure. It is carried on a
    // separate property so it can never leak through `message`.
    const failure = new AppError('Google sign in failed. Please try again.', 401, 'GOOGLE_TOKEN_INVALID')
    failure.verificationReason = error?.message || 'verification failed'
    throw failure
  }

  const payload = ticket.getPayload() || {}

  // Defensive: verifyIdToken already rejects foreign issuers, but the issuer
  // check is cheap and this function is the only thing standing between a
  // client-supplied string and an authenticated session.
  if (!GOOGLE_ISSUERS.includes(String(payload.iss))) {
    throw new AppError('Google sign in failed. Please try again.', 401, 'GOOGLE_ISSUER_INVALID')
  }

  if (!payload.sub) {
    throw new AppError('Google sign in failed. Please try again.', 401, 'GOOGLE_TOKEN_INVALID')
  }

  const email = String(payload.email || '').trim().toLowerCase()
  if (!email) {
    throw new AppError(
      'Your Google account did not share an email address. Please use email sign in.',
      400,
      'GOOGLE_EMAIL_MISSING'
    )
  }

  // A Google account can carry an unverified email (e.g. some Workspace
  // aliases). Linking or creating on one would let a stranger claim an address
  // they do not own, so it is refused outright.
  if (payload.email_verified !== true) {
    throw new AppError(
      'Your Google email is not verified. Please verify it with Google and try again.',
      403,
      'GOOGLE_EMAIL_NOT_VERIFIED'
    )
  }

  return {
    googleId: String(payload.sub),
    email,
    emailVerified: true,
    firstName: payload.given_name ? String(payload.given_name).trim() : null,
    lastName: payload.family_name ? String(payload.family_name).trim() : null,
    fullName: payload.name ? String(payload.name).trim() : null,
    picture: payload.picture ? String(payload.picture).trim() : null,
  }
}

module.exports = {
  verifyGoogleIdToken,
  getAcceptedAudiences,
  isConfigured,
  GOOGLE_ISSUERS,
}
