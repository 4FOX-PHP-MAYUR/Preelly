/**
 * Migration script: convert legacy embedded `subcategories` into normalized Category documents.
 *
 * Usage:
 *   NODE_ENV=production node server/scripts/migrate_categories.js
 *
 * The script:
 *  - Connects to MongoDB using MONGODB_URI (or default)
 *  - Scans the `categories` collection for documents with a `subcategories` array
 *  - For each embedded subcategory it creates a new Category document with parentId set
 *  - Avoids creating duplicates (checks by name + parentId)
 *  - Optionally removes the legacy `subcategories` field from the parent document
 *
 * This script is idempotent and safe to re-run.
 */

require('dotenv').config()
const mongoose = require('mongoose')

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb+srv://mankarmayur4fox_db_user:Mayur%40321@cluster0.pgtcaoj.mongodb.net/preelly'

async function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function run() {
  console.log('Connecting to MongoDB...', MONGODB_URI)
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  const Category = require('../models/Category') // current model
  const rawColl = mongoose.connection.collection('categories')

  const cursor = rawColl.find({ subcategories: { $exists: true, $ne: [] } })
  let parentsProcessed = 0
  let createdCount = 0
  while (await cursor.hasNext()) {
    const doc = await cursor.next()
    parentsProcessed++
    const parentId = doc._id
    const subs = Array.isArray(doc.subcategories) ? doc.subcategories : []
    if (subs.length === 0) continue

    for (const s of subs) {
      const name = (s && s.name) ? String(s.name).trim() : null
      if (!name) continue
      const slug = await slugify(name)

      // Determine legacy sub id (preserve if available)
      let subId = null
      if (s && s._id) {
        // If coming from exported JSON, _id may be { $oid: '...' }
        if (typeof s._id === 'object' && s._id.$oid) {
          subId = mongoose.Types.ObjectId(s._id.$oid)
        } else {
          try {
            subId = mongoose.Types.ObjectId(s._id)
          } catch (e) {
            subId = null
          }
        }
      }

      // don't recreate if a normalized child already exists by _id or by (name+parent)
      let exists = null
      if (subId) exists = await Category.findById(subId).lean()
      if (!exists) {
        exists = await Category.findOne({ name: name, parentId: parentId }).lean()
      }
      if (exists) continue

      const now = new Date()
      const toCreate = {
        _id: subId || undefined,
        name,
        slug,
        parentId: parentId,
        sortOrder: typeof s.sortOrder === 'number' ? s.sortOrder : 0,
        icon: s.icon || null,
        emoji: s.emoji || doc.emoji || null,
        count: typeof s.count === 'number' ? s.count : 0,
        isActive: s.isActive !== undefined ? Boolean(s.isActive) : true,
        isDeleted: false,
        createdAt: s.createdAt || doc.createdAt || now,
        updatedAt: s.updatedAt || doc.updatedAt || now,
      }

      try {
        // If _id provided, pass it into the constructor so original ids are preserved
        const created = new Category(toCreate)
        await created.save()
        createdCount++
        console.log(`Created category "${name}" under parent ${parentId} (preserved id: ${created._id})`)
      } catch (err) {
        // If slug duplicate or other issue, log and continue
        console.error(`Failed to create subcategory "${name}" under ${parentId}:`, err.message || err)
      }
    }

    // Optionally remove legacy subcategories to avoid reprocessing; comment out if you'd like to keep them.
    try {
      await rawColl.updateOne({ _id: parentId }, { $unset: { subcategories: '' } })
      console.log(`Removed legacy subcategories field from parent ${parentId}`)
    } catch (err) {
      console.warn(`Failed to remove legacy field for parent ${parentId}:`, err.message || err)
    }
  }

  console.log('Migration complete.')
  console.log(`Parents scanned: ${parentsProcessed}`)
  console.log(`New categories created: ${createdCount}`)

  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})

