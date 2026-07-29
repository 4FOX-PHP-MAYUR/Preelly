/**
 * Unit tests for the block service.
 * Stubs the Follow model so no database connection is needed.
 * Run: node tests/blockService.test.js
 */
const assert = require('assert')
const path = require('path')
const mongoose = require('mongoose')

// ── Stub the Follow model before blockService requires it ────────────────────
const followPath = require.resolve(path.join(__dirname, '..', 'models', 'Follow.js'))

let stubbedRecords = []
let lastQuery = null

function makeChain(records) {
  return {
    select() { return this },
    lean() { return Promise.resolve(records) },
  }
}

require.cache[followPath] = {
  id: followPath,
  filename: followPath,
  loaded: true,
  exports: {
    find(query) {
      lastQuery = query
      return makeChain(stubbedRecords)
    },
  },
}

const {
  getBlockedUserIds,
  buildBlockExclusion,
  getBlockMap,
  getBlockState,
  isBlockedBetween,
  filterBlockedFromList,
} = require('../core/services/blockService')

const ME = '507f1f77bcf86cd799439011'
const OTHER = '507f1f77bcf86cd799439012'
const THIRD = '507f1f77bcf86cd799439013'

// A block record: follower = blocked user, following = blocker.
const blockRecord = (blockedUser, blocker) => ({
  follower: new mongoose.Types.ObjectId(blockedUser),
  following: new mongoose.Types.ObjectId(blocker),
})

async function runTests() {
  // ── getBlockedUserIds ─────────────────────────────────────────────────────
  stubbedRecords = []
  assert.deepStrictEqual(await getBlockedUserIds(ME), [], 'no records → empty list')
  assert.deepStrictEqual(await getBlockedUserIds(null), [], 'anonymous → empty list')
  assert.deepStrictEqual(await getBlockedUserIds('not-an-id'), [], 'invalid id → empty list')

  // I blocked OTHER
  stubbedRecords = [blockRecord(OTHER, ME)]
  let ids = await getBlockedUserIds(ME)
  assert.strictEqual(ids.length, 1)
  assert.strictEqual(String(ids[0]), OTHER, 'user I blocked is hidden')

  // THIRD blocked me — must be hidden too (block cuts both ways)
  stubbedRecords = [blockRecord(ME, THIRD)]
  ids = await getBlockedUserIds(ME)
  assert.strictEqual(String(ids[0]), THIRD, 'user who blocked me is hidden')

  // both directions at once, deduplicated
  stubbedRecords = [blockRecord(OTHER, ME), blockRecord(ME, THIRD), blockRecord(OTHER, ME)]
  ids = await getBlockedUserIds(ME)
  assert.strictEqual(ids.length, 2, 'both directions, no duplicates')
  assert.deepStrictEqual(ids.map(String).sort(), [OTHER, THIRD].sort())

  // returns ObjectIds so callers can drop them into a $nin
  assert.ok(ids.every((id) => id instanceof mongoose.Types.ObjectId), 'ids are ObjectIds')

  // ── buildBlockExclusion ───────────────────────────────────────────────────
  stubbedRecords = []
  assert.deepStrictEqual(await buildBlockExclusion(ME, 'seller'), {}, 'nothing blocked → no filter')
  assert.deepStrictEqual(await buildBlockExclusion(null, 'seller'), {}, 'anonymous → no filter')

  stubbedRecords = [blockRecord(OTHER, ME)]
  const exclusion = await buildBlockExclusion(ME, 'seller')
  assert.ok(exclusion.seller && Array.isArray(exclusion.seller.$nin), 'builds a $nin clause')
  assert.strictEqual(String(exclusion.seller.$nin[0]), OTHER)

  const userExclusion = await buildBlockExclusion(ME, 'user')
  assert.ok(userExclusion.user.$nin, 'honours the field name')

  // ── getBlockMap / getBlockState ───────────────────────────────────────────
  stubbedRecords = [blockRecord(OTHER, ME)]
  let map = await getBlockMap(ME, [OTHER, THIRD])
  assert.deepStrictEqual(map[OTHER], { blockedByMe: true, blockedMe: false })
  assert.deepStrictEqual(map[THIRD], { blockedByMe: false, blockedMe: false }, 'unrelated user is clean')

  stubbedRecords = [blockRecord(ME, OTHER)]
  map = await getBlockMap(ME, [OTHER])
  assert.deepStrictEqual(map[OTHER], { blockedByMe: false, blockedMe: true })

  // mutual block — two records, one per direction
  stubbedRecords = [blockRecord(OTHER, ME), blockRecord(ME, OTHER)]
  assert.deepStrictEqual(
    await getBlockState(ME, OTHER),
    { blockedByMe: true, blockedMe: true },
    'mutual block reports both flags',
  )

  stubbedRecords = []
  assert.deepStrictEqual(await getBlockState(ME, null), { blockedByMe: false, blockedMe: false })
  assert.deepStrictEqual(await getBlockMap(ME, []), {}, 'empty id list short-circuits')

  // ── isBlockedBetween ──────────────────────────────────────────────────────
  stubbedRecords = [blockRecord(OTHER, ME)]
  assert.strictEqual(await isBlockedBetween(ME, OTHER), true, 'blocker side')
  stubbedRecords = [blockRecord(ME, OTHER)]
  assert.strictEqual(await isBlockedBetween(ME, OTHER), true, 'blocked side')
  stubbedRecords = []
  assert.strictEqual(await isBlockedBetween(ME, OTHER), false, 'no block')
  assert.strictEqual(await isBlockedBetween(ME, ME), false, 'never blocked against yourself')
  assert.strictEqual(await isBlockedBetween(null, OTHER), false, 'anonymous is never blocked')

  // ── filterBlockedFromList ─────────────────────────────────────────────────
  stubbedRecords = [blockRecord(OTHER, ME)]
  const items = [
    { _id: 'a', seller: OTHER },
    { _id: 'b', seller: THIRD },
    { _id: 'c', seller: { _id: OTHER } }, // populated seller
    { _id: 'd' }, // no seller — kept
  ]
  const filtered = await filterBlockedFromList(ME, items, 'seller')
  assert.deepStrictEqual(filtered.map((i) => i._id), ['b', 'd'], 'drops blocked sellers, raw and populated')

  stubbedRecords = []
  assert.strictEqual((await filterBlockedFromList(ME, items, 'seller')).length, 4, 'nothing blocked → untouched')
  assert.deepStrictEqual(await filterBlockedFromList(ME, [], 'seller'), [])
  assert.deepStrictEqual(await filterBlockedFromList(ME, null, 'seller'), [])

  // ── query shape: both directions are asked for in one round-trip ──────────
  stubbedRecords = [blockRecord(OTHER, ME)]
  await getBlockedUserIds(ME)
  assert.strictEqual(lastQuery.status, 'blocked', 'only blocked records are read')
  assert.strictEqual(lastQuery.$or.length, 2, 'queries both directions at once')

  console.log('blockService.test.js — all tests passed')
}

runTests().catch((err) => {
  console.error(err)
  process.exit(1)
})
