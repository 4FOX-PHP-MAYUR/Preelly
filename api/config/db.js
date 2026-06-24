const mongoose = require('mongoose')

mongoose.set('bufferCommands', false)
mongoose.set('strictQuery', true)

async function connectDB() {
  const uri = process.env.MONGO_URI

  if (!uri) {
    console.error('❌  MONGO_URI is not set in .env')
    process.exit(1)
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    })
    const host = mongoose.connection.host
    console.log(`✅  MongoDB connected: ${host}`)
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message)
    process.exit(1)
  }

  mongoose.connection.on('disconnected', () =>
    console.warn('⚠️   MongoDB disconnected'),
  )
  mongoose.connection.on('reconnected', () =>
    console.log('✅  MongoDB reconnected'),
  )
}

module.exports = connectDB
