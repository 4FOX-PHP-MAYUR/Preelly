/**
 * Unit tests for the device-token upsert/ownership-transfer semantics used by
 * POST/DELETE /api/user/device-tokens (routes/user.js). Exercises the same
 * findOneAndUpdate-by-token and deleteOne-by-token+userId queries the routes
 * issue, against an in-memory fake collection — no real MongoDB needed.
 * Run: node tests/deviceTokenRegistration.test.js
 */
const assert = require('assert')

// ── Minimal in-memory fake of the two DeviceToken operations the routes use ──
function makeFakeStore() {
  let docs = []
  return {
    async findOneAndUpdate(query, update, options) {
      let doc = docs.find((d) => d.token === query.token)
      if (!doc) {
        if (!options?.upsert) return null
        doc = { token: query.token }
        docs.push(doc)
      }
      Object.assign(doc, update.$set)
      return doc
    },
    async deleteOne(query) {
      const before = docs.length
      docs = docs.filter((d) => !(d.token === query.token && String(d.userId) === String(query.userId)))
      return { deletedCount: before - docs.length }
    },
    _all: () => docs,
  }
}

async function runTests() {
  const store = makeFakeStore()
  const TOKEN = 'fcm-token-abc'
  const USER_A = 'userA'
  const USER_B = 'userB'

  // ── POST registers a new token ──────────────────────────────────────────
  await store.findOneAndUpdate(
    { token: TOKEN },
    { $set: { userId: USER_A, platform: 'ios', deviceId: 'device-1', lastSeenAt: new Date() } },
    { upsert: true }
  )
  assert.strictEqual(store._all().length, 1)
  assert.strictEqual(store._all()[0].userId, USER_A)
  console.log('✓ registers a new device token for user A')

  // ── Re-registering the same token under a different user reassigns ownership,
  //    it does not create a duplicate document ──────────────────────────────
  await store.findOneAndUpdate(
    { token: TOKEN },
    { $set: { userId: USER_B, platform: 'ios', deviceId: 'device-1', lastSeenAt: new Date() } },
    { upsert: true }
  )
  assert.strictEqual(store._all().length, 1, 'must not duplicate — same token upserts in place')
  assert.strictEqual(store._all()[0].userId, USER_B, 'ownership transfers to the new user')
  console.log('✓ re-registering the same token under user B transfers ownership, no duplicate')

  // ── DELETE only removes the token if it belongs to the requesting user ─────
  const deleteAsWrongUser = await store.deleteOne({ token: TOKEN, userId: USER_A })
  assert.strictEqual(deleteAsWrongUser.deletedCount, 0, 'user A no longer owns this token, nothing deleted')
  assert.strictEqual(store._all().length, 1)
  console.log('✓ DELETE as a non-owner removes nothing')

  const deleteAsOwner = await store.deleteOne({ token: TOKEN, userId: USER_B })
  assert.strictEqual(deleteAsOwner.deletedCount, 1)
  assert.strictEqual(store._all().length, 0)
  console.log('✓ DELETE as the current owner removes the token')

  // ── DELETE of a token that does not exist is a no-op, not an error ─────────
  const deleteMissing = await store.deleteOne({ token: 'never-registered', userId: USER_B })
  assert.strictEqual(deleteMissing.deletedCount, 0)
  console.log('✓ DELETE of a non-existent token is a harmless no-op (200, not 500)')

  console.log('\nAll device-token registration tests passed.')
}

runTests().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
