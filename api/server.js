const path        = require('path')
const fs          = require('fs')
const dotenv      = require('dotenv')

// ── Load api/.env (production uses .env.production) ───────────────────────────
const envName = process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
const envPath = path.join(__dirname, envName)
dotenv.config({ path: fs.existsSync(envPath) ? envPath : path.join(__dirname, '.env') })

const express     = require('express')
const http        = require('http')
const { Server }  = require('socket.io')
const mongoose    = require('mongoose')
const cors        = require('cors')
const cookieParser = require('cookie-parser')
const session     = require('express-session')
const passport    = require('passport')
const jwt         = require('jsonwebtoken')
const ffmpeg      = require('fluent-ffmpeg')
const { configureFfmpeg } = require('./services/ffmpegConfig')

const connectDB   = require('./config/db')
const { isCookieSecure } = require('./utils/cookieSecure')

// ── Config from .env ──────────────────────────────────────────────────────────
const PORT         = Number(process.env.PORT)         || 8029
const BASE_URL     = process.env.BASE_URL             || `http://localhost:${PORT}`
const FRONTEND_URL = process.env.FRONTEND_URL         || 'http://localhost:8030'
const ADMIN_URL    = process.env.ADMIN_URL            || 'http://localhost:8031'
const ALLOWED_ORIGINS = [...new Set([FRONTEND_URL, ADMIN_URL].filter(Boolean))]

// ── Express + HTTP server ─────────────────────────────────────────────────────
const app    = express()
app.set('trust proxy', 1)
const server = http.createServer(app)

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ALLOWED_ORIGINS
      : true,
    credentials: true,
    methods: ['GET', 'POST'],
  },
})

// Make io available to route handlers
app.set('io', io)

// ── ffmpeg (compression + adaptive HLS/DASH) ─────────────────────────────────
configureFfmpeg()
if (process.env.FFMPEG_PATH) {
  try { ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH) } catch {}
}

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsOptions = process.env.NODE_ENV === 'production'
  ? {
      origin (origin, callback) {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true)
        } else {
          callback(new Error(`CORS blocked for origin: ${origin}`))
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'device-id', 'x-device-id', 'X-Platform', 'X-App-Version'],
    }
  : {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'device-id', 'x-device-id', 'X-Platform', 'X-App-Version'],
    }

// Disable ETag — prevents browsers returning stale 304 for API calls
app.set('etag', false)

app.use(cors(corsOptions))

// No-cache header for all /api responses
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// ── Session + Passport (OAuth) ────────────────────────────────────────────────
app.use(cookieParser())
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: process.env.SESSION_COOKIE_SAME_SITE || 'lax',
    maxAge: Number(process.env.SESSION_COOKIE_MAX_AGE_MS || 600000),
  },
}))
app.use(passport.initialize())
app.use(passport.session())
require('./auth/passport')

// ── Request logger (dev only) ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`)
    next()
  })
}

// ── Body parsers + static files ───────────────────────────────────────────────
app.use(express.json({ limit: '500mb' }))
app.use(express.urlencoded({ extended: true, limit: '500mb' }))
const uploadsDir = path.join(__dirname, 'uploads')
const streamingDir = path.join(uploadsDir, 'streaming')
if (!fs.existsSync(streamingDir)) fs.mkdirSync(streamingDir, { recursive: true })

app.use('/uploads', express.static(uploadsDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
      res.setHeader('Cache-Control', 'public, max-age=60')
    } else if (filePath.endsWith('.mpd')) {
      res.setHeader('Content-Type', 'application/dash+xml')
      res.setHeader('Cache-Control', 'public, max-age=60')
    } else if (filePath.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    } else if (filePath.endsWith('.m4s')) {
      res.setHeader('Content-Type', 'video/iso.segment')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
  },
}))

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, 'uploads', 'videos', 'screenshots')
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true })

// ── DB availability guard ─────────────────────────────────────────────────────
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next()
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database unavailable. Check MONGO_URI.' })
  }
  next()
})

// ── API v1 (mobile + web) ─────────────────────────────────────────────────────
const v1ErrorHandler = require('./core/errors/v1ErrorHandler')
app.use('/api/v1', require('./api/v1'))
app.use('/api/v1', v1ErrorHandler)

// ── Legacy routes (backward compatible — deprecation headers added below) ─────
const { legacyDeprecationHeaders } = require('./api/legacy/compat')
app.use('/api', legacyDeprecationHeaders)

app.use('/api/auth/oauth',    require('./routes/oauth'))
app.use('/api/auth',          require('./routes/auth'))
app.use('/api',               require('./routes/profile'))
app.use('/api/categories',    require('./routes/categories'))
app.use('/api/filters',       require('./routes/filters'))
app.use('/api/category-filters', require('./routes/categoryFilters'))
app.use('/api/vehicle-filters', require('./routes/vehicleFilters'))
app.use('/api/user',          require('./routes/user'))
app.use('/api/chats',         require('./routes/chats'))
app.use('/api/cart',          require('./routes/cart'))
app.use('/api',               require('./routes/feedData'))
app.use('/api',               require('./routes/interactions'))  // before /products
app.use('/api/products',      require('./routes/products'))
app.use('/api',               require('./routes/dynamicForm'))
app.use('/api/admin',         require('./routes/admin'))
app.use('/api/coupon',        require('./routes/coupons'))
app.use('/api/buyer-coupon',  require('./routes/buyerCoupons'))
app.use('/api/payment',       require('./routes/payment'))
app.use('/api',               require('./routes/ai'))
app.use('/api/video',         require('./routes/video'))
app.use('/api/streaming',     require('./routes/streaming'))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// ── Swagger docs ──────────────────────────────────────────────────────────────
app.locals.baseUrl = BASE_URL
const { mountSwagger } = require('./swagger/setup')
mountSwagger(app, { baseUrl: BASE_URL })

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

// ── Socket.IO auth + rooms ────────────────────────────────────────────────────
const User = require('./models/User')

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next()
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.userId = decoded.userId
    User.findById(decoded.userId).select('role').then((user) => {
      socket.role = user?.role
      next()
    }).catch(() => next())
  } catch {
    next()
  }
})

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id)

  if (socket.userId) {
    socket.join(`user-${socket.userId}`)
    if (socket.role === 'admin') {
      socket.join('admin')
      console.log(`👤 Admin ${socket.userId} joined admin room`)
    }
  }

  socket.on('join-user', (userId) => {
    if (userId) { socket.join(`user-${userId}`); socket.userId = userId }
  })

  socket.on('join-room',  (roomId) => { if (roomId) socket.join(roomId) })
  socket.on('leave-room', (roomId) => { if (roomId) socket.leave(roomId) })

  // ── WebRTC call signaling ─────────────────────────────────────────────────
  socket.on('call:offer', ({ to, threadId, type, offer, callerName }) => {
    if (!to) return
    socket.to(`user-${to}`).emit('call:incoming', {
      from: socket.userId, fromName: callerName, threadId, type, offer,
    })
  })

  socket.on('call:answer', ({ to, threadId, answer }) => {
    if (!to) return
    socket.to(`user-${to}`).emit('call:answered', { answer, threadId })
  })

  socket.on('call:ice-candidate', ({ to, candidate }) => {
    if (!to) return
    socket.to(`user-${to}`).emit('call:ice-candidate', { from: socket.userId, candidate })
  })

  socket.on('call:end', ({ to, threadId }) => {
    if (!to) return
    socket.to(`user-${to}`).emit('call:end', { from: socket.userId, threadId })
  })

  socket.on('call:reject', ({ to, threadId }) => {
    if (!to) return
    socket.to(`user-${to}`).emit('call:rejected', { from: socket.userId, threadId })
  })

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id)
  })
})

// ── Connect DB then start server ──────────────────────────────────────────────
connectDB().then(() => {
  // Fix/sync indexes after connection
  Promise.allSettled([
    require('./models/Category').fixIndexes(),
    require('./models/Filter').fixIndexes?.() ?? Promise.resolve(),
    require('./models/FormField').fixIndexes?.() ?? Promise.resolve(),
    require('./models/Emirate').fixIndexes?.() ?? Promise.resolve(),
    require('./models/Package').fixIndexes?.() ?? Promise.resolve(),
    require('./models/StorageFacility').fixIndexes?.() ?? Promise.resolve(),
    require('./models/Coupon').fixIndexes?.() ?? Promise.resolve(),
    require('./models/CouponRedemption').fixIndexes?.() ?? Promise.resolve(),
    require('./models/PaymentTransaction').fixIndexes?.() ?? Promise.resolve(),
    require('./models/PaymentLog').fixIndexes?.() ?? Promise.resolve(),
    require('./models/Product').syncIndexes(),
    require('./models/User').syncIndexes(),
    require('./models/Chat').syncIndexes(),
    require('./models/SearchHistory').syncIndexes(),
    require('./models/SearchAnalytics').syncIndexes(),
  ]).then((results) => {
    results.forEach((r) => {
      if (r.status === 'rejected') console.warn('⚠️  Index sync warning:', r.reason?.message)
    })
  })

  // Expired coupons → inactive (hourly sweep)
  require('./jobs/couponExpiryJob').startCouponExpiryJob()

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`📡 API: ${BASE_URL}/api`)
    console.log(`🏥 Health: ${BASE_URL}/api/health`)
    console.log(`📚 Docs: ${BASE_URL}/api-docs`)
    console.log(`🌐 Frontend: ${FRONTEND_URL}`)
    console.log(`🛠️  Admin: ${ADMIN_URL}`)
  })
})

module.exports = { app, io }
