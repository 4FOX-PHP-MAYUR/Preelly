/**
 * Unit tests for categoryService tree-building logic.
 * Run: npm test (from server/) or node tests/categoryService.test.js
 */
const assert = require('assert')
const {
  buildParentSubcategoryTree,
  sortBySortOrder,
} = require('../core/services/categoryService')
const { propertyCategoriesList } = require('../dto/category.dto')

function runTests() {
  // sortBySortOrder
  assert.strictEqual(
    sortBySortOrder({ sortOrder: 1, name: 'B' }, { sortOrder: 0, name: 'A' }),
    1,
  )
  assert.strictEqual(
    sortBySortOrder({ sortOrder: 0, name: 'A' }, { sortOrder: 0, name: 'B' }),
    -1,
  )

  const rootId = 'root123'
  const flat = [
    {
      _id: 'parent2',
      name: 'For Sale',
      parentId: rootId,
      level: 1,
      sortOrder: 1,
      isActive: true,
      isDeleted: false,
    },
    {
      _id: 'parent1',
      name: 'For Rent',
      parentId: rootId,
      level: 1,
      sortOrder: 0,
      isActive: true,
      isDeleted: false,
    },
    {
      _id: 'sub2',
      name: 'Commercial',
      parentId: 'parent1',
      level: 2,
      sortOrder: 1,
      isActive: true,
      isDeleted: false,
    },
    {
      _id: 'sub1',
      name: 'Residential',
      parentId: 'parent1',
      level: 2,
      sortOrder: 0,
      isActive: true,
      isDeleted: false,
    },
  ]

  const tree = buildParentSubcategoryTree(flat, rootId)

  assert.strictEqual(tree.length, 2)
  assert.strictEqual(tree[0].name, 'For Rent')
  assert.strictEqual(tree[1].name, 'For Sale')
  assert.strictEqual(tree[0].subcategories.length, 2)
  assert.strictEqual(tree[0].subcategories[0].name, 'Residential')
  assert.strictEqual(tree[0].subcategories[1].name, 'Commercial')
  assert.strictEqual(tree[1].subcategories.length, 0)

  // Empty input
  assert.deepStrictEqual(buildParentSubcategoryTree([], rootId), [])
  assert.deepStrictEqual(buildParentSubcategoryTree(null, rootId), [])

  // DTO strips nested keys from subcategories
  const dto = propertyCategoriesList(tree)
  assert.ok(!('subcategories' in dto[0].subcategories[0]))
  assert.ok(Array.isArray(dto[0].subcategories))

  console.log('categoryService.test.js — all tests passed')
}

runTests()
