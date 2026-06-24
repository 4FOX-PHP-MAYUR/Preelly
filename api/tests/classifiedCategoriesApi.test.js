/**
 * Integration-style tests for classified categories HTTP route (no database).
 * Mocks categoryService to verify routing, response shape, and error handling.
 * Run: node tests/classifiedCategoriesApi.test.js
 */
const assert = require('assert')
const express = require('express')
const http = require('http')

const categoryService = require('../core/services/categoryService')
const originalGetClassifiedCategories = categoryService.getClassifiedCategories

const mockCategories = [
  {
    _id: '69bd3a36f8f72a46764ed476',
    name: 'Cars',
    slug: 'cars',
    parentId: 'classified_root_id',
    level: 1,
    path: ['classified_root_id'],
    sortOrder: 0,
    isActive: true,
    isDeleted: false,
    icon: null,
    emoji: '🚗',
    count: 0,
    subcategories: [
      {
        _id: '69bd39e0f8f72a46764ed36c',
        name: 'Sedan',
        slug: 'sedan',
        parentId: '69bd3a36f8f72a46764ed476',
        level: 2,
        path: ['classified_root_id', '69bd3a36f8f72a46764ed476'],
        sortOrder: 0,
        isActive: true,
        isDeleted: false,
        icon: null,
        emoji: '🚘',
        count: 0,
      },
    ],
  },
]

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/classifieds', require('../api/v1/routes/classifieds.routes'))
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

  // should return classified categories with subcategories
  categoryService.getClassifiedCategories = async () => mockCategories
  const success = await request(app, '/api/v1/classifieds/categories')
  assert.strictEqual(success.status, 200)
  assert.strictEqual(success.body.success, true)
  assert.strictEqual(success.body.message, 'Classified categories fetched successfully')
  assert.strictEqual(success.body.data.length, 1)
  assert.strictEqual(success.body.data[0].name, 'Cars')
  assert.strictEqual(success.body.data[0].subcategories.length, 1)
  assert.strictEqual(success.body.data[0].subcategories[0].name, 'Sedan')

  // should return empty array when no categories exist
  categoryService.getClassifiedCategories = async () => []
  const empty = await request(app, '/api/v1/classifieds/categories')
  assert.strictEqual(empty.status, 200)
  assert.strictEqual(empty.body.success, true)
  assert.strictEqual(empty.body.message, 'Classified categories fetched successfully')
  assert.deepStrictEqual(empty.body.data, [])

  // should handle repository errors gracefully
  categoryService.getClassifiedCategories = async () => {
    throw new Error('Database connection failed')
  }
  const errorRes = await request(app, '/api/v1/classifieds/categories')
  assert.strictEqual(errorRes.status, 500)
  assert.strictEqual(errorRes.body.success, false)
  assert.strictEqual(errorRes.body.message, 'Failed to fetch classified categories')

  categoryService.getClassifiedCategories = originalGetClassifiedCategories

  console.log('classifiedCategoriesApi.test.js — all tests passed')
}

runTests().catch((error) => {
  categoryService.getClassifiedCategories = originalGetClassifiedCategories
  console.error(error)
  process.exit(1)
})
