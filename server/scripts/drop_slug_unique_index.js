/**
 * Drop ALL unique indexes on name/slug fields in the categories collection.
 * Duplicate names and slugs are fully allowed (even under the same parent).
 *
 * Run from the server directory:
 *   node scripts/drop_slug_unique_index.js
 */

const mongoose = require('mongoose')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb+srv://mankarmayur4fox_db_user:Mayur%40321@cluster0.pgtcaoj.mongodb.net/preelly'

async function run() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)
  console.log('Connected. Database:', mongoose.connection.db.databaseName, '\n')

  const coll = mongoose.connection.collection('categories')
  const indexes = await coll.indexes()

  console.log('--- Current indexes ---')
  indexes.forEach((i) =>
    console.log(` ${i.name}  keys=${JSON.stringify(i.key)}  unique=${!!i.unique}`)
  )

  let dropped = false

  for (const idx of indexes) {
    if (idx.name === '_id_') continue
    if (!idx.unique) continue
    const hasName = idx.key && idx.key.name
    const hasSlug = idx.key && idx.key.slug
    if (hasName || hasSlug) {
      await coll.dropIndex(idx.name)
      console.log(`\n✅ Dropped unique index: ${idx.name} (keys: ${JSON.stringify(idx.key)})`)
      dropped = true
    }
  }

  // Ensure a non-unique compound index exists for query performance
  const final = await coll.indexes()
  const hasCompound = final.find(
    (i) => i.key && i.key.parentId === 1 && i.key.slug === 1 && !i.unique
  )
  if (!hasCompound) {
    await coll.createIndex({ parentId: 1, slug: 1 }, { name: 'parentId_1_slug_1' })
    console.log('\n✅ Created non-unique compound index: parentId_1_slug_1')
  }

  const finalIndexes = await coll.indexes()
  console.log('\n--- Final indexes ---')
  finalIndexes.forEach((i) =>
    console.log(` ${i.name}  keys=${JSON.stringify(i.key)}  unique=${!!i.unique}`)
  )

  if (!dropped) {
    console.log('\nNo unique name/slug indexes found — nothing to drop.')
  } else {
    console.log('\nDone! Duplicate names and slugs are now fully allowed. Restart the server.')
  }

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Script failed:', err)
  process.exitCode = 1
  mongoose.disconnect().catch(() => {})
})
