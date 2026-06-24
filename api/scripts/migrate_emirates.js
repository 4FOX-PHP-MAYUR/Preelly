/**
 * Creates the emirates collection and optionally seeds UAE emirates.
 *
 * Usage:
 *   node server/scripts/migrate_emirates.js
 *   node server/scripts/migrate_emirates.js --seed
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const mongoose = require('mongoose')

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/preelly'

const DEFAULT_EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
]

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function run() {
  const shouldSeed = process.argv.includes('--seed')

  console.log('[migrate_emirates] Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)

  const Emirate = require('../models/Emirate')
  await Emirate.syncIndexes()
  console.log('[migrate_emirates] Emirate indexes synced.')

  if (shouldSeed) {
    let inserted = 0
    for (const name of DEFAULT_EMIRATES) {
      const slug = slugify(name)
      const existing = await Emirate.findOne({ slug, isDeleted: false }).lean()
      if (existing) continue

      await Emirate.create({ name, slug, status: true, isDeleted: false })
      inserted += 1
    }
    console.log(`[migrate_emirates] Seeded ${inserted} emirate(s).`)
  } else {
    console.log('[migrate_emirates] Collection ready. Pass --seed to insert default UAE emirates.')
  }

  await mongoose.disconnect()
  console.log('[migrate_emirates] Done.')
}

run().catch((err) => {
  console.error('[migrate_emirates] Failed:', err)
  process.exit(1)
})
