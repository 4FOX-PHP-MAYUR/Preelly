const express = require('express')
const router = express.Router()
const authMiddleware = require('../middleware/auth')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const Product = require('../models/Product')
const User = require('../models/User')
const Follow = require('../models/Follow')
const Order = require('../models/Order')
const Notification = require('../models/Notification')
const AdminRolePermission = require('../models/AdminRolePermission')
const validateObjectId = require('../middleware/validateObjectId')

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

    const query = { seller: req.user._id }
    if (status) query.status = status
    if (q) query.$or = [{ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }]

    const [items, total] = await Promise.all([
      Product.find(query)
        .select('title price currency status images video location createdAt views')
        .sort({ createdAt: -1 })
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
    const products = await Product.find({ likes: req.user._id })
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
    const products = await Product.find({ _id: { $in: savedIds } })
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

    const query = { user: req.user._id }
    if (tab && tab !== 'all') query.tab = tab

    const items = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actor', 'name avatar isVerified')
      .populate('relatedProduct', 'title images video price')
      .lean()

    // counts per tab for badge display
    const [buyingUnread, sellingUnread] = await Promise.all([
      Notification.countDocuments({ user: req.user._id, tab: 'buying', isRead: false }),
      Notification.countDocuments({ user: req.user._id, tab: 'selling', isRead: false }),
    ])

    res.json({ items, buyingUnread, sellingUnread })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    res.status(500).json({ message: 'Error fetching notifications' })
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
router.get('/:id/profile', validateObjectId('id'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -savedProducts -emiratesIdFront -emiratesIdBack -identityVerificationRejectionReason')

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Get user stats
    const products = await Product.find({ seller: user._id, status: 'active' })
    const stats = {
      totalProducts: products.length,
      totalViews: products.reduce((sum, p) => sum + (p.views || 0), 0),
      totalLikes: products.reduce((sum, p) => sum + (p.likes?.length || 0), 0),
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
router.get('/:id/followers', validateObjectId('id'), async (req, res) => {
  try {
    const userExists = await User.exists({ _id: req.params.id })
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' })
    }

    const records = await Follow.find({ following: req.params.id, status: 'active' })
      .populate('follower', 'name avatar email phone rating memberSince isVerified role')
      .sort({ followedAt: -1 })
      .lean()

    const followers = records.map((r) => ({ ...r.follower, followedAt: r.followedAt }))

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
router.get('/:id/following', validateObjectId('id'), async (req, res) => {
  try {
    const userExists = await User.exists({ _id: req.params.id })
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' })
    }

    const records = await Follow.find({ follower: req.params.id, status: 'active' })
      .populate('following', 'name avatar email phone rating memberSince isVerified role')
      .sort({ followedAt: -1 })
      .lean()

    const following = records.map((r) => ({ ...r.following, followedAt: r.followedAt }))

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
      const perms = await AdminRolePermission.find({ role_id: user.adminRole._id }).lean()
      const permMap = {}
      perms.forEach((p) => {
        permMap[p.module_name] = {
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        }
      })
      userData.permissions = permMap
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

module.exports = router

