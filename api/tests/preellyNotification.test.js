/**
 * Unit tests for sendPreellyNotificationToUser (services/firebase/preellyNotifications.js).
 * Stubs the DeviceToken model, the User model and the firebase-admin SDK, so no
 * real Firebase project or database connection is needed.
 * Run: node tests/preellyNotification.test.js
 */
const assert = require('assert')
const path = require('path')

const deviceTokenPath = require.resolve(path.join(__dirname, '..', 'models', 'DeviceToken.js'))
const userPath = require.resolve(path.join(__dirname, '..', 'models', 'User.js'))
const firebaseAdminPkgPath = require.resolve('firebase-admin')

let stubbedTokens = []
let deletedManyFilter = null
let stubbedUser = null
let userUpdateFilter = null

require.cache[deviceTokenPath] = {
  id: deviceTokenPath,
  filename: deviceTokenPath,
  loaded: true,
  exports: {
    find() {
      return { lean: () => Promise.resolve(stubbedTokens) }
    },
    deleteMany(filter) {
      deletedManyFilter = filter
      return Promise.resolve({ deletedCount: filter.token.$in.length })
    },
  },
}

require.cache[userPath] = {
  id: userPath,
  filename: userPath,
  loaded: true,
  exports: {
    findById() {
      return { select: () => ({ lean: () => Promise.resolve(stubbedUser) }) }
    },
    updateOne(filter) {
      userUpdateFilter = filter
      return Promise.resolve({ modifiedCount: 1 })
    },
  },
}

let sendEachForMulticastImpl = null
let multicastCalls = []
require.cache[firebaseAdminPkgPath] = {
  id: firebaseAdminPkgPath,
  filename: firebaseAdminPkgPath,
  loaded: true,
  exports: {
    apps: [{}], // pretend an app is already initialized
    app: () => ({}),
    credential: { cert: () => ({}) },
    initializeApp: () => ({}),
    messaging: () => ({
      sendEachForMulticast: (message) => {
        multicastCalls.push(message)
        return sendEachForMulticastImpl(message)
      },
    }),
  },
}

process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test-project' })

const { sendPreellyNotificationToUser } = require('../services/firebaseAdmin')

function reset () {
  stubbedTokens = []
  stubbedUser = null
  deletedManyFilter = null
  userUpdateFilter = null
  multicastCalls = []
}

const allSucceed = (msg) => Promise.resolve({ responses: msg.tokens.map(() => ({ success: true })) })

async function runTests () {
  // ── the exported name is the documented one ──────────────────────────────
  assert.strictEqual(typeof sendPreellyNotificationToUser, 'function')
  console.log('✓ sendPreellyNotificationToUser is exported from services/firebaseAdmin')

  // ── happy path: multiple devices, one multicast ──────────────────────────
  reset()
  stubbedTokens = [{ token: 'tok-a' }, { token: 'tok-b' }]
  sendEachForMulticastImpl = allSucceed
  let result = await sendPreellyNotificationToUser('user1', 'New Notification', 'You have a new message', {
    type: 'chat',
    chatId: '123',
  })
  assert.strictEqual(result.success, true)
  assert.strictEqual(result.configured, true)
  assert.strictEqual(result.attempted, 2)
  assert.strictEqual(result.successCount, 2)
  assert.strictEqual(result.failureCount, 0)
  assert.strictEqual(multicastCalls.length, 1)
  assert.deepStrictEqual(multicastCalls[0].tokens, ['tok-a', 'tok-b'])
  assert.deepStrictEqual(multicastCalls[0].notification, {
    title: 'New Notification',
    body: 'You have a new message',
  })
  console.log('✓ sends to every registered device of the user in one multicast')

  // ── iOS delivery: APNs options must be present or the alert is silent ────
  reset()
  stubbedTokens = [{ token: 'ios-tok', platform: 'ios' }]
  sendEachForMulticastImpl = allSucceed
  await sendPreellyNotificationToUser('user1', 'New like', 'Someone liked your listing')
  assert.ok(multicastCalls[0].apns, 'an apns block is required for iOS delivery')
  assert.strictEqual(multicastCalls[0].apns.payload.aps.sound, 'default',
    'iOS notifications must carry a sound or they arrive silently')
  assert.strictEqual(multicastCalls[0].apns.headers['apns-priority'], '10')
  console.log('✓ sends iOS-ready APNs options (sound + immediate priority) by default')

  // ── an explicit apns block from the caller wins ───────────────────────────
  reset()
  stubbedTokens = [{ token: 'ios-tok', platform: 'ios' }]
  sendEachForMulticastImpl = allSucceed
  await sendPreellyNotificationToUser('user1', 'T', 'B', {}, {
    apns: { payload: { aps: { sound: 'custom.caf' } } },
  })
  assert.strictEqual(multicastCalls[0].apns.payload.aps.sound, 'custom.caf')
  console.log('✓ a caller-supplied apns block overrides the defaults')

  // ── data values are cast to strings; null/undefined dropped ──────────────
  reset()
  stubbedTokens = [{ token: 'tok-a' }]
  sendEachForMulticastImpl = allSucceed
  await sendPreellyNotificationToUser('user1', 'T', 'B', {
    type: 'chat',
    count: 7,
    productId: { toString: () => 'prod-1' },
    actorId: undefined,
    extra: null,
  })
  const sentData = multicastCalls[0].data
  Object.values(sentData).forEach((v) => assert.strictEqual(typeof v, 'string'))
  assert.strictEqual(sentData.count, '7')
  assert.strictEqual(sentData.productId, 'prod-1')
  assert.strictEqual('actorId' in sentData, false)
  assert.strictEqual('extra' in sentData, false)
  console.log('✓ casts data values to strings and drops null/undefined keys')

  // ── legacy User.deviceToken is included and de-duplicated ────────────────
  reset()
  stubbedTokens = [{ token: 'tok-a' }]
  stubbedUser = { deviceToken: 'legacy-tok' }
  sendEachForMulticastImpl = allSucceed
  result = await sendPreellyNotificationToUser('user1', 'T', 'B')
  assert.deepStrictEqual(multicastCalls[0].tokens, ['tok-a', 'legacy-tok'])
  assert.strictEqual(result.attempted, 2)
  console.log('✓ also notifies the legacy User.deviceToken captured at OTP login')

  reset()
  stubbedTokens = [{ token: 'shared-tok' }]
  stubbedUser = { deviceToken: 'shared-tok' }
  sendEachForMulticastImpl = allSucceed
  result = await sendPreellyNotificationToUser('user1', 'T', 'B')
  assert.deepStrictEqual(multicastCalls[0].tokens, ['shared-tok'], 'a token in both stores must be sent once')
  assert.strictEqual(result.attempted, 1)
  console.log('✓ de-duplicates a token present in both stores')

  // ── stale tokens are purged from the store they came from ────────────────
  reset()
  stubbedTokens = [{ token: 'stale-collection' }, { token: 'good' }]
  stubbedUser = { deviceToken: 'stale-legacy' }
  sendEachForMulticastImpl = () => Promise.resolve({
    responses: [
      { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      { success: true },
      { success: false, error: { code: 'messaging/invalid-registration-token' } },
    ],
  })
  result = await sendPreellyNotificationToUser('user1', 'T', 'B')
  assert.deepStrictEqual(deletedManyFilter.token.$in, ['stale-collection'], 'only the collection token is deleted')
  assert.ok(userUpdateFilter, 'the legacy token must be cleared on the user document')
  assert.deepStrictEqual(userUpdateFilter.deviceToken.$in, ['stale-legacy'])
  assert.strictEqual(userUpdateFilter._id, 'user1', 'cleanup must be scoped to this user')
  assert.strictEqual(result.staleTokensRemoved, 2)
  assert.strictEqual(result.successCount, 1)
  assert.strictEqual(result.failureCount, 2)
  assert.strictEqual(result.success, true, 'one delivered device still counts as a success')
  console.log('✓ purges stale tokens from the correct store and keeps the valid one')

  // ── errors never leak a raw token ────────────────────────────────────────
  assert.ok(result.errors.length)
  result.errors.forEach((e) => {
    assert.strictEqual(e.token.includes('stale'), false, 'error entries must mask the token')
  })
  console.log('✓ masks device tokens in the error summary')

  // ── transient failures must not delete anything ──────────────────────────
  reset()
  stubbedTokens = [{ token: 'tok-a' }]
  sendEachForMulticastImpl = () => Promise.resolve({
    responses: [{ success: false, error: { code: 'messaging/internal-error' } }],
  })
  result = await sendPreellyNotificationToUser('user1', 'T', 'B')
  assert.strictEqual(deletedManyFilter, null, 'transient errors must not delete the token')
  assert.strictEqual(result.success, false)
  assert.strictEqual(result.reason, 'all-sends-failed')
  console.log('✓ keeps tokens on transient send failures and reports failure')

  // ── user with no devices is a benign no-op ───────────────────────────────
  reset()
  sendEachForMulticastImpl = allSucceed
  result = await sendPreellyNotificationToUser('user1', 'T', 'B')
  assert.strictEqual(multicastCalls.length, 0, 'must not call FCM with an empty token list')
  assert.strictEqual(result.reason, 'no-device-tokens')
  assert.strictEqual(result.success, true)
  console.log('✓ skips the send when the user has no registered devices')

  // ── guard rails ──────────────────────────────────────────────────────────
  reset()
  sendEachForMulticastImpl = allSucceed
  result = await sendPreellyNotificationToUser(null, 'T', 'B')
  assert.strictEqual(result.reason, 'missing-user-id')
  assert.strictEqual(multicastCalls.length, 0)

  result = await sendPreellyNotificationToUser('user1', '', '')
  assert.strictEqual(result.reason, 'empty-notification')
  assert.strictEqual(multicastCalls.length, 0)
  console.log('✓ rejects a missing userId and an empty notification without calling FCM')

  // ── batches beyond the 500-token multicast limit ─────────────────────────
  reset()
  stubbedTokens = Array.from({ length: 501 }, (_, i) => ({ token: `tok-${i}` }))
  sendEachForMulticastImpl = allSucceed
  result = await sendPreellyNotificationToUser('user1', 'T', 'B')
  assert.strictEqual(multicastCalls.length, 2, 'must split into 500-token batches')
  assert.strictEqual(multicastCalls[0].tokens.length, 500)
  assert.strictEqual(multicastCalls[1].tokens.length, 1)
  assert.strictEqual(result.successCount, 501)
  console.log('✓ splits sends larger than the 500-token FCM multicast limit')

  // ── never throws out of the caller ───────────────────────────────────────
  reset()
  stubbedTokens = [{ token: 'tok-a' }]
  sendEachForMulticastImpl = () => Promise.reject(new Error('network down'))
  result = await sendPreellyNotificationToUser('user1', 'T', 'B')
  assert.strictEqual(result.success, false)
  assert.strictEqual(result.reason, 'exception')
  assert.strictEqual(result.error, 'network down')
  console.log('✓ swallows SDK errors and reports them instead of throwing')

  console.log('\nAll preellyNotification tests passed.')
}

runTests().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
