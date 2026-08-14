/**
 * Unit tests for services/firebaseAdmin.js.
 * Stubs the DeviceToken model and the firebase-admin SDK so no real
 * Firebase project or database connection is needed.
 * Run: node tests/firebaseAdmin.test.js
 */
const assert = require('assert')
const path = require('path')

const deviceTokenPath = require.resolve(path.join(__dirname, '..', 'models', 'DeviceToken.js'))
const firebaseAdminPkgPath = require.resolve('firebase-admin')

let stubbedTokens = []
let deletedManyFilter = null

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

let sendEachForMulticastImpl = null
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
      sendEachForMulticast: (message) => sendEachForMulticastImpl(message),
    }),
  },
}

process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test-project' })

const { sendPushToUser, maskToken } = require('../services/firebaseAdmin')

async function runTests() {
  // ── maskToken never leaks the full token ────────────────────────────────
  assert.strictEqual(maskToken('abcdefghijklmnop'), 'abcd...mnop')
  assert.strictEqual(maskToken('short'), '***')
  console.log('✓ maskToken masks the token body')

  // ── no device tokens registered → no send attempted ─────────────────────
  stubbedTokens = []
  let sendCalled = false
  sendEachForMulticastImpl = () => { sendCalled = true; return Promise.resolve({ responses: [] }) }
  let result = await sendPushToUser('user1', { notification: { title: 'Hi', body: 'there' }, data: {} })
  assert.strictEqual(sendCalled, false, 'should not call FCM when the user has no device tokens')
  assert.strictEqual(result.configured, true)
  assert.strictEqual(result.attempted, 0)
  console.log('✓ skips send when user has no registered device tokens')

  // ── result summary reports per-call outcome (used by the manual test-push route) ──
  stubbedTokens = [{ token: 'ok-1' }, { token: 'ok-2' }]
  sendEachForMulticastImpl = () => Promise.resolve({ responses: [{ success: true }, { success: true }] })
  result = await sendPushToUser('user1', { notification: { title: 'T', body: 'B' }, data: {} })
  assert.deepStrictEqual(result, {
    configured: true, attempted: 2, successCount: 2, failureCount: 0, staleTokensRemoved: 0, errors: [],
  })
  console.log('✓ returns a full success summary when every token succeeds')

  // ── data payload values are all cast to strings ─────────────────────────
  stubbedTokens = [{ token: 'tok-1' }]
  let capturedMessage = null
  sendEachForMulticastImpl = (message) => {
    capturedMessage = message
    return Promise.resolve({ responses: [{ success: true }] })
  }
  await sendPushToUser('user1', {
    notification: { title: 'New like', body: 'Someone liked your post' },
    data: { type: 'like', notificationId: 12345, productId: { toString: () => 'prod-1' }, actorId: undefined },
  })
  assert.strictEqual(capturedMessage.tokens.length, 1)
  assert.strictEqual(capturedMessage.tokens[0], 'tok-1')
  Object.values(capturedMessage.data).forEach((v) => assert.strictEqual(typeof v, 'string'))
  assert.strictEqual(capturedMessage.data.notificationId, '12345')
  assert.strictEqual('actorId' in capturedMessage.data, false, 'undefined values are omitted, not stringified')
  console.log('✓ builds a correctly-shaped multicast message with all-string data values')

  // ── stale token cleanup ──────────────────────────────────────────────────
  stubbedTokens = [{ token: 'stale-token' }, { token: 'valid-token' }]
  deletedManyFilter = null
  sendEachForMulticastImpl = () => Promise.resolve({
    responses: [
      { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      { success: true },
    ],
  })
  result = await sendPushToUser('user1', { notification: { title: 'T', body: 'B' }, data: {} })
  assert.ok(deletedManyFilter, 'deleteMany should have been called')
  assert.deepStrictEqual(deletedManyFilter.token.$in, ['stale-token'])
  assert.strictEqual(result.staleTokensRemoved, 1)
  assert.strictEqual(result.failureCount, 1)
  assert.strictEqual(result.successCount, 1)
  assert.strictEqual(result.errors[0].code, 'messaging/registration-token-not-registered')
  assert.strictEqual(result.errors[0].token.includes('stale-token'), false, 'error entries must mask the token, never log it raw')
  console.log('✓ deletes only the stale token, keeps the valid one, and reports it in the result summary')

  // ── invalid-registration-token also triggers cleanup ─────────────────────
  stubbedTokens = [{ token: 'bad-token' }]
  deletedManyFilter = null
  sendEachForMulticastImpl = () => Promise.resolve({
    responses: [{ success: false, error: { code: 'messaging/invalid-registration-token' } }],
  })
  await sendPushToUser('user1', { notification: { title: 'T', body: 'B' }, data: {} })
  assert.deepStrictEqual(deletedManyFilter.token.$in, ['bad-token'])
  console.log('✓ also cleans up messaging/invalid-registration-token')

  // ── other failure codes do NOT delete the token ──────────────────────────
  stubbedTokens = [{ token: 'temporarily-unavailable' }]
  deletedManyFilter = null
  sendEachForMulticastImpl = () => Promise.resolve({
    responses: [{ success: false, error: { code: 'messaging/internal-error' } }],
  })
  await sendPushToUser('user1', { notification: { title: 'T', body: 'B' }, data: {} })
  assert.strictEqual(deletedManyFilter, null, 'transient errors must not delete the token')
  console.log('✓ does not delete tokens on transient send failures')

  // ── never throws, even if the SDK call rejects ───────────────────────────
  stubbedTokens = [{ token: 'tok-x' }]
  sendEachForMulticastImpl = () => Promise.reject(new Error('network down'))
  await sendPushToUser('user1', { notification: { title: 'T', body: 'B' }, data: {} }) // must not throw
  console.log('✓ swallows SDK errors instead of throwing out of the caller')

  console.log('\nAll firebaseAdmin tests passed.')
}

runTests().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
