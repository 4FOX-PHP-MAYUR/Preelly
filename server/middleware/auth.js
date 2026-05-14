const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { getJwtFromRequest } = require('../utils/authToken')

const authMiddleware = async (req, res, next) => {
  try {
    const token = getJwtFromRequest(req)

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    const user = await User.findById(decoded.userId).select('-password')

    if (!user) {
      return res.status(401).json({ message: 'User not found' })
    }

    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

module.exports = authMiddleware

