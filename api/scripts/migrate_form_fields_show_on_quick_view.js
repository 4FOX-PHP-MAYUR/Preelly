/**
 * Backfill showOnQuickView on existing formFields documents.
 * MongoDB is schemaless — new documents get default false from the Mongoose schema;
 * this migration ensures legacy rows explicitly store false when the field is missing.
 *
 * Usage:
 *   node server/scripts/migrate_form_fields_show_on_quick_view.js
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const mongoose = require('mongoose')

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/preelly'

async function run() {
  console.log('[migrate_form_fields_show_on_quick_view] Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)

  const coll = mongoose.connection.collection('formFields')
  const result = await coll.updateMany(
    { showOnQuickView: { $exists: false } },
    { $set: { showOnQuickView: false } }
  )

  console.log(
    `[migrate_form_fields_show_on_quick_view] Updated ${result.modifiedCount} document(s); matched ${result.matchedCount}.`
  )

  const FormField = require('../models/FormField')
  await FormField.syncIndexes()
  console.log('[migrate_form_fields_show_on_quick_view] FormField indexes synced.')

  await mongoose.disconnect()
  console.log('[migrate_form_fields_show_on_quick_view] Done.')
}

run().catch((err) => {
  console.error('[migrate_form_fields_show_on_quick_view] Failed:', err)
  process.exit(1)
})
