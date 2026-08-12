/**
 * Unit tests for WEB Sign in with Apple (POST /api/auth/apple/web).
 *
 * Covers the web verifier in utils/appleWebIdToken.js, which is separate from the
 * mobile app's verifier and reads only APPLE_WEB_* configuration. The isolation is
 * asserted in both directions: a token minted for the app's bundle ID must NOT
 * verify here, and the web Services ID must not be needed by the app's flow.
 *
 * Tokens are real RS256 JWTs signed by a throwaway key pair generated here, and the
 * verifier resolves them through a stubbed JWKS — so signature, issuer, audience and
 * expiry are checked by the real jose code path. The User model is stubbed, so no
 * database is needed.
 *
 * Run: node tests/appleWebAuth.test.js
 */
const assert = require('assert')
const crypto = require('crypto')
const path = require('path')
const jwt = require('jsonwebtoken')

const APPLE_ID = '001234.fedcba9876543210fedcba9876543210.0123'
const OTHER_APPLE_ID = '009999.aaaabbbbccccddddeeeeffff00001111.9999'
const EMAIL = 'appleweb@example.com'
const RELAY_EMAIL = 'q9w8e7r6t5@privaterelay.appleid.com'
const WEB_SERVICES_ID = 'com.preelly.serviceid'
const MOBILE_BUNDLE_ID = 'com.preelly.preelly'

// ── Throwaway RSA key pair standing in for Apple's signing key ───────────────
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const KID = 'test-apple-web-kid'

// ── Stub jose's createRemoteJWKSet so jwtVerify runs for real, offline ───────
const josePath = require.resolve('jose')
const realJose = require('jose')
let jwksCalls = 0

require.cache[josePath] = {
  id: josePath,
  filename: josePath,
  loaded: true,
  exports: {
    ...realJose,
    createRemoteJWKSet () {
      jwksCalls += 1
      return async (header) => {
        if (header.kid && header.kid !== KID) throw new Error('no applicable key found in the JSON Web Key Set')
        return publicKey
      }
    },
  },
}

// ── Stub the User model before the account service requires it ──────────────
const userPath = require.resolve(path.join(__dirname, '..', 'models', 'User.js'))

let users = []

function makeDoc (fields) {
  return {
    ...fields,
    save () {
      if (!users.includes(this)) users.push(this)
      return Promise.resolve(this)
    },
  }
}

const matches = (doc, query) =>
  Object.entries(query).every(([key, value]) => String(doc[key]) === String(value))

class UserStub {
  constructor (fields) { Object.assign(this, makeDoc(fields)) }
  static findOne (query) { return Promise.resolve(users.find((d) => matches(d, query)) || null) }
  static exists (query) { return Promise.resolve(users.some((d) => matches(d, query))) }
}

require.cache[userPath] = {
  id: userPath,
  filename: userPath,
  loaded: true,
  exports: UserStub,
}

const {
  verifyAppleWebIdentityToken,
  getWebAudience,
  isWebConfigured,
  isPrivateRelayEmail,
  canExchangeWebAuthorizationCode,
} = require('../utils/appleWebIdToken')
// Shared on purpose: one Apple ID must map to one Preelly account whichever client
// the person signed in from. Only the login plumbing above is web-specific.
const { resolveAppleUser } = require('../core/services/appleAuthService')
const { getAcceptedAudiences } = require('../utils/appleIdToken')

/** Signs a real RS256 token with the throwaway key. Audience defaults to the web one. */
function signToken (claims = {}, { expiresIn = '10m', kid = KID } = {}) {
  const { iss, aud, sub, ...rest } = {
    iss: 'https://appleid.apple.com',
    aud: WEB_SERVICES_ID,
    sub: APPLE_ID,
    ...claims,
  }
  return jwt.sign({ iss, aud, sub, ...rest }, privateKey, { algorithm: 'RS256', keyid: kid, expiresIn })
}

function reset () {
  users = []
  process.env.APPLE_WEB_CLIENT_ID = WEB_SERVICES_ID
  // The app's own keys, set to prove the web verifier ignores them entirely.
  process.env.APPLE_MOBILE_CLIENT_IDS = MOBILE_BUNDLE_ID
  process.env.APPLE_CLIENT_ID = ''
  delete process.env.APPLE_WEB_TEAM_ID
  delete process.env.APPLE_WEB_KEY_ID
  delete process.env.APPLE_WEB_PRIVATE_KEY
  delete process.env.APPLE_WEB_PRIVATE_KEY_PATH
  process.env.ENABLE_MOBILE_OTP = 'true'
}

const results = []
async function test (name, fn) {
  reset()
  try {
    await fn()
    results.push(true)
    console.log(`PASS  ${name}`)
  } catch (err) {
    results.push(false)
    console.log(`FAIL  ${name}\n      ${err.message}`)
  }
}

async function expectError (fn, { code, statusCode }) {
  try {
    await fn()
  } catch (err) {
    if (code) assert.strictEqual(err.code, code, `expected code ${code}, got ${err.code}`)
    if (statusCode) assert.strictEqual(err.statusCode, statusCode, `expected ${statusCode}, got ${err.statusCode}`)
    assert.ok(err.isOperational, 'error should be operational (client-safe)')
    return err
  }
  throw new Error('expected an error, none thrown')
}

async function main () {
  // ── Configuration is web-specific ─────────────────────────────────────────
  await test('web audience is APPLE_WEB_CLIENT_ID alone', async () => {
    assert.strictEqual(getWebAudience(), WEB_SERVICES_ID)
    assert.strictEqual(isWebConfigured(), true)
  })

  await test('missing APPLE_WEB_CLIENT_ID returns 503, even with mobile keys set', async () => {
    process.env.APPLE_WEB_CLIENT_ID = ''
    assert.strictEqual(isWebConfigured(), false)
    await expectError(() => verifyAppleWebIdentityToken(signToken()), {
      code: 'APPLE_WEB_NOT_CONFIGURED',
      statusCode: 503,
    })
  })

  await test('code exchange stays off until the web team/key are configured', async () => {
    assert.strictEqual(canExchangeWebAuthorizationCode(), false, 'mobile key must not enable it')
    process.env.APPLE_WEB_TEAM_ID = 'TEAM123'
    process.env.APPLE_WEB_KEY_ID = 'KEY123'
    process.env.APPLE_WEB_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nstub\\n-----END PRIVATE KEY-----'
    assert.strictEqual(canExchangeWebAuthorizationCode(), true)
  })

  // ── Isolation from the mobile app flow ────────────────────────────────────
  await test('a mobile bundle-ID token is REJECTED by the web verifier', async () => {
    const err = await expectError(() => verifyAppleWebIdentityToken(signToken({ aud: MOBILE_BUNDLE_ID })), {
      code: 'APPLE_WEB_TOKEN_INVALID',
      statusCode: 401,
    })
    assert.strictEqual(err.verificationReason, 'ERR_JWT_CLAIM_VALIDATION_FAILED')
  })

  await test('the app endpoint does not need the web Services ID', async () => {
    // APPLE_CLIENT_ID is empty in reset(), so the app flow accepts app tokens only.
    assert.deepStrictEqual(getAcceptedAudiences(), [MOBILE_BUNDLE_ID])
  })

  // ── Token verification (real signature checks) ─────────────────────────────
  await test('valid web token: returns appleId + verified email only', async () => {
    const profile = await verifyAppleWebIdentityToken(signToken({ email: EMAIL, email_verified: true }))
    assert.strictEqual(profile.appleId, APPLE_ID)
    assert.strictEqual(profile.email, EMAIL)
    assert.strictEqual(profile.emailVerified, true)
    assert.strictEqual(profile.audience, WEB_SERVICES_ID)
  })

  await test('accepts email_verified sent as the string "true" (Apple does this)', async () => {
    const profile = await verifyAppleWebIdentityToken(signToken({ email: EMAIL, email_verified: 'true' }))
    assert.strictEqual(profile.emailVerified, true)
    assert.strictEqual(profile.email, EMAIL)
  })

  await test('private relay email is accepted and flagged, never rewritten', async () => {
    const profile = await verifyAppleWebIdentityToken(signToken({ email: RELAY_EMAIL, email_verified: 'true' }))
    assert.strictEqual(profile.email, RELAY_EMAIL)
    assert.strictEqual(profile.isPrivateRelay, true)
    assert.ok(isPrivateRelayEmail(RELAY_EMAIL))
  })

  await test('unverified email is dropped, not used for linking', async () => {
    const profile = await verifyAppleWebIdentityToken(signToken({ email: EMAIL, email_verified: false }))
    assert.strictEqual(profile.email, null)
    assert.strictEqual(profile.unverifiedEmail, EMAIL)
  })

  await test('token with no email still authenticates (repeat web logins)', async () => {
    const profile = await verifyAppleWebIdentityToken(signToken())
    assert.strictEqual(profile.appleId, APPLE_ID)
    assert.strictEqual(profile.email, null)
  })

  await test('invalid signature (wrong key) is rejected as 401', async () => {
    const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
    const forged = jwt.sign({ iss: 'https://appleid.apple.com', aud: WEB_SERVICES_ID, sub: APPLE_ID }, other,
      { algorithm: 'RS256', keyid: KID, expiresIn: '10m' })
    const err = await expectError(() => verifyAppleWebIdentityToken(forged), {
      code: 'APPLE_WEB_TOKEN_INVALID',
      statusCode: 401,
    })
    assert.ok(!/signature/i.test(err.message), 'client message must stay generic')
    assert.strictEqual(err.verificationReason, 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED')
  })

  await test('expired token is rejected as 401', async () => {
    const err = await expectError(() => verifyAppleWebIdentityToken(signToken({}, { expiresIn: '-5m' })), {
      code: 'APPLE_WEB_TOKEN_INVALID',
      statusCode: 401,
    })
    assert.strictEqual(err.verificationReason, 'ERR_JWT_EXPIRED')
  })

  await test('foreign issuer is rejected as 401', async () => {
    await expectError(() => verifyAppleWebIdentityToken(signToken({ iss: 'https://evil.example.com' })), {
      code: 'APPLE_WEB_TOKEN_INVALID',
      statusCode: 401,
    })
  })

  await test('unsigned (alg:none) token is rejected', async () => {
    const unsigned = jwt.sign({ iss: 'https://appleid.apple.com', aud: WEB_SERVICES_ID, sub: APPLE_ID }, '',
      { algorithm: 'none' })
    await expectError(() => verifyAppleWebIdentityToken(unsigned), {
      code: 'APPLE_WEB_TOKEN_INVALID',
      statusCode: 401,
    })
  })

  await test('Apple JWKS is fetched through one cached key set', async () => {
    const before = jwksCalls
    await verifyAppleWebIdentityToken(signToken())
    await verifyAppleWebIdentityToken(signToken())
    assert.strictEqual(jwksCalls, before, 'key set must be reused across logins')
  })

  // ── Account resolution (shared service, so one Apple ID = one account) ────
  await test('new web user: first login creates the account', async () => {
    const profile = await verifyAppleWebIdentityToken(signToken({ email: EMAIL, email_verified: 'true' }))
    // Exactly what the browser sends: split name, and no email (the token's wins).
    const { user, isNewUser } = await resolveAppleUser(profile, { firstName: 'Web', lastName: 'User' })
    assert.strictEqual(isNewUser, true)
    assert.strictEqual(user.appleProviderId, APPLE_ID)
    assert.strictEqual(user.email, EMAIL)
    assert.strictEqual(user.name, 'Web User')
    assert.strictEqual(user.password, undefined, 'no password may be set for Apple accounts')
  })

  await test('repeat web login without name/email reuses the account', async () => {
    const first = await resolveAppleUser(
      await verifyAppleWebIdentityToken(signToken({ email: EMAIL, email_verified: 'true' })),
      { firstName: 'Web', lastName: 'User' }
    )
    const again = await resolveAppleUser(await verifyAppleWebIdentityToken(signToken()), {})
    assert.strictEqual(again.isNewUser, false)
    assert.strictEqual(again.user._id, first.user._id)
    assert.strictEqual(again.user.name, 'Web User', 'existing name must not be blanked')
    assert.strictEqual(users.length, 1, 'no duplicate account')
  })

  await test('a web login lands on the account the app created (same Apple ID)', async () => {
    // Pre-existing row as the app's flow would have written it.
    users = [makeDoc({
      _id: 'm1', appleProviderId: APPLE_ID, email: EMAIL, name: 'App User',
      status: 'active', isEmailVerified: true,
    })]
    const { user, isNewUser } = await resolveAppleUser(await verifyAppleWebIdentityToken(signToken()), {})
    assert.strictEqual(isNewUser, false)
    assert.strictEqual(user._id, 'm1', 'must be the same account, not a web-only duplicate')
    assert.strictEqual(user.lastOauthProvider, 'apple')
    assert.strictEqual(users.length, 1)
  })

  await test('existing local account with the same verified email is linked', async () => {
    users = [makeDoc({ _id: 'w2', email: EMAIL, name: 'Signup Name', password: 'hash', status: 'active' })]
    const profile = await verifyAppleWebIdentityToken(signToken({ email: EMAIL, email_verified: 'true' }))
    const { user, linked } = await resolveAppleUser(profile, { firstName: 'Apple', lastName: 'Name' })
    assert.strictEqual(linked, true)
    assert.strictEqual(user._id, 'w2')
    assert.strictEqual(user.appleProviderId, APPLE_ID)
    assert.strictEqual(user.password, 'hash', 'local credential survives linking')
  })

  await test('email already linked to a different Apple account is a 409 conflict', async () => {
    users = [makeDoc({ _id: 'w3', email: EMAIL, appleProviderId: OTHER_APPLE_ID, status: 'active' })]
    const profile = await verifyAppleWebIdentityToken(signToken({ email: EMAIL, email_verified: 'true' }))
    await expectError(() => resolveAppleUser(profile, {}), {
      code: 'APPLE_ACCOUNT_CONFLICT',
      statusCode: 409,
    })
  })

  await test('deactivated account cannot sign in from the web', async () => {
    users = [makeDoc({ _id: 'w4', appleProviderId: APPLE_ID, status: 'inactive' })]
    const profile = await verifyAppleWebIdentityToken(signToken())
    await expectError(() => resolveAppleUser(profile, {}), {
      code: 'ACCOUNT_DEACTIVATED',
      statusCode: 403,
    })
  })

  await test('browser-supplied email/appleId can never override the token', async () => {
    const profile = await verifyAppleWebIdentityToken(signToken({ email: EMAIL, email_verified: 'true' }))
    const { user } = await resolveAppleUser(profile, {
      firstName: 'Attacker', email: 'attacker@evil.com', appleId: OTHER_APPLE_ID, sub: OTHER_APPLE_ID,
    })
    assert.strictEqual(user.email, EMAIL)
    assert.strictEqual(user.appleProviderId, APPLE_ID)
  })

  const failed = results.filter((ok) => !ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

main()
