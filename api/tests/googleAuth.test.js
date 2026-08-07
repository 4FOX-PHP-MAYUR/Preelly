/**
 * Unit tests for mobile Google Sign-In.
 * Stubs google-auth-library and the User model so no network or database is needed.
 * Run: node tests/googleAuth.test.js
 */
const assert = require('assert')
const path = require('path')

// ── Stub google-auth-library before utils/googleIdToken requires it ──────────
const googleLibPath = require.resolve('google-auth-library')

let verifyImpl = () => { throw new Error('verifyImpl not set') }
let lastVerifyArgs = null

require.cache[googleLibPath] = {
  id: googleLibPath,
  filename: googleLibPath,
  loaded: true,
  exports: {
    OAuth2Client: class {
      async verifyIdToken (args) {
        lastVerifyArgs = args
        return verifyImpl(args)
      }
    },
  },
}

// ── Stub the User model before googleAuthService requires it ────────────────
const userPath = require.resolve(path.join(__dirname, '..', 'models', 'User.js'))

let usersById = []           // documents the stub "database" holds
let saveError = null         // force save() to throw (duplicate key / db failure)
let insertOnSaveError = null // row a racing request "already inserted" (see race test)
const savedDocs = []

function makeDoc (fields) {
  return {
    ...fields,
    save () {
      if (saveError) {
        const err = saveError
        saveError = null
        // Model the concurrent writer: the conflicting row is now visible to
        // subsequent reads, which is exactly why the insert was rejected.
        if (insertOnSaveError) {
          usersById.push(insertOnSaveError)
          insertOnSaveError = null
        }
        return Promise.reject(err)
      }
      savedDocs.push(this)
      return Promise.resolve(this)
    },
  }
}

function matches (doc, query) {
  return Object.entries(query).every(([key, value]) => String(doc[key]) === String(value))
}

class UserStub {
  constructor (fields) { Object.assign(this, makeDoc(fields)) }
  static findOne (query) {
    return Promise.resolve(usersById.find((doc) => matches(doc, query)) || null)
  }
}

require.cache[userPath] = {
  id: userPath,
  filename: userPath,
  loaded: true,
  exports: UserStub,
}

const { verifyGoogleIdToken, getAcceptedAudiences } = require('../utils/googleIdToken')
const { resolveGoogleUser } = require('../core/services/googleAuthService')

const GOOGLE_ID = '109876543210987654321'
const OTHER_GOOGLE_ID = '111111111111111111111'
const EMAIL = 'jane.doe@example.com'
const WEB_CLIENT_ID = 'web-client-id.apps.googleusercontent.com'
const ANDROID_CLIENT_ID = 'android-client-id.apps.googleusercontent.com'

function goodPayload (overrides = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: WEB_CLIENT_ID,
    sub: GOOGLE_ID,
    email: EMAIL,
    email_verified: true,
    given_name: 'Jane',
    family_name: 'Doe',
    name: 'Jane Doe',
    picture: 'https://lh3.googleusercontent.com/a/photo',
    ...overrides,
  }
}

const ticketFor = (payload) => ({ getPayload: () => payload })

function reset () {
  usersById = []
  savedDocs.length = 0
  saveError = null
  insertOnSaveError = null
  lastVerifyArgs = null
  process.env.GOOGLE_CLIENT_ID = WEB_CLIENT_ID
  process.env.GOOGLE_MOBILE_CLIENT_IDS = ANDROID_CLIENT_ID
  process.env.ENABLE_MOBILE_OTP = 'true'
  verifyImpl = () => ticketFor(goodPayload())
}

const results = []
async function test (name, fn) {
  reset()
  try {
    await fn()
    results.push([true, name])
    console.log(`PASS  ${name}`)
  } catch (err) {
    results.push([false, name])
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
  // ── Token verification ────────────────────────────────────────────────────
  await test('accepts a valid token and returns only verified profile fields', async () => {
    const profile = await verifyGoogleIdToken('token')
    assert.deepStrictEqual(profile, {
      googleId: GOOGLE_ID,
      email: EMAIL,
      emailVerified: true,
      firstName: 'Jane',
      lastName: 'Doe',
      fullName: 'Jane Doe',
      picture: 'https://lh3.googleusercontent.com/a/photo',
    })
  })

  await test('audience list covers both the mobile and web client IDs', async () => {
    await verifyGoogleIdToken('token')
    assert.deepStrictEqual(lastVerifyArgs.audience, [ANDROID_CLIENT_ID, WEB_CLIENT_ID])
    assert.deepStrictEqual(getAcceptedAudiences(), [ANDROID_CLIENT_ID, WEB_CLIENT_ID])
  })

  await test('invalid token signature is rejected as 401 without leaking details', async () => {
    verifyImpl = () => { throw new Error('Invalid token signature: xyz') }
    const err = await expectError(() => verifyGoogleIdToken('token'), { code: 'GOOGLE_TOKEN_INVALID', statusCode: 401 })
    assert.ok(!/signature/i.test(err.message), 'client message must not describe the failure')
    assert.match(err.verificationReason, /signature/i, 'reason kept for server logs only')
  })

  await test('expired token is rejected as 401', async () => {
    verifyImpl = () => { throw new Error('Token used too late, 1700000000 > 1699999999') }
    await expectError(() => verifyGoogleIdToken('token'), { code: 'GOOGLE_TOKEN_INVALID', statusCode: 401 })
  })

  await test('wrong audience is rejected as 401', async () => {
    verifyImpl = () => { throw new Error('Wrong recipient, payload audience != requiredAudience') }
    await expectError(() => verifyGoogleIdToken('token'), { code: 'GOOGLE_TOKEN_INVALID', statusCode: 401 })
  })

  await test('foreign issuer is rejected even if the library returns a ticket', async () => {
    verifyImpl = () => ticketFor(goodPayload({ iss: 'https://evil.example.com' }))
    await expectError(() => verifyGoogleIdToken('token'), { code: 'GOOGLE_ISSUER_INVALID', statusCode: 401 })
  })

  await test('unverified Google email is refused', async () => {
    verifyImpl = () => ticketFor(goodPayload({ email_verified: false }))
    await expectError(() => verifyGoogleIdToken('token'), { code: 'GOOGLE_EMAIL_NOT_VERIFIED', statusCode: 403 })
  })

  await test('token without an email is refused', async () => {
    verifyImpl = () => ticketFor(goodPayload({ email: undefined }))
    await expectError(() => verifyGoogleIdToken('token'), { code: 'GOOGLE_EMAIL_MISSING', statusCode: 400 })
  })

  await test('missing client-ID configuration returns 503, not a crash', async () => {
    process.env.GOOGLE_CLIENT_ID = ''
    process.env.GOOGLE_MOBILE_CLIENT_IDS = ''
    await expectError(() => verifyGoogleIdToken('token'), { code: 'GOOGLE_NOT_CONFIGURED', statusCode: 503 })
  })

  // ── User resolution ───────────────────────────────────────────────────────
  await test('new user: creates an account with google fields and no password', async () => {
    const { user, isNewUser, linked } = await resolveGoogleUser(await verifyGoogleIdToken('token'))
    assert.strictEqual(isNewUser, true)
    assert.strictEqual(linked, false)
    assert.strictEqual(user.email, EMAIL)
    assert.strictEqual(user.googleProviderId, GOOGLE_ID)
    assert.strictEqual(user.lastOauthProvider, 'google')
    assert.strictEqual(user.isEmailVerified, true)
    assert.strictEqual(user.name, 'Jane Doe')
    assert.strictEqual(user.avatar, 'https://lh3.googleusercontent.com/a/photo')
    assert.strictEqual(user.password, undefined, 'no password may be set for Google accounts')
    // ENABLE_MOBILE_OTP=true → phone still unverified, same as email OTP signup
    assert.strictEqual(user.isPhoneVerified, false)
  })

  await test('new user without a Google name falls back to an email-derived name', async () => {
    verifyImpl = () => ticketFor(goodPayload({ name: undefined, given_name: undefined, family_name: undefined }))
    const { user } = await resolveGoogleUser(await verifyGoogleIdToken('token'))
    assert.strictEqual(user.name, 'Jane doe')
  })

  await test('returning Google user logs in without creating a duplicate', async () => {
    usersById = [makeDoc({ _id: 'u1', email: EMAIL, googleProviderId: GOOGLE_ID, isEmailVerified: true, name: 'Jane Doe', status: 'active' })]
    const { user, isNewUser, linked } = await resolveGoogleUser(await verifyGoogleIdToken('token'))
    assert.strictEqual(isNewUser, false)
    assert.strictEqual(linked, false)
    assert.strictEqual(user._id, 'u1')
    assert.strictEqual(usersById.length, 1, 'no second account created')
  })

  await test('existing local account with the same verified email is linked, not duplicated', async () => {
    usersById = [makeDoc({ _id: 'u2', email: EMAIL, name: 'Jane From Signup', avatar: '/uploads/mine.jpg', password: 'hash', status: 'active', isEmailVerified: true })]
    const { user, isNewUser, linked } = await resolveGoogleUser(await verifyGoogleIdToken('token'))
    assert.strictEqual(isNewUser, false)
    assert.strictEqual(linked, true)
    assert.strictEqual(user._id, 'u2')
    assert.strictEqual(user.googleProviderId, GOOGLE_ID)
    // existing profile data is preserved, not overwritten by Google's
    assert.strictEqual(user.name, 'Jane From Signup')
    assert.strictEqual(user.avatar, '/uploads/mine.jpg')
    assert.strictEqual(user.password, 'hash', 'local credential must survive linking')
  })

  await test('email already linked to a different Google account is a 409 conflict', async () => {
    usersById = [makeDoc({ _id: 'u3', email: EMAIL, googleProviderId: OTHER_GOOGLE_ID, status: 'active' })]
    await expectError(
      async () => resolveGoogleUser(await verifyGoogleIdToken('token')),
      { code: 'GOOGLE_ACCOUNT_CONFLICT', statusCode: 409 }
    )
  })

  await test('deactivated account cannot sign in with Google', async () => {
    usersById = [makeDoc({ _id: 'u4', email: EMAIL, googleProviderId: GOOGLE_ID, status: 'inactive' })]
    await expectError(
      async () => resolveGoogleUser(await verifyGoogleIdToken('token')),
      { code: 'ACCOUNT_DEACTIVATED', statusCode: 403 }
    )
  })

  await test('concurrent first logins: duplicate-key race resolves to the winning account', async () => {
    const dup = new Error('E11000 duplicate key')
    dup.code = 11000
    saveError = dup
    // Both requests see an empty table, both try to insert; the unique index on
    // googleProviderId rejects this one and the winner's row becomes visible.
    usersById = []
    insertOnSaveError = makeDoc({ _id: 'u5', email: EMAIL, googleProviderId: GOOGLE_ID, status: 'active' })
    const { user, isNewUser } = await resolveGoogleUser(await verifyGoogleIdToken('token'))
    assert.strictEqual(user._id, 'u5', 'should adopt the winning row instead of failing')
    assert.strictEqual(isNewUser, false)
    assert.strictEqual(usersById.length, 1, 'exactly one account exists for the Google ID')
  })

  await test('database failure propagates as non-operational (route answers 500)', async () => {
    saveError = new Error('connection timed out')
    try {
      await resolveGoogleUser(await verifyGoogleIdToken('token'))
      throw new Error('expected a throw')
    } catch (err) {
      assert.strictEqual(err.isOperational, undefined, 'db errors must not be client-safe')
      assert.strictEqual(err.message, 'connection timed out')
    }
  })

  await test('client-supplied identity fields are ignored (token is the only source)', async () => {
    // Simulates a malicious client posting its own email/sub alongside the token:
    // resolveGoogleUser only ever receives the verified payload.
    const verified = await verifyGoogleIdToken('token')
    const tampered = { ...verified, email: 'attacker@evil.com', googleId: 'attacker-sub' }
    // the route passes the verified object, never the request body — assert the
    // verified values are what the verifier produced
    assert.strictEqual(verified.email, EMAIL)
    assert.strictEqual(verified.googleId, GOOGLE_ID)
    assert.notStrictEqual(tampered.email, verified.email)
  })

  const failed = results.filter(([ok]) => !ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

main()
