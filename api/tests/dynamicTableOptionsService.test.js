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

testNormalizeColumnName()
testResolveEmiratesConfig()
testValidateEmiratesConfig()
testRejectInvalidColumn()
testRejectUnregisteredTable()
testLegacyFiltersDefaults()
console.log('\nAll dynamicTableOptionsService tests passed.')
