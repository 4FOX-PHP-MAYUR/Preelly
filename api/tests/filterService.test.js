/**
 * Unit tests for filterService grouping and DTO shaping.
 * Run: node tests/filterService.test.js
 */
const assert = require('assert')
const {
  groupFiltersForResponse,
  mergeFiltersById,
} = require('../core/services/filterService')
const { categoryFiltersResponse } = require('../dto/filter.dto')

function runTests() {
  const flat = [
    {
      _id: 'root1',
      name: 'Property Type',
      slug: 'property-type',
      parentId: null,
      sortOrder: 0,
      options: [],
    },
    {
      _id: 'val1',
      name: 'Apartment',
      slug: 'apartment',
      parentId: 'root1',
      sortOrder: 0,
    },
    {
      _id: 'val2',
      name: 'Villa',
      slug: 'villa',
      parentId: 'root1',
      sortOrder: 1,
    },
    {
      _id: 'root2',
      name: 'Bedrooms',
      slug: 'bedrooms',
      parentId: null,
      sortOrder: 1,
      options: ['1 BHK', '2 BHK'],
    },
    {
      _id: 'dup-root',
      name: 'Property Type',
      slug: 'property-type',
      parentId: null,
      sortOrder: 2,
    },
    {
      _id: 'val3',
      name: 'Townhouse',
      slug: 'townhouse',
      parentId: 'dup-root',
      sortOrder: 2,
    },
  ]

  const grouped = groupFiltersForResponse(flat)
  assert.strictEqual(grouped.length, 2)
  assert.strictEqual(grouped[0].filterName, 'Property Type')
  assert.strictEqual(grouped[0].values.length, 3)
  assert.deepStrictEqual(
    grouped[0].values.map((value) => value.name),
    ['Apartment', 'Villa', 'Townhouse'],
  )
  assert.strictEqual(grouped[1].filterName, 'Bedrooms')
  assert.strictEqual(grouped[1].values.length, 2)

  const merged = mergeFiltersById(
    [{ _id: 'a', name: 'A' }],
    [{ _id: 'a', name: 'A-updated' }, { _id: 'b', name: 'B' }],
  )
  assert.strictEqual(merged.length, 2)
  assert.strictEqual(merged.find((entry) => String(entry._id) === 'a').name, 'A-updated')

  const dto = categoryFiltersResponse({
    categoryId: '507f1f77bcf86cd799439011',
    filters: grouped,
  })
  assert.strictEqual(dto.categoryId, '507f1f77bcf86cd799439011')
  assert.ok(Array.isArray(dto.filters))
  assert.ok(!('sortOrder' in dto.filters[0]))

  assert.deepStrictEqual(groupFiltersForResponse([]), [])

  console.log('filterService.test.js — all tests passed')
}

runTests()
