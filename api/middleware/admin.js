const jwt = require('jsonwebtoken')
const AdminUser = require('../models/AdminUser')
const { getAdminAuthTokensFromRequest } = require('../utils/adminAuthToken')

/**
 * Gates every /api/admin/* route. Authenticates exclusively against the
 * dedicated `admin_users` collection — completely independent of the
 * marketplace `users` collection / customer JWTs. A marketplace customer's
 * token will never satisfy this middleware: admin tokens are signed with an
 * `adminUserId` claim (not `userId`), and even a forged/borrowed `userId`
 * claim would not resolve to any document in `admin_users`.
 */
const adminMiddleware = async (req, res, next) => {
  try {
    const tokens = getAdminAuthTokensFromRequest(req)
    if (!tokens.length) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key'
    let decoded = null
    for (const token of tokens) {
      try {
        const payload = jwt.verify(token, secret)
        if (payload?.adminUserId) {
          decoded = payload
          break
        }
      } catch {
        // try next candidate token
      }
    }

    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    const adminUser = await AdminUser.findById(decoded.adminUserId).select('-password').populate('adminRole')

    if (!adminUser) {
      return res.status(401).json({ message: 'Admin user not found' })
    }

    if (adminUser.isDeleted) {
      return res.status(403).json({ message: 'This admin account has been removed' })
    }

    if (adminUser.status !== 'active') {
      return res.status(403).json({ message: 'This admin account has been deactivated' })
    }

    req.user = adminUser
    next()
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

module.exports = adminMiddleware
