const mongoose = require('mongoose')
const Product = require('../models/Product')
require('dotenv').config()

async function makeAllProductsActive() {
  try {
    // Connect to MongoDB
    const mongoURI =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      'mongodb://adminUser:admin1234@117.254.196.100:27017/reelsmarket?authSource=admin'
    await mongoose.connect(mongoURI)
    console.log('✅ Connected to MongoDB')

    // Update all products to active status
    const result = await Product.updateMany(
      {}, // Match all products
      { $set: { status: 'active' } }
    )

    console.log(`✅ Updated ${result.modifiedCount} products to active status`)
    console.log(`📊 Total products matched: ${result.matchedCount}`)

    // Show status breakdown
    const statusCounts = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])

    console.log('\n📈 Current product status breakdown:')
    statusCounts.forEach(({ _id, count }) => {
      console.log(`  ${_id}: ${count}`)
    })

    await mongoose.connection.close()
    console.log('\n✅ Done! Database connection closed.')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

makeAllProductsActive()

