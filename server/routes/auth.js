const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const User = require('../models/User')
const AdminRolePermission = require('../models/AdminRolePermission')
const EmailOtp = require('../models/EmailOtp')
const { body, validationResult } = require('express-validator')
const { sendEmail } = require('../utils/mailer')
const { getCookieName, getCookieClearOptions, setJwtCookie } = require('../utils/jwt')

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

const OTP_PURPOSE = 'register'
const OTP_LENGTH = Number(process.env.EMAIL_OTP_LENGTH || 6)
const OTP_TTL_SECONDS = Number(process.env.EMAIL_OTP_TTL_SECONDS || 600) // 10 minutes
const OTP_MAX_ATTEMPTS = Number(process.env.EMAIL_OTP_MAX_ATTEMPTS || 5)
const OTP_LOCK_SECONDS = Number(process.env.EMAIL_OTP_LOCK_SECONDS || 900) // 15 minutes

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

const generateOtpCode = () => {
  const min = 10 ** (OTP_LENGTH - 1)
  const max = 10 ** OTP_LENGTH - 1
  return String(Math.floor(Math.random() * (max - min + 1)) + min)
}

const hashOtp = (otpCode) => crypto.createHash('sha256').update(String(otpCode)).digest('hex')

const sendRegistrationOtp = async (email) => {
  const code = generateOtpCode()
  const otpHash = hashOtp(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000)

  await EmailOtp.findOneAndUpdate(
    { email, purpose: OTP_PURPOSE },
    { otpHash, expiresAt, attempts: 0, lockedUntil: null },
    { upsert: true, new: true }
  )

  const subject = 'Your Preelly verification code'
  const text = `Your verification code is: ${code}\n\nThis code will expire in ${Math.ceil(
    OTP_TTL_SECONDS / 60
  )} minutes.`
  const html = `<p>Your verification code is:</p><h2 style="margin: 0 0 12px 0;">${code}</h2><p>It expires in ${Math.ceil(
    OTP_TTL_SECONDS / 60
  )} minutes.</p>`

  await sendEmail({ to: email, subject, text, html })
}

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { name, email, phone, password } = req.body
      const normalizedEmail = normalizeEmail(email)
      const normalizedPhone = String(phone).trim()

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
      })

      if (existingUser) {
        if (existingUser.isVerified) {
          return res.status(400).json({ message: 'User already exists' })
        }

        await sendRegistrationOtp(existingUser.email)
        return res.status(200).json({
          message: 'Verification code sent to your email',
          verificationRequired: true,
          email: existingUser.email,
          user: {
            _id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            phone: existingUser.phone,
            role: existingUser.role,
            avatar: existingUser.avatar,
            isVerified: existingUser.isVerified,
          isProfileComplete: existingUser.isProfileComplete,
          },
        })
      }

      // Create new user
      const user = new User({
        name,
        email: normalizedEmail,
        phone: normalizedPhone,
        password,
      })
      await user.save()

      await sendRegistrationOtp(user.email)

      return res.status(201).json({
        message: 'User registered successfully. Verify your email to login.',
        verificationRequired: true,
        email: user.email,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          isVerified: user.isVerified,
          isProfileComplete: user.isProfileComplete,
        },
      })
    } catch (error) {
      console.error('Registration error:', error)
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Email or phone already exists' })
      }
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message })
      }
      if (String(error.message || '').includes('GOOGLE_SMTP_USER')) {
        return res
          .status(500)
          .json({ message: 'Email service is not configured (Google SMTP env vars missing)' })
      }
      res.status(500).json({ message: 'Server error during registration' })
    }
  }
)

// @route   POST /api/auth/send-email-otp
// @desc    Send email verification OTP
// @access  Public
router.post(
  '/send-email-otp',
  [body('email').isEmail().withMessage('Please enter a valid email')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const email = normalizeEmail(req.body.email)
      const user = await User.findOne({ email })
      if (!user) return res.status(404).json({ message: 'User not found' })
      if (user.isVerified) {
        return res.status(200).json({ message: 'Email already verified', verificationRequired: false })
      }

      await sendRegistrationOtp(email)
      return res.status(200).json({ message: 'Verification code sent', verificationRequired: true, email })
    } catch (error) {
      console.error('Send-email-otp error:', error)
      res.status(500).json({ message: 'Server error while sending OTP' })
    }
  }
)

// @route   POST /api/auth/verify-email-otp
// @desc    Verify email OTP and mark user verified
// @access  Public
router.post(
  '/verify-email-otp',
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

      const email = normalizeEmail(req.body.email)
      const otp = String(req.body.otp || '').trim()

      const record = await EmailOtp.findOne({ email, purpose: OTP_PURPOSE }).select('+otpHash')
      if (!record) return res.status(400).json({ message: 'Invalid or expired verification code' })

      const now = Date.now()
      if (record.lockedUntil && record.lockedUntil.getTime() > now) {
        return res.status(429).json({ message: 'Too many attempts. Please wait and try again.' })
      }

      if (!record.expiresAt || record.expiresAt.getTime() < now) {
        return res.status(400).json({ message: 'Invalid or expired verification code' })
      }

      const isMatch = hashOtp(otp) === record.otpHash
      if (!isMatch) {
        record.attempts = (record.attempts || 0) + 1
        if (record.attempts >= OTP_MAX_ATTEMPTS) {
          record.lockedUntil = new Date(Date.now() + OTP_LOCK_SECONDS * 1000)
        }
        await record.save()
        return res.status(400).json({ message: 'Invalid verification code' })
      }

      const user = await User.findOne({ email })
      if (!user) return res.status(400).json({ message: 'User not found' })

      user.isVerified = true
      await user.save()
      await EmailOtp.deleteOne({ _id: record._id })

      const token = generateToken(user._id)
      // Set secure HTTP-only cookie for the SPA.
      // Keep token in JSON response as well to avoid breaking the existing frontend.
      setJwtCookie(res, token)
      return res.json({
        message: 'Email verified successfully',
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          isVerified: true,
          isProfileComplete: user.isProfileComplete,
        },
      })
    } catch (error) {
      console.error('Verify-email-otp error:', error)
      res.status(500).json({ message: 'Server error while verifying OTP' })
    }
  }
)

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  [
    body('email').notEmpty().withMessage('Email or phone is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const { email, password } = req.body

      // Find user by email or phone
      const user = await User.findOne({
        $or: [{ email }, { phone: email }],
      }).select('+password')

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      // Check password
      const isMatch = await user.comparePassword(password)
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      // Block non-verified users (admins are auto-verified via pre-save hook)
      if (!user.isVerified && user.role !== 'admin') {
        return res.status(403).json({ message: 'Please verify your email address before logging in' })
      }

      const token = generateToken(user._id)
      // Prefer secure HTTP-only cookie for the SPA.
      setJwtCookie(res, token)

      let permissions = null
      let adminRoleData = null
      if (user.role === 'admin' && user.adminRole) {
        const populated = await User.findById(user._id).populate('adminRole', 'role_name status')
        adminRoleData = populated.adminRole
        const perms = await AdminRolePermission.find({ role_id: user.adminRole }).lean()
        const permMap = {}
        perms.forEach((p) => {
          permMap[p.module_name] = {
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
          }
        })
        permissions = permMap
      }

      res.json({
        message: 'Login successful',
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          isVerified: user.isVerified,
          isProfileComplete: user.isProfileComplete,
          adminRole: adminRoleData,
          permissions,
        },
      })
    } catch (error) {
      console.error('Login error:', error)
      res.status(500).json({ message: 'Server error during login' })
    }
  }
)

// @route   POST /api/auth/logout
// @desc    Clear JWT cookie (HTTP-only) and finish logout.
// @access  Public
router.post('/logout', (req, res) => {
  try {
    const cookieName = getCookieName()
    res.clearCookie(cookieName, getCookieClearOptions())
    return res.json({ message: 'Logged out' })
  } catch (e) {
    return res.status(200).json({ message: 'Logged out' })
  }
})

module.exports = router

