const express = require('express')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')

const User = require('../models/User')
const { isSuperAdminRole, buildFullPermissionSet } = require('../config/adminPermissions')
const { getPermissionMapForRole } = require('../services/adminPermissionService')
const { setJwtCookie } = require('../utils/jwt')
const {
  verifyAppleWebIdentityToken,
  exchangeAppleWebAuthorizationCode,
  canExchangeWebAuthorizationCode,
  isWebConfigured,
} = require('../utils/appleWebIdToken')
const { resolveAppleUser } = require('../core/services/appleAuthService')

/**
 * Sign in with Apple for the **web app** — mounted at POST /api/auth/apple/web.
 *
 * A route of its own, with its own verifier (utils/appleWebIdToken.js) and its own
 * APPLE_WEB_* credentials, so the browser flow and the mobile app flow
 * (POST /api/auth/apple) share no endpoint and no configuration. Changing the web
 * Services ID, key or return URL cannot affect the app, and neither flow's token is
 * accepted by the other's route.
 *
 * What IS shared is core/services/appleAuthService.js, which maps a verified Apple
 * identity onto a Preelly user. That is account storage, not login plumbing, and it
 * must stay shared: it is what makes one Apple ID resolve to one account whether the
 * person signs in on the phone or in a browser. Copying it would hand the same
 * person a second account depending on the device they used.
 */

const router = express.Router()

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })

const MOBILE_OTP_ENABLED = () => process.env.ENABLE_MOBILE_OTP === 'true'

/**
 * Same verification view routes/auth.js derives, so the payload this route returns
 * matches every other login response the web app consumes. Kept local rather than
 * imported so this flow owns its own behaviour; if serializeUser there gains a
 * field, add it here too.
 */
function serializeUser (user) {
  const emailVerified =
    typeof user.isEmailVerified === 'boolean' ? user.isEmailVerified : Boolean(user.isVerified)
  const phoneVerified = !MOBILE_OTP_ENABLED()
    ? true
    : typeof user.isPhoneVerified === 'boolean'
      ? user.isPhoneVerified
      : Boolean(user.isVerified && user.phone)

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    phoneCountryCode: user.phoneCountryCode || null,
    phoneCountryIso: user.phoneCountryIso || null,
    role: user.role,
    avatar: user.avatar,
    isVerified: user.role === 'admin' ? true : Boolean(emailVerified && phoneVerified),
    isEmailVerified: emailVerified,
    isPhoneVerified: phoneVerified,
    isProfileComplete: user.isProfileComplete,
    memberSince: user.memberSince || user.createdAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    identityVerificationStatus: user.identityVerificationStatus || 'none',
    identityVerificationRejectionReason: user.identityVerificationRejectionReason || null,
  }
}

/** Issues the JWT + cookie and answers with the standard { message, token, user }. */
async function sendWebAuthSuccess (res, user, message) {
  const token = generateToken(user._id)
  setJwtCookie(res, token)

  let permissions = null
  let adminRoleData = null
  if (user.role === 'admin' && user.adminRole) {
    const populated = await User.findById(user._id).populate('adminRole', 'role_name status is_system')
    adminRoleData = populated.adminRole
    if (isSuperAdminRole(adminRoleData)) {
      permissions = {}
      buildFullPermissionSet().forEach((p) => {
        permissions[p.module_name] = {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: true,
        }
      })
    } else {
      permissions = await getPermissionMapForRole(adminRoleData?._id || user.adminRole)
    }
  }

  return res.json({
    message,
    token,
    user: { ...serializeUser(user), adminRole: adminRoleData, permissions },
  })
}

// @route   POST /api/auth/apple/web
// @desc    Sign in with Apple from the browser. The Apple JS popup returns an
//          identity token whose `aud` is the web Services ID; this verifies it
//          against Apple's JWKS and returns the normal Preelly JWT + user payload.
//          `user` carries the first-name/last-name hints Apple releases on a first
//          authorization only — display-only data, never used to identify anyone.
// @access  Public
router.post(
  '/',
  [
    body('identityToken').trim().notEmpty().withMessage('Apple identity token is required'),
    body('authorizationCode').optional({ values: 'falsy' }).isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg })
      }

      if (!isWebConfigured()) {
        console.warn('[auth:apple-web] rejected: APPLE_WEB_CLIENT_ID is not set')
        return res.status(503).json({ message: 'Apple sign in is not configured yet' })
      }

      // Never log req.body: it carries the identity token and the authorization code.
      console.log('[auth:apple-web] sign-in attempt received')

      let profile
      try {
        profile = await verifyAppleWebIdentityToken(req.body.identityToken)
      } catch (error) {
        if (error?.isOperational) {
          console.warn(
            `[auth:apple-web] token rejected (${error.code}${
              error.verificationReason ? `: ${error.verificationReason}` : ''
            })`
          )
          return res.status(error.statusCode).json({ message: error.message })
        }
        throw error
      }

      // Optional cross-check: redeem the popup's one-time code and confirm Apple
      // names the same user. A mismatch is a genuine attack signal and is refused; a
      // failed exchange is not (codes are single-use and expire in ~5 minutes), so it
      // is logged and ignored unless APPLE_WEB_REQUIRE_AUTH_CODE=true.
      const authorizationCode = String(req.body.authorizationCode || '').trim()
      const requireAuthCode = process.env.APPLE_WEB_REQUIRE_AUTH_CODE === 'true'
      if (authorizationCode && canExchangeWebAuthorizationCode()) {
        try {
          const exchanged = await exchangeAppleWebAuthorizationCode(authorizationCode)
          if (exchanged.sub && exchanged.sub !== profile.appleId) {
            console.warn('[auth:apple-web] rejected: authorization code belongs to a different Apple user')
            return res.status(401).json({ message: 'Apple sign in failed. Please try again.' })
          }
          console.log('[auth:apple-web] authorization code verified with Apple')
        } catch (error) {
          const reason = error?.verificationReason || error?.code || 'exchange failed'
          console.warn(`[auth:apple-web] authorization code not verified (${reason})`)
          if (requireAuthCode) {
            return res.status(401).json({ message: 'Apple sign in failed. Please try again.' })
          }
        }
      } else if (requireAuthCode) {
        console.warn('[auth:apple-web] rejected: authorization code required but missing or unverifiable')
        return res.status(400).json({ message: 'Apple authorization code is required' })
      }

      const { user, isNewUser, linked } = await resolveAppleUser(profile, req.body.user || {})

      if (isNewUser) {
        console.log(
          `[auth:apple-web] new account created (user ${user._id}, email ${
            profile.email ? (profile.isPrivateRelay ? 'private-relay' : 'provided') : 'withheld'
          })`
        )
      } else if (linked) {
        console.log(`[auth:apple-web] linked Apple identity to existing account (user ${user._id})`)
      } else {
        console.log(`[auth:apple-web] existing account signed in (user ${user._id})`)
      }

      return sendWebAuthSuccess(
        res,
        user,
        isNewUser ? 'Account created successfully' : 'Login successful'
      )
    } catch (error) {
      // Operational errors (deactivated account, Apple/email conflict) carry a
      // client-safe message; anything else stays generic so database or Apple
      // internals are never exposed.
      if (error?.isOperational) {
        console.warn(`[auth:apple-web] rejected (${error.code})`)
        return res.status(error.statusCode).json({ message: error.message })
      }
      console.error('Apple web sign-in error:', error)
      return res.status(500).json({ message: 'Server error during Apple sign in' })
    }
  }
)

module.exports = router
