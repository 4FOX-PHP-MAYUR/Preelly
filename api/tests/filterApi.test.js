/**
 * Integration-style tests for filters HTTP routes (no database).
 * Mocks filterService to verify routing and validation.
 * Run: node tests/filterApi.test.js
 */
const assert = require('assert')
const express = require('express')
const http = require('http')

const filterService = require('../core/services/filterService')
const originalGetFiltersByCategoryId = filterService.getFiltersByCategoryId

filterService.getFiltersByCategoryId = async (categoryId) => ({
  categoryId,
  filters: [
    {
      filterId: 'root1',
      filterName: 'Property Type',
      slug: 'property-type',
      values: [{ id: 'val1', name: 'Apartment' }],
    },
  ],
})

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/web/filters', require('../api/v1/web/routes/filters.routes'))
  app.use(require('../core/errors/v1ErrorHandler'))
  return app
}

function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, () => {
      const { port } = server.address()
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET',
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () => {
            server.close()
            resolve({
              status: res.statusCode,
              body: JSON.parse(data || '{}'),
            })
          })
        },
      )
      req.on('error', (error) => {
        server.close()
        reject(error)
      })
      req.end()
    })
  })
}

async function runTests() {
  const app = createTestApp()
  const validCategoryId = '507f1f77bcf86cd799439011'

  const success = await request(app, `/api/v1/web/filters/${validCategoryId}`)
  assert.strictEqual(success.status, 200)
  assert.strictEqual(success.body.success, true)
  assert.strictEqual(success.body.data.categoryId, validCategoryId)
  assert.strictEqual(success.body.data.filters.length, 1)
  assert.strictEqual(success.body.data.filters[0].filterName, 'Property Type')

  const invalid = await request(app, '/api/v1/web/filters/not-a-valid-id')
  assert.strictEqual(invalid.status, 400)
  assert.strictEqual(invalid.body.success, false)
  assert.strictEqual(invalid.body.code, 'VALIDATION_ERROR')

  filterService.getFiltersByCategoryId = originalGetFiltersByCategoryId
  console.log('filterApi.test.js — all tests passed')
}

runTests().catch((error) => {
  filterService.getFiltersByCategoryId = originalGetFiltersByCategoryId
  console.error(error)
  process.exit(1)
})
