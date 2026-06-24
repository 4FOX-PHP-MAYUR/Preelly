/**
 * Tests for device-id middleware and search validation.
 * Run: node tests/searchMiddleware.test.js
 */
const assert = require('assert')
const { validationResult } = require('express-validator')
const { requireDeviceId } = require('../middleware/deviceId')
const { globalSearchQueryRules } = require('../core/validators/search.validator')

async function runValidation(req) {
  for (const rule of globalSearchQueryRules) {
    await rule.run(req)
  }
  return validationResult(req)
}

function runMiddlewareTests() {
  // requireDeviceId — missing header
  let statusCode = null
  let body = null
  const res = {
    status(code) {
      statusCode = code
      return this
    },
    json(payload) {
      body = payload
      return this
    },
  }

  let nextCalled = false
  requireDeviceId({ headers: {} }, res, () => {
    nextCalled = true
  })
  assert.strictEqual(nextCalled, false)
  assert.strictEqual(statusCode, 400)
  assert.strictEqual(body.code, 'DEVICE_ID_REQUIRED')

  // requireDeviceId — valid header
  statusCode = null
  body = null
  nextCalled = false
  const req = { headers: { 'device-id': 'valid-device-123' } }
  requireDeviceId(req, res, () => {
    nextCalled = true
  })
  assert.strictEqual(nextCalled, true)
  assert.strictEqual(req.deviceId, 'valid-device-123')

  // requireDeviceId — whitespace only
  nextCalled = false
  requireDeviceId({ headers: { 'device-id': '   ' } }, res, () => {
    nextCalled = true
  })
  assert.strictEqual(nextCalled, false)
  assert.strictEqual(body.code, 'DEVICE_ID_REQUIRED')

  console.log('searchMiddleware.test.js — middleware tests passed')
}

async function runValidationTests() {
  const emptyResult = await runValidation({
    query: { keyword: '   ' },
    headers: {},
  })
  assert.ok(!emptyResult.isEmpty(), 'whitespace keyword should fail validation')

  const missingResult = await runValidation({
    query: {},
    headers: {},
  })
  assert.ok(!missingResult.isEmpty(), 'missing keyword should fail validation')

  const validReq = {
    query: { keyword: '  land rover  ', type: 'products', page: '2', limit: '10' },
    headers: {},
  }
  const validResult = await runValidation(validReq)
  assert.ok(validResult.isEmpty(), 'valid query should pass')
  assert.strictEqual(validReq.query.keyword, 'land rover', 'keyword should be trimmed')

  const invalidType = await runValidation({
    query: { keyword: 'test', type: 'invalid' },
    headers: {},
  })
  assert.ok(!invalidType.isEmpty(), 'invalid type should fail validation')

  console.log('searchMiddleware.test.js — validation tests passed')
}

async function runTests() {
  runMiddlewareTests()
  await runValidationTests()
}

runTests().catch((err) => {
  console.error(err)
  process.exit(1)
})
