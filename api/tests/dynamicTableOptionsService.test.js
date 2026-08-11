/**
 * Unit tests for dynamicTableOptionsService validation and config resolution.
 *
 * Run: node server/tests/dynamicTableOptionsService.test.js
 */
const assert = require('assert')
const {
  normalizeColumnName,
  resolveTableConfig,
  validateTableConfig,
  isValidTableName,
  resolveLegacyCategoryParentId,
} = require('../core/services/dynamicTableOptionsService')

function testNormalizeColumnName() {
  assert.strictEqual(normalizeColumnName('id'), '_id')
  assert.strictEqual(normalizeColumnName('_id'), '_id')
  assert.strictEqual(normalizeColumnName('name'), 'name')
  console.log('✓ normalizeColumnName')
}

function testResolveEmiratesConfig() {
  const config = resolveTableConfig({
    tableName: 'emirates',
    tableConfig: {
      valueColumn: 'id',
      labelColumn: 'name',
      statusColumn: 'status',
      sortColumn: 'name',
    },
  })
  assert.ok(config)
  assert.strictEqual(config.tableName, 'emirates')
  assert.strictEqual(config.valueColumn, '_id')
  assert.strictEqual(config.labelColumn, 'name')
  assert.strictEqual(config.statusColumn, 'status')
  console.log('✓ resolveTableConfig (emirates)')
}

function testValidateEmiratesConfig() {
  const config = resolveTableConfig({ tableName: 'emirates' })
  assert.doesNotThrow(() => validateTableConfig(config))
  console.log('✓ validateTableConfig (emirates defaults)')
}

function testRejectInvalidColumn() {
  const config = resolveTableConfig({
    tableName: 'emirates',
    tableConfig: { labelColumn: 'nonexistent_column_xyz' },
  })
  assert.throws(() => validateTableConfig(config), /does not exist/)
  console.log('✓ rejects invalid column')
}

function testRejectUnregisteredTable() {
  assert.strictEqual(isValidTableName('unknown_table_xyz'), false)
  assert.strictEqual(isValidTableName('filters'), true)
  assert.strictEqual(isValidTableName('emirates'), true)
  console.log('✓ isValidTableName')
}

function testLegacyFiltersDefaults() {
  const config = resolveTableConfig({ tableName: 'filters' })
  assert.strictEqual(config.legacyHandler, 'filters')
  assert.strictEqual(config.parentColumn, 'parentId')
  console.log('✓ legacy filters defaults preserved')
}

function testLegacyCategoryParentId() {
  const categoryId = '64b7f1e2c3d4e5f6a7b8c9d0'
  const childCategoryId = '64b7f1e2c3d4e5f6a7b8c9d1'

  // No childCategoryId → existing categoryId behaviour
  assert.strictEqual(resolveLegacyCategoryParentId({ categoryId }), categoryId)
  assert.strictEqual(
    resolveLegacyCategoryParentId({ categoryId, childCategoryId: null }),
    categoryId
  )
  assert.strictEqual(resolveLegacyCategoryParentId({ categoryId, childCategoryId: '' }), categoryId)

  // childCategoryId present → wins over categoryId
  assert.strictEqual(
    resolveLegacyCategoryParentId({ categoryId, childCategoryId }),
    childCategoryId
  )
  assert.strictEqual(
    resolveLegacyCategoryParentId({ categoryId, childCategoryId: { _id: childCategoryId } }),
    childCategoryId
  )
  console.log('✓ legacy category parent id prefers childCategoryId')
}

function testResolveLegacyCategoryParentIdWithRequestedCategory() {
  const storedCategoryId = '64b7f1e2c3d4e5f6a7b8c9d0'   // ancestor the field is stored on
  const requestedCategoryId = '64b7f1e2c3d4e5f6a7b8c9d2' // category the API was called with
  const requestedChildId = '64b7f1e2c3d4e5f6a7b8c9d3'
  const fieldChildId = '64b7f1e2c3d4e5f6a7b8c9d1'

  // The bridge case: field stored on an ancestor, request asks for the leaf.
  // Options must come from the requested category, not the stored one.
  assert.strictEqual(
    resolveLegacyCategoryParentId({ categoryId: storedCategoryId }, { categoryId: requestedCategoryId }),
    requestedCategoryId
  )

  // A childCategoryId on the field no longer wins over the requested category.
  assert.strictEqual(
    resolveLegacyCategoryParentId(
      { categoryId: storedCategoryId, childCategoryId: fieldChildId },
      { categoryId: requestedCategoryId }
    ),
    requestedCategoryId
  )

  // When the caller narrows to a child category, that is the most specific
  // category in the request and wins.
  assert.strictEqual(
    resolveLegacyCategoryParentId(
      { categoryId: storedCategoryId },
      { categoryId: requestedCategoryId, childCategoryId: requestedChildId }
    ),
    requestedChildId
  )

  // Invalid/absent request context falls back to the previous field-scope logic.
  for (const requested of [{}, { categoryId: null }, { categoryId: 'not-an-objectid' }, undefined]) {
    assert.strictEqual(
      resolveLegacyCategoryParentId({ categoryId: storedCategoryId }, requested),
      storedCategoryId
    )
    assert.strictEqual(
      resolveLegacyCategoryParentId({ categoryId: storedCategoryId, childCategoryId: fieldChildId }, requested),
      fieldChildId
    )
  }

  console.log('✓ legacy category parent id honours the requested categoryId')
}

testNormalizeColumnName()
testResolveEmiratesConfig()
testValidateEmiratesConfig()
testRejectInvalidColumn()
testRejectUnregisteredTable()
testLegacyFiltersDefaults()
testLegacyCategoryParentId()
testResolveLegacyCategoryParentIdWithRequestedCategory()
console.log('\nAll dynamicTableOptionsService tests passed.')
