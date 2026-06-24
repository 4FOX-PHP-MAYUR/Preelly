/**
 * Ensures Product collection has indexes for new optional vehicle listing fields.
 * MongoDB is schemaless — this migration only syncs indexes; no data rewrite required.
 *
 * Usage:
 *   node server/scripts/migrate_product_vehicle_fields.js
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const mongoose = require('mongoose')

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/preelly'

async function run() {
  console.log('[migrate_product_vehicle_fields] Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)
  const Product = require('../models/Product')

  console.log('[migrate_product_vehicle_fields] Syncing Product indexes...')
  await Product.syncIndexes()
  console.log('[migrate_product_vehicle_fields] Done — optional vehicle listing fields are nullable on existing documents.')
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('[migrate_product_vehicle_fields] Failed:', err)
  process.exit(1)
})
