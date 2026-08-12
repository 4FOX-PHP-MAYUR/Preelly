/**
 * Unit tests for mobile Sign in with Apple.
 *
 * Tokens are real RS256 JWTs signed by a throwaway key pair generated here, and
 * the verifier resolves them through a stubbed JWKS — so signature, issuer,
 * audience and expiry are checked by the real jose code path, not a fake one.
 * The User model is stubbed, so no database is needed.
 *
 * Run: node tests/appleAuth.test.js
 */
const assert = require('assert')
const crypto = require('crypto')
const path = require('path')
const jwt = require('jsonwebtoken')

const APPLE_ID = '001234.fedcba9876543210fedcba9876543210.0123'
const OTHER_APPLE_ID = '009999.aaaabbbbccccddddeeeeffff00001111.9999'
const EMAIL = 'appleuser@example.com'
const RELAY_EMAIL = 'x7k2m9p4qz@privaterelay.appleid.com'
const BUNDLE_ID = 'com.preelly.app'
const SERVICES_ID = 'com.preelly.web'

// ── Throwaway RSA key pair standing in for Apple's signing key ───────────────
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const KID = 'test-apple-kid'

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
      // Returns the key-resolver shape jwtVerify expects; counted so we can assert
      // the remote key set is created once and reused.
      jwksCalls += 1
      return async (header) => {
        if (header.kid && header.kid !== KID) throw new Error('no applicable key found in the JSON Web Key Set')
        // Already a KeyObject — passing it back through createPublicKey would
        // throw ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE and make every verification
        // fail, which would let the negative tests below pass vacuously.
        return publicKey
      }
    },
  },
}

// ── Stub the User model before appleAuthService requires it ─────────────────
const userPath = require.resolve(path.join(__dirname, '..', 'models', 'User.js'))

let users = []
let saveError = null
let insertOnSaveError = null

function makeDoc (fields) {
  return {
    ...fields,
    save () {
      if (saveError) {
        const err = saveError
        saveError = null
        if (insertOnSaveError) {
          users.push(insertOnSaveError)
          insertOnSaveError = null
        }
        return Promise.reject(err)
      }
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

const { verifyAppleIdentityToken, getAcceptedAudiences, isPrivateRelayEmail } = require('../utils/appleIdToken')
const { resolveAppleUser } = require('../core/services/appleAuthService')

/** Signs a real RS256 token with the throwaway key. */
function signToken (claims = {}, { expiresIn = '10m', kid = KID } = {}) {
  const { iss, aud, sub, ...rest } = {
    iss: 'https://appleid.apple.com',
    aud: BUNDLE_ID,
    sub: APPLE_ID,
    ...claims,
  }
  return jwt.sign({ iss, aud, sub, ...rest }, privateKey, { algorithm: 'RS256', keyid: kid, expiresIn })
}

function reset () {
  users = []
  saveError = null
  insertOnSaveError = null
  process.env.APPLE_MOBILE_CLIENT_IDS = BUNDLE_ID
  process.env.APPLE_CLIENT_ID = SERVICES_ID
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
  // ── Token verification (real signature checks) ─────────────────────────────
  await test('valid token: returns appleId + verified email only', async () => {
    const profile = await verifyAppleIdentityToken(signToken({ email: EMAIL, email_verified: true }))
    assert.strictEqual(profile.appleId, APPLE_ID)
    assert.strictEqual(profile.email, EMAIL)
    assert.strictEqual(profile.emailVerified, true)
    assert.strictEqual(profile.isPrivateRelay, false)
    assert.strictEqual(profile.audience, BUNDLE_ID)
  })

  await test('accepts email_verified sent as the string "true" (Apple does this)', async () => {
    const profile = await verifyAppleIdentityToken(signToken({ email: EMAIL, email_verified: 'true' }))
    assert.strictEqual(profile.emailVerified, true)
    assert.strictEqual(profile.email, EMAIL)
  })

  await test('private relay email is accepted and flagged, never rewritten', async () => {
    const profile = await verifyAppleIdentityToken(signToken({ email: RELAY_EMAIL, email_verified: 'true' }))
    assert.strictEqual(profile.email, RELAY_EMAIL)
    assert.strictEqual(profile.isPrivateRelay, true)
    assert.ok(isPrivateRelayEmail(RELAY_EMAIL))
  })

  await test('token with no email at all still authenticates (later Apple logins)', async () => {
    const profile = await verifyAppleIdentityToken(signToken())
    assert.strictEqual(profile.appleId, APPLE_ID)
    assert.strictEqual(profile.email, null)
    assert.strictEqual(profile.emailVerified, false)
  })

  await test('unverified email is dropped, not used for linking', async () => {
    const profile = await verifyAppleIdentityToken(signToken({ email: EMAIL, email_verified: false }))
    assert.strictEqual(profile.email, null, 'unverified email must not be usable')
    assert.strictEqual(profile.unverifiedEmail, EMAIL)
  })

  await test('audience list covers bundle ID and Services ID', async () => {
    assert.deepStrictEqual(getAcceptedAudiences(), [BUNDLE_ID, SERVICES_ID])
    const viaServicesId = await verifyAppleIdentityToken(signToken({ aud: SERVICES_ID }))
    assert.strictEqual(viaServicesId.audience, SERVICES_ID)
  })

  await test('invalid signature (wrong key) is rejected as 401', async () => {
    const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
    const forged = jwt.sign({ iss: 'https://appleid.apple.com', aud: BUNDLE_ID, sub: APPLE_ID }, other,
      { algorithm: 'RS256', keyid: KID, expiresIn: '10m' })
    const err = await expectError(() => verifyAppleIdentityToken(forged), { code: 'APPLE_TOKEN_INVALID', statusCode: 401 })
    assert.ok(!/signature/i.test(err.message), 'client message must stay generic')
    assert.strictEqual(err.verificationReason, 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED')
  })

  await test('unknown signing key id is rejected as 401', async () => {
    const err = await expectError(() => verifyAppleIdentityToken(signToken({}, { kid: 'rotated-away' })),
      { code: 'APPLE_TOKEN_INVALID', statusCode: 401 })
    assert.match(err.verificationReason, /no applicable key/i)
  })

  await test('expired token is rejected as 401', async () => {
    const err = await expectError(() => verifyAppleIdentityToken(signToken({}, { expiresIn: '-5m' })),
      { code: 'APPLE_TOKEN_INVALID', statusCode: 401 })
    assert.strictEqual(err.verificationReason, 'ERR_JWT_EXPIRED')
  })

  await test('wrong audience is rejected as 401', async () => {
    const err = await expectError(() => verifyAppleIdentityToken(signToken({ aud: 'com.someone.else' })),
      { code: 'APPLE_TOKEN_INVALID', statusCode: 401 })
    assert.strictEqual(err.verificationReason, 'ERR_JWT_CLAIM_VALIDATION_FAILED')
  })

  await test('foreign issuer is rejected as 401', async () => {
    const err = await expectError(() => verifyAppleIdentityToken(signToken({ iss: 'https://evil.example.com' })),
      { code: 'APPLE_TOKEN_INVALID', statusCode: 401 })
    assert.strictEqual(err.verificationReason, 'ERR_JWT_CLAIM_VALIDATION_FAILED')
  })

  await test('unsigned (alg:none) token is rejected', async () => {
    const unsigned = jwt.sign({ iss: 'https://appleid.apple.com', aud: BUNDLE_ID, sub: APPLE_ID }, '',
      { algorithm: 'none' })
    await expectError(() => verifyAppleIdentityToken(unsigned), { code: 'APPLE_TOKEN_INVALID', statusCode: 401 })
  })

  await test('missing audience configuration returns 503, not a crash', async () => {
    process.env.APPLE_MOBILE_CLIENT_IDS = ''
    process.env.APPLE_CLIENT_ID = ''
    await expectError(() => verifyAppleIdentityToken(signToken()), { code: 'APPLE_NOT_CONFIGURED', statusCode: 503 })
  })

  await test('Apple JWKS is fetched through one cached key set', async () => {
    const before = jwksCalls
    await verifyAppleIdentityToken(signToken())
    await verifyAppleIdentityToken(signToken())
    assert.strictEqual(jwksCalls, before, 'key set must be reused across logins')
  })

  // ── User resolution ───────────────────────────────────────────────────────
  await test('new user: first login with name + verified email', async () => {
    const profile = await verifyAppleIdentityToken(signToken({ email: EMAIL, email_verified: 'true' }))
    const { user, isNewUser, linked } = await resolveAppleUser(profile, { name: 'John Doe', email: 'lies@evil.com' })
    assert.strictEqual(isNewUser, true)
    assert.strictEqual(linked, false)
    assert.strictEqual(user.appleProviderId, APPLE_ID)
    assert.strictEqual(user.lastOauthProvider, 'apple')
    assert.strictEqual(user.email, EMAIL, 'email must come from the token, not the body')
    assert.strictEqual(user.name, 'John Doe')
    assert.strictEqual(user.isEmailVerified, true)
    assert.strictEqual(user.isPhoneVerified, false)
    assert.strictEqual(user.password, undefined, 'no password may be set for Apple accounts')
  })

  await test('new user: relay email stored as-is', async () => {
    const profile = await verifyAppleIdentityToken(signToken({ email: RELAY_EMAIL, email_verified: 'true' }))
    const { user } = await resolveAppleUser(profile, { firstName: 'Jane', lastName: 'Roe' })
    assert.strictEqual(user.email, RELAY_EMAIL)
    assert.strictEqual(user.name, 'Jane Roe')
  })

  await test('new user: no name and no email falls back to a U-XXXXXXXX username', async () => {
    const profile = await verifyAppleIdentityToken(signToken())
    const { user } = await resolveAppleUser(profile, {})
    assert.match(user.name, /^U-\d{8}$/, `unexpected fallback name: ${user.name}`)
    assert.strictEqual(user.email, undefined, 'no email should be invented')
    assert.strictEqual(user.isEmailVerified, false)
  })

  await test('repeat login without name/email finds the account by appleId', async () => {
    users = [makeDoc({ _id: 'a1', appleProviderId: APPLE_ID, email: EMAIL, name: 'John Doe', status: 'active', isEmailVerified: true })]
    const profile = await verifyAppleIdentityToken(signToken())   // no email, no name
    const { user, isNewUser } = await resolveAppleUser(profile, {})
    assert.strictEqual(isNewUser, false)
    assert.strictEqual(user._id, 'a1')
    assert.strictEqual(user.name, 'John Doe', 'existing name must not be blanked')
    assert.strictEqual(user.email, EMAIL, 'existing email must not be blanked')
    assert.strictEqual(users.length, 1, 'no duplicate account')
  })

  await test('existing local account with the same verified email is linked', async () => {
    users = [makeDoc({ _id: 'a2', email: EMAIL, name: 'Signup Name', password: 'hash', status: 'active', isEmailVerified: false })]
    const profile = await verifyAppleIdentityToken(signToken({ email: EMAIL, email_verified: 'true' }))
    const { user, isNewUser, linked } = await resolveAppleUser(profile, { name: 'Apple Name' })
    assert.strictEqual(isNewUser, false)
    assert.strictEqual(linked, true)
    assert.strictEqual(user._id, 'a2')
    assert.strictEqual(user.appleProviderId, APPLE_ID)
    assert.strictEqual(user.name, 'Signup Name', 'existing name preserved')
    assert.strictEqual(user.password, 'hash', 'local credential survives linking')
    assert.strictEqual(user.isEmailVerified, true)
  })

  await test('unverified Apple email is NOT linked to an existing account', async () => {
    users = [makeDoc({ _id: 'a3', email: EMAIL, name: 'Victim', status: 'active' })]
    const profile = await verifyAppleIdentityToken(signToken({ email: EMAIL, email_verified: false }))
    const { user, isNewUser } = await resolveAppleUser(profile, {})
    assert.strictEqual(isNewUser, true, 'must create a separate account, not seize the existing one')
    assert.notStrictEqual(user._id, 'a3')
    assert.strictEqual(users.find((u) => u._id === 'a3').appleProviderId, undefined)
  })

  await test('email already linked to a different Apple account is a 409 conflict', async () => {
    users = [makeDoc({ _id: 'a4', email: EMAIL, appleProviderId: OTHER_APPLE_ID, status: 'active' })]
    const profile = await verifyAppleIdentityToken(signToken({ email: EMAIL, email_verified: 'true' }))
    await expectError(() => resolveAppleUser(profile, {}), { code: 'APPLE_ACCOUNT_CONFLICT', statusCode: 409 })
  })

  await test('deactivated account cannot sign in with Apple', async () => {
    users = [makeDoc({ _id: 'a5', appleProviderId: APPLE_ID, status: 'inactive' })]
    const profile = await verifyAppleIdentityToken(signToken())
    await expectError(() => resolveAppleUser(profile, {}), { code: 'ACCOUNT_DEACTIVATED', statusCode: 403 })
  })

  await test('concurrent first logins: duplicate-key race adopts the winning row', async () => {
    const dup = new Error('E11000 duplicate key')
    dup.code = 11000
    saveError = dup
    insertOnSaveError = makeDoc({ _id: 'a6', appleProviderId: APPLE_ID, email: EMAIL, status: 'active' })
    const profile = await verifyAppleIdentityToken(signToken({ email: EMAIL, email_verified: 'true' }))
    const { user, isNewUser } = await resolveAppleUser(profile, {})
    assert.strictEqual(user._id, 'a6')
    assert.strictEqual(isNewUser, false)
    assert.strictEqual(users.length, 1)
  })

  await test('database failure propagates as non-operational (route answers 500)', async () => {
    saveError = new Error('connection timed out')
    const profile = await verifyAppleIdentityToken(signToken())
    try {
      await resolveAppleUser(profile, {})
      throw new Error('expected a throw')
    } catch (err) {
      assert.strictEqual(err.isOperational, undefined, 'db errors must not be client-safe')
      assert.strictEqual(err.message, 'connection timed out')
    }
  })

  // ── Web popup flow (same endpoint, Services ID audience) ──────────────────
  await test('web: first login through the Services ID creates the account', async () => {
    const profile = await verifyAppleIdentityToken(
      signToken({ aud: SERVICES_ID, email: EMAIL, email_verified: 'true' })
    )
    // Shape the browser sends: name split in two, no email (the token's wins).
    const { user, isNewUser } = await resolveAppleUser(profile, { firstName: 'Web', lastName: 'User' })
    assert.strictEqual(isNewUser, true)
    assert.strictEqual(profile.audience, SERVICES_ID)
    assert.strictEqual(user.appleProviderId, APPLE_ID)
    assert.strictEqual(user.email, EMAIL)
    assert.strictEqual(user.name, 'Web User')
  })

  await test('web login finds the account created on mobile (same Apple user)', async () => {
    const mobile = await verifyAppleIdentityToken(signToken({ aud: BUNDLE_ID, email: EMAIL, email_verified: 'true' }))
    const created = await resolveAppleUser(mobile, { name: 'Mobile User' })
    assert.strictEqual(created.isNewUser, true)

    // Later web login: different audience, and Apple sends no name/email again.
    const web = await verifyAppleIdentityToken(signToken({ aud: SERVICES_ID }))
    const returning = await resolveAppleUser(web, {})
    assert.strictEqual(returning.isNewUser, false)
    assert.strictEqual(returning.user._id, created.user._id, 'must be the same account')
    assert.strictEqual(returning.user.name, 'Mobile User', 'name must survive the web login')
    assert.strictEqual(users.length, 1, 'no duplicate account across platforms')
  })

  await test('mobile login finds the account created on the web (reverse direction)', async () => {
    const web = await verifyAppleIdentityToken(signToken({ aud: SERVICES_ID, email: EMAIL, email_verified: 'true' }))
    const created = await resolveAppleUser(web, { firstName: 'Web', lastName: 'User' })

    const mobile = await verifyAppleIdentityToken(signToken({ aud: BUNDLE_ID }))
    const returning = await resolveAppleUser(mobile, {})
    assert.strictEqual(returning.isNewUser, false)
    assert.strictEqual(returning.user._id, created.user._id)
    assert.strictEqual(users.length, 1)
  })

  await test('web: a deactivated account is refused with the same 403', async () => {
    users = [makeDoc({ _id: 'a7', appleProviderId: APPLE_ID, status: 'inactive' })]
    const profile = await verifyAppleIdentityToken(signToken({ aud: SERVICES_ID }))
    await expectError(() => resolveAppleUser(profile, {}), { code: 'ACCOUNT_DEACTIVATED', statusCode: 403 })
  })

  await test('client-supplied email/appleId can never override the token', async () => {
    const profile = await verifyAppleIdentityToken(signToken({ email: EMAIL, email_verified: 'true' }))
    const { user } = await resolveAppleUser(profile, {
      name: 'Attacker', email: 'attacker@evil.com', appleId: OTHER_APPLE_ID, sub: OTHER_APPLE_ID,
    })
    assert.strictEqual(user.email, EMAIL)
    assert.strictEqual(user.appleProviderId, APPLE_ID)
  })

  const failed = results.filter((ok) => !ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

main()
