const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const authMiddleware = require('../middleware/auth')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { body, validationResult } = require('express-validator')
const Product = require('../models/Product')
const User = require('../models/User')
const Follow = require('../models/Follow')
const Order = require('../models/Order')
const Notification = require('../models/Notification')
const EmailOtp = require('../models/EmailOtp')
const PhoneOtp = require('../models/PhoneOtp')
const BankAccount = require('../models/BankAccount')
const SavedCard = require('../models/SavedCard')
const mongoose = require('mongoose')
const { sendEmail } = require('../utils/mailer')
const { sendWhatsAppOtp } = require('../utils/whatsapp')
const { phoneDigitsOnly, parsePhoneInput, applyPhoneFieldsToUser } = require('../utils/phone')
const { isSuperAdminRole, buildFullPermissionSet } = require('../config/adminPermissions')
const { getPermissionMapForRole } = require('../services/adminPermissionService')
const validateObjectId = require('../middleware/validateObjectId')
const optionalAuth = require('../middleware/optionalAuth')
const { getBlockedUserIds, isBlockedBetween } = require('../core/services/blockService')
const DeviceToken = require('../models/DeviceToken')
const { maskToken, sendPreellyNotificationToUser } = require('../services/firebaseAdmin')

const CHANGE_EMAIL_PURPOSE = 'change_email'
const CHANGE_PHONE_PURPOSE = 'change_phone'
const OTP_LENGTH = Number(process.env.EMAIL_OTP_LENGTH || 6)
const OTP_TTL_SECONDS = Number(process.env.EMAIL_OTP_TTL_SECONDS || 600)
const OTP_MAX_ATTEMPTS = Number(process.env.EMAIL_OTP_MAX_ATTEMPTS || 5)
const OTP_LOCK_SECONDS = Number(process.env.EMAIL_OTP_LOCK_SECONDS || 900)

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const generateOtpCode = () => {
  const min = 10 ** (OTP_LENGTH - 1)
  const max = 10 ** OTP_LENGTH - 1
  return String(Math.floor(min + Math.random() * (max - min + 1)))
}
const hashOtp = (otpCode) => crypto.createHash('sha256').update(String(otpCode)).digest('hex')

const sendChangeEmailOtp = async (email) => {
  const code = generateOtpCode()
  const otpHash = hashOtp(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000)

  await EmailOtp.findOneAndUpdate(
    { email, purpose: CHANGE_EMAIL_PURPOSE },
    { otpHash, expiresAt, attempts: 0, lockedUntil: null },
    { upsert: true, returnDocument: 'after' }
  )

  const minutes = Math.ceil(OTP_TTL_SECONDS / 60)
  await sendEmail({
    to: email,
    subject: 'Your Preelly email change code',
    text: `Your verification code is: ${code}\n\nUse this code to confirm your new email address. It expires in ${minutes} minutes.`,
    html: `<p>Your verification code is:</p><h2 style="margin: 0 0 12px 0;">${code}</h2><p>Use this code to confirm your new email address. It expires in ${minutes} minutes.</p>`,
  })
}

// Phone changes reuse the same WhatsApp OTP delivery as sign-in
// (routes/auth.js sendLoginPhoneOtp), but store the code under its own purpose
// so a sign-in code can never be replayed to change someone's number.
const sendChangePhoneOtp = async (phoneKey) => {
  const code = generateOtpCode()
  const otpHash = hashOtp(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000)

  await PhoneOtp.findOneAndUpdate(
    { phone: phoneKey, purpose: CHANGE_PHONE_PURPOSE },
    { otpHash, expiresAt, attempts: 0, lockedUntil: null },
    { upsert: true, returnDocument: 'after' }
  )

  await sendWhatsAppOtp({ to: phoneKey, code })
}

/** Another account already using this number? Covers the stored phone formats. */
const phoneTakenByOtherUser = async (phoneKey, selfId) => {
  const existing = await User.findOne({
    _id: { $ne: selfId },
    $or: [{ phone: phoneKey }, { phone: `+${phoneKey}` }],
  }).select('_id')
  return Boolean(existing)
}

const avatarDir = path.join(__dirname, '..', 'uploads', 'avatars')
const identityDir = path.join(__dirname, '..', 'uploads', 'identity')
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true })
if (!fs.existsSync(identityDir)) fs.mkdirSync(identityDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.jpg'
      cb(null, `user_${req.user?._id || 'unknown'}_${Date.now()}${ext}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) return cb(new Error('Only image uploads are allowed'))
    cb(null, true)
  },
})

const identityUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, identityDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.jpg'
      const side = file.fieldname === 'emiratesIdBack' ? 'back' : 'front'
      cb(null, `eid_${side}_${req.user?._id || 'unknown'}_${Date.now()}${ext}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) return cb(new Error('Only image uploads are allowed'))
    cb(null, true)
  },
})

// @route   GET /api/user/identity-verification
// @desc    Get current user's identity verification status
// @access  Private
router.get('/identity-verification', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      'identityVerificationStatus identityVerificationRejectionReason identityVerificationSubmittedAt identityVerifiedAt emiratesIdFront emiratesIdBack isVerified'
    )
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({
      status: user.identityVerificationStatus,
      rejectionReason: user.identityVerificationRejectionReason,
      submittedAt: user.identityVerificationSubmittedAt,
      verifiedAt: user.identityVerifiedAt,
      emiratesIdFront: user.emiratesIdFront,
      emiratesIdBack: user.emiratesIdBack,
      isVerified: user.isVerified,
    })
  } catch (error) {
    console.error('Error fetching identity verification:', error)
    res.status(500).json({ message: 'Error fetching identity verification status' })
  }
})

// @route   POST /api/user/identity-verification
// @desc    Submit Emirates ID front/back for identity verification
// @access  Private
router.post(
  '/identity-verification',
  authMiddleware,
  identityUpload.fields([
    { name: 'emiratesIdFront', maxCount: 1 },
    { name: 'emiratesIdBack', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const frontFile = req.files?.emiratesIdFront?.[0]
      const backFile = req.files?.emiratesIdBack?.[0]

      if (!frontFile || !backFile) {
        return res.status(400).json({ message: 'Both Emirates ID front and back photos are required' })
      }

      const user = await User.findById(req.user._id)
      if (!user) return res.status(404).json({ message: 'User not found' })

      if (user.identityVerificationStatus === 'pending') {
        return res.status(400).json({ message: 'Your verification is already under review' })
      }
      if (user.identityVerificationStatus === 'approved') {
        return res.status(400).json({ message: 'Your account is already verified' })
      }

      user.emiratesIdFront = `/uploads/identity/${frontFile.filename}`
      user.emiratesIdBack = `/uploads/identity/${backFile.filename}`
      user.identityVerificationStatus = 'pending'
      user.identityVerificationRejectionReason = null
      user.identityVerificationSubmittedAt = new Date()
      await user.save()

      res.json({
        message: 'Verification submitted successfully. We will review your documents shortly.',
        status: user.identityVerificationStatus,
        submittedAt: user.identityVerificationSubmittedAt,
      })
    } catch (error) {
      console.error('Error submitting identity verification:', error)
      res.status(500).json({ message: error.message || 'Error submitting identity verification' })
    }
  }
)

// @route   GET /api/user/reels-progress
// @desc    Get last watched reel index per feed (for resume on revisit)
// @access  Private
router.get('/reels-progress', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('reelsProgress')
    const reelsProgress = user?.reelsProgress && typeof user.reelsProgress === 'object' ? user.reelsProgress : {}
    res.json({ reelsProgress })
  } catch (error) {
    console.error('Error fetching reels progress:', error)
    res.status(500).json({ message: 'Error fetching reels progress' })
  }
})

// @route   PUT /api/user/reels-progress
// @desc    Save last watched reel index for a feed
// @access  Private
router.put('/reels-progress', authMiddleware, async (req, res) => {
  try {
    const { feedKey, index } = req.body
    if (typeof feedKey !== 'string' || typeof index !== 'number' || index < 0) {
      return res.status(400).json({ message: 'Invalid feedKey or index' })
    }
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (!user.reelsProgress || typeof user.reelsProgress !== 'object') {
      user.reelsProgress = {}
    }
    user.reelsProgress[feedKey] = index
    await user.save()
    res.json({ reelsProgress: user.reelsProgress })
  } catch (error) {
    console.error('Error saving reels progress:', error)
    res.status(500).json({ message: 'Error saving reels progress' })
  }
})

// @route   GET /api/user/dashboard
// @desc    Get user dashboard data
// @access  Private
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id

    const [products, user, purchaseCount] = await Promise.all([
      Product.find({ seller: userId }).populate('category', 'name').sort({ createdAt: -1 }),
      User.findById(userId),
      Order.countDocuments({ buyer: userId }),
    ])

    const savedProducts = await Product.find({ _id: { $in: user?.savedProducts || [] } })
      .populate('category', 'name')
      .sort({ createdAt: -1 })

    const stats = {
      totalProducts: products.length,
      activeProducts: products.filter((p) => p.status === 'active').length,
      soldProducts: products.filter((p) => p.status === 'sold').length,
      totalViews: products.reduce((sum, p) => sum + (p.views || 0), 0),
      savedCount: savedProducts.length,
      purchaseCount,
    }

    res.json({
      user: req.user,
      products,
      savedProducts,
      stats,
    })
  } catch (error) {
    console.error('Error fetching dashboard:', error)
    res.status(500).json({ message: 'Error fetching dashboard data' })
  }
})

// @route   GET /api/user/listings
// @desc    Get user's listings with pagination/search/filter
// @access  Private
router.get('/listings', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1))
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)))
    const q = String(req.query.q || '').trim()
    const status = String(req.query.status || '').trim()
    const category = String(req.query.category || '').trim()
    const archived = ['1', 'true', 'yes'].includes(String(req.query.archived || '').trim().toLowerCase())
    const sortKey = String(req.query.sort || '').trim()

    const query = { seller: req.user._id }
    if (archived) {
      // Archives: inactive status and/or isArchived flag (legacy + new)
      query.$or = [{ status: 'inactive' }, { isArchived: true }]
    } else if (status) {
      query.status = status
    }
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.category = category
    }
    if (q) {
      const textClause = {
        $or: [{ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }],
      }
      if (query.$or) {
        // Combine archived $or with text search via $and
        query.$and = [{ $or: query.$or }, textClause]
        delete query.$or
      } else {
        Object.assign(query, textClause)
      }
    }

    // Price sorts key on `productPrice`, the field the post-ad flow writes; `price`
    // is the legacy required column and stays at its placeholder (1) on those
    // listings, which made this sort a no-op. Same rule as GET /api/products.
    let sort = { createdAt: -1 }
    if (sortKey === 'oldest') sort = { createdAt: 1 }
    else if (sortKey === 'price_asc') sort = { productPrice: 1, createdAt: -1 }
    else if (sortKey === 'price_desc') sort = { productPrice: -1, createdAt: -1 }
    else if (sortKey === 'archived_newest') sort = { archivedAt: -1, updatedAt: -1, createdAt: -1 }
    else if (sortKey === 'archived_oldest') sort = { archivedAt: 1, updatedAt: 1, createdAt: 1 }
    else if (sortKey === 'updated') sort = { updatedAt: -1 }

    const [items, total] = await Promise.all([
      Product.find(query)
        .select(
          // productPrice ships alongside price so the card can show the real amount
          // (the front prefers productPrice and ignores the legacy placeholder).
          'title price productPrice currency status moderationStatus images video location category isArchived archivedAt createdAt updatedAt views',
        )
        .populate('category', 'name')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ])

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (error) {
    console.error('Error fetching listings:', error)
    res.status(500).json({ message: 'Error fetching listings' })
  }
})

// @route   GET /api/user/orders
// @desc    Get buyer orders with pagination
// @access  Private
router.get('/orders', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1))
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)))
    const orderStatus = String(req.query.orderStatus || '').trim()
    const paymentStatus = String(req.query.paymentStatus || '').trim()

    const query = { buyer: req.user._id }
    if (orderStatus) query.orderStatus = orderStatus
    if (paymentStatus) query.paymentStatus = paymentStatus

    const [items, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('product', 'title images price currency status')
        .populate('seller', 'name avatar rating isVerified identityVerificationStatus')
        .lean(),
      Order.countDocuments(query),
    ])

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    res.status(500).json({ message: 'Error fetching orders' })
  }
})

// @route   GET /api/user/liked
// @desc    Products the current user has liked (heart button)
// @access  Private
router.get('/liked', authMiddleware, async (req, res) => {
  try {
    const blockedIds = await getBlockedUserIds(req.user._id)
    const products = await Product.find({
      likes: req.user._id,
      ...(blockedIds.length ? { seller: { $nin: blockedIds } } : {}),
    })
      .populate('category', 'name icon emoji')
      .populate('seller', 'name avatar rating isVerified identityVerificationStatus')
      .sort({ createdAt: -1 })
      .lean()
    res.json({ items: products })
  } catch (error) {
    console.error('Error fetching liked products:', error)
    res.status(500).json({ message: 'Error fetching liked products' })
  }
})

// @route   GET /api/user/wishlist
// @desc    Alias for saved products (wishlist)
// @access  Private
router.get('/wishlist', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('savedProducts').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })

    const savedIds = (user.savedProducts || []).filter(Boolean)
    // Wishlist entries from blocked accounts stay stored but are hidden.
    const blockedIds = await getBlockedUserIds(req.user._id)
    const products = await Product.find({
      _id: { $in: savedIds },
      ...(blockedIds.length ? { seller: { $nin: blockedIds } } : {}),
    })
      .populate('category', 'name icon emoji')
      .populate('seller', 'name avatar rating isVerified identityVerificationStatus')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ items: products })
  } catch (error) {
    console.error('Error fetching wishlist:', error)
    res.status(500).json({ message: 'Error fetching wishlist' })
  }
})

// @route   GET /api/user/notifications
// @desc    Get recent notifications with actor/product populated
// @access  Private
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)))
    const { tab } = req.query // 'buying' | 'selling' | 'general' | undefined (all)

    // Notifications whose actor is a blocked account are hidden from both the
    // list and the badge counts, in either direction.
    const blockedIds = await getBlockedUserIds(req.user._id)
    const actorFilter = blockedIds.length ? { actor: { $nin: blockedIds } } : {}

    const query = { user: req.user._id, ...actorFilter }
    if (tab && tab !== 'all') query.tab = tab

    const items = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actor', 'name avatar isVerified')
      .populate('relatedProduct', 'title images video price')
      .lean()

    // counts per tab for badge display
    const [buyingUnread, sellingUnread] = await Promise.all([
      Notification.countDocuments({ user: req.user._id, tab: 'buying', isRead: false, ...actorFilter }),
      Notification.countDocuments({ user: req.user._id, tab: 'selling', isRead: false, ...actorFilter }),
    ])

    res.json({ items, buyingUnread, sellingUnread })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    res.status(500).json({ message: 'Error fetching notifications' })
  }
})

// @route   GET /api/user/notifications/unread-count
// @desc    Total unread notifications — badge only, no documents fetched
// @access  Private
router.get('/notifications/unread-count', authMiddleware, async (req, res) => {
  try {
    // Same blocked-actor rule as the list, so the badge can't count hidden rows.
    const blockedIds = await getBlockedUserIds(req.user._id)
    const unread = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
      ...(blockedIds.length ? { actor: { $nin: blockedIds } } : {}),
    })
    res.json({ unread })
  } catch (error) {
    console.error('Error counting unread notifications:', error)
    res.status(500).json({ message: 'Error counting unread notifications' })
  }
})

// @route   PATCH /api/user/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.patch('/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true })
    res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    console.error('Error marking notifications read:', error)
    res.status(500).json({ message: 'Error marking notifications read' })
  }
})

// @route   PATCH /api/user/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
router.patch('/notifications/:id/read', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true }
    )
    res.json({ message: 'Notification marked as read' })
  } catch (error) {
    console.error('Error marking notification read:', error)
    res.status(500).json({ message: 'Error marking notification read' })
  }
})

// @route   GET /api/user/:id/profile
// @desc    Get user profile by ID (public)
// @access  Public
// NOTE: This route must come BEFORE /profile to avoid route conflicts
router.get('/:id/profile', validateObjectId('id'), optionalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -savedProducts -emiratesIdFront -emiratesIdBack -identityVerificationRejectionReason')

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Direct-URL access to a blocked account's profile (either direction)
    // resolves to the standard not-found response.
    if (req.user && (await isBlockedBetween(req.user._id, user._id))) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Get user stats. "totalProducts" (Ads Posted) counts ads the user has
    // created, excluding ones that are hidden from their profile listings —
    // status 'inactive' or soft-archived — so this number matches what a
    // visitor actually sees when they scroll the listings grid below it.
    // Hard-deleted ads are gone from the collection so they're excluded
    // automatically. Aggregated in one pass so we never pull full product
    // documents just to count/sum them.
    const [statsAgg] = await Product.aggregate([
      { $match: { seller: user._id, status: { $ne: 'inactive' }, isArchived: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalViews: { $sum: { $ifNull: ['$views', 0] } },
          totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } },
        },
      },
    ])
    const stats = {
      totalProducts: statsAgg?.totalProducts || 0,
      totalViews: statsAgg?.totalViews || 0,
      totalLikes: statsAgg?.totalLikes || 0,
    }

    res.json({
      ...user.toObject(),
      stats,
    })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error fetching user profile' })
  }
})

// @route   GET /api/user/:id/followers
// @desc    Get list of active followers for a user
// @access  Public
router.get('/:id/followers', validateObjectId('id'), optionalAuth, async (req, res) => {
  try {
    const userExists = await User.exists({ _id: req.params.id })
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' })
    }
    if (req.user && (await isBlockedBetween(req.user._id, req.params.id))) {
      return res.status(404).json({ message: 'User not found' })
    }

    const blockedIds = req.user ? await getBlockedUserIds(req.user._id) : []
    const records = await Follow.find({
      following: req.params.id,
      status: 'active',
      ...(blockedIds.length ? { follower: { $nin: blockedIds } } : {}),
    })
      .populate('follower', 'name avatar email phone rating memberSince isVerified role')
      .sort({ followedAt: -1 })
      .lean()

    let myFollowingIds = new Set()
    if (req.user) {
      const myFollowingRecords = await Follow.find({
        follower: req.user._id,
        status: 'active',
      })
        .select('following')
        .lean()
      myFollowingIds = new Set(myFollowingRecords.map((r) => String(r.following)))
    }

    const followers = records
      .filter((r) => r.follower)
      .map((r) => ({
        ...r.follower,
        followedAt: r.followedAt,
        isFollowing: myFollowingIds.has(String(r.follower._id)),
      }))

    res.json({ followers, count: followers.length })
  } catch (error) {
    console.error('Error fetching followers:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error fetching followers' })
  }
})

// @route   GET /api/user/:id/following
// @desc    Get list of users that a user is actively following
// @access  Public
router.get('/:id/following', validateObjectId('id'), optionalAuth, async (req, res) => {
  try {
    const userExists = await User.exists({ _id: req.params.id })
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' })
    }
    if (req.user && (await isBlockedBetween(req.user._id, req.params.id))) {
      return res.status(404).json({ message: 'User not found' })
    }

    const blockedIds = req.user ? await getBlockedUserIds(req.user._id) : []
    const records = await Follow.find({
      follower: req.params.id,
      status: 'active',
      ...(blockedIds.length ? { following: { $nin: blockedIds } } : {}),
    })
      .populate('following', 'name avatar email phone rating memberSince isVerified role')
      .sort({ followedAt: -1 })
      .lean()

    let myFollowingIds = new Set()
    if (req.user) {
      const myFollowingRecords = await Follow.find({
        follower: req.user._id,
        status: 'active',
      })
        .select('following')
        .lean()
      myFollowingIds = new Set(myFollowingRecords.map((r) => String(r.following)))
    }

    const following = records
      .filter((r) => r.following)
      .map((r) => ({
        ...r.following,
        followedAt: r.followedAt,
        isFollowing: myFollowingIds.has(String(r.following._id)),
      }))

    res.json({ following, count: following.length })
  } catch (error) {
    console.error('Error fetching following:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error fetching following' })
  }
})

// @route   GET /api/user/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('adminRole', 'role_name status')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const userData = user.toJSON()
    if (user.role === 'admin' && user.adminRole) {
      // Super Admin always gets full access (view/create/edit/delete) on every module
      if (isSuperAdminRole(user.adminRole)) {
        userData.permissions = {}
        buildFullPermissionSet().forEach((p) => {
          userData.permissions[p.module_name] = {
            can_view: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
          }
        })
      } else {
        userData.permissions = await getPermissionMapForRole(user.adminRole._id)
      }
    }

    res.json(userData)
  } catch (error) {
    console.error('Error fetching profile:', error)
    res.status(500).json({ message: 'Error fetching profile' })
  }
})

// @route   POST /api/user/profile
// @desc    Basic profile setup (name, profile pic, location) + mark complete
// @access  Private
router.post('/profile', authMiddleware, upload.single('profilePic'), async (req, res) => {
  try {
    const skip = String(req.body?.skip || '').trim() === '1'
    const name = String(req.body?.name || '').trim()
    const displayName = req.body?.displayName != null ? String(req.body.displayName).trim() : ''
    const gender = req.body?.gender != null ? String(req.body.gender).trim() : ''
    const dobRaw = req.body?.dob != null ? String(req.body.dob).trim() : ''
    const city = String(req.body?.city || '').trim()
    const lat = req.body?.lat != null && req.body?.lat !== '' ? Number(req.body.lat) : null
    const lng = req.body?.lng != null && req.body?.lng !== '' ? Number(req.body.lng) : null
    const locationSource = String(req.body?.locationSource || '').trim().toLowerCase()
    const addressLine1 = req.body?.addressLine1 != null ? String(req.body.addressLine1).trim() : ''
    const addressLine2 = req.body?.addressLine2 != null ? String(req.body.addressLine2).trim() : ''
    const postalCode = req.body?.postalCode != null ? String(req.body.postalCode).trim() : ''
    const country = req.body?.country != null ? String(req.body.country).trim() : ''

    if (!skip && !name) {
      return res.status(400).json({ message: 'Name is required' })
    }
    if ((lat != null && Number.isNaN(lat)) || (lng != null && Number.isNaN(lng))) {
      return res.status(400).json({ message: 'Invalid latitude/longitude' })
    }

    if (!skip) {
      const allowedGenders = ['male', 'female', 'other', 'prefer_not_to_say']
      if (gender && !allowedGenders.includes(gender)) {
        return res.status(400).json({ message: 'Invalid gender' })
      }
      if (dobRaw) {
        const dob = new Date(dobRaw)
        if (Number.isNaN(dob.getTime())) {
          return res.status(400).json({ message: 'Invalid date of birth' })
        }
      }
    }

    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (name) user.name = name
    if (displayName) user.displayName = displayName
    if (gender) user.gender = gender
    if (dobRaw) user.dob = new Date(dobRaw)
    if (addressLine1) user.address = user.address || {}
    if (user.address) {
      user.address.line1 = addressLine1 || user.address.line1 || null
      user.address.line2 = addressLine2 || user.address.line2 || null
      user.address.postalCode = postalCode || user.address.postalCode || null
      user.address.country = country || user.address.country || null
    }

    if (req.file?.filename) {
      user.avatar = `/uploads/avatars/${req.file.filename}`
    }

    const hasCoords = lat != null && lng != null
    const hasCity = !!city

    if (hasCoords || hasCity) {
      user.location = user.location || {}
      user.location.city = hasCity ? city : user.location.city || null
      user.location.source = locationSource === 'geolocation' ? 'geolocation' : 'manual'
      user.location.updatedAt = new Date()
      if (hasCoords) {
        user.location.coordinates = { type: 'Point', coordinates: [lng, lat] }
      }
    }

    user.isProfileComplete = true
    await user.save()

    res.json({
      user: user.toJSON(),
    })
  } catch (error) {
    console.error('Error completing profile:', error)
    res.status(500).json({ message: 'Error saving profile' })
  }
})

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email, phone, avatar, displayName, gender, dob, address } = req.body
    const user = await User.findById(req.user._id)

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (name) user.name = name
    if (displayName != null) user.displayName = String(displayName).trim() || null
    if (gender != null && gender !== '') {
      const allowedGenders = ['male', 'female', 'other', 'prefer_not_to_say']
      if (!allowedGenders.includes(gender)) return res.status(400).json({ message: 'Invalid gender' })
      user.gender = gender
    }
    if (req.body?.genderCustom !== undefined) {
      const custom = req.body.genderCustom == null ? '' : String(req.body.genderCustom).trim()
      user.genderCustom = custom || null
    }
    if (dob != null && String(dob).trim()) {
      const d = new Date(String(dob))
      if (Number.isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid date of birth' })
      user.dob = d
    }

    if (address && typeof address === 'object') {
      user.address = user.address || {}
      if (address.line1 !== undefined) user.address.line1 = address.line1 ? String(address.line1).trim() : null
      if (address.line2 !== undefined) user.address.line2 = address.line2 ? String(address.line2).trim() : null
      if (address.postalCode !== undefined) user.address.postalCode = address.postalCode ? String(address.postalCode).trim() : null
      if (address.country !== undefined) user.address.country = address.country ? String(address.country).trim() : null
    }
    if (email) user.email = email
    if (phone) user.phone = phone
    if (avatar) user.avatar = avatar

    await user.save()

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message })
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email or phone already exists' })
    }
    res.status(500).json({ message: 'Error updating profile' })
  }
})

// @route   POST /api/user/change-email/request
// @desc    Send OTP to a new email address for email change
// @access  Private
router.post(
  '/change-email/request',
  authMiddleware,
  [body('email').isEmail().withMessage('Please enter a valid email')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const newEmail = normalizeEmail(req.body.email)
      const user = await User.findById(req.user._id)
      if (!user) return res.status(404).json({ message: 'User not found' })

      if (normalizeEmail(user.email) === newEmail) {
        return res.status(400).json({ message: 'Enter an email that is different from your current one' })
      }

      const existing = await User.findOne({ email: newEmail, _id: { $ne: user._id } })
      if (existing) {
        return res.status(400).json({ message: 'This email is already linked to another account' })
      }

      await sendChangeEmailOtp(newEmail)
      return res.status(200).json({
        message: 'Verification code sent',
        email: newEmail,
        otpLength: OTP_LENGTH,
      })
    } catch (error) {
      console.error('change-email request error:', error)
      res.status(500).json({ message: 'Server error while sending verification code' })
    }
  }
)

// @route   POST /api/user/change-email/verify
// @desc    Verify OTP and update the authenticated user's email
// @access  Private
router.post(
  '/change-email/verify',
  authMiddleware,
  [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('otp')
      .trim()
      .isLength({ min: OTP_LENGTH, max: OTP_LENGTH })
      .withMessage('Invalid OTP length'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const newEmail = normalizeEmail(req.body.email)
      const otp = String(req.body.otp || '').trim()
      const user = await User.findById(req.user._id)
      if (!user) return res.status(404).json({ message: 'User not found' })

      if (normalizeEmail(user.email) === newEmail) {
        return res.status(400).json({ message: 'Enter an email that is different from your current one' })
      }

      const existing = await User.findOne({ email: newEmail, _id: { $ne: user._id } })
      if (existing) {
        return res.status(400).json({ message: 'This email is already linked to another account' })
      }

      const record = await EmailOtp.findOne({ email: newEmail, purpose: CHANGE_EMAIL_PURPOSE }).select('+otpHash')
      if (!record) return res.status(400).json({ message: 'Invalid or expired verification code' })

      const now = Date.now()
      if (record.lockedUntil && record.lockedUntil.getTime() > now) {
        return res.status(429).json({ message: 'Too many attempts. Try again later.' })
      }
      if (record.expiresAt.getTime() < now) {
        await EmailOtp.deleteOne({ _id: record._id })
        return res.status(400).json({ message: 'Invalid or expired verification code' })
      }

      const isMatch = hashOtp(otp) === record.otpHash
      if (!isMatch) {
        record.attempts = (record.attempts || 0) + 1
        if (record.attempts >= OTP_MAX_ATTEMPTS) {
          record.lockedUntil = new Date(now + OTP_LOCK_SECONDS * 1000)
        }
        await record.save()
        return res.status(400).json({ message: 'Invalid or expired verification code' })
      }

      await EmailOtp.deleteOne({ _id: record._id })

      user.email = newEmail
      user.isEmailVerified = true
      await user.save()

      return res.status(200).json({
        message: 'Email updated successfully',
        email: user.email,
        isEmailVerified: true,
      })
    } catch (error) {
      console.error('change-email verify error:', error)
      if (error.code === 11000) {
        return res.status(400).json({ message: 'This email is already linked to another account' })
      }
      res.status(500).json({ message: 'Server error while updating email' })
    }
  }
)

// @route   POST /api/user/change-phone/request
// @desc    Send a WhatsApp OTP to a new mobile number for a phone change
// @access  Private
router.post(
  '/change-phone/request',
  authMiddleware,
  [body('phone').trim().notEmpty().withMessage('Phone number is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      let parsedPhone
      try {
        parsedPhone = parsePhoneInput({
          phone: req.body.phone,
          phoneCountryCode: req.body.phoneCountryCode,
          phoneCountryIso: req.body.phoneCountryIso,
        })
      } catch {
        return res.status(400).json({ message: 'Please enter a valid phone number' })
      }

      const phoneKey = parsedPhone.phoneDigits
      const user = await User.findById(req.user._id)
      if (!user) return res.status(404).json({ message: 'User not found' })

      if (user.phone && phoneDigitsOnly(user.phone) === phoneKey) {
        return res
          .status(400)
          .json({ message: 'Enter a mobile number that is different from your current one' })
      }

      if (await phoneTakenByOtherUser(phoneKey, user._id)) {
        return res.status(400).json({ message: 'This mobile number is already linked to another account' })
      }

      await sendChangePhoneOtp(phoneKey)
      return res.status(200).json({
        message: 'Verification code sent',
        phone: phoneKey,
        otpLength: OTP_LENGTH,
      })
    } catch (error) {
      console.error('change-phone request error:', error)
      if (String(error.message || '').includes('WABA_')) {
        return res
          .status(500)
          .json({ message: 'WhatsApp OTP service is not configured (WABA env vars missing)' })
      }
      res.status(500).json({ message: 'Server error while sending verification code' })
    }
  }
)

// @route   POST /api/user/change-phone/verify
// @desc    Verify the OTP and update the authenticated user's mobile number
// @access  Private
router.post(
  '/change-phone/verify',
  authMiddleware,
  [
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('otp')
      .trim()
      .isLength({ min: OTP_LENGTH, max: OTP_LENGTH })
      .withMessage('Invalid OTP length'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      let parsedPhone
      try {
        parsedPhone = parsePhoneInput({
          phone: req.body.phone,
          phoneCountryCode: req.body.phoneCountryCode,
          phoneCountryIso: req.body.phoneCountryIso,
        })
      } catch {
        return res.status(400).json({ message: 'Please enter a valid phone number' })
      }

      const phoneKey = parsedPhone.phoneDigits
      const otp = String(req.body.otp || '').trim()
      const user = await User.findById(req.user._id)
      if (!user) return res.status(404).json({ message: 'User not found' })

      if (user.phone && phoneDigitsOnly(user.phone) === phoneKey) {
        return res
          .status(400)
          .json({ message: 'Enter a mobile number that is different from your current one' })
      }

      if (await phoneTakenByOtherUser(phoneKey, user._id)) {
        return res.status(400).json({ message: 'This mobile number is already linked to another account' })
      }

      const record = await PhoneOtp.findOne({ phone: phoneKey, purpose: CHANGE_PHONE_PURPOSE }).select('+otpHash')
      if (!record) return res.status(400).json({ message: 'Invalid or expired verification code' })

      const now = Date.now()
      if (record.lockedUntil && record.lockedUntil.getTime() > now) {
        return res.status(429).json({ message: 'Too many attempts. Try again later.' })
      }
      if (record.expiresAt.getTime() < now) {
        await PhoneOtp.deleteOne({ _id: record._id })
        return res.status(400).json({ message: 'Invalid or expired verification code' })
      }

      const isMatch = hashOtp(otp) === record.otpHash
      if (!isMatch) {
        record.attempts = (record.attempts || 0) + 1
        if (record.attempts >= OTP_MAX_ATTEMPTS) {
          record.lockedUntil = new Date(now + OTP_LOCK_SECONDS * 1000)
        }
        await record.save()
        return res.status(400).json({ message: 'Invalid or expired verification code' })
      }

      await PhoneOtp.deleteOne({ _id: record._id })

      applyPhoneFieldsToUser(user, parsedPhone)
      user.isPhoneVerified = true
      await user.save()

      return res.status(200).json({
        message: 'Mobile number updated successfully',
        phone: user.phone,
        isPhoneVerified: true,
      })
    } catch (error) {
      console.error('change-phone verify error:', error)
      if (error.code === 11000) {
        return res.status(400).json({ message: 'This mobile number is already linked to another account' })
      }
      res.status(500).json({ message: 'Server error while updating mobile number' })
    }
  }
)

// @route   POST /api/user/change-password
// @access  Private
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' })
    }
    const user = await User.findById(req.user._id).select('+password')
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (user.password) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password is required' })
      const match = await user.comparePassword(currentPassword)
      if (!match) return res.status(400).json({ message: 'Current password is incorrect' })
    }

    user.password = newPassword
    await user.save()
    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('change-password error', err)
    res.status(500).json({ message: 'Failed to change password' })
  }
})

// @route   POST /api/user/unlink-social
// @access  Private
router.post('/unlink-social', authMiddleware, async (req, res) => {
  try {
    const { provider } = req.body
    const allowed = ['google', 'apple', 'facebook', 'instagram']
    if (!allowed.includes(provider)) return res.status(400).json({ message: 'Invalid provider' })
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    const fieldMap = {
      google: 'googleProviderId',
      apple: 'appleProviderId',
      facebook: 'facebookProviderId',
      instagram: 'instagramProviderId',
    }
    user[fieldMap[provider]] = undefined
    if (provider === 'instagram') user.instagramUsername = undefined
    await user.save()
    res.json({ message: `${provider} account unlinked` })
  } catch (err) {
    console.error('unlink-social error', err)
    res.status(500).json({ message: 'Failed to unlink account' })
  }
})


// ─── Follow Requests ────────────────────────────────────────────────────────

// @route   GET /api/user/follow-requests
// @desc    Get all pending follow requests for the current user
// @access  Private
router.get('/follow-requests', authMiddleware, async (req, res) => {
  try {
    const records = await Follow.find({ following: req.user._id, status: 'pending' })
      .populate('follower', 'name avatar isVerified')
      .sort({ requestedAt: -1 })
      .lean()

    const requests = records.map((r) => ({
      _id: r._id,
      user: r.follower,
      requestedAt: r.requestedAt || r.createdAt,
    }))

    res.json({ requests, count: requests.length })
  } catch (error) {
    console.error('Error fetching follow requests:', error)
    res.status(500).json({ message: 'Error fetching follow requests' })
  }
})

// @route   GET /api/user/suggested
// @desc    Get suggested users to follow (users the current user doesn't follow yet)
// @access  Private
router.get('/suggested', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(20, Number(req.query.limit || 10))

    // IDs the user already has a relationship with (any status)
    const existing = await Follow.find({ follower: req.user._id }).select('following').lean()
    const excludeIds = existing.map((r) => r.following)
    excludeIds.push(req.user._id)
    // Never suggest an account blocked in either direction.
    excludeIds.push(...(await getBlockedUserIds(req.user._id)))

    const suggested = await User.find({ _id: { $nin: excludeIds }, status: 'active' })
      .select('name avatar isVerified')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    res.json({ suggested })
  } catch (error) {
    console.error('Error fetching suggested users:', error)
    res.status(500).json({ message: 'Error fetching suggested users' })
  }
})

// @route   GET /api/user/search
// @desc    Search active users by name (used by the share panel). Requires at
//          least 3 characters; returns an empty list otherwise.
// @access  Private
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 3) return res.json({ users: [] })

    const limit = Math.min(30, Number(req.query.limit || 20))
    // Escape regex metacharacters so a raw query can't break the pattern.
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Blocked accounts (either direction) never appear in user search.
    const blockedIds = await getBlockedUserIds(req.user._id)

    const users = await User.find({
      _id: { $nin: [req.user._id, ...blockedIds] },
      status: 'active',
      $or: [
        { name: { $regex: safe, $options: 'i' } },
        { displayName: { $regex: safe, $options: 'i' } },
      ],
    })
      .select('name displayName avatar isVerified role')
      .sort({ name: 1 })
      .limit(limit)
      .lean()

    res.json({ users })
  } catch (error) {
    console.error('Error searching users:', error)
    res.status(500).json({ message: 'Error searching users' })
  }
})

// ─── Saved Locations ────────────────────────────────────────────────────────

// @route   GET /api/user/locations
// @desc    Get all saved locations for authenticated user
// @access  Private
router.get('/locations', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('savedLocations').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ locations: user.savedLocations || [] })
  } catch (error) {
    console.error('Error fetching locations:', error)
    res.status(500).json({ message: 'Error fetching locations' })
  }
})

// @route   POST /api/user/locations
// @desc    Add a new saved location
// @access  Private
router.post('/locations', authMiddleware, async (req, res) => {
  try {
    const { label, city, building, apartment, coordinates, isDefault } = req.body
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (!user.savedLocations) user.savedLocations = []

    // If setting as default, clear existing defaults
    if (isDefault) {
      user.savedLocations.forEach((loc) => { loc.isDefault = false })
    }

    const newLoc = {
      label: (label || 'Home').trim(),
      city: (city || '').trim(),
      building: (building || '').trim(),
      apartment: (apartment || '').trim(),
      isDefault: Boolean(isDefault),
    }

    if (coordinates?.lat != null && coordinates?.lng != null) {
      newLoc.coordinates = {
        type: 'Point',
        coordinates: [Number(coordinates.lng), Number(coordinates.lat)],
      }
    }

    user.savedLocations.push(newLoc)
    await user.save()

    const saved = user.savedLocations[user.savedLocations.length - 1]
    res.status(201).json({ location: saved })
  } catch (error) {
    console.error('Error adding location:', error)
    res.status(500).json({ message: 'Error adding location' })
  }
})

// @route   PUT /api/user/locations/:locId
// @desc    Update a saved location
// @access  Private
router.put('/locations/:locId', authMiddleware, async (req, res) => {
  try {
    const { label, city, building, apartment, coordinates, isDefault } = req.body
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const loc = user.savedLocations?.id(req.params.locId)
    if (!loc) return res.status(404).json({ message: 'Location not found' })

    // If setting as default, clear others
    if (isDefault) {
      user.savedLocations.forEach((l) => { l.isDefault = false })
    }

    if (label !== undefined) loc.label = label.trim()
    if (city !== undefined) loc.city = city.trim()
    if (building !== undefined) loc.building = building.trim()
    if (apartment !== undefined) loc.apartment = apartment.trim()
    if (isDefault !== undefined) loc.isDefault = Boolean(isDefault)

    if (coordinates?.lat != null && coordinates?.lng != null) {
      loc.coordinates = {
        type: 'Point',
        coordinates: [Number(coordinates.lng), Number(coordinates.lat)],
      }
    }

    await user.save()
    res.json({ location: loc })
  } catch (error) {
    console.error('Error updating location:', error)
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid location ID' })
    res.status(500).json({ message: 'Error updating location' })
  }
})

// @route   DELETE /api/user/locations/:locId
// @desc    Delete a saved location
// @access  Private
router.delete('/locations/:locId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const loc = user.savedLocations?.id(req.params.locId)
    if (!loc) return res.status(404).json({ message: 'Location not found' })

    loc.deleteOne()
    await user.save()
    res.json({ message: 'Location deleted' })
  } catch (error) {
    console.error('Error deleting location:', error)
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid location ID' })
    res.status(500).json({ message: 'Error deleting location' })
  }
})

// ─── Bank Accounts (separate collection, keyed by userId) ────────────────────

function sanitizeBankPayload(body = {}) {
  return {
    bankName: String(body.bankName || '').trim(),
    accountNumber: String(body.accountNumber || '').replace(/\s+/g, '').trim(),
    iban: String(body.iban || '').replace(/\s+/g, '').trim().toUpperCase(),
    swift: String(body.swift || '').replace(/\s+/g, '').trim().toUpperCase(),
    branchName: String(body.branchName || '').trim(),
    isPrimary: Boolean(body.isPrimary),
  }
}

async function clearPrimaryBankAccounts(userId, exceptId = null) {
  const filter = { userId, isPrimary: true }
  if (exceptId) filter._id = { $ne: exceptId }
  await BankAccount.updateMany(filter, { $set: { isPrimary: false } })
}

router.get('/bank-accounts', authMiddleware, async (req, res) => {
  try {
    const bankAccounts = await BankAccount.find({ userId: req.user._id })
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean()
    res.json({ bankAccounts })
  } catch (error) {
    console.error('Error fetching bank accounts:', error)
    res.status(500).json({ message: 'Error fetching bank accounts' })
  }
})

router.post('/bank-accounts', authMiddleware, async (req, res) => {
  try {
    const payload = sanitizeBankPayload(req.body)
    if (!payload.bankName) return res.status(400).json({ message: 'Bank name is required' })
    if (!payload.accountNumber || payload.accountNumber.length < 4) {
      return res.status(400).json({ message: 'Enter a valid account number' })
    }

    const existingCount = await BankAccount.countDocuments({ userId: req.user._id })
    if (payload.isPrimary || existingCount === 0) {
      await clearPrimaryBankAccounts(req.user._id)
      payload.isPrimary = true
    }

    const bankAccount = await BankAccount.create({
      userId: req.user._id,
      ...payload,
    })
    res.status(201).json({ bankAccount })
  } catch (error) {
    console.error('Error adding bank account:', error)
    res.status(500).json({ message: 'Error adding bank account' })
  }
})

router.put('/bank-accounts/:accountId', authMiddleware, async (req, res) => {
  try {
    const account = await BankAccount.findOne({
      _id: req.params.accountId,
      userId: req.user._id,
    })
    if (!account) return res.status(404).json({ message: 'Bank account not found' })

    const payload = sanitizeBankPayload({ ...account.toObject(), ...req.body })
    if (!payload.bankName) return res.status(400).json({ message: 'Bank name is required' })
    if (!payload.accountNumber || payload.accountNumber.length < 4) {
      return res.status(400).json({ message: 'Enter a valid account number' })
    }

    if (payload.isPrimary) {
      await clearPrimaryBankAccounts(req.user._id, account._id)
    }

    account.bankName = payload.bankName
    account.accountNumber = payload.accountNumber
    account.iban = payload.iban
    account.swift = payload.swift
    account.branchName = payload.branchName
    if (req.body.isPrimary !== undefined) account.isPrimary = Boolean(req.body.isPrimary)

    await account.save()
    res.json({ bankAccount: account })
  } catch (error) {
    console.error('Error updating bank account:', error)
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid bank account ID' })
    res.status(500).json({ message: 'Error updating bank account' })
  }
})

router.delete('/bank-accounts/:accountId', authMiddleware, async (req, res) => {
  try {
    const account = await BankAccount.findOne({
      _id: req.params.accountId,
      userId: req.user._id,
    })
    if (!account) return res.status(404).json({ message: 'Bank account not found' })

    const wasPrimary = account.isPrimary
    await account.deleteOne()

    if (wasPrimary) {
      const next = await BankAccount.findOne({ userId: req.user._id }).sort({ createdAt: 1 })
      if (next) {
        next.isPrimary = true
        await next.save()
      }
    }
    res.json({ message: 'Bank account deleted' })
  } catch (error) {
    console.error('Error deleting bank account:', error)
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid bank account ID' })
    res.status(500).json({ message: 'Error deleting bank account' })
  }
})

// ─── Saved Cards (separate collection; metadata only — never store full PAN/CVV)

function detectCardBrand(digits) {
  if (/^4/.test(digits)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  if (/^3[47]/.test(digits)) return 'American Express'
  if (/^6(?:011|5)/.test(digits)) return 'Discover'
  return 'Card'
}

function sanitizeCardPayload(body = {}, { requireNumber = false } = {}) {
  const rawNumber = String(body.cardNumber || '').replace(/\D/g, '')
  const last4FromBody = String(body.last4 || '').replace(/\D/g, '').slice(-4)
  const last4 = rawNumber ? rawNumber.slice(-4) : last4FromBody
  const brand = String(body.brand || '').trim() || (rawNumber ? detectCardBrand(rawNumber) : 'Card')
  let expiry = String(body.expiry || '').trim()
  if (expiry) {
    const m = expiry.match(/^(\d{1,2})\s*[\/\-]?\s*(\d{2}|\d{4})$/)
    if (m) {
      const mm = String(m[1]).padStart(2, '0')
      const yy = String(m[2]).slice(-2)
      expiry = `${mm}/${yy}`
    }
  }
  return {
    brand,
    last4,
    expiry,
    holderName: String(body.holderName || '').trim(),
    nickname: String(body.nickname || '').trim(),
    isPrimary: Boolean(body.isPrimary),
    _rawNumber: rawNumber,
    _requireNumber: requireNumber,
  }
}

async function clearPrimarySavedCards(userId, exceptId = null) {
  const filter = { userId, isPrimary: true }
  if (exceptId) filter._id = { $ne: exceptId }
  await SavedCard.updateMany(filter, { $set: { isPrimary: false } })
}

router.get('/saved-cards', authMiddleware, async (req, res) => {
  try {
    const savedCards = await SavedCard.find({ userId: req.user._id })
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean()
    res.json({ savedCards })
  } catch (error) {
    console.error('Error fetching saved cards:', error)
    res.status(500).json({ message: 'Error fetching saved cards' })
  }
})

router.post('/saved-cards', authMiddleware, async (req, res) => {
  try {
    const payload = sanitizeCardPayload(req.body, { requireNumber: true })
    if (!payload._rawNumber || payload._rawNumber.length < 12 || payload._rawNumber.length > 19) {
      return res.status(400).json({ message: 'Enter a valid card number' })
    }
    if (!/^\d{4}$/.test(payload.last4)) {
      return res.status(400).json({ message: 'Invalid card number' })
    }
    if (payload.expiry && !/^\d{2}\/\d{2}$/.test(payload.expiry)) {
      return res.status(400).json({ message: 'Expiry must be MM/YY' })
    }

    const existingCount = await SavedCard.countDocuments({ userId: req.user._id })
    if (payload.isPrimary || existingCount === 0) {
      await clearPrimarySavedCards(req.user._id)
      payload.isPrimary = true
    }

    const savedCard = await SavedCard.create({
      userId: req.user._id,
      brand: payload.brand,
      last4: payload.last4,
      expiry: payload.expiry,
      holderName: payload.holderName,
      nickname: payload.nickname || `${payload.brand} Card`,
      isPrimary: payload.isPrimary,
    })
    res.status(201).json({ savedCard })
  } catch (error) {
    console.error('Error adding saved card:', error)
    res.status(500).json({ message: 'Error adding saved card' })
  }
})

router.put('/saved-cards/:cardId', authMiddleware, async (req, res) => {
  try {
    const card = await SavedCard.findOne({
      _id: req.params.cardId,
      userId: req.user._id,
    })
    if (!card) return res.status(404).json({ message: 'Saved card not found' })

    const payload = sanitizeCardPayload({
      brand: card.brand,
      last4: card.last4,
      expiry: card.expiry,
      holderName: card.holderName,
      nickname: card.nickname,
      isPrimary: card.isPrimary,
      ...req.body,
    })

    if (payload._rawNumber) {
      if (payload._rawNumber.length < 12 || payload._rawNumber.length > 19) {
        return res.status(400).json({ message: 'Enter a valid card number' })
      }
      card.last4 = payload.last4
      card.brand = payload.brand
    }
    if (payload.expiry && !/^\d{2}\/\d{2}$/.test(payload.expiry)) {
      return res.status(400).json({ message: 'Expiry must be MM/YY' })
    }
    if (req.body.expiry !== undefined) card.expiry = payload.expiry
    if (req.body.holderName !== undefined) card.holderName = payload.holderName
    if (req.body.nickname !== undefined) card.nickname = payload.nickname
    if (req.body.brand !== undefined && !payload._rawNumber) card.brand = payload.brand

    if (payload.isPrimary) {
      await clearPrimarySavedCards(req.user._id, card._id)
      card.isPrimary = true
    } else if (req.body.isPrimary !== undefined) {
      card.isPrimary = Boolean(req.body.isPrimary)
    }

    await card.save()
    res.json({ savedCard: card })
  } catch (error) {
    console.error('Error updating saved card:', error)
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid card ID' })
    res.status(500).json({ message: 'Error updating saved card' })
  }
})

router.delete('/saved-cards/:cardId', authMiddleware, async (req, res) => {
  try {
    const card = await SavedCard.findOne({
      _id: req.params.cardId,
      userId: req.user._id,
    })
    if (!card) return res.status(404).json({ message: 'Saved card not found' })

    const wasPrimary = card.isPrimary
    await card.deleteOne()

    if (wasPrimary) {
      const next = await SavedCard.findOne({ userId: req.user._id }).sort({ createdAt: 1 })
      if (next) {
        next.isPrimary = true
        await next.save()
      }
    }
    res.json({ message: 'Saved card deleted' })
  } catch (error) {
    console.error('Error deleting saved card:', error)
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid card ID' })
    res.status(500).json({ message: 'Error deleting saved card' })
  }
})

// ─── Saved Searches ──────────────────────────────────────────────────────────

const SavedSearch = require('../models/SavedSearch')
const { enrichSavedSearch } = require('../core/services/savedSearchMatchService')

const ACTIVE_SAVED_SEARCH_QUERY = {
  isDeleted: { $ne: true },
  status: { $ne: 'deleted' },
}

function resolveNotifyFlags(body = {}) {
  const hasMaster =
    body.notificationEnabled !== undefined || body.notifyEnabled !== undefined
  const master = hasMaster
    ? Boolean(
        body.notificationEnabled !== undefined ? body.notificationEnabled : body.notifyEnabled
      )
    : undefined
  return {
    master,
    email:
      body.emailNotificationEnabled !== undefined
        ? Boolean(body.emailNotificationEnabled)
        : undefined,
    push:
      body.pushNotificationEnabled !== undefined
        ? Boolean(body.pushNotificationEnabled)
        : undefined,
  }
}

router.get('/saved-searches', authMiddleware, async (req, res) => {
  try {
    // Sync latest keyword history into My Search so recent searches always appear.
    try {
      const SearchHistory = require('../models/SearchHistory')
      const deviceId = String(req.headers['device-id'] || '').trim()
      const historyFilter = deviceId
        ? {
            $or: [
              { userId: req.user._id },
              { deviceId, userId: null },
              { deviceId, userId: req.user._id },
            ],
          }
        : { userId: req.user._id }

      const histories = await SearchHistory.find(historyFilter)
        .sort({ createdAt: -1 })
        .limit(15)
        .lean()

      for (const row of histories) {
        const kw = String(row.keyword || '').trim()
        if (!kw) continue
        const searchUrl = `/search?q=${encodeURIComponent(kw)}`
        const exists = await SavedSearch.findOne({
          userId: req.user._id,
          $or: [
            { searchUrl },
            { keyword: new RegExp(`^${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            { query: new RegExp(`^${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          ],
          isDeleted: { $ne: true },
          status: { $ne: 'deleted' },
        }).select('_id')

        if (exists) {
          // Bump latest matches to the top
          await SavedSearch.updateOne(
            { _id: exists._id },
            {
              $set: {
                updatedAt: row.createdAt || new Date(),
                keyword: kw,
                query: kw,
                searchUrl,
              },
            }
          )
          continue
        }

        await SavedSearch.create({
          userId: req.user._id,
          title: `My ${kw} Search`,
          searchName: `My ${kw} Search`,
          query: kw,
          keyword: kw,
          searchType: 'keyword',
          categoryPath: [kw],
          categoryName: kw,
          filters: {
            location: '',
            minPrice: '',
            maxPrice: '',
            sortBy: 'newest',
            tags: ['ALL CITIES'],
            extra: {},
          },
          selectedFilters: { tags: ['ALL CITIES'], keywords: kw },
          sortOption: 'newest',
          location: '',
          searchUrl,
          notifyEnabled: true,
          notificationEnabled: true,
          emailNotificationEnabled: true,
          pushNotificationEnabled: true,
          deviceId: row.deviceId || deviceId || `user-${req.user._id}`,
          platform: row.platform === 'mobile' ? 'mobile' : 'web',
          isLoggedIn: true,
          status: 'active',
          isDeleted: false,
          lastViewedAt: row.createdAt || new Date(),
        })
      }
    } catch (syncErr) {
      console.warn('Saved-search history sync skipped:', syncErr.message)
    }

    const docs = await SavedSearch.find({
      userId: req.user._id,
      ...ACTIVE_SAVED_SEARCH_QUERY,
    })
      .sort({ updatedAt: -1 })
      .lean()

    const enriched = await Promise.all(docs.map((d) => enrichSavedSearch(d)))

    const tabsMap = new Map()
    enriched.forEach((s) => {
      const root = s.categoryPath?.[0] || s.categoryName || 'Other'
      tabsMap.set(root, (tabsMap.get(root) || 0) + 1)
    })
    const tabs = [
      { key: 'all', label: 'All', count: enriched.length },
      ...Array.from(tabsMap.entries()).map(([label, count]) => ({
        key: label.toLowerCase().replace(/\s+/g, '-'),
        label,
        count,
      })),
    ]

    res.json({ savedSearches: enriched, tabs })
  } catch (error) {
    console.error('Error fetching saved searches:', error)
    res.status(500).json({ message: 'Error fetching saved searches' })
  }
})

router.post('/saved-searches', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {}
    const {
      title,
      searchName,
      categoryPath,
      categoryId,
      categoryName,
      subcategoryId,
      subCategoryId,
      subCategoryName,
      query,
      keyword,
      filters,
      selectedFilters,
      sortOption,
      location,
      searchUrl,
      searchType,
      notifyEnabled,
      notificationEnabled,
      emailNotificationEnabled,
      pushNotificationEnabled,
      deviceId,
      platform,
      isLoggedIn,
    } = body

    const trimmedTitle = String(searchName || title || '').trim()
    if (!trimmedTitle) return res.status(400).json({ message: 'Title is required' })

    const queryText = String(query || keyword || '').trim().slice(0, 300)
    const mongoose = require('mongoose')
    const toObjectIdOrNull = (value) => {
      if (value == null || value === '') return null
      const str = String(value)
      return mongoose.Types.ObjectId.isValid(str) ? str : null
    }
    const catId = toObjectIdOrNull(categoryId)
    const subId = toObjectIdOrNull(subcategoryId || subCategoryId)
    const pathNames = Array.isArray(categoryPath)
      ? categoryPath.map((s) => String(s).trim()).filter(Boolean)
      : []
    const loc = String(location || filters?.location || '').trim()
    const sort = String(sortOption || filters?.sortBy || 'newest').trim() || 'newest'
    const masterNotify =
      notificationEnabled !== undefined
        ? Boolean(notificationEnabled)
        : notifyEnabled !== false
    const resolvedUrl = String(searchUrl || '/search').slice(0, 2000)
    const resolvedDeviceId = String(deviceId || req.headers['device-id'] || `user-${req.user._id}`)
      .trim()
      .slice(0, 128)
    const resolvedPlatform = platform === 'mobile' ? 'mobile' : 'web'
    const resolvedType = ['keyword', 'category', 'filtered', 'mixed'].includes(searchType)
      ? searchType
      : queryText && (catId || subId)
        ? 'mixed'
        : catId || subId
          ? 'category'
          : queryText
            ? 'keyword'
            : 'filtered'

    const filtersPayload = {
      location: loc,
      minPrice: filters?.minPrice != null ? String(filters.minPrice) : '',
      maxPrice: filters?.maxPrice != null ? String(filters.maxPrice) : '',
      sortBy: sort,
      tags: Array.isArray(filters?.tags) ? filters.tags.map(String).slice(0, 20) : [],
      extra: filters?.extra && typeof filters.extra === 'object' ? filters.extra : {},
    }
    const selectedPayload =
      selectedFilters && typeof selectedFilters === 'object'
        ? selectedFilters
        : {
            location: loc,
            minPrice: filters?.minPrice ?? '',
            maxPrice: filters?.maxPrice ?? '',
            sortBy: sort,
            tags: Array.isArray(filters?.tags) ? filters.tags : [],
            keywords: filters?.extra?.keywords || '',
            ...(filters?.extra && typeof filters.extra === 'object' ? filters.extra : {}),
          }

    const sharedFields = {
      title: trimmedTitle.slice(0, 120),
      searchName: trimmedTitle.slice(0, 120),
      categoryPath: pathNames,
      categoryId: catId,
      categoryName: String(categoryName || pathNames[0] || '').trim().slice(0, 120),
      subcategoryId: subId,
      subCategoryId: subId,
      subCategoryName: String(subCategoryName || pathNames[1] || '').trim().slice(0, 120),
      query: queryText,
      keyword: queryText,
      searchType: resolvedType,
      filters: filtersPayload,
      selectedFilters: selectedPayload,
      sortOption: sort,
      location: loc,
      searchUrl: resolvedUrl,
      deviceId: resolvedDeviceId,
      platform: resolvedPlatform,
      isLoggedIn: isLoggedIn !== false,
      status: 'active',
      isDeleted: false,
      deletedAt: null,
    }

    let doc = await SavedSearch.findOne({
      userId: req.user._id,
      searchUrl: resolvedUrl,
      isDeleted: { $ne: true },
      status: { $ne: 'deleted' },
    })
    let created = false

    if (doc) {
      Object.assign(doc, sharedFields)
      if (notificationEnabled !== undefined || notifyEnabled !== undefined) {
        doc.notifyEnabled = masterNotify
        doc.notificationEnabled = masterNotify
      }
      if (emailNotificationEnabled !== undefined) {
        doc.emailNotificationEnabled = Boolean(emailNotificationEnabled)
      }
      if (pushNotificationEnabled !== undefined) {
        doc.pushNotificationEnabled = Boolean(pushNotificationEnabled)
      }
      await doc.save()
    } else {
      created = true
      doc = await SavedSearch.create({
        userId: req.user._id,
        ...sharedFields,
        notifyEnabled: masterNotify,
        notificationEnabled: masterNotify,
        emailNotificationEnabled:
          emailNotificationEnabled !== undefined ? Boolean(emailNotificationEnabled) : true,
        pushNotificationEnabled:
          pushNotificationEnabled !== undefined ? Boolean(pushNotificationEnabled) : true,
        lastViewedAt: new Date(),
        newAdsCount: 0,
        totalMatchingAdsCount: 0,
        latestMatchingImages: [],
      })
    }

    if (queryText) {
      try {
        const searchRepository = require('../core/repositories/searchRepository')
        await searchRepository.recordSearchActivity({
          keyword: queryText,
          deviceId: resolvedDeviceId || `user-${req.user._id}`,
          userId: req.user._id,
          platform: resolvedPlatform,
          isLoggedIn: true,
        })
      } catch (histErr) {
        console.warn('Saved search created but history record failed:', histErr.message)
      }
    }

    const enriched = await enrichSavedSearch(doc)
    res.status(created ? 201 : 200).json({ savedSearch: enriched })
  } catch (error) {
    console.error('Error saving search:', error)
    res.status(500).json({ message: error?.message || 'Error saving search' })
  }
})

router.put('/saved-searches/:id', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const doc = await SavedSearch.findOne({
      _id: req.params.id,
      userId: req.user._id,
      ...ACTIVE_SAVED_SEARCH_QUERY,
    })
    if (!doc) return res.status(404).json({ message: 'Saved search not found' })

    const body = req.body || {}

    if (body.title != null || body.searchName != null) {
      const nextName = String(body.searchName != null ? body.searchName : body.title)
        .trim()
        .slice(0, 120)
      if (!nextName) return res.status(400).json({ message: 'Search name is required' })
      doc.title = nextName
      doc.searchName = nextName
    }

    const flags = resolveNotifyFlags(body)
    if (flags.master !== undefined) {
      doc.notifyEnabled = flags.master
      doc.notificationEnabled = flags.master
      // Turning master off leaves channel prefs intact so they restore when re-enabled
    }
    if (flags.email !== undefined) doc.emailNotificationEnabled = flags.email
    if (flags.push !== undefined) doc.pushNotificationEnabled = flags.push

    if (body.markViewed) {
      doc.lastViewedAt = new Date()
      doc.newAdsCount = 0
    }
    if (body.filters && typeof body.filters === 'object') {
      doc.filters = {
        ...(doc.filters.toObject?.() || doc.filters || {}),
        ...body.filters,
      }
      if (body.filters.location != null) doc.location = String(body.filters.location)
      if (body.filters.sortBy != null) doc.sortOption = String(body.filters.sortBy)
    }
    if (body.selectedFilters && typeof body.selectedFilters === 'object') {
      doc.selectedFilters = body.selectedFilters
    }
    if (body.location != null) {
      doc.location = String(body.location).trim()
      if (doc.filters) doc.filters.location = doc.location
    }
    if (body.sortOption != null) {
      doc.sortOption = String(body.sortOption).trim()
      if (doc.filters) doc.filters.sortBy = doc.sortOption
    }
    if (body.searchUrl != null) doc.searchUrl = String(body.searchUrl).slice(0, 2000)
    await doc.save()

    const enriched = await enrichSavedSearch(doc)
    res.json({ savedSearch: enriched })
  } catch (error) {
    console.error('Error updating saved search:', error)
    res.status(500).json({ message: 'Error updating saved search' })
  }
})

router.delete('/saved-searches/:id', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const doc = await SavedSearch.findOne({
      _id: req.params.id,
      userId: req.user._id,
      ...ACTIVE_SAVED_SEARCH_QUERY,
    })
    if (!doc) return res.status(404).json({ message: 'Saved search not found' })

    // Soft delete only — preserve historical record
    doc.isDeleted = true
    doc.status = 'deleted'
    doc.deletedAt = new Date()
    doc.notificationEnabled = false
    doc.notifyEnabled = false
    await doc.save()

    res.json({ message: 'Saved search deleted', softDeleted: true })
  } catch (error) {
    console.error('Error deleting saved search:', error)
    res.status(500).json({ message: 'Error deleting saved search' })
  }
})

router.post(
  '/device-tokens',
  authMiddleware,
  [
    body('token').isString().trim().notEmpty().withMessage('token is required'),
    body('platform').isIn(['android', 'ios']).withMessage('platform must be android or ios'),
    body('deviceId').isString().trim().notEmpty().withMessage('deviceId is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { token, platform, deviceId } = req.body

      await DeviceToken.findOneAndUpdate(
        { token },
        {
          $set: {
            userId: req.user._id,
            platform,
            deviceId,
            lastSeenAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      // FCM rotates a handset's token periodically. Without this, the previous
      // token for the same physical device lingers and every push is sent to a
      // dead address until Firebase eventually reports it unregistered.
      // Scoped to this user + this deviceId, so the user's OTHER devices — and
      // other users sharing the handset — keep their own valid tokens.
      const rotated = await DeviceToken.deleteMany({
        userId: req.user._id,
        deviceId,
        token: { $ne: token },
      })
      if (rotated.deletedCount) {
        console.log(
          `[device-tokens] Cleared ${rotated.deletedCount} rotated token(s) for device ${deviceId} of user ${req.user._id}`
        )
      }

      console.log(`[device-tokens] Registered token ${maskToken(token)} for user ${req.user._id}`)
      res.json({ message: 'Device token registered' })
    } catch (error) {
      console.error('Error registering device token:', error)
      res.status(500).json({ message: 'Error registering device token' })
    }
  }
)

router.delete('/device-tokens/:token', authMiddleware, async (req, res) => {
  try {
    await DeviceToken.deleteOne({ token: req.params.token, userId: req.user._id })
    res.json({ message: 'Device token unregistered' })
  } catch (error) {
    console.error('Error unregistering device token:', error)
    res.status(500).json({ message: 'Error unregistering device token' })
  }
})

// @route   POST /api/user/device-tokens/test
// @desc    Send a test push notification to every device the requesting user
//          has registered — for verifying end-to-end FCM delivery without
//          waiting on a real domain event (like/comment/message/etc).
// @access  Private
router.post(
  '/device-tokens/test',
  authMiddleware,
  [
    body('title').optional().isString().trim().isLength({ max: 120 }),
    body('body').optional().isString().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const title = req.body.title || 'Test notification'
      const body = req.body.body || 'This is a test push from Preelly'

      const result = await sendPreellyNotificationToUser(req.user._id, title, body, {
        type: 'system',
        notificationId: `test-${Date.now()}`,
      })

      if (!result.configured) {
        return res.status(503).json({ message: 'Firebase Admin is not configured on this server', result })
      }
      if (result.reason === 'no-device-tokens') {
        return res.json({ message: 'No device tokens registered for this user', result })
      }

      res.json({ message: 'Test notification sent', result })
    } catch (error) {
      console.error('Error sending test notification:', error)
      res.status(500).json({ message: 'Error sending test notification' })
    }
  }
)

module.exports = router

