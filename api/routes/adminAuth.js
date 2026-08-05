const express = require('express')
const jwt = require('jsonwebtoken')
const router = express.Router()

const AdminUser = require('../models/AdminUser')
const adminMiddleware = require('../middleware/admin')
const { isSuperAdminRole, buildFullPermissionSet } = require('../config/adminPermissions')
const { getPermissionMapForRole } = require('../services/adminPermissionService')

/**
 * Admin Panel authentication — completely independent of the marketplace
 * `/api/auth` (OTP, `users` collection) flow. Email + password against the
 * dedicated `admin_users` collection only.
 */

const JWT_SECRET = () => process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = () => process.env.ADMIN_JWT_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '7d'

function generateAdminToken(adminUserId) {
  return jwt.sign({ adminUserId }, JWT_SECRET(), { expiresIn: JWT_EXPIRES_IN() })
}

async function buildPermissionsForAdmin(adminUser) {
  if (!adminUser.adminRole) return null
  if (isSuperAdminRole(adminUser.adminRole)) {
    const permissions = {}
    buildFullPermissionSet().forEach((p) => {
      permissions[p.module_name] = {
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
      }
    })
    return permissions
  }
  const roleId = adminUser.adminRole?._id || adminUser.adminRole
  return getPermissionMapForRole(roleId)
}

function serializeAdminUser(adminUser) {
  return {
    _id: adminUser._id,
    name: adminUser.name,
    email: adminUser.email,
    phone: adminUser.phone,
    avatar: adminUser.avatar,
    status: adminUser.status,
    adminRole: adminUser.adminRole,
    lastLoginAt: adminUser.lastLoginAt,
  }
}

// POST /api/admin/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const adminUser = await AdminUser.findOne({ email: normalizedEmail, isDeleted: { $ne: true } })
      .select('+password')
      .populate('adminRole')
    if (!adminUser) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }
    if (adminUser.status !== 'active') {
      return res.status(403).json({ message: 'This admin account has been deactivated' })
    }

    const matches = await adminUser.comparePassword(password)
    if (!matches) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    adminUser.lastLoginAt = new Date()
    await adminUser.save()

    const token = generateAdminToken(adminUser._id)
    const permissions = await buildPermissionsForAdmin(adminUser)

    res.json({
      message: 'Login successful',
      token,
      adminUser: serializeAdminUser(adminUser),
      permissions,
    })
  } catch (error) {
    console.error('Error logging in admin user:', error)
    res.status(500).json({ message: 'Error logging in' })
  }
})

// POST /api/admin/auth/logout — stateless JWT, nothing to invalidate server-side.
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' })
})

// GET /api/admin/auth/me — session restore on app load
router.get('/me', adminMiddleware, async (req, res) => {
  try {
    const permissions = await buildPermissionsForAdmin(req.user)
    res.json({ adminUser: serializeAdminUser(req.user), permissions })
  } catch (error) {
    console.error('Error fetching admin session:', error)
    res.status(500).json({ message: 'Error fetching session' })
  }
})

// PATCH /api/admin/auth/change-password
router.patch('/change-password', adminMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' })
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' })
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'New password and confirmation do not match' })
    }

    const adminUser = await AdminUser.findById(req.user._id).select('+password')
    const matches = await adminUser.comparePassword(currentPassword)
    if (!matches) {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }

    adminUser.password = newPassword
    await adminUser.save()

    res.json({ message: 'Password updated' })
  } catch (error) {
    console.error('Error changing admin password:', error)
    res.status(500).json({ message: 'Error changing password' })
  }
})

module.exports = router
