/**
 * Backfill search_analytics from existing search_histories.
 * Idempotent — safe to run multiple times.
 *
 * Usage: node server/scripts/migrate_search_analytics.js
 */
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '../.env') })

const mongoose = require('mongoose')
const SearchHistory = require('../models/SearchHistory')
const SearchAnalytics = require('../models/SearchAnalytics')

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGO_URI or MONGODB_URI is required')
    process.exit(1)
  }

  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  const pipeline = [
    {
      $project: {
        keyword: {
          $toLower: {
            $trim: { input: '$keyword' },
          },
        },
        createdAt: 1,
      },
    },
    { $match: { keyword: { $ne: '' } } },
    {
      $group: {
        _id: '$keyword',
        searchCount: { $sum: 1 },
        lastSearchedAt: { $max: '$createdAt' },
      },
    },
  ]

  const aggregates = await SearchHistory.aggregate(pipeline)
  console.log(`Found ${aggregates.length} unique keywords in search history`)

  let upserted = 0
  for (const row of aggregates) {
    await SearchAnalytics.findOneAndUpdate(
      { keyword: row._id },
      {
        $set: { lastSearchedAt: row.lastSearchedAt },
        $max: { searchCount: row.searchCount },
        $setOnInsert: { keyword: row._id },
      },
      { upsert: true },
    )
    upserted += 1
  }

  console.log(`Upserted ${upserted} analytics records`)
  await mongoose.disconnect()
  console.log('Done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
