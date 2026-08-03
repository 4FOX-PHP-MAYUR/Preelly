#!/usr/bin/env node
/**
 * Build the Admin Dashboard indexes now, without waiting for an API restart.
 *
 * The indexes themselves are declared in `core/dashboardIndexes.js` and are
 * registered on the existing schemas, so the API creates and preserves them on
 * every boot. This script is for the in-between case: you deployed the
 * dashboard and want the indexes in place before the next restart, or you want
 * to see what changed.
 *
 * Idempotent — `syncIndexes()` is safe to re-run.
 *
 * Usage:  node scripts/ensure_dashboard_indexes.js
 */

const path = require('path')

require('dotenv').config({
  path: path.join(
    __dirname,
    '..',
    process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
  ),
})

const mongoose = require('mongoose')
const {
  registerDashboardIndexes,
  dashboardIndexedModels,
  DASHBOARD_INDEXES,
} = require('../core/dashboardIndexes')

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGO_URI is not set — nothing to do.')
    process.exit(1)
  }

  registerDashboardIndexes()

  await mongoose.connect(uri)
  console.log(`Connected to ${mongoose.connection.name}\n`)

  const expected = new Set(DASHBOARD_INDEXES.map(([, , options]) => options.name))

  for (const model of dashboardIndexedModels()) {
    try {
      // syncIndexes both creates the new dash_* indexes and reconciles the rest,
      // exactly as the API does on boot.
      await model.syncIndexes()
    } catch (error) {
      // A pre-existing conflict elsewhere in the schema shouldn't block the
      // dashboard's indexes — fall back to creating just those directly.
      console.warn(`${model.collection.name}: syncIndexes failed (${error.message})`)
      console.warn('   falling back to direct createIndex for dashboard indexes')
      for (const [target, keys, options] of DASHBOARD_INDEXES) {
        if (target !== model) continue
        try {
          await model.collection.createIndex(keys, { background: true, ...options })
        } catch (createError) {
          console.warn(`   ! ${options.name}: ${createError.message}`)
        }
      }
    }

    const present = (await model.collection.indexes())
      .map((index) => index.name)
      .filter((name) => expected.has(name))
    console.log(`${model.collection.name}: ${present.length} dashboard index(es)`)
    present.forEach((name) => console.log(`   ✓ ${name}`))
  }

  await mongoose.disconnect()
  console.log('\nDone.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
