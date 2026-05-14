// Server entrypoint (combined single-file server)

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { Server } = require('socket.io')
const ffmpeg = require('fluent-ffmpeg');
const cookieParser = require('cookie-parser')
const session = require('express-session')
const passport = require('passport')

// Load environment variables
dotenv.config()

const app = express()
const server = http.createServer(app)

// Fail fast when MongoDB is down: do not buffer commands
mongoose.set('bufferCommands', false)
mongoose.set('strictQuery', true)

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['http://117.254.196.100:3002', 'http://127.0.0.1:3000']
      : true,
    credentials: true,
    methods: ['GET', 'POST'],
  },
})

ffmpeg.setFfmpegPath('/usr/local/bin/ffmpeg');

// Make io available to routes
app.set('io', io)

// CORS Configuration
// In development, allow all origins for easier debugging
const corsOptions = process.env.NODE_ENV === 'production' 
  ? {
      origin: ['http://117.254.196.100:3002', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }
  : {
      origin: true, // Allow all origins in development
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }

// Middleware
app.use(cors(corsOptions))

// Cookie + session support
// - Needed for Passport OAuth state handling.
// - Also enables JWT auth from an HTTP-only cookie.
app.use(cookieParser())
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.SESSION_COOKIE_SAME_SITE || 'lax',
      maxAge: Number(process.env.SESSION_COOKIE_MAX_AGE_MS || 10 * 60 * 1000), // 10 minutes
    },
  }),
)

// Passport initialization + strategy registration
app.use(passport.initialize())
app.use(passport.session())
require('./auth/passport')

// Logging middleware for debugging (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`)
    next()
  })
}

// Handle preflight requests
// No explicit app.options wildcard necessary — app.use(cors) handles preflight.

// Increase body parser limits for large file uploads
app.use(express.json({ limit: '500mb' }))
app.use(express.urlencoded({ extended: true, limit: '500mb' }))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, 'uploads', 'videos', 'screenshots')
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true })
}

// If DB is disconnected, respond before any route runs Mongoose queries (bufferCommands = false)
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next()
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'Database unavailable',
      details: 'MongoDB is not connected. Check MONGO_URI and network access.',
    })
  }
  next()
})

// Routes
// IMPORTANT: Mount interactions routes BEFORE products routes
// to ensure /api/products/:id/saved matches before /api/products/:id
app.use('/api/auth/oauth', require('./routes/oauth'))
app.use('/api/auth', require('./routes/auth'))
app.use('/api', require('./routes/profile')) // GET /api/profile (protected example)
app.use('/api/categories', require('./routes/categories'))
app.use('/api/filters', require('./routes/filters'))
app.use('/api/category-filters', require('./routes/categoryFilters'))
app.use('/api/user', require('./routes/user'))
app.use('/api/chats', require('./routes/chats'))
app.use('/api', require('./routes/feedData')) // GET /api/feed-data (optimized fan-out)
app.use('/api', require('./routes/interactions')) // Must come before /api/products
app.use('/api/products', require('./routes/products'))
app.use('/api/admin', require('./routes/admin'))
app.use('/api', require('./routes/ai'))
app.use('/api/video', require('./routes/video'))

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {},
  })
})

// Runtime configuration from environment variables
const PORT = Number(process.env.PORT) || 5002
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb+srv://mankarmayur4fox_db_user:Mayur%40321@cluster0.pgtcaoj.mongodb.net/preelly'

// Make base URL available to routes/services that need public API links.
app.locals.baseUrl = BASE_URL

const { mountSwagger } = require('./swagger/setup')
mountSwagger(app, { baseUrl: BASE_URL })

mongoose
  .connect(MONGO_URI, {
    // Keep initial connect & command selection fast in dev
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 20000,
  })
  .then(async () => {
    console.log('✅ Connected to MongoDB')
    try {
      const Category = require('./models/Category')
      await Category.fixIndexes()
    } catch (err) {
      console.error('⚠️  fixIndexes failed (non-fatal):', err.message)
    }

    try {
      const Filter = require('./models/Filter')
      if (typeof Filter.fixIndexes === 'function') {
        await Filter.fixIndexes()
      }
    } catch (err) {
      console.error('⚠️  Filter.fixIndexes failed (non-fatal):', err.message)
    }

    // Ensure required indexes exist for faster feed / interactions queries.
    // syncIndexes() is safe (idempotent) and will only create missing ones.
    try {
      const Product = require('./models/Product')
      const User = require('./models/User')
      const Chat = require('./models/Chat')
      await Promise.all([Product.syncIndexes(), User.syncIndexes(), Chat.syncIndexes()])
    } catch (err) {
      console.error('⚠️  syncIndexes failed (non-fatal):', err.message)
    }
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message)
    console.log('⚠️  Server will start but database operations will fail')
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || ''
    const isAtlas = /mongodb\.net|mongodb\+srv/i.test(uri)
    if (isAtlas) {
      console.log(
        '💡 Atlas: check internet/VPN, firewall, and Atlas Network Access (IP allowlist). ' +
          'querySrv ETIMEOUT usually means DNS or outbound 27017 blocked.'
      )
    } else {
      console.log('💡 Local MongoDB: ensure it is running, e.g. brew services start mongodb-community')
    }
  })

// Socket.io: optional auth from token for admin room
const User = require('./models/User')
const jwt = require('jsonwebtoken')

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
      socket.userId = decoded.userId
      User.findById(decoded.userId).select('role').then((user) => {
        socket.role = user?.role
        next()
      }).catch(() => next())
    } catch {
      next()
    }
  } else {
    next()
    return
  }
})

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id)

  if (socket.userId) {
    socket.join(`user-${socket.userId}`)
    if (socket.role === 'admin') {
      socket.join('admin')
      console.log(`👤 Admin ${socket.userId} joined admin room`)
    }
  }

  socket.on('join-user', (userId) => {
    if (userId) {
      socket.join(`user-${userId}`)
      socket.userId = userId
      console.log(`👤 User ${userId} joined their room`)
    }
  })

  // Join a specific chat room
  socket.on('join-room', (roomId) => {
    if (roomId) {
      socket.join(roomId)
      console.log(`📨 Socket ${socket.id} joined room: ${roomId}`)
    }
  })

  // Leave a specific chat room
  socket.on('leave-room', (roomId) => {
    if (roomId) {
      socket.leave(roomId)
      console.log(`📨 Socket ${socket.id} left room: ${roomId}`)
    }
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id)
  })
})

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📡 API available at ${BASE_URL}/api`)
  console.log(`🏥 Health check: ${BASE_URL}/api/health`)
  console.log(`📚 API docs (Swagger): ${BASE_URL}/api-docs`)
  console.log(`🔌 Socket.io server ready`)
})

module.exports = { app, io }

