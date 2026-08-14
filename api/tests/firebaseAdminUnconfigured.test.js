/**
 * Verifies services/firebaseAdmin.js degrades gracefully when no Firebase
 * service account is configured (FIREBASE_SERVICE_ACCOUNT / _PATH unset) —
 * the exact state of a fresh dev environment before secrets are provisioned.
 * Kept in its own process/module-cache since firebaseAdmin.js caches its
 * initialized app for the lifetime of the process.
 * Run: node tests/firebaseAdminUnconfigured.test.js
 */
const assert = require('assert')
const path = require('path')

delete process.env.FIREBASE_SERVICE_ACCOUNT
delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH

const deviceTokenPath = require.resolve(path.join(__dirname, '..', 'models', 'DeviceToken.js'))
let findCalled = false
require.cache[deviceTokenPath] = {
  id: deviceTokenPath,
  filename: deviceTokenPath,
  loaded: true,
  exports: {
    find() {
      findCalled = true
      return { lean: () => Promise.resolve([]) }
    },
  },
}

const { sendPushToUser } = require('../services/firebaseAdmin')

async function runTests() {
  const result = await sendPushToUser('user1', { notification: { title: 'T', body: 'B' }, data: {} })
  assert.strictEqual(result.configured, false)
  assert.strictEqual(result.attempted, 0)
  assert.strictEqual(findCalled, false, 'must not query device tokens when Firebase is not configured')
  console.log('✓ reports configured:false and skips the DB lookup when no service account is set')

  console.log('\nAll firebaseAdminUnconfigured tests passed.')
}

runTests().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
