/**
 * Unit tests for search service helpers.
 * Run: node tests/searchService.test.js
 */
const assert = require('assert')
const {
  normalizeKeyword,
  dedupeKeywords,
  mergeSuggestions,
  scoreSuggestion,
  buildHistoryPayload,
  SUGGESTION_MIN_LENGTH,
} = require('../core/services/searchService')
const { resolvePlatform } = require('../utils/platformDetection')
const { getDeviceIdFromRequest } = require('../middleware/deviceId')

function runTests() {
  // normalizeKeyword
  assert.strictEqual(normalizeKeyword('  iphone  '), 'iphone')
  assert.strictEqual(normalizeKeyword(''), '')
  assert.strictEqual(normalizeKeyword('   '), '')
  assert.strictEqual(normalizeKeyword(null), '')

  // dedupeKeywords — case-insensitive, most recent first
  const deduped = dedupeKeywords(
    [
      { keyword: 'iPhone' },
      { keyword: 'iphone' },
      { keyword: 'Samsung' },
      { keyword: 'iPhone 15' },
    ],
    10,
  )
  assert.deepStrictEqual(deduped, ['iPhone', 'Samsung', 'iPhone 15'])

  assert.deepStrictEqual(dedupeKeywords([], 10), [])
  assert.strictEqual(dedupeKeywords([{ keyword: 'a' }, { keyword: 'b' }], 1).length, 1)

  // scoreSuggestion — prefix and source priority
  assert.ok(scoreSuggestion('iphone 14', 'iph', 'history') > scoreSuggestion('galaxy', 'iph', 'product'))
  assert.ok(scoreSuggestion('iphone', 'iphone', 'popular', 50) >= 100)

  // mergeSuggestions with relevance ranking
  const suggestions = mergeSuggestions(
    {
      historyRows: [{ keyword: 'iphone 14' }],
      categoryRows: [{ name: 'iPhone Accessories' }],
      subcategoryRows: [{ name: 'iPhone Cases' }],
      productRows: [{ title: 'iPhone 14 Pro Max' }],
      locationRows: [{ location: 'Dubai Marina' }],
      agentRows: [{ displayName: 'iPhone Dealer' }],
      agencyRows: [{ dealer_name: 'iPhone Store' }],
      popularRows: [{ keyword: 'iphone', searchCount: 120 }],
    },
    'iph',
    10,
  )
  assert.ok(suggestions.includes('iphone 14'))
  assert.ok(suggestions.includes('iPhone Accessories'))
  assert.ok(suggestions.includes('iPhone 14 Pro Max'))
  assert.ok(suggestions.length <= 10)
  assert.ok(suggestions.every((item) => item.length >= SUGGESTION_MIN_LENGTH || item.length > 0))

  // buildHistoryPayload
  const guestReq = {
    deviceId: 'device-abc',
    headers: {},
    user: null,
    platform: 'web',
  }
  const guestPayload = buildHistoryPayload(guestReq, 'dubai villa')
  assert.strictEqual(guestPayload.keyword, 'dubai villa')
  assert.strictEqual(guestPayload.deviceId, 'device-abc')
  assert.strictEqual(guestPayload.userId, null)
  assert.strictEqual(guestPayload.isLoggedIn, false)
  assert.strictEqual(guestPayload.platform, 'web')

  const authReq = {
    deviceId: 'device-xyz',
    headers: { 'x-platform': 'ios' },
    user: { _id: '507f1f77bcf86cd799439011' },
    platform: 'mobile',
  }
  const authPayload = buildHistoryPayload(authReq, 'land rover')
  assert.strictEqual(authPayload.userId, '507f1f77bcf86cd799439011')
  assert.strictEqual(authPayload.isLoggedIn, true)
  assert.strictEqual(authPayload.platform, 'mobile')

  // resolvePlatform
  assert.strictEqual(resolvePlatform({ platform: 'web', headers: {} }), 'web')
  assert.strictEqual(resolvePlatform({ platform: 'mobile', headers: {} }), 'mobile')
  assert.strictEqual(resolvePlatform({ headers: { 'x-platform': 'android' } }), 'mobile')
  assert.strictEqual(resolvePlatform({ headers: { 'x-platform': 'ios' } }), 'mobile')
  assert.strictEqual(resolvePlatform({ headers: { 'user-agent': 'Mozilla/5.0 Chrome' } }), 'web')

  // getDeviceIdFromRequest
  assert.strictEqual(
    getDeviceIdFromRequest({ headers: { 'device-id': '  my-device  ' } }),
    'my-device',
  )
  assert.strictEqual(
    getDeviceIdFromRequest({ headers: { 'x-device-id': 'fallback-id' } }),
    'fallback-id',
  )
  assert.strictEqual(getDeviceIdFromRequest({ headers: {} }), null)
  assert.strictEqual(getDeviceIdFromRequest({ headers: { 'device-id': '   ' } }), null)

  console.log('searchService.test.js — all tests passed')
}

runTests()
