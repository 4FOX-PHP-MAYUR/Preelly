import { APPLE_CLIENT_ID, APPLE_REDIRECT_URI, APPLE_SCOPE } from '../utils/constants'

/**
 * Web "Sign in with Apple" — the browser half of the SAME flow the mobile app uses.
 *
 * Apple's JS SDK runs in a popup (`usePopup: true`), so Apple hands the identity
 * token straight back to this page instead of form-POSTing it to a server
 * callback. The token then goes to POST /api/auth/apple — the endpoint the mobile
 * app already calls — which verifies it against Apple's JWKS (signature, issuer,
 * audience, expiry) and resolves the account through the shared
 * `resolveAppleUser` service. One verification path, one account-resolution rule,
 * both platforms: an Apple user who signs up on iOS lands on the same Preelly
 * account when they sign in here, because `sub` (appleProviderId) identifies them
 * in both cases.
 *
 * Nothing this module sends is trusted as identity by the server: the name is
 * display-only (Apple releases it on first authorization only, via the client),
 * and the email always comes from the verified token, never from here.
 *
 * The token's `aud` is the Services ID, which the API's accepted-audience list
 * already covers next to the mobile bundle IDs — so no backend change is needed.
 */

const APPLE_SDK_URL =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'

/** Apple/SDK error codes that mean "the user backed out", not "something broke". */
const CANCEL_CODES = new Set([
  'popup_closed_by_user',
  'user_cancelled_authorize',
  'user_trigger_new_signin_flow',
])

export class AppleSignInError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'AppleSignInError'
    this.code = code || 'APPLE_SIGN_IN_FAILED'
  }
}

/**
 * Apple only accepts https Return URLs on registered domains, so the button is
 * hidden rather than shown-and-broken when this deployment has no Services ID.
 */
export function isAppleSignInConfigured() {
  return Boolean(APPLE_CLIENT_ID && APPLE_REDIRECT_URI)
}

/**
 * Apple checks the requesting page's origin against the domains registered for the
 * Services ID, and it will not register localhost or a plain-http host. Opening the
 * popup from one only ever shows Apple's own error page, which the SDK cannot read
 * back — the user just sees "invalid_client" and, on closing it, a "cancelled"
 * message. Failing here instead says what is actually wrong.
 */
function isUsableOrigin() {
  if (typeof window === 'undefined') return false
  if (!window.isSecureContext) return false
  return !/^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/i.test(window.location.hostname)
}

let sdkPromise = null

function loadAppleSdk() {
  if (window.AppleID?.auth) return Promise.resolve(window.AppleID)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = APPLE_SDK_URL
    script.async = true
    script.onload = () => {
      if (window.AppleID?.auth) resolve(window.AppleID)
      else {
        sdkPromise = null
        reject(new AppleSignInError('Apple sign in is unavailable right now. Please try again.', 'APPLE_SDK_UNAVAILABLE'))
      }
    }
    script.onerror = () => {
      // Retry on the next click — a blocked/offline load must not poison the page.
      sdkPromise = null
      reject(new AppleSignInError('Could not reach Apple. Check your connection and try again.', 'APPLE_SDK_LOAD_FAILED'))
    }
    document.head.appendChild(script)
  })

  return sdkPromise
}

/**
 * Warm the SDK while the page is idle. Without this the first click has to await a
 * network fetch before it can open the popup, and a popup opened a task later than
 * the click is treated as unrequested and blocked. Safe to call repeatedly, and a
 * failure here is ignored — the click retries and reports it properly.
 */
export function preloadAppleSdk() {
  if (!isAppleSignInConfigured() || !isUsableOrigin()) return
  loadAppleSdk().catch(() => {})
}

/** Opaque value echoed back by Apple — proves the popup response is ours. */
function randomState() {
  const bytes = new Uint8Array(16)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function messageForCode(code) {
  switch (code) {
    case 'invalid_client':
    case 'invalid_request':
      // Services ID / Return URL not registered for this domain in Apple Developer.
      return 'Apple sign in is not available on this site yet.'
    default:
      return 'Apple sign in failed. Please try again.'
  }
}

/**
 * Opens the Apple popup and returns the payload for POST /api/auth/apple.
 *
 * Must be called directly from a click handler — the popup is blocked otherwise.
 * When the SDK is already loaded (see preloadAppleSdk) this reaches
 * `AppleID.auth.signIn()` without awaiting anything first, so the popup still
 * belongs to the click that asked for it.
 *
 * @returns {Promise<{cancelled: boolean, identityToken?: string,
 *   authorizationCode?: string, user?: {firstName: string, lastName: string}}>}
 *   `{ cancelled: true }` when the user closed the sheet — not an error.
 * @throws {AppleSignInError} client-safe message for a genuine failure
 */
export async function signInWithApple() {
  if (!isAppleSignInConfigured()) {
    throw new AppleSignInError('Apple sign in is not configured yet', 'APPLE_NOT_CONFIGURED')
  }

  if (!isUsableOrigin()) {
    throw new AppleSignInError(
      'Apple sign in only works on the live https site, not on localhost.',
      'APPLE_ORIGIN_UNSUPPORTED'
    )
  }

  // Deliberately not `await loadAppleSdk()` on the warm path: awaiting even an
  // already-resolved promise would push signIn() into a later task.
  const AppleID = window.AppleID?.auth ? window.AppleID : await loadAppleSdk()
  const state = randomState()

  AppleID.auth.init({
    clientId: APPLE_CLIENT_ID,
    // Registered Return URL for this domain. In popup mode Apple validates it but
    // never navigates to it, so the page the user is on is preserved.
    redirectURI: APPLE_REDIRECT_URI,
    // Name + email are released on first authorization only; a repeat login
    // returns neither, and the server handles that (it matches on `sub`).
    scope: APPLE_SCOPE,
    state,
    usePopup: true,
  })

  let response
  try {
    response = await AppleID.auth.signIn()
  } catch (error) {
    const code = String(error?.error || error?.details?.error || '')
    if (CANCEL_CODES.has(code)) return { cancelled: true }
    throw new AppleSignInError(messageForCode(code), code || 'APPLE_POPUP_FAILED')
  }

  const authorization = response?.authorization || {}

  if (authorization.state && authorization.state !== state) {
    throw new AppleSignInError('Apple sign in failed. Please try again.', 'APPLE_STATE_MISMATCH')
  }
  if (!authorization.id_token) {
    throw new AppleSignInError('Apple sign in failed. Please try again.', 'APPLE_NO_IDENTITY_TOKEN')
  }

  const name = response?.user?.name || {}

  return {
    cancelled: false,
    identityToken: authorization.id_token,
    // One-time code: the API redeems it with Apple as a cross-check on the token
    // when the signing key is configured, exactly as it does for mobile.
    authorizationCode: authorization.code || '',
    // Display-only hints, and only ever present on a first authorization.
    user: {
      firstName: String(name.firstName || '').trim(),
      lastName: String(name.lastName || '').trim(),
    },
  }
}
