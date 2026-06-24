/**
 * Integration-style tests for search HTTP routes (no database).
 * Mocks searchService to verify routing, auth, and device-id enforcement.
 * Run: node tests/searchApi.test.js
 */
const assert = require('assert')
const express = require('express')
const http = require('http')

const originalGlobalSearch = require('../core/services/searchService').globalSearch
const originalGetRecent = require('../core/services/searchService').getRecentSearches
const originalClearRecent = require('../core/services/searchService').clearRecentSearches
const originalGetPopular = require('../core/services/searchService').getPopularSearches
const originalGetSuggestions = require('../core/services/searchService').getSearchSuggestions

let savedHistoryPayload = null
const searchService = require('../core/services/searchService')
searchService.globalSearch = async (keyword, query, req) => {
  savedHistoryPayload = searchService.buildHistoryPayload(req, keyword)
  return {
    results: {
      products: [],
      properties: [],
      categories: [],
      agents: [],
      agencies: [],
      projects: [],
      blogs: [],
    },
    meta: { page: 1, limit: 5, total: 0, totalPages: 0, hasMore: false, perCategoryLimit: 5 },
    extras: query.include ? { recentSearches: { keywords: ['test'] } } : undefined,
  }
}
searchService.getRecentSearches = async (req) => ({
  keywords: req.user ? ['user-search'] : ['guest-search'],
  items: [{ keyword: req.user ? 'user-search' : 'guest-search', searchedAt: null }],
  total: 1,
})
searchService.clearRecentSearches = async () => ({
  cleared: true,
  deletedCount: 2,
})
searchService.getPopularSearches = async () => ({
  keywords: ['iphone', 'car'],
  items: [
    { keyword: 'iphone', searchCount: 50, lastSearchedAt: null },
    { keyword: 'car', searchCount: 30, lastSearchedAt: null },
  ],
  total: 2,
})
searchService.getSearchSuggestions = async () => ({
  suggestions: ['iphone', 'iphone 14'],
})

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/web/search', require('../api/v1/web/routes/search.routes'))
  app.use(require('../core/errors/v1ErrorHandler'))
  return app
}

function request(app, path, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, () => {
      const { port } = server.address()
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers,
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () => {
            server.close()
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) })
            } catch (err) {
              reject(err)
            }
          })
        },
      )
      req.on('error', (err) => {
        server.close()
        reject(err)
      })
      req.end()
    })
  })
}

async function runTests() {
  const app = createTestApp()

  // Missing device-id
  const noDevice = await request(app, '/api/v1/web/search?keyword=iphone')
  assert.strictEqual(noDevice.status, 400)
  assert.strictEqual(noDevice.body.code, 'DEVICE_ID_REQUIRED')

  // Missing keyword
  const noKeyword = await request(app, '/api/v1/web/search', { 'device-id': 'test-device' })
  assert.strictEqual(noKeyword.status, 400)
  assert.strictEqual(noKeyword.body.code, 'VALIDATION_ERROR')

  // Successful search (guest)
  savedHistoryPayload = null
  const searchRes = await request(app, '/api/v1/web/search?keyword=land%20rover', {
    'device-id': 'guest-device-001',
  })
  assert.strictEqual(searchRes.status, 200)
  assert.strictEqual(searchRes.body.success, true)
  assert.ok(searchRes.body.data.results)
  assert.strictEqual(savedHistoryPayload.deviceId, 'guest-device-001')
  assert.strictEqual(savedHistoryPayload.isLoggedIn, false)
  assert.strictEqual(savedHistoryPayload.platform, 'web')

  // Search with include extras
  const includeRes = await request(
    app,
    '/api/v1/web/search?keyword=iphone&include=recent',
    { 'device-id': 'guest-device-001' },
  )
  assert.strictEqual(includeRes.status, 200)
  assert.ok(includeRes.body.data.extras)

  // Recent searches (guest)
  const recentRes = await request(app, '/api/v1/web/search/recent', {
    'device-id': 'guest-device-001',
  })
  assert.strictEqual(recentRes.status, 200)
  assert.deepStrictEqual(recentRes.body.data.keywords, ['guest-search'])

  // Clear recent searches
  const clearRes = await request(
    app,
    '/api/v1/web/search/recent',
    { 'device-id': 'guest-device-001' },
    'DELETE',
  )
  assert.strictEqual(clearRes.status, 200)
  assert.strictEqual(clearRes.body.data.cleared, true)
  assert.strictEqual(clearRes.body.data.deletedCount, 2)

  // Popular searches
  const popularRes = await request(app, '/api/v1/web/search/popular?limit=5', {
    'device-id': 'guest-device-001',
  })
  assert.strictEqual(popularRes.status, 200)
  assert.deepStrictEqual(popularRes.body.data.keywords, ['iphone', 'car'])

  // Suggestions
  const suggestRes = await request(
    app,
    '/api/v1/web/search/suggestions?keyword=iph',
    { 'device-id': 'guest-device-001' },
  )
  assert.strictEqual(suggestRes.status, 200)
  assert.ok(Array.isArray(suggestRes.body.data.suggestions))

  // Suggestions too short
  const shortSuggest = await request(
    app,
    '/api/v1/web/search/suggestions?keyword=i',
    { 'device-id': 'guest-device-001' },
  )
  assert.strictEqual(shortSuggest.status, 400)
  assert.strictEqual(shortSuggest.body.code, 'VALIDATION_ERROR')

  // Restore originals
  searchService.globalSearch = originalGlobalSearch
  searchService.getRecentSearches = originalGetRecent
  searchService.clearRecentSearches = originalClearRecent
  searchService.getPopularSearches = originalGetPopular
  searchService.getSearchSuggestions = originalGetSuggestions

  console.log('searchApi.test.js — all tests passed')
}

runTests().catch((err) => {
  console.error(err)
  process.exit(1)
})
