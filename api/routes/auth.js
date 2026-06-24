const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const User = require('../models/User')
const AdminRolePermission = require('../models/AdminRolePermission')
const EmailOtp = require('../models/EmailOtp')
const PhoneOtp = require('../models/PhoneOtp')
const { body, validationResult } = require('express-validator')
const { sendEmail } = require('../utils/mailer')
const { sendWhatsAppOtp, normalizePhoneForWhatsApp } = require('../utils/whatsapp')
const {
  phoneDigitsOnly,
  phonesMatch,
  parsePhoneInput,
  applyPhoneFieldsToUser,
  maybeUpgradeUserPhone,
} = require('../utils/phone')
const { getCookieName, getCookieClearOptions, setJwtCookie } = require('../utils/jwt')

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

const OTP_PURPOSES = {
  REGISTER: 'register',
  PASSWORD_RESET: 'password_reset',
  LOGIN: 'login',
}
const OTP_LENGTH = Number(process.env.EMAIL_OTP_LENGTH || 6)
const OTP_TTL_SECONDS = Number(process.env.EMAIL_OTP_TTL_SECONDS || 600) // 10 minutes
const OTP_MAX_ATTEMPTS = Number(process.env.EMAIL_OTP_MAX_ATTEMPTS || 5)
const OTP_LOCK_SECONDS = Number(process.env.EMAIL_OTP_LOCK_SECONDS || 900) // 15 minutes
const PASSWORD_RESET_TOKEN_TTL = process.env.PASSWORD_RESET_TOKEN_TTL || '15m'
const MOBILE_OTP_ENABLED = process.env.ENABLE_MOBILE_OTP === 'true'

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const normalizePhone = (value) => String(value || '').trim()
const isEmailLike = (value) => /^\S+@\S+\.\S+$/.test(String(value || '').trim())

const findUserByPhone = async (phone) => {
  let digits
  try {
    digits = phoneDigitsOnly(phone)
  } catch {
    return null
  }

  const trimmed = normalizePhone(phone)
  let user = await User.findOne({
    $or: [{ phone: trimmed }, { phone: digits }, { phone: `+${digits}` }],
  })
  if (user) return user

  const candidates = await User.find({ phone: { $exists: true, $nin: [null, ''] } }).select(
    'phone phoneCountryCode phoneCountryIso name email role avatar isVerified isEmailVerified isPhoneVerified isProfileComplete status adminRole'
  )

  return candidates.find((candidate) => phonesMatch(digits, candidate.phone)) || null
}

const generateOtpCode = () => {
  const min = 10 ** (OTP_LENGTH - 1)
  const max = 10 ** OTP_LENGTH - 1
  return String(Math.floor(Math.random() * (max - min + 1)) + min)
}

const hashOtp = (otpCode) => crypto.createHash('sha256').update(String(otpCode)).digest('hex')

const getVerificationState = (user) => {
  const emailVerified =
    typeof user.isEmailVerified === 'boolean'
      ? user.isEmailVerified
      : Boolean(user.isVerified)
  const phoneVerified =
    !MOBILE_OTP_ENABLED
      ? true
      : typeof user.isPhoneVerified === 'boolean'
      ? user.isPhoneVerified
      : Boolean(user.isVerified && user.phone)
  const isVerified = user.role === 'admin' ? true : Boolean(emailVerified && phoneVerified)

  return { emailVerified, phoneVerified, isVerified }
}

const serializeUser = (user) => {
  const verification = getVerificationState(user)

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    phoneCountryCode: user.phoneCountryCode || null,
    phoneCountryIso: user.phoneCountryIso || null,
    role: user.role,
    avatar: user.avatar,
    isVerified: verification.isVerified,
    isEmailVerified: verification.emailVerified,
    isPhoneVerified: verification.phoneVerified,
    isProfileComplete: user.isProfileComplete,
  }
}

const persistVerificationState = async (user, updates = {}) => {
  const current = getVerificationState(user)

  user.isEmailVerified =
    updates.isEmailVerified !== undefined ? updates.isEmailVerified : current.emailVerified
  user.isPhoneVerified =
    !MOBILE_OTP_ENABLED
      ? true
      : updates.isPhoneVerified !== undefined
      ? updates.isPhoneVerified
      : current.phoneVerified
  user.isVerified = user.role === 'admin' ? true : Boolean(user.isEmailVerified && user.isPhoneVerified)

  await user.save()
  return getVerificationState(user)
}

const sendAuthSuccess = (res, user, message) => {
  const token = generateToken(user._id)
  setJwtCookie(res, token)

  return res.json({
    message,
    token,
    user: serializeUser(user),
  })
}

const generatePasswordResetToken = (userId) => {
  return jwt.sign(
    { userId, purpose: OTP_PURPOSES.PASSWORD_RESET },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: PASSWORD_RESET_TOKEN_TTL }
  )
}

const sendRegistrationOtp = async (email) => {
  const code = generateOtpCode()
  const otpHash = hashOtp(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000)

  await EmailOtp.findOneAndUpdate(
    { email, purpose: OTP_PURPOSES.REGISTER },
    { otpHash, expiresAt, attempts: 0, lockedUntil: null },
    { upsert: true, returnDocument: 'after' }
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

const sendPasswordResetOtp = async (email) => {
  const code = generateOtpCode()
  const otpHash = hashOtp(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000)

  await EmailOtp.findOneAndUpdate(
    { email, purpose: OTP_PURPOSES.PASSWORD_RESET },
    { otpHash, expiresAt, attempts: 0, lockedUntil: null },
    { upsert: true, returnDocument: 'after' }
  )

  const subject = 'Your Preelly password reset code'
  const text = `Your password reset code is: ${code}\n\nUse this code to verify your identity. It will expire in ${Math.ceil(
    OTP_TTL_SECONDS / 60
  )} minutes.`
  const html = `<p>Your password reset code is:</p><h2 style="margin: 0 0 12px 0;">${code}</h2><p>Use this code to verify your identity and continue resetting your password.</p><p>It expires in ${Math.ceil(
    OTP_TTL_SECONDS / 60
  )} minutes.</p>`

  await sendEmail({ to: email, subject, text, html })
}

const sendLoginOtp = async (email) => {
  const code = generateOtpCode()
  const otpHash = hashOtp(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000)

  await EmailOtp.findOneAndUpdate(
    { email, purpose: OTP_PURPOSES.LOGIN },
    { otpHash, expiresAt, attempts: 0, lockedUntil: null },
    { upsert: true, returnDocument: 'after' }
  )

  const subject = 'Your Preelly sign-in code'
  const text = `Your sign-in code is: ${code}\n\nThis code will expire in ${Math.ceil(
    OTP_TTL_SECONDS / 60
  )} minutes.`
  const html = `<p>Your sign-in code is:</p><h2 style="margin: 0 0 12px 0;">${code}</h2><p>It expires in ${Math.ceil(
    OTP_TTL_SECONDS / 60
  )} minutes.</p>`

  await sendEmail({ to: email, subject, text, html })
}

const sendLoginPhoneOtp = async (phone) => {
  const phoneKey = phoneDigitsOnly(phone)
  const code = generateOtpCode()
  const otpHash = hashOtp(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000)

  await PhoneOtp.findOneAndUpdate(
    { phone: phoneKey, purpose: OTP_PURPOSES.LOGIN },
    { otpHash, expiresAt, attempts: 0, lockedUntil: null },
    { upsert: true, returnDocument: 'after' }
  )

  await sendWhatsAppOtp({ to: phoneKey, code })
}

const verifyStoredEmailOtp = async (email, otp, purpose) => {
  const record = await EmailOtp.findOne({ email, purpose }).select('+otpHash')
  if (!record) return { ok: false, status: 400, message: 'Invalid or expired verification code' }

  const now = Date.now()
  if (record.lockedUntil && record.lockedUntil.getTime() > now) {
    return { ok: false, status: 429, message: 'Too many attempts. Please wait and try again.' }
  }

  if (!record.expiresAt || record.expiresAt.getTime() < now) {
    return { ok: false, status: 400, message: 'Invalid or expired verification code' }
  }

  const isMatch = hashOtp(String(otp || '').trim()) === record.otpHash
  if (!isMatch) {
    record.attempts = (record.attempts || 0) + 1
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      record.lockedUntil = new Date(Date.now() + OTP_LOCK_SECONDS * 1000)
    }
    await record.save()
    return { ok: false, status: 400, message: 'Invalid verification code' }
  }

  await EmailOtp.deleteOne({ _id: record._id })
  return { ok: true }
}

const verifyStoredPhoneOtp = async (phone, otp, purpose) => {
  const phoneKey = phoneDigitsOnly(phone)
  const record = await PhoneOtp.findOne({ phone: phoneKey, purpose }).select('+otpHash')
  if (!record) return { ok: false, status: 400, message: 'Invalid or expired verification code' }

  const now = Date.now()
  if (record.lockedUntil && record.lockedUntil.getTime() > now) {
    return { ok: false, status: 429, message: 'Too many attempts. Please wait and try again.' }
  }

  if (!record.expiresAt || record.expiresAt.getTime() < now) {
    return { ok: false, status: 400, message: 'Invalid or expired verification code' }
  }

  const isMatch = hashOtp(String(otp || '').trim()) === record.otpHash
  if (!isMatch) {
    record.attempts = (record.attempts || 0) + 1
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      record.lockedUntil = new Date(Date.now() + OTP_LOCK_SECONDS * 1000)
    }
    await record.save()
    return { ok: false, status: 400, message: 'Invalid verification code' }
  }

  await PhoneOtp.deleteOne({ _id: record._id })
  return { ok: true }
}

const sendAuthSuccessWithPermissions = async (res, user, message) => {
  const token = generateToken(user._id)
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

  return res.json({
    message,
    token,
    user: {
      ...serializeUser(user),
      adminRole: adminRoleData,
      permissions,
    },
  })
}

const deriveNameFromEmail = (email) => {
  const localPart = String(email || '').split('@')[0] || 'User'
  const cleaned = localPart.replace(/[._+-]+/g, ' ').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'User'
}

const sendRegistrationPhoneOtp = async (phone) => {
  const code = generateOtpCode()
  const otpHash = hashOtp(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000)

  await PhoneOtp.findOneAndUpdate(
    { phone, purpose: OTP_PURPOSES.REGISTER },
    { otpHash, expiresAt, attempts: 0, lockedUntil: null },
    { upsert: true, returnDocument: 'after' }
  )

  await sendWhatsAppOtp({ to: phone, code })
}

const sendPasswordResetPhoneOtp = async (phone) => {
  const code = generateOtpCode()
  const otpHash = hashOtp(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000)

  await PhoneOtp.findOneAndUpdate(
    { phone, purpose: OTP_PURPOSES.PASSWORD_RESET },
    { otpHash, expiresAt, attempts: 0, lockedUntil: null },
    { upsert: true, returnDocument: 'after' }
  )

  await sendWhatsAppOtp({ to: phone, code })
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
    body('phoneCountryCode').optional().trim(),
    body('phoneCountryIso').optional().trim(),
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
      const parsedPhone = parsePhoneInput({
        phone,
        phoneCountryCode: req.body.phoneCountryCode,
        phoneCountryIso: req.body.phoneCountryIso,
      })

      const existingByEmail = await User.findOne({ email: normalizedEmail })
      const existingByPhone = parsedPhone.phoneDigits
        ? await findUserByPhone(parsedPhone.phoneDigits)
        : null
      const existingUser = existingByEmail || existingByPhone

      if (existingUser) {
        if (getVerificationState(existingUser).isVerified) {
          return res.status(400).json({ message: 'User already exists' })
        }

        await sendRegistrationOtp(existingUser.email)
        return res.status(200).json({
          message: MOBILE_OTP_ENABLED
            ? 'Verification codes sent to your email and mobile number'
            : 'Verification code sent to your email',
          verificationRequired: true,
          email: existingUser.email,
          phone: existingUser.phone,
          nextStep: 'email',
          user: serializeUser(existingUser),
        })
      }

      // Create new user
      const user = new User({
        name,
        email: normalizedEmail,
        phone: parsedPhone.phoneDigits,
        phoneCountryCode: parsedPhone.phoneCountryCode,
        phoneCountryIso: parsedPhone.phoneCountryIso,
        password,
        isVerified: false,
        isEmailVerified: false,
        isPhoneVerified: !MOBILE_OTP_ENABLED,
      })
      await user.save()

      await sendRegistrationOtp(user.email)
      if (MOBILE_OTP_ENABLED) {
        await sendRegistrationPhoneOtp(user.phone)
      }

      return res.status(201).json({
        message: MOBILE_OTP_ENABLED
          ? 'User registered successfully. Verify your email and mobile number to continue.'
          : 'User registered successfully. Verify your email to continue.',
        verificationRequired: true,
        email: user.email,
        phone: user.phone,
        nextStep: 'email',
        user: serializeUser(user),
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
      if (String(error.message || '').includes('WABA_')) {
        return res
          .status(500)
          .json({ message: 'WhatsApp OTP service is not configured (WABA env vars missing)' })
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
      if (getVerificationState(user).emailVerified) {
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

// @route   POST /api/auth/send-phone-otp
// @desc    Send signup mobile verification OTP via WhatsApp
// @access  Public
router.post(
  '/send-phone-otp',
  [body('phone').trim().notEmpty().withMessage('Phone number is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const phone = normalizePhone(req.body.phone)
      const user = await findUserByPhone(phone)
      if (!user) return res.status(404).json({ message: 'User not found' })
      if (getVerificationState(user).phoneVerified) {
        return res.status(200).json({ message: 'Mobile number already verified', verificationRequired: false })
      }

      await sendRegistrationPhoneOtp(phone)
      return res.status(200).json({ message: 'Verification code sent', verificationRequired: true, phone })
    } catch (error) {
      console.error('Send-phone-otp error:', error)
      if (String(error.message || '').includes('WABA_')) {
        return res
          .status(500)
          .json({ message: 'WhatsApp OTP service is not configured (WABA env vars missing)' })
      }
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

      const record = await EmailOtp.findOne({ email, purpose: OTP_PURPOSES.REGISTER }).select('+otpHash')
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

      const verification = await persistVerificationState(user, { isEmailVerified: true })
      await EmailOtp.deleteOne({ _id: record._id })

      if (!verification.phoneVerified) {
        return res.status(200).json({
          message: 'Email verified successfully. Please verify your mobile number to continue.',
          verificationRequired: true,
          nextStep: 'phone',
          email: user.email,
          phone: user.phone,
          user: serializeUser(user),
        })
      }

      return sendAuthSuccess(res, user, 'Email verified successfully')
    } catch (error) {
      console.error('Verify-email-otp error:', error)
      res.status(500).json({ message: 'Server error while verifying OTP' })
    }
  }
)

// @route   POST /api/auth/verify-phone-otp
// @desc    Verify signup mobile OTP (WhatsApp) and mark user verified
// @access  Public
router.post(
  '/verify-phone-otp',
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

      const phone = normalizePhone(req.body.phone)
      const otp = String(req.body.otp || '').trim()

      const record = await PhoneOtp.findOne({ phone, purpose: OTP_PURPOSES.REGISTER }).select('+otpHash')
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

      const user = await findUserByPhone(phone)
      if (!user) return res.status(400).json({ message: 'User not found' })

      const verification = await persistVerificationState(user, { isPhoneVerified: true })
      await PhoneOtp.deleteOne({ _id: record._id })

      if (!verification.emailVerified) {
        return res.status(200).json({
          message: 'Mobile number verified successfully. Please verify your email to continue.',
          verificationRequired: true,
          nextStep: 'email',
          email: user.email,
          phone: user.phone,
          user: serializeUser(user),
        })
      }

      return sendAuthSuccess(res, user, 'Mobile number verified successfully')
    } catch (error) {
      console.error('Verify-phone-otp error:', error)
      res.status(500).json({ message: 'Server error while verifying OTP' })
    }
  }
)

// @route   POST /api/auth/send-otp
// @desc    Send OTP for unified login/signup (email or WhatsApp)
// @access  Public
router.post(
  '/send-otp',
  [
    body('mode').optional().isIn(['login', 'signup']).withMessage('Invalid mode'),
    body('channel').optional().isIn(['email', 'whatsapp']).withMessage('Invalid channel'),
    body('email').optional().trim(),
    body('phone').optional().trim(),
    body('phoneCountryCode').optional().trim(),
    body('phoneCountryIso').optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const channel = req.body.channel === 'whatsapp' ? 'whatsapp' : 'email'
      const mode = req.body.mode === 'signup' ? 'signup' : 'login'

      if (channel === 'whatsapp') {
        if (mode !== 'login') {
          return res.status(400).json({ message: 'WhatsApp verification is only available for login' })
        }

        const phone = normalizePhone(req.body.phone)
        if (!phone) {
          return res.status(400).json({ message: 'Phone number is required' })
        }

        let phoneKey
        let parsedPhone
        try {
          parsedPhone = parsePhoneInput({
            phone,
            phoneCountryCode: req.body.phoneCountryCode,
            phoneCountryIso: req.body.phoneCountryIso,
          })
          phoneKey = parsedPhone.phoneDigits
        } catch {
          return res.status(400).json({ message: 'Please enter a valid phone number' })
        }

        const user = await findUserByPhone(phoneKey)
        if (!user) {
          return res.status(404).json({ message: 'No account found with this mobile number' })
        }

        await maybeUpgradeUserPhone(user, parsedPhone)
        await sendLoginPhoneOtp(phoneKey)

        return res.status(200).json({
          message: 'Sign-in code sent to your WhatsApp',
          phone: phoneKey,
          channel: 'whatsapp',
        })
      }

      const email = normalizeEmail(req.body.email)
      if (!isEmailLike(email)) {
        return res.status(400).json({ message: 'Please enter a valid email' })
      }

      if (mode === 'signup') {
        const existingUser = await User.findOne({ email })
        if (existingUser) {
          return res.status(409).json({
            message: 'An account with this email already exists. Please log in.',
            code: 'USER_ALREADY_EXISTS',
          })
        }
      }

      await sendLoginOtp(email)

      return res.status(200).json({
        message: mode === 'signup' ? 'Verification code sent to your email' : 'Sign-in code sent to your email',
        email,
        channel: 'email',
      })
    } catch (error) {
      console.error('Send-otp error:', error)
      if (String(error.message || '').includes('GOOGLE_SMTP_USER')) {
        return res
          .status(500)
          .json({ message: 'Email service is not configured (Google SMTP env vars missing)' })
      }
      if (String(error.message || '').includes('WABA_')) {
        return res
          .status(500)
          .json({ message: 'WhatsApp OTP service is not configured (WABA env vars missing)' })
      }
      return res.status(500).json({ message: 'Server error while sending sign-in code' })
    }
  }
)

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and sign in (email or WhatsApp channel; creates account if new via email)
// @access  Public
router.post(
  '/verify-otp',
  [
    body('otp')
      .trim()
      .isLength({ min: OTP_LENGTH, max: OTP_LENGTH })
      .withMessage('Invalid OTP length'),
    body('phone').optional().trim(),
    body('phoneCountryCode').optional().trim(),
    body('phoneCountryIso').optional().trim(),
    body('email').optional().trim(),
    body('mode').optional().isIn(['login', 'signup']).withMessage('Invalid mode'),
    body('channel').optional().isIn(['email', 'whatsapp']).withMessage('Invalid channel'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      const channel = req.body.channel === 'whatsapp' ? 'whatsapp' : 'email'
      const otp = String(req.body.otp || '').trim()
      const mode = req.body.mode === 'signup' ? 'signup' : 'login'

      if (channel === 'whatsapp') {
        const phone = normalizePhone(req.body.phone)
        if (!phone) {
          return res.status(400).json({ message: 'Phone number is required' })
        }

        let phoneKey
        let parsedPhone
        try {
          parsedPhone = parsePhoneInput({
            phone,
            phoneCountryCode: req.body.phoneCountryCode,
            phoneCountryIso: req.body.phoneCountryIso,
          })
          phoneKey = parsedPhone.phoneDigits
        } catch {
          return res.status(400).json({ message: 'Please enter a valid phone number' })
        }

        const otpResult = await verifyStoredPhoneOtp(phoneKey, otp, OTP_PURPOSES.LOGIN)
        if (!otpResult.ok) {
          return res.status(otpResult.status).json({ message: otpResult.message })
        }

        const user = await findUserByPhone(phoneKey)
        if (!user) {
          return res.status(404).json({ message: 'User not found' })
        }

        if (user.status === 'inactive') {
          return res.status(403).json({ message: 'Your account has been deactivated' })
        }

        await maybeUpgradeUserPhone(user, parsedPhone)

        return sendAuthSuccessWithPermissions(res, user, 'Login successful')
      }

      const email = normalizeEmail(req.body.email)
      const phone = normalizePhone(req.body.phone)
      let parsedPhone = null
      if (phone) {
        try {
          parsedPhone = parsePhoneInput({
            phone,
            phoneCountryCode: req.body.phoneCountryCode,
            phoneCountryIso: req.body.phoneCountryIso,
          })
        } catch {
          return res.status(400).json({ message: 'Please enter a valid phone number' })
        }
      }
      if (!isEmailLike(email)) {
        return res.status(400).json({ message: 'Please enter a valid email' })
      }

      const otpResult = await verifyStoredEmailOtp(email, otp, OTP_PURPOSES.LOGIN)
      if (!otpResult.ok) {
        return res.status(otpResult.status).json({ message: otpResult.message })
      }

      let user = await User.findOne({ email })

      if (mode === 'signup' && user) {
        return res.status(409).json({
          message: 'An account with this email already exists. Please log in.',
          code: 'USER_ALREADY_EXISTS',
        })
      }

      let isNewUser = false

      if (!user) {
        isNewUser = true
        user = new User({
          name: deriveNameFromEmail(email),
          email,
          isEmailVerified: true,
          isPhoneVerified: !MOBILE_OTP_ENABLED,
          isVerified: !MOBILE_OTP_ENABLED,
          isProfileComplete: false,
        })
        if (parsedPhone) {
          applyPhoneFieldsToUser(user, parsedPhone)
        }
        await user.save()
      } else {
        if (parsedPhone && !user.phone) {
          applyPhoneFieldsToUser(user, parsedPhone)
        } else if (parsedPhone) {
          await maybeUpgradeUserPhone(user, parsedPhone)
        }
        await persistVerificationState(user, { isEmailVerified: true })
      }

      if (user.status === 'inactive') {
        return res.status(403).json({ message: 'Your account has been deactivated' })
      }

      const message = isNewUser ? 'Account created successfully' : 'Login successful'
      return sendAuthSuccessWithPermissions(res, user, message)
    } catch (error) {
      console.error('Verify-otp error:', error)
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Email already exists' })
      }
      return res.status(500).json({ message: 'Server error while verifying sign-in code' })
    }
  }
)

// @route   POST /api/auth/login
// @desc    Deprecated — use send-otp + verify-otp instead
// @access  Public
router.post('/login', (_req, res) => {
  return res.status(400).json({
    message: 'Password login is no longer supported. Please use email OTP sign-in.',
  })
})

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

