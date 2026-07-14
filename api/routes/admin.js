const express = require('express')
const router = express.Router()
const Product = require('../models/Product')
const User = require('../models/User')
const Chat = require('../models/Chat')
const Comment = require('../models/Comment')
const CommentReport = require('../models/CommentReport')
const adminMiddleware = require('../middleware/admin')
const Category = require('../models/Category')
const Filter = require('../models/Filter')
const CategoryFilter = require('../models/CategoryFilter')
const Dealer = require('../models/Dealer')
const AdminRole = require('../models/AdminRole')
const AdminRolePermission = require('../models/AdminRolePermission')
const FieldType = require('../models/FieldType')
const FormField = require('../models/FormField')
const { upload, uploadAny } = require('../middleware/upload')
const { Types } = require('mongoose')
const XLSX = require('xlsx')
const slugify = require('slugify')
const { buildNestedCategoryTreeForFilters } = require('../services/categoryNestedTreeService')
const { importFiltersFromExcel } = require('../services/filterExcelImportService')
const { importCategoriesFromExcel } = require('../services/categoryExcelImportService')
const { sendEmail } = require('../utils/mailer')
const { sendIdentityApprovedEmail, sendIdentityRejectedEmail } = require('../utils/identityVerificationMail')
const { REJECTION_REASON_CATEGORIES } = require('../constants/rejectionReasons')
const { buildDuplicateFormFieldQuery, normalizeCategoryFilterId, normalizeChildCategoryId } = require('../utils/formFieldScope')
const emirateService = require('../core/services/emirateService')
const { toPaginatedEmiratesResponse, toEmirateDto } = require('../dto/emirate.dto')
const packageService = require('../core/services/packageService')
const packageValidator = require('../core/validators/package.validator')
const validateRequest = require('../middleware/validateRequest')
const { toPaginatedPackagesResponse, toPackageDto } = require('../dto/package.dto')
const storageFacilityService = require('../core/services/storageFacilityService')
const storageFacilityValidator = require('../core/validators/storageFacility.validator')
const {
  toPaginatedStorageFacilitiesResponse,
  toStorageFacilityDto,
} = require('../dto/storageFacility.dto')
const {
  resolveTableConfig,
  validateTableConfig,
} = require('../core/services/dynamicTableOptionsService')
const { listRegisteredTables, isRegisteredTable, normalizeTableName } = require('../config/dynamicTableRegistry')

// @route   GET /api/admin/products/pending
// @desc    Get all pending products for review
// @access  Private (Admin only)
router.get('/products/pending', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const query = { status: 'pending' }
    if (search) {
      query.$text = { $search: search }
    }

    const products = await Product.find(query)
      .populate('category', 'name icon emoji')
      .populate('seller', 'name email avatar isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    const total = await Product.countDocuments(query)

    res.json({
      products,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore: skip + products.length < total,
    })
  } catch (error) {
    console.error('Error fetching pending products:', error)
    res.status(500).json({ message: 'Error fetching pending products' })
  }
})

// @route   GET /api/admin/products
// @desc    Get all products with filters (admin view)
// @access  Private (Admin only)
router.get('/products', adminMiddleware, async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      search,
    } = req.query

    const query = {}
    if (status) query.status = status
    if (search) {
      query.$text = { $search: search }
    }

    const skip = (Number(page) - 1) * Number(limit)

    const products = await Product.find(query)
      .populate('category', 'name icon emoji')
      .populate('seller', 'name email avatar isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    const total = await Product.countDocuments(query)

    res.json({
      products,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore: skip + products.length < total,
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    res.status(500).json({ message: 'Error fetching products' })
  }
})

// @route   PUT /api/admin/products/:id/approve
// @desc    Approve a pending product
// @access  Private (Admin only)
router.put('/products/:id/approve', adminMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    if (product.status !== 'pending') {
      return res.status(400).json({ 
        message: `Product is already ${product.status}. Only pending products can be approved.` 
      })
    }

    product.status = 'active'
    product.moderationStatus = 'approved'
    // Clear rejection data on approval to keep UI simple.
    product.rejectionReason = null
    product.rejectionDetails = null
    product.moderationNotes = null
    await product.save()

    await product.populate('category', 'name icon emoji')
    await product.populate('seller', 'name email avatar')

    // Best-effort email notification after approval.
    // Approval should still succeed even if email sending fails.
    const sellerEmail = product?.seller?.email
    if (sellerEmail) {
      const adTitle = product?.title || 'your ad'
      const subject = 'Your ad is approved'
      const text = `Hi ${product.seller.name || 'there'},\n\nGood news! Your ad "${adTitle}" has been approved and is now live.\n\nThanks,\nPreelly Team`
      const html = `<p>Hi ${product.seller.name || 'there'},</p><p>Good news! Your ad <strong>${adTitle}</strong> has been approved and is now live.</p><p>Thanks,<br/>Preelly Team</p>`

      try {
        await sendEmail({
          to: sellerEmail,
          subject,
          text,
          html,
        })
      } catch (mailError) {
        console.error('Product approved but failed to send approval email:', mailError.message)
      }
    }

    res.json({
      message: 'Product approved successfully',
      product,
    })
  } catch (error) {
    console.error('Error approving product:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error approving product' })
  }
})

// @route   PUT /api/admin/products/:id/reject
// @desc    Reject a pending product
// @access  Private (Admin only)
router.put('/products/:id/reject', adminMiddleware, async (req, res) => {
  try {
    const { reason, rejectionCategory, rejectionCategories, reasons, rejectionSelections, customReason } = req.body
    const product = await Product.findById(req.params.id)
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    if (product.status !== 'pending') {
      return res.status(400).json({ 
        message: `Product is already ${product.status}. Only pending products can be rejected.` 
      })
    }

    product.status = 'rejected'
    product.moderationStatus = 'rejected'
    const selectedReasons = Array.isArray(reasons)
      ? reasons.map((r) => String(r || '').trim()).filter(Boolean)
      : []
    const safeCustomReason = String(customReason || '').trim()
    const safeCategory = String(rejectionCategory || '').trim()
    const safeCategories = Array.isArray(rejectionCategories)
      ? rejectionCategories.map((c) => String(c || '').trim()).filter(Boolean)
      : []
    const safeSelections = Array.isArray(rejectionSelections)
      ? rejectionSelections
          .map((row) => ({
            category: String(row?.category || '').trim(),
            reasons: Array.isArray(row?.reasons)
              ? row.reasons.map((r) => String(r || '').trim()).filter(Boolean)
              : [],
          }))
          .filter((row) => row.category && row.reasons.length > 0)
      : []

    const categoriesForStorage = safeSelections.length
      ? [...new Set(safeSelections.map((row) => row.category))]
      : safeCategories.length
      ? [...new Set(safeCategories)]
      : safeCategory
      ? [safeCategory]
      : []
    const reasonsForStorage = safeSelections.length
      ? [...new Set(safeSelections.flatMap((row) => row.reasons))]
      : selectedReasons

    const computedReason = safeSelections.length
      ? safeSelections
          .map((row) => `${row.category}: ${row.reasons.join(', ')}`)
          .join(' | ')
      : reasonsForStorage.length > 0
        ? reasonsForStorage.join(', ')
        : String(reason || '').trim() || safeCustomReason || 'No reason provided'

    product.rejectionReason = computedReason
    product.moderationNotes = safeCategory
      ? `Category: ${safeCategory}${safeCustomReason ? ` | Note: ${safeCustomReason}` : ''}`
      : safeCustomReason || product.moderationNotes
    product.rejectionDetails = {
      category: categoriesForStorage[0] || safeCategory || null,
      categories: categoriesForStorage,
      reasons: reasonsForStorage,
      reasonSelections: safeSelections,
      customReason: safeCustomReason || null,
      rejectedAt: new Date(),
      rejectedBy: req.user?._id || null,
    }
    await product.save()

    await product.populate('category', 'name icon emoji')
    await product.populate('seller', 'name email avatar')

    // Best-effort rejection email notification.
    const sellerEmail = product?.seller?.email
    if (sellerEmail) {
      const adTitle = product?.title || 'your ad'
      const reasonsLines = safeSelections.length
        ? safeSelections
            .map((row) => `${row.category}:\n${row.reasons.map((r) => `- ${r}`).join('\n')}`)
            .join('\n\n')
        : reasonsForStorage.length
        ? reasonsForStorage.map((r) => `- ${r}`).join('\n')
        : `- ${computedReason}`
      const reasonCategoryLine = categoriesForStorage.length
        ? `Categories: ${categoriesForStorage.join(', ')}\n`
        : safeCategory
        ? `Category: ${safeCategory}\n`
        : ''
      const customLine = safeCustomReason ? `\nAdditional note: ${safeCustomReason}\n` : '\n'
      const subject = 'Your ad was rejected'
      const text = `Hi ${product.seller.name || 'there'},\n\nYour ad "${adTitle}" could not be approved at this time.\n\n${reasonCategoryLine}Reason(s):\n${reasonsLines}${customLine}\nPlease update your ad and submit again.\n\nThanks,\nPreelly Team`
      const htmlReasons = safeSelections.length
        ? safeSelections
            .map(
              (row) =>
                `<p><strong>${row.category}</strong></p><ul>${row.reasons.map((r) => `<li>${r}</li>`).join('')}</ul>`
            )
            .join('')
        : reasonsForStorage.length
        ? `<ul>${reasonsForStorage.map((r) => `<li>${r}</li>`).join('')}</ul>`
        : `<ul><li>${computedReason}</li></ul>`
      const html = `<p>Hi ${product.seller.name || 'there'},</p><p>Your ad <strong>${adTitle}</strong> could not be approved at this time.</p>${categoriesForStorage.length ? `<p><strong>Categories:</strong> ${categoriesForStorage.join(', ')}</p>` : safeCategory ? `<p><strong>Category:</strong> ${safeCategory}</p>` : ''}<p><strong>Reason(s):</strong></p>${htmlReasons}${safeCustomReason ? `<p><strong>Additional note:</strong> ${safeCustomReason}</p>` : ''}<p>Please update your ad and submit again.</p><p>Thanks,<br/>Preelly Team</p>`

      try {
        await sendEmail({
          to: sellerEmail,
          subject,
          text,
          html,
        })
      } catch (mailError) {
        console.error('Product rejected but failed to send rejection email:', mailError.message)
      }
    }

    res.json({
      message: 'Product rejected successfully',
      product,
      reason: computedReason,
      rejectionCategory: safeCategory || null,
      rejectionCategories: categoriesForStorage,
      reasons: reasonsForStorage,
      rejectionSelections: safeSelections,
      customReason: safeCustomReason || null,
    })
  } catch (error) {
    console.error('Error rejecting product:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error rejecting product' })
  }
})

// @route   GET /api/admin/products/rejection-reasons
// @desc    Get predefined rejection categories and reasons
// @access  Private (Admin only)
router.get('/products/rejection-reasons', adminMiddleware, async (req, res) => {
  return res.json({
    categories: REJECTION_REASON_CATEGORIES,
  })
})

// @route   PUT /api/admin/products/:id/status
// @desc    Update product status (active/inactive)
// @access  Private (Admin only)
router.put('/products/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body
    const allowedStatus = ['active', 'inactive']

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' })
    }

    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // Don't allow changing sold products back to active/inactive here
    if (product.status === 'sold') {
      return res.status(400).json({ message: 'Cannot change status of sold products' })
    }

    product.status = status
    await product.save()

    await product.populate('category', 'name icon emoji')
    await product.populate('seller', 'name email avatar')

    res.json({
      message: `Product status updated to ${status}`,
      product,
    })
  } catch (error) {
    console.error('Error updating product status:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error updating product status' })
  }
})

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/stats', adminMiddleware, async (req, res) => {
  try {
    const [
      totalProducts,
      pendingProducts,
      activeProducts,
      rejectedProducts,
      soldProducts,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ status: 'pending' }),
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ status: 'rejected' }),
      Product.countDocuments({ status: 'sold' }),
    ])

    res.json({
      totalProducts,
      pendingProducts,
      activeProducts,
      rejectedProducts,
      soldProducts,
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    res.status(500).json({ message: 'Error fetching admin statistics' })
  }
})

// @route   GET /api/admin/users
// @desc    Get all users (admin view)
// @access  Private (Admin only)
router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isVerified, status } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const query = {}
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ]
    }
    if (isVerified !== undefined) {
      query.isVerified = isVerified === 'true'
    }
    if (status) {
      query.status = status
    }

    const users = await User.find(query)
      .select('-password')
      .populate('adminRole', 'role_name status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    const total = await User.countDocuments(query)

    res.json({
      users,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore: skip + users.length < total,
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ message: 'Error fetching users' })
  }
})

// @route   POST /api/admin/users
// @desc    Create a new user (including admin users)
// @access  Private (Admin only)
router.post('/users', adminMiddleware, async (req, res) => {
  try {
    const { name, email, phone, password, role = 'user', status = 'active', adminRole } = req.body

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Name, email, phone and password are required' })
    }

    const allowedRoles = ['user', 'admin']
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role value' })
    }

    const allowedStatus = ['active', 'inactive']
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' })
    }

    if (adminRole) {
      if (!Types.ObjectId.isValid(adminRole)) {
        return res.status(400).json({ message: 'Invalid admin role ID' })
      }
      const roleDoc = await AdminRole.findById(adminRole)
      if (!roleDoc) return res.status(400).json({ message: 'Admin role not found' })
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    })
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email or phone already exists' })
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      role,
      status,
      adminRole: adminRole || null,
    })
    await user.save()

    const populated = await User.findById(user._id).populate('adminRole', 'role_name status')
    res.status(201).json({
      message: 'User created successfully',
      user: {
        _id: populated._id,
        name: populated.name,
        email: populated.email,
        phone: populated.phone,
        role: populated.role,
        isVerified: populated.isVerified,
        status: populated.status,
        adminRole: populated.adminRole,
      },
    })
  } catch (error) {
    console.error('Error creating user:', error)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' })
    }
    res.status(500).json({ message: 'Error creating user' })
  }
})

// @route   PUT /api/admin/users/:id/verify
// @desc    Verify or unverify a user
// @access  Private (Admin only)
router.put('/users/:id/verify', adminMiddleware, async (req, res) => {
  try {
    const { isVerified } = req.body
    const user = await User.findById(req.params.id)
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Explicitly handle boolean and string values
    // true or 'true' means verified (set to true)
    // false or 'false' means not verified (set to false)
    let verifiedValue = false
    if (isVerified === true || isVerified === 'true' || isVerified === 1 || isVerified === '1') {
      verifiedValue = true
    } else if (isVerified === false || isVerified === 'false' || isVerified === 0 || isVerified === '0') {
      verifiedValue = false
    }

    user.isVerified = verifiedValue
    await user.save()

    res.json({
      message: `User ${user.isVerified ? 'verified' : 'unverified'} successfully`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    })
  } catch (error) {
    console.error('Error updating user verification:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error updating user verification' })
  }
})

// @route   GET /api/admin/identity-verifications
// @desc    List identity verification requests
// @access  Private (Admin only)
router.get('/identity-verifications', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'pending', search } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const query = {}
    if (status && status !== 'all') {
      query.identityVerificationStatus = status
    } else if (status === 'all') {
      query.identityVerificationStatus = { $in: ['pending', 'approved', 'rejected'] }
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ]
    }

    const users = await User.find(query)
      .select('name email phone avatar identityVerificationStatus identityVerificationSubmittedAt identityVerifiedAt emiratesIdFront emiratesIdBack identityVerificationRejectionReason isVerified createdAt')
      .sort({ identityVerificationSubmittedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    const total = await User.countDocuments(query)

    res.json({
      verifications: users,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore: skip + users.length < total,
    })
  } catch (error) {
    console.error('Error fetching identity verifications:', error)
    res.status(500).json({ message: 'Error fetching identity verifications' })
  }
})

// @route   GET /api/admin/identity-verifications/:id
// @desc    Get single identity verification request
// @access  Private (Admin only)
router.get('/identity-verifications/:id', adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      '-password -savedProducts'
    )
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (!user.emiratesIdFront && !user.emiratesIdBack && user.identityVerificationStatus === 'none') {
      return res.status(404).json({ message: 'No verification request found for this user' })
    }
    res.json({ user })
  } catch (error) {
    console.error('Error fetching identity verification:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error fetching identity verification' })
  }
})

// @route   PUT /api/admin/identity-verifications/:id/approve
// @desc    Approve identity verification and mark user as verified
// @access  Private (Admin only)
router.put('/identity-verifications/:id/approve', adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (user.identityVerificationStatus !== 'pending') {
      return res.status(400).json({ message: 'Only pending verification requests can be approved' })
    }

    user.identityVerificationStatus = 'approved'
    user.identityVerifiedAt = new Date()
    user.identityVerificationRejectionReason = null
    await user.save()

    try {
      await sendIdentityApprovedEmail(user)
    } catch (mailError) {
      console.error('Identity approved but failed to send email:', mailError.message)
    }

    res.json({
      message: 'Identity verification approved successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        identityVerificationStatus: user.identityVerificationStatus,
        identityVerifiedAt: user.identityVerifiedAt,
      },
    })
  } catch (error) {
    console.error('Error approving identity verification:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error approving identity verification' })
  }
})

// @route   PUT /api/admin/identity-verifications/:id/reject
// @desc    Reject identity verification request
// @access  Private (Admin only)
router.put('/identity-verifications/:id/reject', adminMiddleware, async (req, res) => {
  try {
    const { reason } = req.body
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (user.identityVerificationStatus !== 'pending') {
      return res.status(400).json({ message: 'Only pending verification requests can be rejected' })
    }

    const rejectionReason = reason ? String(reason).trim().slice(0, 500) : ''
    if (!rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' })
    }

    user.identityVerificationStatus = 'rejected'
    user.identityVerificationRejectionReason = rejectionReason
    await user.save()

    try {
      await sendIdentityRejectedEmail(user, rejectionReason)
    } catch (mailError) {
      console.error('Identity rejected but failed to send email:', mailError.message)
    }

    res.json({
      message: 'Verification rejected',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        identityVerificationStatus: user.identityVerificationStatus,
        identityVerificationRejectionReason: user.identityVerificationRejectionReason,
      },
    })
  } catch (error) {
    console.error('Error rejecting identity verification:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error rejecting identity verification' })
  }
})

// @route   PUT /api/admin/users/:id/role
// @desc    Update a user's role (user/admin)
// @access  Private (Admin only)
router.put('/users/:id/role', adminMiddleware, async (req, res) => {
  try {
    const { role } = req.body
    const allowedRoles = ['user', 'admin']

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role value' })
    }

    // Prevent an admin from changing their own role to avoid locking out all admins
    if (req.user && String(req.user._id) === String(req.params.id)) {
      return res.status(400).json({ message: 'You cannot change your own role' })
    }

    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    user.role = role

    // Auto-verify admins, keep existing behavior consistent
    if (role === 'admin' && !user.isVerified) {
      user.isVerified = true
    }

    await user.save()

    res.json({
      message: 'User role updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    })
  } catch (error) {
    console.error('Error updating user role:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error updating user role' })
  }
})

// @route   PUT /api/admin/users/:id/status
// @desc    Update a user's status (active/inactive)
// @access  Private (Admin only)
router.put('/users/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body
    const allowedStatus = ['active', 'inactive']

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' })
    }

    // Optional: prevent deactivating own account
    if (req.user && String(req.user._id) === String(req.params.id) && status === 'inactive') {
      return res.status(400).json({ message: 'You cannot deactivate your own account' })
    }

    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    user.status = status
    await user.save()

    res.json({
      message: `User status updated to ${status}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    })
  } catch (error) {
    console.error('Error updating user status:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error updating user status' })
  }
})

// @route   GET /api/admin/comments
// @desc    Get comments for moderation
// @access  Private (Admin only)
router.get('/comments', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50, status = 'pending', search } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const query = {}
    if (status && status !== 'all') {
      query.status = status
    }

    // Optional search by product title or comment text
    let productIds = []
    if (search) {
      const products = await Product.find({
        title: new RegExp(search, 'i'),
      }).select('_id')
      productIds = products.map((p) => p._id)

      query.$or = [
        { text: new RegExp(search, 'i') },
        ...(productIds.length ? [{ product: { $in: productIds } }] : []),
      ]
    }

    const comments = await Comment.find(query)
      .populate('user', 'name email')
      .populate('product', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    const total = await Comment.countDocuments(query)

    res.json({
      comments,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore: skip + comments.length < total,
    })
  } catch (error) {
    console.error('Error fetching comments for admin:', error)
    res.status(500).json({ message: 'Error fetching comments' })
  }
})

// @route   PUT /api/admin/comments/:id/approve
// @desc    Approve a comment
// @access  Private (Admin only)
router.put('/comments/:id/approve', adminMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' })
    }

    comment.status = 'approved'
    await comment.save()

    await comment.populate('user', 'name email')
    await comment.populate('product', 'title')

    res.json({
      message: 'Comment approved successfully',
      comment,
    })
  } catch (error) {
    console.error('Error approving comment:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid comment ID' })
    }
    res.status(500).json({ message: 'Error approving comment' })
  }
})

// @route   PUT /api/admin/comments/:id/reject
// @desc    Reject a comment
// @access  Private (Admin only)
router.put('/comments/:id/reject', adminMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' })
    }

    comment.status = 'rejected'
    await comment.save()

    await comment.populate('user', 'name email')
    await comment.populate('product', 'title')

    res.json({
      message: 'Comment rejected successfully',
      comment,
    })
  } catch (error) {
    console.error('Error rejecting comment:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid comment ID' })
    }
    res.status(500).json({ message: 'Error rejecting comment' })
  }
})

// @route   GET /api/admin/reported-comments
// @desc    Get reported comments (pending + resolved). Includes resolution: pending | deactivated | ignored.
// @access  Private (Admin only)
router.get('/reported-comments', adminMiddleware, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50))
  const skip = (page - 1) * limit

  try {
    const aggregated = await CommentReport.aggregate([
      { $match: { status: { $in: ['pending', 'resolved-removed', 'resolved-ignored'] } } },
      {
        $group: {
          _id: '$comment',
          reportCount: { $sum: 1 },
          reasons: { $addToSet: '$reason' },
          reportIds: { $push: '$_id' },
          statuses: { $addToSet: '$status' },
        },
      },
      { $sort: { reportCount: -1 } },
      { $skip: skip },
      { $limit: limit },
    ])

    const total = await CommentReport.distinct('comment', {
      status: { $in: ['pending', 'resolved-removed', 'resolved-ignored'] },
    }).then((ids) => ids.length)

    const commentIds = (aggregated || []).map((a) => a._id).filter(Boolean)
    let comments = []
    if (commentIds.length > 0) {
      comments = await Comment.find({ _id: { $in: commentIds } })
        .populate('user', 'name email avatar')
        .populate('product', 'title')
        .lean()
    }

    const commentMap = Object.fromEntries(
      (comments || []).map((c) => [c._id.toString(), c])
    )

    const resolutionFromStatuses = (statuses) => {
      if (!Array.isArray(statuses)) return 'pending'
      if (statuses.some((s) => s === 'pending')) return 'pending'
      if (statuses.some((s) => s === 'resolved-removed')) return 'deactivated'
      if (statuses.some((s) => s === 'resolved-ignored')) return 'ignored'
      return 'pending'
    }

    const items = (aggregated || []).map((a) => ({
      commentId: a._id,
      comment: commentMap[a._id && a._id.toString ? a._id.toString() : String(a._id)] || null,
      reportCount: a.reportCount || 0,
      reasons: Array.isArray(a.reasons) ? a.reasons : [],
      reportIds: Array.isArray(a.reportIds) ? a.reportIds : [],
      resolution: resolutionFromStatuses(a.statuses),
    }))

    return res.json({
      comments: items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    })
  } catch (error) {
    console.error('Error fetching reported comments:', error)
    return res.status(500).json({
      message: 'Error fetching reported comments',
      comments: [],
      total: 0,
      page,
      limit,
      hasMore: false,
    })
  }
})

// @route   PUT /api/admin/reported-comments/comment/:commentId/action
// @desc    Admin action: deactivate comment (hide) or ignore report(s)
// @access  Private (Admin only)
router.put('/reported-comments/comment/:commentId/action', adminMiddleware, async (req, res) => {
  try {
    let { action } = req.body
    const validActions = ['deactivate', 'ignore']
    if (action === 'delete') action = 'deactivate'
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({ message: 'Valid action required: deactivate or ignore' })
    }

    const commentId = req.params.commentId
    const comment = await Comment.findById(commentId)
    if (!comment && action === 'deactivate') {
      return res.status(404).json({ message: 'Comment not found' })
    }

    const update = {
      status: action === 'deactivate' ? 'resolved-removed' : 'resolved-ignored',
      resolvedAt: new Date(),
      resolvedBy: req.user._id,
    }
    await CommentReport.updateMany({ comment: commentId, status: 'pending' }, update)

    if (action === 'deactivate' && comment) {
      comment.status = 'rejected'
      await comment.save()
    }

    res.json({
      message: action === 'deactivate' ? 'Comment deactivated' : 'Report(s) ignored',
    })
  } catch (error) {
    console.error('Error resolving reported comment:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid comment ID' })
    }
    res.status(500).json({ message: 'Error resolving report' })
  }
})

// @route   GET /api/admin/support-unread-count
// @desc    Total unread support messages for admin badge
// @access  Private (Admin only)
router.get('/support-unread-count', adminMiddleware, async (req, res) => {
  try {
    const result = await Chat.aggregate([
      { $match: { type: 'support' } },
      { $group: { _id: null, total: { $sum: '$unreadForAdmin' } } },
    ])
    const unread = result[0]?.total ?? 0
    res.json({ unread })
  } catch (error) {
    console.error('Error fetching support unread:', error)
    res.status(500).json({ unread: 0 })
  }
})

// @route   GET /api/admin/contacts
// @desc    Get contacts for admin. Default: support chats only; optional activeOnly (has at least one message).
// @access  Private (Admin only)
router.get('/contacts', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, type = 'support', activeOnly } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const query = { type: 'support' }

    if (activeOnly === 'true' || activeOnly === '1') {
      query.lastMessage = { $exists: true, $regex: /\S/ }
    }

    if (search && search.trim()) {
      const users = await User.find({
        $or: [
          { name: new RegExp(search.trim(), 'i') },
          { email: new RegExp(search.trim(), 'i') },
          { username: new RegExp(search.trim(), 'i') },
        ],
      }).select('_id')
      query.user = { $in: users.map((u) => u._id) }
    }

    const chats = await Chat.find(query)
      .populate('user', 'name email username avatar')
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    const total = await Chat.countDocuments(query)

    res.json({
      contacts: chats,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore: skip + chats.length < total,
    })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    res.status(500).json({ message: 'Error fetching contacts' })
  }
})
// --------------------------
// Category admin endpoints
// --------------------------

/**
 * Build a nested tree from a flat list of categories using parent_id.
 * Does not depend on insertion order; roots first, then children under each parent.
 * @param {Array} items - Flat array of category documents (each has _id, parentId, sortOrder, name)
 * @returns {Array} Tree of roots, each node has .children array (sorted by sortOrder, name)
 */
function buildCategoryTreeFromFlat(items) {
  if (!items || items.length === 0) return []
  const byId = new Map()
  items.forEach((c) => {
    byId.set(String(c._id), { ...c, children: [] })
  })
  const roots = []
  items.forEach((c) => {
    const node = byId.get(String(c._id))
    const parentId = c.parentId != null ? String(c.parentId) : null
    if (!parentId || !byId.has(parentId)) {
      roots.push(node)
    } else {
      byId.get(parentId).children.push(node)
    }
  })
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => (Number(a.sortOrder) - Number(b.sortOrder)) || String(a.name || '').localeCompare(String(b.name || '')))
    nodes.forEach((n) => sortNodes(n.children))
  }
  sortNodes(roots)
  return roots
}

/**
 * Flatten a tree to a single array in depth-first order (hierarchy order).
 * Root first, then each root's children in order, then their children, etc.
 * @param {Array} nodes - Tree nodes (each may have .children)
 * @returns {Array} Flat list of category objects (without .children) in hierarchy order
 */
function flattenCategoryTreeInOrder(nodes) {
  const out = []
  function walk(list) {
    if (!Array.isArray(list)) return
    for (const node of list) {
      const { children, ...rest } = node
      out.push(rest)
      if (children && children.length) walk(children)
    }
  }
  walk(nodes)
  return out
}

// GET /api/admin/categories
// Fetch all matching categories, build tree by parent_id, flatten in hierarchy order, then paginate
router.get('/categories', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 100, search, parentId: filterParentId, rootOnly } = req.query
    const skip = Math.max(0, (Number(page) - 1) * Number(limit))
    const limitNum = Math.max(1, Math.min(500, Number(limit)))
    const query = { isDeleted: false }
    if (search && String(search).trim()) {
      query.name = new RegExp(String(search).trim(), 'i')
    }
    // Fetch all matching categories (no skip/limit yet) so we can build full tree order
    const categories = await Category.find(query).lean()
    // Merge legacy embedded subcategories (if any)
    const rawColl = require('mongoose').connection.collection('categories')
    const legacyParents = await rawColl.find({ subcategories: { $exists: true, $ne: [] } }).toArray()
    const merged = [...categories]
    const seen = new Set(merged.map((c) => String(c._id)))
    for (const p of legacyParents) {
      if (!seen.has(String(p._id))) {
        merged.push({
          _id: p._id,
          name: p.name,
          slug: p.slug || undefined,
          parentId: p.parentId || null,
          level: p.level || 0,
          path: p.path || [],
          sortOrder: p.sortOrder || 0,
          isActive: p.isActive !== undefined ? p.isActive : true,
          isDeleted: p.isDeleted || false,
          icon: p.icon || null,
          emoji: p.emoji || null,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })
        seen.add(String(p._id))
      }
      const subs = Array.isArray(p.subcategories) ? p.subcategories : []
      for (const s of subs) {
        let sid = s && s._id ? s._id : null
        if (sid && typeof sid === 'object' && sid.$oid) sid = require('mongoose').Types.ObjectId(sid.$oid)
        const idStr = sid ? String(sid) : `${String(p._id)}:${String(s.name)}`
        if (seen.has(idStr)) continue
        merged.push({
          _id: sid || undefined,
          name: s.name,
          slug: s.slug || undefined,
          parentId: p._id,
          level: (p.level || 0) + 1,
          path: (p.path || []).concat([p._id]),
          sortOrder: s.sortOrder || 0,
          isActive: s.isActive !== undefined ? s.isActive : true,
          isDeleted: s.isDeleted || false,
          icon: s.icon || null,
          emoji: s.emoji || p.emoji || null,
          createdAt: s.createdAt || p.createdAt,
          updatedAt: s.updatedAt || p.updatedAt,
        })
        seen.add(idStr)
      }
    }
    // Build tree from flat list (by parent_id), then flatten in hierarchy order
    const tree = buildCategoryTreeFromFlat(merged)
    let ordered = flattenCategoryTreeInOrder(tree)
    // Filter to root categories only, if requested
    if (rootOnly === 'true' || rootOnly === true) {
      ordered = ordered.filter((c) => !c.parentId)
    } else if (filterParentId && filterParentId !== 'all' && filterParentId !== '') {
      // Filter by parent category if requested
      ordered = ordered.filter((c) => c.parentId && String(c.parentId) === String(filterParentId))
    }
    const total = ordered.length
    const categoriesPage = ordered.slice(skip, skip + limitNum)
    res.json({
      categories: categoriesPage,
      page: Number(page),
      limit: limitNum,
      total,
      hasMore: skip + categoriesPage.length < total,
    })
  } catch (error) {
    console.error('Error fetching admin categories:', error)
    res.status(500).json({ message: 'Error fetching categories' })
  }
})

// GET /api/admin/categories/children?parentId=...
router.get('/categories/children', adminMiddleware, async (req, res) => {
  try {
    const { parentId } = req.query
    const filter = { isDeleted: false }
    const id = (parentId === undefined || parentId === 'null' || parentId === '') ? null : parentId
    if (id && !Types.ObjectId.isValid(String(id))) return res.status(400).json({ message: 'Invalid parentId' })
    const children = await Category.getChildren(id, filter).lean()
    res.json(children)
  } catch (error) {
    console.error('Error fetching category children:', error)
    res.status(500).json({ message: 'Error fetching children' })
  }
})

// GET /api/admin/categories/nested-for-filters
// Full category tree for cascading dropdowns (all levels). Single DB query + in-memory build.
router.get('/categories/nested-for-filters', adminMiddleware, async (req, res) => {
  try {
    const flat = await Category.find({ isDeleted: false })
      .sort({ xOrder: 1, name: 1 })
      .lean()
    const payload = buildNestedCategoryTreeForFilters(flat)
    res.json(payload)
  } catch (error) {
    console.error('Error building nested category tree:', error)
    res.status(500).json({ message: 'Error fetching category tree' })
  }
})

// POST /api/admin/categories/import-excel
// Accepts Excel/CSV with columns: Brand, Model, Variant
// Body: optional targetCategoryId (import under any existing category level),
//       or rootCategoryId + subCategoryId / legacy sheet name behavior.
router.post(
  '/categories/import-excel',
  adminMiddleware,
  uploadAny.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' })
      }
      const result = await importCategoriesFromExcel({
        filePath: req.file.path,
        body: req.body || {},
        Category,
      })
      res.json(result)
    } catch (error) {
      console.error('Error importing categories from Excel:', error)
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      return res.status(500).json({ message: 'Failed to import categories' })
    }
  }
)

// GET /api/admin/categories/debug-indexes  (temporary – remove after debugging)
router.get('/categories/debug-indexes', adminMiddleware, async (req, res) => {
  try {
    const indexes = await Category.collection.indexes()
    const slug = req.query.slug
    let matches = []
    if (slug) {
      matches = await Category.find({ slug, isDeleted: { $ne: true } })
        .select('_id name slug parentId level isDeleted')
        .lean()
    }
    res.json({ indexes, matches })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

function resolveCategoryImage(req, fieldname = 'category_image', bodyKey = 'image') {
  const file = req.files?.[fieldname]?.[0] || (fieldname === 'category_image' ? req.file : null)
  if (file) return `/uploads/images/${file.filename}`
  const raw = req.body?.[bodyKey]
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    return String(raw).trim()
  }
  return null
}

// POST /api/admin/categories
router.post(
  '/categories',
  adminMiddleware,
  upload.fields([
    { name: 'category_image', maxCount: 1 },
    { name: 'categoryImage', maxCount: 1 },
  ]),
  async (req, res) => {
  try {
    const { name, slug, parentId, sortOrder = 0, isActive = true, colorCode, xOrder } = req.body
    if (!name) return res.status(400).json({ message: 'name is required' })
    if (parentId) {
      if (!Types.ObjectId.isValid(parentId)) return res.status(400).json({ message: 'Invalid parentId' })
      const parent = await Category.findById(parentId).select('_id isDeleted path')
      if (!parent || parent.isDeleted) return res.status(400).json({ message: 'Parent not found or deleted' })
    }
    const image = resolveCategoryImage(req, 'category_image', 'image')
    const categoryImage = resolveCategoryImage(req, 'categoryImage', 'categoryImage')
    const category = new Category({
      name,
      slug: slug || undefined,
      parentId: parentId || null,
      sortOrder,
      isActive,
      ...(image ? { image, icon: image } : {}),
      ...(categoryImage ? { categoryImage } : {}),
      ...(colorCode !== undefined && String(colorCode).trim() !== '' ? { colorCode: String(colorCode).trim() } : {}),
      ...(xOrder !== undefined && String(xOrder).trim() !== '' ? { xOrder: Number(xOrder) } : {}),
    })
    await category.save()
    res.status(201).json(category)
  } catch (error) {
    console.error('Error creating category:', error)
    if (error.code === 11000) {
      console.warn('[Category] Stale unique index caused E11000 — restart server to auto-fix. Details:', JSON.stringify(error.keyPattern))
      return res.status(400).json({ message: 'Duplicate key error from stale index. Please restart the server or run: node scripts/drop_slug_unique_index.js' })
    }
    if (error.message && /parent|circular/i.test(error.message)) {
      return res.status(400).json({ message: error.message })
    }
    res.status(500).json({ message: 'Error creating category' })
  }
  }
)

// GET full tree
router.get('/categories/tree', adminMiddleware, async (req, res) => {
  try {
    const tree = await Category.getTree({ isDeleted: false })
    res.json(tree)
  } catch (error) {
    console.error('Error fetching category tree:', error)
    res.status(500).json({ message: 'Error fetching category tree' })
  }
})

// GET /api/admin/categories/:id/ancestors
router.get('/categories/:id/ancestors', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(String(id))) return res.status(400).json({ message: 'Invalid id' })
    const ancestors = await Category.getAncestors(id)
    res.json(ancestors)
  } catch (error) {
    console.error('Error fetching category ancestors:', error)
    res.status(500).json({ message: 'Error fetching ancestors' })
  }
})

// GET /api/admin/categories/:id/path
router.get('/categories/:id/path', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(String(id))) return res.status(400).json({ message: 'Invalid id' })
    const pathInfo = await Category.getFullPath(id)
    res.json(pathInfo)
  } catch (error) {
    console.error('Error fetching category path:', error)
    res.status(500).json({ message: 'Error fetching category path' })
  }
})

// PATCH update
router.patch(
  '/categories/:id',
  adminMiddleware,
  upload.fields([
    { name: 'category_image', maxCount: 1 },
    { name: 'categoryImage', maxCount: 1 },
  ]),
  async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const category = await Category.findById(id)
    if (!category) return res.status(404).json({ message: 'Category not found' })
    const { name, slug, parentId, sortOrder, isActive, clear_image, clear_categoryImage, colorCode, xOrder } = req.body
    if (parentId !== undefined) {
      if (parentId) {
        if (!Types.ObjectId.isValid(parentId)) return res.status(400).json({ message: 'Invalid parentId' })
        const parent = await Category.findById(parentId).select('_id path isDeleted').lean()
        if (!parent || parent.isDeleted) return res.status(400).json({ message: 'Parent not found or deleted' })
        if (parent._id.equals(category._id)) return res.status(400).json({ message: 'Cannot set parent to self' })
        if (parent.path && parent.path.some((p) => p.equals(category._id))) return res.status(400).json({ message: 'Circular parent relationship' })
        category.parentId = parent._id
      } else {
        category.parentId = null
      }
    }
    if (name !== undefined) category.name = name
    if (slug !== undefined) category.slug = slug
    if (sortOrder !== undefined) category.sortOrder = sortOrder
    if (isActive !== undefined) category.isActive = isActive
    if (req.files?.category_image?.[0]) {
      const image = resolveCategoryImage(req, 'category_image', 'image')
      category.image = image
      category.icon = image
    } else if (clear_image === 'true' || clear_image === true) {
      category.image = null
      category.icon = null
    } else if (req.body.image !== undefined) {
      const image = resolveCategoryImage(req, 'category_image', 'image')
      category.image = image
      category.icon = image
    }
    if (req.files?.categoryImage?.[0]) {
      category.categoryImage = resolveCategoryImage(req, 'categoryImage', 'categoryImage')
    } else if (clear_categoryImage === 'true' || clear_categoryImage === true) {
      category.categoryImage = null
    } else if (req.body.categoryImage !== undefined) {
      category.categoryImage = resolveCategoryImage(req, 'categoryImage', 'categoryImage')
    }
    if (colorCode !== undefined) {
      category.colorCode = String(colorCode).trim() !== '' ? String(colorCode).trim() : null
    }
    if (xOrder !== undefined) {
      category.xOrder = String(xOrder).trim() !== '' ? Number(xOrder) : 0
    }
    await category.save()
    res.json(category)
  } catch (error) {
    console.error('Error updating category:', error)
    if (error.code === 11000) {
      console.warn('[Category] Stale unique index caused E11000 — restart server to auto-fix. Details:', JSON.stringify(error.keyPattern))
      return res.status(400).json({ message: 'Duplicate key error from stale index. Please restart the server or run: node scripts/drop_slug_unique_index.js' })
    }
    if (error.message && /parent|circular/i.test(error.message)) {
      return res.status(400).json({ message: error.message })
    }
    res.status(500).json({ message: 'Error updating category' })
  }
  }
)

// DELETE soft-delete and descendants
router.delete('/categories/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const _id = new Types.ObjectId(id)
    const category = await Category.findById(id).select('_id')
    if (!category) return res.status(404).json({ message: 'Category not found' })
    const descendants = await Category.find({ path: _id }).select('_id').lean()
    const idsToDelete = [category._id, ...descendants.map((d) => d._id)]
    await Category.updateMany({ _id: { $in: idsToDelete } }, { $set: { isDeleted: true, isActive: false } })
    res.json({ deletedCount: idsToDelete.length })
  } catch (error) {
    console.error('Error deleting category:', error)
    res.status(500).json({ message: 'Error deleting category' })
  }
})
  
  // GET /api/admin/categories/all
  // Return all categories (optionally include deleted)
  router.get('/categories/all', adminMiddleware, async (req, res) => {
    try {
      const includeDeleted = req.query.includeDeleted === 'true'
      const filter = includeDeleted ? {} : { isDeleted: false }
      // Fetch normalized categories
      const categories = await Category.find(filter).sort({ xOrder: 1, name: 1 }).lean()
      // Also include legacy embedded subcategories (if any) so admin sees everything
      const rawColl = require('mongoose').connection.collection('categories')
      const legacyParents = await rawColl.find({ subcategories: { $exists: true, $ne: [] } }).toArray()
      const merged = [...categories]
      const seen = new Set(merged.map((c) => String(c._id)))
      for (const p of legacyParents) {
        if (!includeDeleted && p.isDeleted) continue
        // include parent doc if not present
        if (!seen.has(String(p._id))) {
          merged.push({
            _id: p._id,
            name: p.name,
            slug: p.slug || undefined,
            parentId: p.parentId || null,
            level: p.level || 0,
            path: p.path || [],
            sortOrder: p.sortOrder || 0,
            isActive: p.isActive !== undefined ? p.isActive : true,
            isDeleted: p.isDeleted || false,
            icon: p.icon || null,
            emoji: p.emoji || null,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })
          seen.add(String(p._id))
        }
        const subs = Array.isArray(p.subcategories) ? p.subcategories : []
        for (const s of subs) {
          if (!includeDeleted && s.isDeleted) continue
          let sid = s && s._id ? s._id : null
          if (sid && typeof sid === 'object' && sid.$oid) sid = require('mongoose').Types.ObjectId(sid.$oid)
          const idStr = sid ? String(sid) : `${String(p._id)}:${String(s.name)}`
          if (seen.has(idStr)) continue
          merged.push({
            _id: sid || undefined,
            name: s.name,
            slug: s.slug || undefined,
            parentId: p._id,
            level: (p.level || 0) + 1,
            path: (p.path || []).concat([p._id]),
            sortOrder: s.sortOrder || 0,
            isActive: s.isActive !== undefined ? s.isActive : true,
            isDeleted: s.isDeleted || false,
            icon: s.icon || null,
            emoji: s.emoji || p.emoji || null,
            createdAt: s.createdAt || p.createdAt,
            updatedAt: s.updatedAt || p.updatedAt,
          })
          seen.add(idStr)
        }
      }
      res.json({ categories: merged, total: merged.length })
    } catch (error) {
      console.error('Error fetching all categories:', error)
      res.status(500).json({ message: 'Error fetching categories' })
    }
  })

// ---------------------------------------------------------------------------
// Filters (hierarchical) - admin CRUD & tree
// ---------------------------------------------------------------------------

// GET /api/admin/filters
// Fetch all matching filters, build tree by parent_id, flatten in hierarchy order, then paginate
router.get('/filters', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 100, search, mainCategoryId, subCategoryId } = req.query
    const skip = Math.max(0, (Number(page) - 1) * Number(limit))
    const limitNum = Math.max(1, Math.min(500, Number(limit)))

    // Optional category scoping: limit filters list to those assigned to the selected
    // main/sub category (including the category subtree).
    // - `mainCategoryId`: root category (and its descendants)
    // - `subCategoryId`: sub category (and its descendants). If present, it takes priority.
    let filters = []
    if (subCategoryId || mainCategoryId) {
      const scopeId = subCategoryId || mainCategoryId
      if (!Types.ObjectId.isValid(String(scopeId))) {
        return res.status(400).json({ message: 'Invalid category id' })
      }
      const scopeObjId = new Types.ObjectId(String(scopeId))

      // Categories in scope = selected category + all descendants.
      const scopedCategories = await Category.find({
        isDeleted: false,
        $or: [{ _id: scopeObjId }, { path: scopeObjId }],
      })
        .select('_id')
        .lean()
      const scopedCategoryIds = scopedCategories.map((c) => c._id)

      if (!scopedCategoryIds.length) {
        return res.json({
          filters: [],
          page: Number(page),
          limit: limitNum,
          total: 0,
          hasMore: false,
        })
      }

      const scopedLinks = await CategoryFilter.find({
        categoryId: { $in: scopedCategoryIds },
      })
        .select('filterId')
        .lean()

      const directScopedFilters = await Filter.find({
        isDeleted: false,
        $or: [
          { categoryId: { $in: scopedCategoryIds } },
          { subcategoryId: { $in: scopedCategoryIds } },
          { childCategoryId: { $in: scopedCategoryIds } },
        ],
      })
        .select('_id')
        .lean()

      const assignedFilterIds = [
        ...new Set([
          ...scopedLinks.map((l) => String(l.filterId)),
          ...directScopedFilters.map((f) => String(f._id)),
        ]),
      ]

      if (!assignedFilterIds.length) {
        return res.json({
          filters: [],
          page: Number(page),
          limit: limitNum,
          total: 0,
          hasMore: false,
        })
      }

      // Include the whole filter subtree:
      // - CategoryFilter points to one or more filters assigned to a category.
      // - For hierarchical filters, showing children is usually what admins expect.
      // - We therefore include descendants (path contains assigned ids),
      //   then include ancestors of those descendants so the tree stays valid.
      const assignedObjIds = assignedFilterIds.map((id) => new Types.ObjectId(id))
      const candidateFilters = await Filter.find({
        isDeleted: false,
        $or: [{ _id: { $in: assignedObjIds } }, { path: { $in: assignedObjIds } }],
      })
        .select('_id path')
        .lean()

      const allIdsSet = new Set(candidateFilters.map((f) => String(f._id)))
      candidateFilters.forEach((f) => {
        ;(f.path || []).forEach((pid) => allIdsSet.add(String(pid)))
      })
      const allFilterIds = [...allIdsSet].map((id) => new Types.ObjectId(id))

      if (search && String(search).trim()) {
        const regex = new RegExp(String(search).trim(), 'i')

        const matched = await Filter.find({
          _id: { $in: allFilterIds },
          isDeleted: false,
          name: regex,
        })
          .select('_id path')
          .lean()

        const expandedIdsSet = new Set(matched.map((m) => String(m._id)))
        matched.forEach((m) => {
          ;(m.path || []).forEach((pid) => expandedIdsSet.add(String(pid)))
        })
        const expandedIds = [...expandedIdsSet].map((id) => new Types.ObjectId(id))

        filters = await Filter.find({ _id: { $in: expandedIds }, isDeleted: false }).lean()
      } else {
        filters = await Filter.find({ _id: { $in: allFilterIds }, isDeleted: false }).lean()
      }
    } else {
      const query = { isDeleted: false }
      if (search && String(search).trim()) {
        query.name = new RegExp(String(search).trim(), 'i')
      }
      filters = await Filter.find(query).lean()
    }

    const tree = buildCategoryTreeFromFlat(filters)
    const ordered = flattenCategoryTreeInOrder(tree)
    const total = ordered.length
    const pageItems = ordered.slice(skip, skip + limitNum)
    res.json({
      filters: pageItems,
      page: Number(page),
      limit: limitNum,
      total,
      hasMore: skip + pageItems.length < total,
    })
  } catch (error) {
    console.error('Error fetching admin filters:', error)
    res.status(500).json({ message: 'Error fetching filters' })
  }
})

// GET /api/admin/filters/tree
// Return full filter tree for parent dropdowns etc.
// Optional ?subCategoryId=ID or ?mainCategoryId=ID to scope to a category.
router.get('/filters/tree', adminMiddleware, async (req, res) => {
  try {
    const { subCategoryId, mainCategoryId } = req.query
    const scopeId = subCategoryId || mainCategoryId

    if (scopeId && Types.ObjectId.isValid(String(scopeId))) {
      const scopeObjId = new Types.ObjectId(String(scopeId))
      const scopedCategories = await Category.find({
        isDeleted: false,
        $or: [{ _id: scopeObjId }, { path: scopeObjId }],
      })
        .select('_id')
        .lean()
      const scopedCategoryIds = scopedCategories.map((c) => c._id)

      const links = await CategoryFilter.find({ categoryId: { $in: scopedCategoryIds } })
        .select('filterId')
        .lean()
      const directFilters = await Filter.find({
        isDeleted: false,
        $or: [
          { categoryId: { $in: scopedCategoryIds } },
          { subcategoryId: { $in: scopedCategoryIds } },
          { childCategoryId: { $in: scopedCategoryIds } },
        ],
      })
        .select('_id')
        .lean()

      const allIds = [...new Set([
        ...links.map((l) => String(l.filterId)),
        ...directFilters.map((f) => String(f._id)),
      ])].map((id) => new Types.ObjectId(id))

      if (!allIds.length) return res.json([])

      // Include full subtrees so children are available as parent options
      const candidates = await Filter.find({
        isDeleted: false,
        $or: [{ _id: { $in: allIds } }, { path: { $in: allIds } }],
      })
        .select('_id path')
        .lean()
      const expandedSet = new Set(candidates.map((f) => String(f._id)))
      candidates.forEach((f) => (f.path || []).forEach((p) => expandedSet.add(String(p))))
      const expandedIds = [...expandedSet].map((id) => new Types.ObjectId(id))

      const tree = await Filter.getTree({ _id: { $in: expandedIds }, isDeleted: false })
      return res.json(tree)
    }

    const tree = await Filter.getTree({ isDeleted: false })
    res.json(tree)
  } catch (error) {
    console.error('Error fetching filter tree:', error)
    res.status(500).json({ message: 'Error fetching filter tree' })
  }
})

// GET /api/admin/filters/children?parentId=...
router.get('/filters/children', adminMiddleware, async (req, res) => {
  try {
    const { parentId } = req.query
    const baseFilter = { isDeleted: false }
    const id = parentId === undefined || parentId === 'null' || parentId === '' ? null : parentId
    if (id && !Types.ObjectId.isValid(String(id))) return res.status(400).json({ message: 'Invalid parentId' })
    const children = await Filter.getChildren(id, baseFilter).lean()
    res.json(children)
  } catch (error) {
    console.error('Error fetching filter children:', error)
    res.status(500).json({ message: 'Error fetching filter children' })
  }
})

// POST /api/admin/filters/import-excel
// Excel columns mapping (header row ignored):
//   Column A -> Filters (parent filter name)
//   Column B -> Properties (child filter name(s); one per row, commas supported)
// Form body: categoryId (optional) — assigns imported filters to that category (CategoryFilter pivot).
const importFiltersExcelHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

    const {
      categoryId,
      targetCategoryId,
      childCategoryId,
      child_category_id,
      subcategoryId,
      subcategory_id,
    } = req.body || {}
    let assignCategoryId = null
    const candidateLevelId =
      (targetCategoryId !== undefined && String(targetCategoryId).trim() !== '' && targetCategoryId) ||
      (childCategoryId !== undefined && String(childCategoryId).trim() !== '' && childCategoryId) ||
      (child_category_id !== undefined && String(child_category_id).trim() !== '' && child_category_id) ||
      (subcategoryId !== undefined && String(subcategoryId).trim() !== '' && subcategoryId) ||
      (subcategory_id !== undefined && String(subcategory_id).trim() !== '' && subcategory_id) ||
      (categoryId !== undefined && String(categoryId).trim() !== '' && categoryId) ||
      null

    if (candidateLevelId) {
      if (!Types.ObjectId.isValid(String(candidateLevelId))) {
        return res.status(400).json({ message: 'Invalid category level id' })
      }
      assignCategoryId = String(candidateLevelId)
    }

    const result = await importFiltersFromExcel({
      filePath: req.file.path,
      assignCategoryId,
      models: { Filter, Category, CategoryFilter },
      log: (level, msg, meta) => console.log(`[filter_import:${level}]`, msg, meta || ''),
    })
    res.json(result)
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
        ...(error.details || {}),
      })
    }
    console.error('Error importing filters from Excel:', error)
    return res.status(500).json({ message: 'Failed to import filters' })
  }
}

router.post('/filters/import-excel', adminMiddleware, uploadAny.single('file'), importFiltersExcelHandler)
router.post('/filters/import', adminMiddleware, uploadAny.single('file'), importFiltersExcelHandler)

// Resolve a selected category-level id (categoryId/subcategoryId/childCategoryId,
// whichever is the deepest one provided) into the full ancestor chain used to
// populate Filter.categoryId/subcategoryId/childCategoryId. Shared by POST and PATCH
// so create and update assign categories the same way.
async function resolveFilterCategoryChain(body) {
  const { categoryId, subcategoryId, subcategory_id, childCategoryId, child_category_id } = body
  const rawSubcategoryId = subcategoryId ?? subcategory_id
  const rawChildCategoryId = childCategoryId ?? child_category_id
  const candidateLevelId =
    (rawChildCategoryId !== undefined && String(rawChildCategoryId).trim() !== '' && rawChildCategoryId) ||
    (rawSubcategoryId !== undefined && String(rawSubcategoryId).trim() !== '' && rawSubcategoryId) ||
    (categoryId !== undefined && String(categoryId).trim() !== '' && categoryId) ||
    null

  if (!candidateLevelId) return { provided: false }

  if (!Types.ObjectId.isValid(String(candidateLevelId))) {
    return { provided: true, error: 'Invalid category level id' }
  }
  const selected = await Category.findOne({
    _id: candidateLevelId,
    isDeleted: { $ne: true },
  })
    .select('_id parentId path')
    .lean()
  if (!selected) return { provided: true, error: 'Selected category level not found or deleted' }

  // Always keep assignment at the selected level id.
  const assignCategoryObjId = new Types.ObjectId(String(selected._id))

  // Build ancestor chain by traversing parentId — more reliable than `path`
  // which can be stale/empty on older category documents.
  const chainIds = []
  {
    let cur = selected
    const seen = new Set()
    while (cur && cur._id) {
      const curIdStr = String(cur._id)
      if (seen.has(curIdStr)) break
      seen.add(curIdStr)
      chainIds.push(curIdStr)
      if (!cur.parentId) break
      // eslint-disable-next-line no-await-in-loop
      cur = await Category.findById(cur.parentId).select('_id parentId').lean()
    }
  }
  const chain = chainIds.length ? chainIds.reverse() : [...(selected.path || []), selected._id].map((id) => String(id))

  return {
    provided: true,
    assignCategoryObjId,
    filterCategoryObjId: chain[0] ? new Types.ObjectId(chain[0]) : null,
    filterSubcategoryObjId: chain[1] ? new Types.ObjectId(chain[1]) : null,
    filterChildCategoryObjId: chain[2] ? new Types.ObjectId(chain[2]) : null,
  }
}

// POST /api/admin/filters
router.post(
  '/filters',
  adminMiddleware,
  upload.single('thumbImage'),
  async (req, res) => {
    try {
      const {
        name,
        slug,
        parentId,
        sortOrder = 0,
        isActive = true,
        colorCode,
        color_code,
      } = req.body
      if (!name) return res.status(400).json({ message: 'name is required' })

      if (parentId) {
        if (!Types.ObjectId.isValid(parentId)) return res.status(400).json({ message: 'Invalid parentId' })
        const parent = await Filter.findById(parentId).select('_id isDeleted path')
        if (!parent || parent.isDeleted) return res.status(400).json({ message: 'Parent not found or deleted' })
      }

      const chainResult = await resolveFilterCategoryChain(req.body)
      if (chainResult.error) return res.status(400).json({ message: chainResult.error })

      const assignCategoryObjId = chainResult.assignCategoryObjId || null
      const filterCategoryObjId = chainResult.filterCategoryObjId || null
      const filterSubcategoryObjId = chainResult.filterSubcategoryObjId || null
      const filterChildCategoryObjId = chainResult.filterChildCategoryObjId || null

      let thumbImage
      if (req.file) {
        thumbImage = `/uploads/images/${req.file.filename}`
      }

      const filter = new Filter({
        name,
        slug: slug || undefined,
        parentId: parentId || null,
        sortOrder,
        isActive,
        colorCode: colorCode || color_code || null,
        thumbImage: thumbImage || undefined,
        categoryId: filterCategoryObjId || null,
        subcategoryId: filterSubcategoryObjId || null,
        childCategoryId: filterChildCategoryObjId || null,
      })

      await filter.save()
      if (assignCategoryObjId) {
        try {
          await CategoryFilter.create({
            categoryId: assignCategoryObjId,
            filterId: filter._id,
          })
        } catch (err) {
          if (err?.code !== 11000) throw err
        }
      }
      res.status(201).json(filter)
    } catch (error) {
      console.error('Error creating filter:', error)
      if (error.code === 11000) return res.status(400).json({ message: 'Slug already exists under this parent' })
      if (error.message && /slug already exists|duplicate/i.test(error.message)) {
        return res.status(400).json({ message: error.message })
      }
      res.status(500).json({ message: 'Error creating filter' })
    }
  }
)

// PATCH /api/admin/filters/:id
router.patch(
  '/filters/:id',
  adminMiddleware,
  upload.single('thumbImage'),
  async (req, res) => {
    try {
      const { id } = req.params
      if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
      const filterDoc = await Filter.findById(id)
      if (!filterDoc) return res.status(404).json({ message: 'Filter not found' })

      const { name, slug, parentId, sortOrder, isActive, colorCode, color_code, clearThumb, clearCategory } = req.body

      if (parentId !== undefined) {
        if (parentId) {
          if (!Types.ObjectId.isValid(parentId)) return res.status(400).json({ message: 'Invalid parentId' })
          const parent = await Filter.findById(parentId).select('_id path isDeleted').lean()
          if (!parent || parent.isDeleted) return res.status(400).json({ message: 'Parent not found or deleted' })
          if (parent._id.equals(filterDoc._id)) {
            return res.status(400).json({ message: 'Cannot set parent to self' })
          }
          if (parent.path && parent.path.some((p) => p.equals(filterDoc._id))) {
            return res.status(400).json({ message: 'Circular parent relationship' })
          }
          filterDoc.parentId = parent._id
        } else {
          filterDoc.parentId = null
        }
      }

      if (name !== undefined) filterDoc.name = name
      if (slug !== undefined) filterDoc.slug = slug
      if (sortOrder !== undefined) filterDoc.sortOrder = sortOrder
      if (isActive !== undefined) filterDoc.isActive = isActive
      if (colorCode !== undefined || color_code !== undefined) {
        filterDoc.colorCode = colorCode || color_code || null
      }

      if (req.file) {
        filterDoc.thumbImage = `/uploads/images/${req.file.filename}`
      } else if (clearThumb === 'true') {
        filterDoc.thumbImage = null
      }

      let assignCategoryObjId
      if (clearCategory === 'true') {
        filterDoc.categoryId = null
        filterDoc.subcategoryId = null
        filterDoc.childCategoryId = null
        assignCategoryObjId = null
      } else {
        const chainResult = await resolveFilterCategoryChain(req.body)
        if (chainResult.error) return res.status(400).json({ message: chainResult.error })
        if (chainResult.provided) {
          filterDoc.categoryId = chainResult.filterCategoryObjId || null
          filterDoc.subcategoryId = chainResult.filterSubcategoryObjId || null
          filterDoc.childCategoryId = chainResult.filterChildCategoryObjId || null
          assignCategoryObjId = chainResult.assignCategoryObjId || null
        }
      }

      await filterDoc.save()

      // Keep the CategoryFilter pivot in sync with the category-level assignment.
      if (assignCategoryObjId !== undefined) {
        await CategoryFilter.deleteMany({ filterId: filterDoc._id })
        if (assignCategoryObjId) {
          try {
            await CategoryFilter.create({ categoryId: assignCategoryObjId, filterId: filterDoc._id })
          } catch (err) {
            if (err?.code !== 11000) throw err
          }
        }
      }

      res.json(filterDoc)
    } catch (error) {
      console.error('Error updating filter:', error)
      if (error.code === 11000) return res.status(400).json({ message: 'Slug already exists under this parent' })
      if (error.message && /slug already exists|duplicate/i.test(error.message)) {
        return res.status(400).json({ message: error.message })
      }
      res.status(500).json({ message: 'Error updating filter' })
    }
  }
)

// DELETE /api/admin/filters/:id - soft-delete filter and its descendants
router.delete('/filters/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const _id = new Types.ObjectId(id)
    const filterDoc = await Filter.findById(id).select('_id')
    if (!filterDoc) return res.status(404).json({ message: 'Filter not found' })
    const descendants = await Filter.find({ path: _id }).select('_id').lean()
    const idsToDelete = [filterDoc._id, ...descendants.map((d) => d._id)]
    await Filter.updateMany({ _id: { $in: idsToDelete } }, { $set: { isDeleted: true, isActive: false } })
    res.json({ deletedCount: idsToDelete.length })
  } catch (error) {
    console.error('Error deleting filter:', error)
    res.status(500).json({ message: 'Error deleting filter' })
  }
})

// ---------------------------------------------------------------------------
// Dealers - admin CRUD
// ---------------------------------------------------------------------------

// GET /api/admin/dealers - list with search (name/email) and pagination
router.get('/dealers', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query
    const skip = (Number(page) - 1) * Number(limit)
    const limitNum = Math.max(1, Math.min(100, Number(limit)))
    const query = {}
    if (search && String(search).trim()) {
      const term = new RegExp(String(search).trim(), 'i')
      query.$or = [
        { dealer_name: term },
        { dealer_email: term },
      ]
    }
    if (status === 'active') query.status = true
    else if (status === 'inactive') query.status = false
    const [dealers, total] = await Promise.all([
      Dealer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Dealer.countDocuments(query),
    ])
    res.json({
      dealers,
      page: Number(page),
      limit: limitNum,
      total,
      hasMore: skip + dealers.length < total,
    })
  } catch (error) {
    console.error('Error fetching dealers:', error)
    res.status(500).json({ message: 'Error fetching dealers' })
  }
})

// GET /api/admin/dealers/:id - get one dealer (for edit)
router.get('/dealers/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const dealer = await Dealer.findById(id).lean()
    if (!dealer) return res.status(404).json({ message: 'Dealer not found' })
    res.json(dealer)
  } catch (error) {
    console.error('Error fetching dealer:', error)
    res.status(500).json({ message: 'Error fetching dealer' })
  }
})

// POST /api/admin/dealers - create dealer (with optional image)
router.post(
  '/dealers',
  adminMiddleware,
  upload.single('dealer_image'),
  async (req, res) => {
    try {
      const {
        dealer_name,
        dealer_email,
        dealer_mobile,
        dealer_whatsapp,
        synopsis,
        status,
      } = req.body
      if (!dealer_name || !String(dealer_name).trim()) {
        return res.status(400).json({ message: 'dealer_name is required' })
      }
      let email = null
      if (dealer_email && String(dealer_email).trim()) {
        email = String(dealer_email).trim().toLowerCase()
        const existing = await Dealer.findOne({ dealer_email: email })
        if (existing) {
          return res.status(400).json({ message: 'Dealer with this email already exists' })
        }
      }
      let dealer_image = null
      if (req.file) {
        dealer_image = `/uploads/images/${req.file.filename}`
      }
      const dealer = new Dealer({
        dealer_name: String(dealer_name).trim(),
        dealer_email: email,
        dealer_mobile: dealer_mobile ? String(dealer_mobile).trim() : null,
        dealer_whatsapp: dealer_whatsapp ? String(dealer_whatsapp).trim() : null,
        synopsis: synopsis ? String(synopsis).trim() : null,
        dealer_image,
        status: status === 'false' || status === false ? false : true,
      })
      await dealer.save()
      res.status(201).json(dealer)
    } catch (error) {
      console.error('Error creating dealer:', error)
      if (error.code === 11000) return res.status(400).json({ message: 'Dealer email already exists' })
      res.status(500).json({ message: 'Error creating dealer' })
    }
  }
)

// PATCH /api/admin/dealers/:id - update dealer (optional image)
router.patch(
  '/dealers/:id',
  adminMiddleware,
  upload.single('dealer_image'),
  async (req, res) => {
    try {
      const { id } = req.params
      if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
      const doc = await Dealer.findById(id)
      if (!doc) return res.status(404).json({ message: 'Dealer not found' })
      const {
        dealer_name,
        dealer_email,
        dealer_mobile,
        dealer_whatsapp,
        synopsis,
        status,
        clear_image,
      } = req.body
      if (dealer_name !== undefined) doc.dealer_name = String(dealer_name).trim()
      if (dealer_email !== undefined) {
        const email = String(dealer_email).trim().toLowerCase()
        const existing = await Dealer.findOne({ dealer_email: email, _id: { $ne: id } })
        if (existing) return res.status(400).json({ message: 'Dealer with this email already exists' })
        doc.dealer_email = email
      }
      if (dealer_mobile !== undefined) doc.dealer_mobile = String(dealer_mobile).trim()
      if (dealer_whatsapp !== undefined) doc.dealer_whatsapp = dealer_whatsapp ? String(dealer_whatsapp).trim() : null
      if (synopsis !== undefined) doc.synopsis = synopsis ? String(synopsis).trim() : null
      if (status !== undefined) doc.status = status === 'false' || status === false ? false : true
      if (req.file) doc.dealer_image = `/uploads/images/${req.file.filename}`
      else if (clear_image === 'true') doc.dealer_image = null
      await doc.save()
      res.json(doc)
    } catch (error) {
      console.error('Error updating dealer:', error)
      if (error.code === 11000) return res.status(400).json({ message: 'Dealer email already exists' })
      res.status(500).json({ message: 'Error updating dealer' })
    }
  }
)

// PUT /api/admin/dealers/:id/status - toggle status (active/inactive)
router.put('/dealers/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const doc = await Dealer.findById(id)
    if (!doc) return res.status(404).json({ message: 'Dealer not found' })
    const newStatus = status === false || status === 'false' ? false : true
    doc.status = newStatus
    await doc.save()
    res.json({ message: `Dealer ${newStatus ? 'active' : 'inactive'}`, dealer: doc })
  } catch (error) {
    console.error('Error updating dealer status:', error)
    res.status(500).json({ message: 'Error updating dealer status' })
  }
})

// DELETE /api/admin/dealers/:id
router.delete('/dealers/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const doc = await Dealer.findByIdAndDelete(id)
    if (!doc) return res.status(404).json({ message: 'Dealer not found' })
    res.json({ message: 'Dealer deleted', deletedCount: 1 })
  } catch (error) {
    console.error('Error deleting dealer:', error)
    res.status(500).json({ message: 'Error deleting dealer' })
  }
})

// ---------------------------------------------------------------------------
// Emirates (Cities) - admin CRUD
// ---------------------------------------------------------------------------

// GET /api/admin/emirates - paginated list with search
router.get('/emirates', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, sortBy = 'name', sortDir = 'asc' } = req.query
    const result = await emirateService.listEmirates({
      page: Number(page),
      limit: Number(limit),
      search,
      status: status || 'all',
      sortBy,
      sortDir,
    })
    res.json(toPaginatedEmiratesResponse(result))
  } catch (error) {
    console.error('Error fetching emirates:', error)
    res.status(error.statusCode || 500).json({ message: error.message || 'Error fetching emirates' })
  }
})

// GET /api/admin/emirates/:id
router.get('/emirates/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const emirate = await emirateService.getEmirateById(id)
    res.json(toEmirateDto(emirate))
  } catch (error) {
    console.error('Error fetching emirate:', error)
    res.status(error.statusCode || 500).json({ message: error.message || 'Error fetching emirate' })
  }
})

// POST /api/admin/emirates - create
router.post('/emirates', adminMiddleware, async (req, res) => {
  try {
    const { name, slug, status = true } = req.body
    const emirate = await emirateService.createEmirate({ name, slug, status })
    res.status(201).json(toEmirateDto(emirate))
  } catch (error) {
    console.error('Error creating emirate:', error)
    res.status(error.statusCode || 500).json({ message: error.message || 'Error creating emirate' })
  }
})

// PATCH /api/admin/emirates/:id - update
router.patch('/emirates/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const emirate = await emirateService.updateEmirate(id, req.body)
    res.json(toEmirateDto(emirate))
  } catch (error) {
    console.error('Error updating emirate:', error)
    res.status(error.statusCode || 500).json({ message: error.message || 'Error updating emirate' })
  }
})

// PUT /api/admin/emirates/:id/status - toggle active/inactive
router.put('/emirates/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const emirate = await emirateService.setEmirateStatus(id, status)
    res.json({
      message: `Emirate ${emirate.status ? 'active' : 'inactive'}`,
      emirate: toEmirateDto(emirate),
    })
  } catch (error) {
    console.error('Error updating emirate status:', error)
    res.status(error.statusCode || 500).json({ message: error.message || 'Error updating emirate status' })
  }
})

// DELETE /api/admin/emirates/:id - soft delete
router.delete('/emirates/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    await emirateService.deleteEmirate(id)
    res.json({ message: 'Emirate deleted successfully' })
  } catch (error) {
    console.error('Error deleting emirate:', error)
    res.status(error.statusCode || 500).json({ message: error.message || 'Error deleting emirate' })
  }
})

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

// GET /api/admin/packages - paginated list with search + filters
router.get(
  '/packages',
  adminMiddleware,
  packageValidator.listQueryRules,
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status,
        isRecomended,
        sortBy = 'displayOrder',
        sortDir = 'asc',
      } = req.query
      const result = await packageService.listPackages({
        page: Number(page),
        limit: Number(limit),
        search,
        status: status || 'all',
        isRecomended: isRecomended || 'all',
        sortBy,
        sortDir,
      })
      res.json(toPaginatedPackagesResponse(result))
    } catch (error) {
      console.error('Error fetching packages:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error fetching packages' })
    }
  }
)

// GET /api/admin/packages/:id
router.get(
  '/packages/:id',
  adminMiddleware,
  packageValidator.mongoIdParamRules,
  validateRequest,
  async (req, res) => {
    try {
      const pkg = await packageService.getPackageById(req.params.id)
      res.json(toPackageDto(pkg))
    } catch (error) {
      console.error('Error fetching package:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error fetching package' })
    }
  }
)

// POST /api/admin/packages - create
router.post(
  '/packages',
  adminMiddleware,
  packageValidator.createPackageRules,
  validateRequest,
  async (req, res) => {
    try {
      const pkg = await packageService.createPackage(req.body, req.user?._id)
      res.status(201).json(toPackageDto(pkg))
    } catch (error) {
      console.error('Error creating package:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error creating package' })
    }
  }
)

// PATCH /api/admin/packages/:id - update
router.patch(
  '/packages/:id',
  adminMiddleware,
  packageValidator.updatePackageRules,
  validateRequest,
  async (req, res) => {
    try {
      const pkg = await packageService.updatePackage(req.params.id, req.body, req.user?._id)
      res.json(toPackageDto(pkg))
    } catch (error) {
      console.error('Error updating package:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error updating package' })
    }
  }
)

// PUT /api/admin/packages/:id/status - activate / deactivate
router.put(
  '/packages/:id/status',
  adminMiddleware,
  packageValidator.statusRules,
  validateRequest,
  async (req, res) => {
    try {
      const pkg = await packageService.setPackageStatus(req.params.id, req.body.status, req.user?._id)
      res.json({
        message: `Package ${pkg.status ? 'activated' : 'deactivated'}`,
        package: toPackageDto(pkg),
      })
    } catch (error) {
      console.error('Error updating package status:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error updating package status' })
    }
  }
)

// DELETE /api/admin/packages/:id - soft delete
router.delete(
  '/packages/:id',
  adminMiddleware,
  packageValidator.mongoIdParamRules,
  validateRequest,
  async (req, res) => {
    try {
      await packageService.deletePackage(req.params.id, req.user?._id)
      res.json({ message: 'Package deleted successfully' })
    } catch (error) {
      console.error('Error deleting package:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error deleting package' })
    }
  }
)

// ---------------------------------------------------------------------------
// Storage Facilities
// ---------------------------------------------------------------------------

/** Multer writes icons into uploads/images — expose the public relative path. */
function resolveFacilityIcon(req) {
  return req.file ? `/uploads/images/${req.file.filename}` : null
}

// GET /api/admin/storage-facilities - paginated list with search + status filter
router.get(
  '/storage-facilities',
  adminMiddleware,
  storageFacilityValidator.listQueryRules,
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status,
        sortBy = 'displayOrder',
        sortDir = 'asc',
      } = req.query
      const result = await storageFacilityService.listStorageFacilities({
        page: Number(page),
        limit: Number(limit),
        search,
        status: status || 'all',
        sortBy,
        sortDir,
      })
      res.json(toPaginatedStorageFacilitiesResponse(result))
    } catch (error) {
      console.error('Error fetching storage facilities:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error fetching storage facilities' })
    }
  }
)

// GET /api/admin/storage-facilities/:id
router.get(
  '/storage-facilities/:id',
  adminMiddleware,
  storageFacilityValidator.mongoIdParamRules,
  validateRequest,
  async (req, res) => {
    try {
      const facility = await storageFacilityService.getStorageFacilityById(req.params.id)
      res.json(toStorageFacilityDto(facility))
    } catch (error) {
      console.error('Error fetching storage facility:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error fetching storage facility' })
    }
  }
)

// POST /api/admin/storage-facilities - create (with optional icon)
router.post(
  '/storage-facilities',
  adminMiddleware,
  upload.single('imageIcon'),
  storageFacilityValidator.createStorageFacilityRules,
  validateRequest,
  async (req, res) => {
    try {
      const facility = await storageFacilityService.createStorageFacility(
        { ...req.body, imageIcon: resolveFacilityIcon(req) },
        req.user?._id
      )
      res.status(201).json(toStorageFacilityDto(facility))
    } catch (error) {
      console.error('Error creating storage facility:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error creating storage facility' })
    }
  }
)

// PATCH /api/admin/storage-facilities/:id - update (optional icon replace / clear)
router.patch(
  '/storage-facilities/:id',
  adminMiddleware,
  upload.single('imageIcon'),
  storageFacilityValidator.updateStorageFacilityRules,
  validateRequest,
  async (req, res) => {
    try {
      const facility = await storageFacilityService.updateStorageFacility(
        req.params.id,
        { ...req.body, imageIcon: resolveFacilityIcon(req) },
        req.user?._id
      )
      res.json(toStorageFacilityDto(facility))
    } catch (error) {
      console.error('Error updating storage facility:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error updating storage facility' })
    }
  }
)

// PUT /api/admin/storage-facilities/:id/status - activate / deactivate
router.put(
  '/storage-facilities/:id/status',
  adminMiddleware,
  storageFacilityValidator.statusRules,
  validateRequest,
  async (req, res) => {
    try {
      const facility = await storageFacilityService.setStorageFacilityStatus(
        req.params.id,
        req.body.status,
        req.user?._id
      )
      res.json({
        message: `Storage facility ${facility.status ? 'activated' : 'deactivated'}`,
        storageFacility: toStorageFacilityDto(facility),
      })
    } catch (error) {
      console.error('Error updating storage facility status:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error updating storage facility status' })
    }
  }
)

// DELETE /api/admin/storage-facilities/:id - soft delete
router.delete(
  '/storage-facilities/:id',
  adminMiddleware,
  storageFacilityValidator.mongoIdParamRules,
  validateRequest,
  async (req, res) => {
    try {
      await storageFacilityService.deleteStorageFacility(req.params.id, req.user?._id)
      res.json({ message: 'Storage facility deleted successfully' })
    } catch (error) {
      console.error('Error deleting storage facility:', error)
      res.status(error.statusCode || 500).json({ message: error.message || 'Error deleting storage facility' })
    }
  }
)

// ---------------------------------------------------------------------------
// Category-Filter assignments (pivot)
// ---------------------------------------------------------------------------

// GET /api/admin/category-filters?categoryId=...
router.get('/category-filters', adminMiddleware, async (req, res) => {
  try {
    const { categoryId } = req.query
    if (!categoryId || !Types.ObjectId.isValid(String(categoryId))) {
      return res.status(400).json({ message: 'Invalid or missing categoryId' })
    }
    const category = await Category.findById(categoryId).lean()
    if (!category) return res.status(404).json({ message: 'Category not found' })

    const links = await CategoryFilter.find({ categoryId }).lean()
    if (!links.length) {
      return res.json({ categoryId, categoryName: category.name, filters: [] })
    }
    const filterIds = links.map((l) => l.filterId)
    const filters = await Filter.find({
      _id: { $in: filterIds },
      isDeleted: { $ne: true },
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean()

    res.json({
      categoryId,
      categoryName: category.name,
      filters: filters.map((f) => ({ _id: f._id, name: f.name, slug: f.slug })),
    })
  } catch (error) {
    console.error('Error fetching admin category-filters:', error)
    res.status(500).json({ message: 'Error fetching category filters' })
  }
})

// POST /api/admin/category-filters
// Body: { categoryId, filterIds: [..] }
// Replaces assignments for the given category
router.post('/category-filters', adminMiddleware, async (req, res) => {
  try {
    const { categoryId, filterIds } = req.body
    if (!categoryId || !Types.ObjectId.isValid(String(categoryId))) {
      return res.status(400).json({ message: 'Invalid or missing categoryId' })
    }
    if (!Array.isArray(filterIds)) {
      return res.status(400).json({ message: 'filterIds must be an array' })
    }

    const category = await Category.findById(categoryId).lean()
    if (!category) return res.status(404).json({ message: 'Category not found' })

    const validFilterIds = filterIds
      .filter((id) => id && Types.ObjectId.isValid(String(id)))
      .map((id) => new Types.ObjectId(id))

    // Optionally ensure filters exist and are not deleted
    if (validFilterIds.length) {
      const existingFilters = await Filter.find({
        _id: { $in: validFilterIds },
        isDeleted: { $ne: true },
      })
        .select('_id')
        .lean()
      const existingSet = new Set(existingFilters.map((f) => String(f._id)))
      // Filter out any IDs that don't correspond to active filters
      validFilterIds.splice(
        0,
        validFilterIds.length,
        ...validFilterIds.filter((id) => existingSet.has(String(id)))
      )
    }

    const existingLinks = await CategoryFilter.find({ categoryId }).lean()
    const existingSet = new Set(existingLinks.map((l) => String(l.filterId)))
    const incomingSet = new Set(validFilterIds.map((id) => String(id)))

    // Determine which links to add and which to remove
    const toAdd = [...incomingSet].filter((id) => !existingSet.has(id))
    const toRemove = [...existingSet].filter((id) => !incomingSet.has(id))

    if (toAdd.length) {
      const docs = toAdd.map((fid) => ({
        categoryId,
        filterId: fid,
      }))
      await CategoryFilter.insertMany(docs, { ordered: false })
    }
    if (toRemove.length) {
      await CategoryFilter.deleteMany({
        categoryId,
        filterId: { $in: toRemove.map((id) => new Types.ObjectId(id)) },
      })
    }

    const updatedLinks = await CategoryFilter.find({ categoryId }).lean()
    const updatedFilterIds = updatedLinks.map((l) => l.filterId)
    const filters = await Filter.find({
      _id: { $in: updatedFilterIds },
      isDeleted: { $ne: true },
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean()

    res.json({
      categoryId,
      categoryName: category.name,
      filters: filters.map((f) => ({ _id: f._id, name: f.name, slug: f.slug })),
    })
  } catch (error) {
    console.error('Error saving admin category-filters:', error)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Duplicate category-filter assignment' })
    }
    res.status(500).json({ message: 'Error saving category filters' })
  }
})

// ---------------------------------------------------------------------------
// Admin Roles - CRUD
// ---------------------------------------------------------------------------

// GET /api/admin/roles - list all roles
router.get('/roles', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query
    const skip = (Number(page) - 1) * Number(limit)
    const query = {}
    if (search && String(search).trim()) {
      query.role_name = new RegExp(String(search).trim(), 'i')
    }
    if (status === 'active' || status === 'inactive') query.status = status
    const [roles, total] = await Promise.all([
      AdminRole.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      AdminRole.countDocuments(query),
    ])
    res.json({
      roles,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore: skip + roles.length < total,
    })
  } catch (error) {
    console.error('Error fetching admin roles:', error)
    res.status(500).json({ message: 'Error fetching roles' })
  }
})

// GET /api/admin/roles/:id - get a single role
router.get('/roles/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const role = await AdminRole.findById(id).lean()
    if (!role) return res.status(404).json({ message: 'Role not found' })
    res.json(role)
  } catch (error) {
    console.error('Error fetching role:', error)
    res.status(500).json({ message: 'Error fetching role' })
  }
})

// POST /api/admin/roles - create a role
router.post('/roles', adminMiddleware, async (req, res) => {
  try {
    const { role_name, description, status = 'active' } = req.body
    if (!role_name || !String(role_name).trim()) {
      return res.status(400).json({ message: 'Role name is required' })
    }
    const existing = await AdminRole.findOne({ role_name: String(role_name).trim() })
    if (existing) {
      return res.status(400).json({ message: 'A role with this name already exists' })
    }
    const role = new AdminRole({
      role_name: String(role_name).trim(),
      description: description ? String(description).trim() : '',
      status,
    })
    await role.save()
    res.status(201).json(role)
  } catch (error) {
    console.error('Error creating role:', error)
    if (error.code === 11000) return res.status(400).json({ message: 'Role name already exists' })
    res.status(500).json({ message: 'Error creating role' })
  }
})

// PATCH /api/admin/roles/:id - update a role
router.patch('/roles/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const role = await AdminRole.findById(id)
    if (!role) return res.status(404).json({ message: 'Role not found' })
    const { role_name, description, status } = req.body
    if (role_name !== undefined) {
      const trimmed = String(role_name).trim()
      if (!trimmed) return res.status(400).json({ message: 'Role name cannot be empty' })
      const dup = await AdminRole.findOne({ role_name: trimmed, _id: { $ne: id } })
      if (dup) return res.status(400).json({ message: 'A role with this name already exists' })
      role.role_name = trimmed
    }
    if (description !== undefined) role.description = String(description).trim()
    if (status !== undefined) role.status = status
    await role.save()
    res.json(role)
  } catch (error) {
    console.error('Error updating role:', error)
    if (error.code === 11000) return res.status(400).json({ message: 'Role name already exists' })
    res.status(500).json({ message: 'Error updating role' })
  }
})

// DELETE /api/admin/roles/:id - delete a role and its permissions
router.delete('/roles/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const role = await AdminRole.findById(id)
    if (!role) return res.status(404).json({ message: 'Role not found' })
    const usersWithRole = await User.countDocuments({ adminRole: id })
    if (usersWithRole > 0) {
      return res.status(400).json({
        message: `Cannot delete role. ${usersWithRole} user(s) are assigned to this role.`,
      })
    }
    await AdminRolePermission.deleteMany({ role_id: id })
    await AdminRole.findByIdAndDelete(id)
    res.json({ message: 'Role deleted', deletedCount: 1 })
  } catch (error) {
    console.error('Error deleting role:', error)
    res.status(500).json({ message: 'Error deleting role' })
  }
})

// ---------------------------------------------------------------------------
// Admin Role Permissions
// ---------------------------------------------------------------------------

const AVAILABLE_MODULES = [
  'Dashboard',
  'Categories',
  'Filters',
  'Filter Assignments',
  'Dealers',
  'Emirates',
  'Packages',
  'Storage Facilities',
  'Coupons',
  'Form Fields',
  'Users',
  'Listings',
]

// GET /api/admin/roles/:id/permissions - get permissions for a role
router.get('/roles/:id/permissions', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const role = await AdminRole.findById(id).lean()
    if (!role) return res.status(404).json({ message: 'Role not found' })
    const permissions = await AdminRolePermission.find({ role_id: id }).lean()
    const permMap = {}
    permissions.forEach((p) => {
      permMap[p.module_name] = {
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      }
    })
    const result = AVAILABLE_MODULES.map((mod) => ({
      module_name: mod,
      can_view: permMap[mod]?.can_view || false,
      can_create: permMap[mod]?.can_create || false,
      can_edit: permMap[mod]?.can_edit || false,
      can_delete: permMap[mod]?.can_delete || false,
    }))
    res.json({ role, permissions: result, availableModules: AVAILABLE_MODULES })
  } catch (error) {
    console.error('Error fetching role permissions:', error)
    res.status(500).json({ message: 'Error fetching permissions' })
  }
})

// PUT /api/admin/roles/:id/permissions - save permissions for a role (bulk upsert)
router.put('/roles/:id/permissions', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const role = await AdminRole.findById(id)
    if (!role) return res.status(404).json({ message: 'Role not found' })
    const { permissions } = req.body
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'permissions must be an array' })
    }
    const ops = permissions.map((p) => ({
      updateOne: {
        filter: { role_id: id, module_name: p.module_name },
        update: {
          $set: {
            role_id: id,
            module_name: p.module_name,
            can_view: !!p.can_view,
            can_create: !!p.can_create,
            can_edit: !!p.can_edit,
            can_delete: !!p.can_delete,
          },
        },
        upsert: true,
      },
    }))
    if (ops.length) {
      await AdminRolePermission.bulkWrite(ops)
    }
    const updated = await AdminRolePermission.find({ role_id: id }).lean()
    res.json({ message: 'Permissions saved', permissions: updated })
  } catch (error) {
    console.error('Error saving role permissions:', error)
    res.status(500).json({ message: 'Error saving permissions' })
  }
})

// GET /api/admin/modules - return available modules list
router.get('/modules', adminMiddleware, async (req, res) => {
  res.json({ modules: AVAILABLE_MODULES })
})

// ---------------------------------------------------------------------------
// Update user admin role assignment
// ---------------------------------------------------------------------------

// PUT /api/admin/users/:id/admin-role - assign admin role to user
router.put('/users/:id/admin-role', adminMiddleware, async (req, res) => {
  try {
    const { adminRole } = req.body
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (adminRole) {
      if (!Types.ObjectId.isValid(adminRole)) {
        return res.status(400).json({ message: 'Invalid admin role ID' })
      }
      const roleDoc = await AdminRole.findById(adminRole)
      if (!roleDoc) return res.status(404).json({ message: 'Admin role not found' })
      user.adminRole = roleDoc._id
      if (user.role !== 'admin') {
        user.role = 'admin'
      }
    } else {
      user.adminRole = null
    }
    await user.save()
    const populated = await User.findById(user._id).populate('adminRole', 'role_name status')
    res.json({
      message: 'Admin role updated',
      user: {
        _id: populated._id,
        name: populated.name,
        email: populated.email,
        role: populated.role,
        adminRole: populated.adminRole,
      },
    })
  } catch (error) {
    console.error('Error updating user admin role:', error)
    res.status(500).json({ message: 'Error updating admin role' })
  }
})

// ---------------------------------------------------------------------------
// Field Types - CRUD
// ---------------------------------------------------------------------------

// GET /api/admin/field-types - list with pagination, search, sort
router.get('/field-types', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'sortOrder', sortDir = 'asc' } = req.query
    const skip = (Number(page) - 1) * Number(limit)
    const query = { isDeleted: false }
    if (search && String(search).trim()) {
      query.fieldValue = new RegExp(String(search).trim(), 'i')
    }
    const allowedSortFields = { sortOrder: 1, fieldValue: 1, createdAt: 1 }
    const sortField = allowedSortFields[sortBy] !== undefined ? sortBy : 'sortOrder'
    const sort = { [sortField]: sortDir === 'desc' ? -1 : 1 }
    const [fieldTypes, total] = await Promise.all([
      FieldType.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
      FieldType.countDocuments(query),
    ])
    res.json({
      fieldTypes,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore: skip + fieldTypes.length < total,
    })
  } catch (error) {
    console.error('Error fetching field types:', error)
    res.status(500).json({ message: 'Error fetching field types' })
  }
})

// GET /api/admin/field-types/:id - get single field type
router.get('/field-types/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const fieldType = await FieldType.findOne({ _id: id, isDeleted: false }).lean()
    if (!fieldType) return res.status(404).json({ message: 'Field type not found' })
    res.json(fieldType)
  } catch (error) {
    console.error('Error fetching field type:', error)
    res.status(500).json({ message: 'Error fetching field type' })
  }
})

// POST /api/admin/field-types - create
router.post('/field-types', adminMiddleware, async (req, res) => {
  try {
    const { fieldValue, sortOrder, isActive = true } = req.body
    if (!fieldValue || !String(fieldValue).trim()) {
      return res.status(400).json({ message: 'Field value is required' })
    }
    if (sortOrder === undefined || sortOrder === null || sortOrder === '') {
      return res.status(400).json({ message: 'Sort order is required' })
    }
    const parsedSortOrder = Number(sortOrder)
    if (Number.isNaN(parsedSortOrder)) {
      return res.status(400).json({ message: 'Sort order must be a number' })
    }
    const fieldType = new FieldType({
      fieldValue: String(fieldValue).trim(),
      sortOrder: parsedSortOrder,
      isActive: isActive !== false && isActive !== 'false',
    })
    await fieldType.save()
    res.status(201).json(fieldType)
  } catch (error) {
    console.error('Error creating field type:', error)
    res.status(500).json({ message: 'Error creating field type' })
  }
})

// PATCH /api/admin/field-types/:id - update
router.patch('/field-types/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const fieldType = await FieldType.findOne({ _id: id, isDeleted: false })
    if (!fieldType) return res.status(404).json({ message: 'Field type not found' })
    const { fieldValue, sortOrder, isActive } = req.body
    if (fieldValue !== undefined) {
      const trimmed = String(fieldValue).trim()
      if (!trimmed) return res.status(400).json({ message: 'Field value cannot be empty' })
      fieldType.fieldValue = trimmed
    }
    if (sortOrder !== undefined) {
      const parsed = Number(sortOrder)
      if (Number.isNaN(parsed)) return res.status(400).json({ message: 'Sort order must be a number' })
      fieldType.sortOrder = parsed
    }
    if (isActive !== undefined) {
      fieldType.isActive = isActive !== false && isActive !== 'false'
    }
    await fieldType.save()
    res.json(fieldType)
  } catch (error) {
    console.error('Error updating field type:', error)
    res.status(500).json({ message: 'Error updating field type' })
  }
})

// DELETE /api/admin/field-types/:id - soft delete
router.delete('/field-types/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const fieldType = await FieldType.findOne({ _id: id, isDeleted: false })
    if (!fieldType) return res.status(404).json({ message: 'Field type not found' })
    fieldType.isDeleted = true
    fieldType.isActive = false
    await fieldType.save()
    res.json({ message: 'Field type deleted successfully' })
  } catch (error) {
    console.error('Error deleting field type:', error)
    res.status(500).json({ message: 'Error deleting field type' })
  }
})

// ---------------------------------------------------------------------------
// Form Fields - CRUD
// ---------------------------------------------------------------------------

// Converts a human-readable title into snake_case field name
function toFieldName(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
}

async function findDuplicateFormFieldName(
  categoryId,
  fieldName,
  categoryFilterId = null,
  childCategoryId = null,
  excludeId = null
) {
  const query = buildDuplicateFormFieldQuery(
    categoryId,
    fieldName,
    categoryFilterId,
    childCategoryId,
    excludeId
  )
  return FormField.findOne(query)
}

async function buildFormFieldScopeLabel(categoryId, categoryFilterId = null, childCategoryId = null) {
  const category = await Category.findById(categoryId).select('name').lean()
  let scope = category?.name || 'this category'
  const filterObjId = normalizeCategoryFilterId(categoryFilterId)
  if (filterObjId) {
    const filterCat = await Category.findById(filterObjId).select('name').lean()
    if (filterCat?.name) scope = `${scope} → ${filterCat.name}`
  }
  const childObjId = normalizeChildCategoryId(childCategoryId)
  if (childObjId) {
    const childCat = await Category.findById(childObjId).select('name').lean()
    if (childCat?.name) scope = `${scope} → ${childCat.name}`
  }
  return scope
}

function sanitizeTableConfig(input) {
  if (input == null || input === '') return null
  if (typeof input !== 'object') return null

  const config = {}
  const fields = [
    'valueColumn', 'labelColumn', 'parentColumn', 'statusColumn',
    'sortColumn', 'slugColumn', 'deletedColumn',
  ]
  for (const key of fields) {
    if (input[key] !== undefined && input[key] !== null && String(input[key]).trim() !== '') {
      config[key] = String(input[key]).trim()
    }
  }
  if (input.activeValue !== undefined && input.activeValue !== null && input.activeValue !== '') {
    config.activeValue = input.activeValue
  }
  if (input.conditions && typeof input.conditions === 'object' && !Array.isArray(input.conditions)) {
    config.conditions = input.conditions
  }

  return Object.keys(config).length ? config : null
}

function validateFormFieldTableConfig(tableName, tableConfig) {
  const normalized = normalizeTableName(tableName)
  if (!normalized) return null

  if (!isRegisteredTable(normalized)) {
    const err = new Error(`Table "${tableName}" is not registered for dynamic option loading`)
    err.statusCode = 400
    throw err
  }

  const resolved = resolveTableConfig({ tableName: normalized, tableConfig: tableConfig || {} })
  if (resolved) {
    validateTableConfig(resolved)
  }
  return sanitizeTableConfig(tableConfig)
}

async function getRootFiltersForCategory(categoryId) {
  const category = await Category.findById(categoryId).lean()
  if (!category) return null

  const selectedLevelObjId = new Types.ObjectId(String(categoryId))
  let levelQuery = null
  if (category.level >= 2) levelQuery = { childCategoryId: selectedLevelObjId }
  else if (category.level === 1) levelQuery = { subcategoryId: selectedLevelObjId }
  else levelQuery = { categoryId: selectedLevelObjId }

  const directLevelFilters = await Filter.find({
    ...levelQuery,
    parentId: null,
    isDeleted: { $ne: true },
    isActive: { $ne: false },
  })
    .select('_id name slug sortOrder')
    .sort({ sortOrder: 1, name: 1 })
    .lean()

  const scopedCategories = await Category.find({
    isDeleted: false,
    $or: [{ _id: selectedLevelObjId }, { path: selectedLevelObjId }],
  })
    .select('_id')
    .lean()
  const scopedCategoryIds = scopedCategories.map((c) => c._id)
  const links = await CategoryFilter.find({ categoryId: { $in: scopedCategoryIds } })
    .select('filterId')
    .lean()
  const linkedFilterIds = [...new Set(links.map((l) => String(l.filterId)))]

  let linkedFilters = []
  if (linkedFilterIds.length) {
    linkedFilters = await Filter.find({
      _id: { $in: linkedFilterIds.map((id) => new Types.ObjectId(id)) },
      parentId: null,
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    })
      .select('_id name slug sortOrder')
      .sort({ sortOrder: 1, name: 1 })
      .lean()
  }

  const byId = new Map()
  for (const f of [...directLevelFilters, ...linkedFilters]) {
    byId.set(String(f._id), f)
  }

  return [...byId.values()].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name))
  )
}

// GET /api/admin/form-fields/option-tables - registered dynamic option source tables
router.get('/form-fields/option-tables', adminMiddleware, async (req, res) => {
  try {
    res.json({ tables: listRegisteredTables() })
  } catch (error) {
    console.error('Error fetching option tables:', error)
    res.status(500).json({ message: 'Error fetching option tables' })
  }
})

// GET /api/admin/form-fields/filters?categoryId=...
router.get('/form-fields/filters', adminMiddleware, async (req, res) => {
  try {
    const { categoryId } = req.query
    if (!categoryId || !Types.ObjectId.isValid(String(categoryId))) {
      return res.status(400).json({ message: 'Invalid or missing categoryId' })
    }

    const filters = await getRootFiltersForCategory(categoryId)
    if (filters === null) return res.status(404).json({ message: 'Category not found' })

    res.json({ filters: filters.map((f) => ({ _id: f._id, name: f.name, slug: f.slug })) })
  } catch (error) {
    console.error('Error fetching form-field filters:', error)
    res.status(500).json({ message: 'Error fetching filters for category' })
  }
})

// GET /api/admin/form-fields/dropdowns - fetch all dropdown data in one call
router.get('/form-fields/dropdowns', adminMiddleware, async (req, res) => {
  try {
    const [roots, children, fieldTypes] = await Promise.all([
      // Level 0 = root categories (shown as group headers + selectable "(root)" option)
      Category.find({ level: 0, isDeleted: false, isActive: true })
        .select('_id name sortOrder')
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
      // Level 1 = sub-categories (shown as indented children under their parent)
      Category.find({ level: 1, isDeleted: false, isActive: true })
        .select('_id name parentId sortOrder')
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
      FieldType.find({ isDeleted: false, isActive: true })
        .select('_id fieldValue sortOrder')
        .sort({ sortOrder: 1, fieldValue: 1 })
        .lean(),
    ])

    // Build grouped structure: each root carries its level-1 children
    const childrenByParent = {}
    children.forEach((c) => {
      const pid = String(c.parentId)
      if (!childrenByParent[pid]) childrenByParent[pid] = []
      childrenByParent[pid].push(c)
    })
    const categoryGroups = roots.map((root) => ({
      _id: root._id,
      name: root.name,
      children: childrenByParent[String(root._id)] || [],
    }))

    res.json({ categoryGroups, fieldTypes })
  } catch (error) {
    console.error('Error fetching form-field dropdowns:', error)
    res.status(500).json({ message: 'Error fetching dropdown data' })
  }
})

// GET /api/admin/form-fields - paginated list with search and filters
router.get('/form-fields', adminMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      categoryId,
      fieldTypeId,
      status,
      showOnQuickView,
      sortBy = 'formStep',
      sortDir = 'asc',
    } = req.query
    const skip = (Number(page) - 1) * Number(limit)
    const query = { isDeleted: false }

    if (categoryId && Types.ObjectId.isValid(categoryId)) {
      query.categoryId = categoryId
    }
    if (fieldTypeId && Types.ObjectId.isValid(fieldTypeId)) {
      query.fieldTypeId = fieldTypeId
    }
    if (status === 'active') {
      query.isActive = true
    } else if (status === 'inactive') {
      query.isActive = false
    }
    if (showOnQuickView === 'true') {
      query.showOnQuickView = true
    } else if (showOnQuickView === 'false') {
      query.showOnQuickView = false
    }

    if (search && String(search).trim()) {
      const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(escaped, 'i')
      const [matchingCategories, matchingFieldTypes] = await Promise.all([
        Category.find({ name: re, isDeleted: false }).select('_id').lean(),
        FieldType.find({ fieldValue: re, isDeleted: false }).select('_id').lean(),
      ])
      const orConditions = [{ fieldTitle: re }, { fieldName: re }]
      if (matchingCategories.length) {
        orConditions.push({ categoryId: { $in: matchingCategories.map((c) => c._id) } })
      }
      if (matchingFieldTypes.length) {
        orConditions.push({ fieldTypeId: { $in: matchingFieldTypes.map((ft) => ft._id) } })
      }
      query.$or = orConditions
    }

    const allowedSortFields = { formStep: 1, fieldOrder: 1, fieldTitle: 1, fieldName: 1, createdAt: 1 }
    const sortField = allowedSortFields[sortBy] !== undefined ? sortBy : 'formStep'
    const sort = { [sortField]: sortDir === 'desc' ? -1 : 1, fieldOrder: 1 }

    const [formFields, total, totalRecords] = await Promise.all([
      FormField.find(query)
        .populate('categoryId', 'name slug')
        .populate('fieldTypeId', 'fieldValue')
        .populate('filterId', 'name')
        .populate('categoryFilterId', 'name slug')
        .populate('childCategoryId', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      FormField.countDocuments(query),
      FormField.countDocuments({ isDeleted: false }),
    ])
    res.json({
      formFields,
      page: Number(page),
      limit: Number(limit),
      total,
      totalRecords,
      hasMore: skip + formFields.length < total,
    })
  } catch (error) {
    console.error('Error fetching form fields:', error)
    res.status(500).json({ message: 'Error fetching form fields' })
  }
})

// GET /api/admin/form-fields/:id - single form field
router.get('/form-fields/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const formField = await FormField.findOne({ _id: id, isDeleted: false })
      .populate('categoryId', 'name slug')
      .populate('fieldTypeId', 'fieldValue')
      .populate('filterId', 'name')
      .populate('categoryFilterId', 'name slug')
      .populate('childCategoryId', 'name slug')
      .lean()
    if (!formField) return res.status(404).json({ message: 'Form field not found' })
    res.json(formField)
  } catch (error) {
    console.error('Error fetching form field:', error)
    res.status(500).json({ message: 'Error fetching form field' })
  }
})

// POST /api/admin/form-fields - create
router.post('/form-fields', adminMiddleware, async (req, res) => {
  try {
    const {
      categoryId, fieldTypeId, filterId, categoryFilterId, childCategoryId,
      fieldTitle, placeholder, fieldName,
      fieldOrder, formStep, validation, tableName, tableConfig, functionName, isActive = true,
      showOnQuickView = false,
    } = req.body

    // Required field validation
    if (!categoryId || !Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: 'Valid category is required' })
    }
    if (!fieldTypeId || !Types.ObjectId.isValid(fieldTypeId)) {
      return res.status(400).json({ message: 'Valid field type is required' })
    }
    if (!fieldTitle || !String(fieldTitle).trim()) {
      return res.status(400).json({ message: 'Field title is required' })
    }

    // Auto-generate or sanitize fieldName
    const resolvedFieldName = fieldName && String(fieldName).trim()
      ? toFieldName(String(fieldName).trim())
      : toFieldName(fieldTitle)

    if (!resolvedFieldName) {
      return res.status(400).json({ message: 'Field name is required' })
    }

    const resolvedCategoryFilterId = normalizeCategoryFilterId(categoryFilterId)
    const resolvedChildCategoryId = normalizeChildCategoryId(childCategoryId)

    let resolvedTableConfig = null
    if (tableName && String(tableName).trim()) {
      resolvedTableConfig = validateFormFieldTableConfig(tableName, tableConfig)
    }

    // Unique fieldName check (scoped to category + optional category filter + child category)
    const existing = await findDuplicateFormFieldName(
      categoryId,
      resolvedFieldName,
      resolvedCategoryFilterId,
      resolvedChildCategoryId
    )
    if (existing) {
      const scope = await buildFormFieldScopeLabel(
        categoryId,
        resolvedCategoryFilterId,
        resolvedChildCategoryId
      )
      return res.status(400).json({
        message: `Field name "${resolvedFieldName}" is already in use for ${scope}`,
      })
    }

    const formField = new FormField({
      categoryId,
      fieldTypeId,
      filterId: filterId && Types.ObjectId.isValid(filterId) ? filterId : null,
      categoryFilterId: resolvedCategoryFilterId,
      childCategoryId: resolvedChildCategoryId,
      fieldTitle: String(fieldTitle).trim(),
      placeholder: placeholder ? String(placeholder).trim() : '',
      fieldName: resolvedFieldName,
      fieldOrder: Number.isNaN(Number(fieldOrder)) ? 0 : Number(fieldOrder),
      formStep: Number.isNaN(Number(formStep)) ? 1 : Number(formStep),
      validation: validation ? String(validation).trim() : '',
      tableName: tableName ? String(tableName).trim() : '',
      tableConfig: resolvedTableConfig,
      functionName: functionName ? String(functionName).trim() : '',
      isActive: isActive !== false && isActive !== 'false',
      showOnQuickView: showOnQuickView === true || showOnQuickView === 'true',
    })
    await formField.save()

    const populated = await FormField.findById(formField._id)
      .populate('categoryId', 'name slug')
      .populate('fieldTypeId', 'fieldValue')
      .populate('filterId', 'name')
      .populate('categoryFilterId', 'name slug')
      .populate('childCategoryId', 'name slug')
      .lean()

    res.status(201).json(populated)
  } catch (error) {
    console.error('Error creating form field:', error)
    if (error.statusCode === 400 || error.code) {
      return res.status(error.statusCode || 400).json({ message: error.message })
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Field name already exists for this category scope' })
    }
    res.status(500).json({ message: 'Error creating form field' })
  }
})

// PATCH /api/admin/form-fields/:id - update
router.patch('/form-fields/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const formField = await FormField.findOne({ _id: id, isDeleted: false })
    if (!formField) return res.status(404).json({ message: 'Form field not found' })

    const {
      categoryId, fieldTypeId, filterId, categoryFilterId, childCategoryId,
      fieldTitle, placeholder, fieldName,
      fieldOrder, formStep, validation, tableName, tableConfig, functionName, isActive, showOnQuickView,
    } = req.body

    if (categoryId !== undefined) {
      if (!Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ message: 'Valid category is required' })
      }
      formField.categoryId = categoryId
    }
    if (fieldTypeId !== undefined) {
      if (!Types.ObjectId.isValid(fieldTypeId)) {
        return res.status(400).json({ message: 'Valid field type is required' })
      }
      formField.fieldTypeId = fieldTypeId
    }
    if (filterId !== undefined) {
      formField.filterId = filterId && Types.ObjectId.isValid(filterId) ? filterId : null
    }
    if (categoryFilterId !== undefined) {
      formField.categoryFilterId = normalizeCategoryFilterId(categoryFilterId)
    }
    if (childCategoryId !== undefined) {
      formField.childCategoryId = normalizeChildCategoryId(childCategoryId)
    }
    if (fieldTitle !== undefined) {
      const trimmed = String(fieldTitle).trim()
      if (!trimmed) return res.status(400).json({ message: 'Field title cannot be empty' })
      formField.fieldTitle = trimmed
    }
    if (fieldName !== undefined) {
      const sanitized = toFieldName(String(fieldName).trim())
      if (!sanitized) return res.status(400).json({ message: 'Field name cannot be empty' })
      formField.fieldName = sanitized
    }
    if (placeholder !== undefined) formField.placeholder = String(placeholder).trim()
    if (fieldOrder !== undefined) formField.fieldOrder = Number.isNaN(Number(fieldOrder)) ? 0 : Number(fieldOrder)
    if (formStep !== undefined) formField.formStep = Number.isNaN(Number(formStep)) ? 1 : Number(formStep)
    if (validation !== undefined) formField.validation = String(validation).trim()
    if (tableName !== undefined) formField.tableName = String(tableName).trim()
    if (tableConfig !== undefined || tableName !== undefined) {
      const nextTableName = tableName !== undefined ? formField.tableName : formField.tableName
      if (nextTableName) {
        formField.tableConfig = validateFormFieldTableConfig(nextTableName, tableConfig !== undefined ? tableConfig : formField.tableConfig)
      } else {
        formField.tableConfig = sanitizeTableConfig(tableConfig)
      }
    }
    if (functionName !== undefined) formField.functionName = String(functionName).trim()
    if (isActive !== undefined) formField.isActive = isActive !== false && isActive !== 'false'
    if (showOnQuickView !== undefined) {
      formField.showOnQuickView = showOnQuickView === true || showOnQuickView === 'true'
    }

    const dup = await findDuplicateFormFieldName(
      formField.categoryId,
      formField.fieldName,
      formField.categoryFilterId,
      formField.childCategoryId,
      id
    )
    if (dup) {
      const scope = await buildFormFieldScopeLabel(
        formField.categoryId,
        formField.categoryFilterId,
        formField.childCategoryId
      )
      return res.status(400).json({
        message: `Field name "${formField.fieldName}" is already in use for ${scope}`,
      })
    }

    await formField.save()

    const populated = await FormField.findById(formField._id)
      .populate('categoryId', 'name slug')
      .populate('fieldTypeId', 'fieldValue')
      .populate('filterId', 'name')
      .populate('categoryFilterId', 'name slug')
      .populate('childCategoryId', 'name slug')
      .lean()

    res.json(populated)
  } catch (error) {
    console.error('Error updating form field:', error)
    if (error.statusCode === 400 || error.code) {
      return res.status(error.statusCode || 400).json({ message: error.message })
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Field name already exists for this category scope' })
    }
    res.status(500).json({ message: 'Error updating form field' })
  }
})

// DELETE /api/admin/form-fields/:id - soft delete
router.delete('/form-fields/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const formField = await FormField.findOne({ _id: id, isDeleted: false })
    if (!formField) return res.status(404).json({ message: 'Form field not found' })
    formField.isDeleted = true
    formField.isActive = false
    await formField.save()
    res.json({ message: 'Form field deleted successfully' })
  } catch (error) {
    console.error('Error deleting form field:', error)
    res.status(500).json({ message: 'Error deleting form field' })
  }
})

module.exports = router

