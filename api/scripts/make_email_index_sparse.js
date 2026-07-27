/**
 * Rebuild the users.email unique index as SPARSE so phone-first signups (records
 * with no email yet) don't collide on a null email. Existing users all have an
 * email, so this is a safe, one-time migration.
 *
 * Run from the server directory:
 *   node scripts/make_email_index_sparse.js
 */

const mongoose = require('mongoose')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI

async function run() {
  if (!MONGODB_URI) throw new Error('MONGO_URI (or MONGODB_URI) is not set in .env')

  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)
  console.log('Connected. Database:', mongoose.connection.db.databaseName, '\n')

  const coll = mongoose.connection.collection('users')
  const indexes = await coll.indexes()

  console.log('--- Current indexes ---')
  indexes.forEach((i) =>
    console.log(` ${i.name}  keys=${JSON.stringify(i.key)}  unique=${!!i.unique}  sparse=${!!i.sparse}`)
  )

  const emailIdx = indexes.find((i) => i.key && i.key.email === 1)

  if (emailIdx && emailIdx.unique && emailIdx.sparse) {
    console.log('\nEmail index is already unique + sparse — nothing to do.')
  } else {
    if (emailIdx) {
      await coll.dropIndex(emailIdx.name)
      console.log(`\n✅ Dropped existing email index: ${emailIdx.name}`)
    }
    await coll.createIndex({ email: 1 }, { unique: true, sparse: true, name: 'email_1' })
    console.log('✅ Created unique + sparse index: email_1')
  }

  const finalIndexes = await coll.indexes()
  console.log('\n--- Final indexes ---')
  finalIndexes.forEach((i) =>
    console.log(` ${i.name}  keys=${JSON.stringify(i.key)}  unique=${!!i.unique}  sparse=${!!i.sparse}`)
  )

  console.log('\nDone! Restart the API server.')
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Script failed:', err)
  process.exitCode = 1
  mongoose.disconnect().catch(() => {})
})
