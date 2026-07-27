/**
 * Backfills Category.isChild for existing documents.
 *
 * The Post Ad category-selection flow now decides whether to drill into a
 * deeper category grid purely from `isChild` (1 = has selectable children,
 * 0/absent = leaf) instead of checking live children on every click. Since
 * `isChild` was added after most categories were created, this sets it once
 * from the ACTUAL current tree shape so existing navigation keeps working:
 *   isChild = 1  if the category has at least one active, non-deleted child
 *   isChild = 0  otherwise (leaf)
 *
 * Safe to re-run — it's idempotent and only updates categories whose stored
 * value doesn't match the computed one.
 *
 * Usage:
 *   node scripts/backfill_category_ischild.js
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const mongoose = require('mongoose')

const MONGODB_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/preelly'

async function run() {
  console.log('[backfill_category_ischild] Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)

  const Category = require('../models/Category')

  const categories = await Category.find({ isDeleted: { $ne: true } })
    .select('_id isChild')
    .lean()
  console.log(`[backfill_category_ischild] Scanning ${categories.length} categories...`)

  let updatedToChild = 0
  let updatedToLeaf = 0
  let unchanged = 0

  for (const cat of categories) {
    const childCount = await Category.countDocuments({
      parentId: cat._id,
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    })
    const nextIsChild = childCount > 0 ? 1 : 0

    if (Number(cat.isChild) === nextIsChild) {
      unchanged += 1
      continue
    }

    await Category.updateOne({ _id: cat._id }, { $set: { isChild: nextIsChild } })
    if (nextIsChild === 1) updatedToChild += 1
    else updatedToLeaf += 1
  }

  console.log('[backfill_category_ischild] Done.')
  console.log(`  isChild set to 1 (has children): ${updatedToChild}`)
  console.log(`  isChild set to 0 (leaf):          ${updatedToLeaf}`)
  console.log(`  already correct:                  ${unchanged}`)

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('[backfill_category_ischild] Failed:', err)
  process.exit(1)
})
