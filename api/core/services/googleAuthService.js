const User = require('../../models/User')
const AppError = require('../errors/AppError')

/**
 * Maps a verified Google profile onto a Preelly user: logs an existing one in,
 * links Google to a matching local account, or creates a new account.
 *
 * Every field consumed here comes from `utils/googleIdToken.verifyGoogleIdToken`,
 * i.e. from a token Google signed — nothing the mobile client sent directly.
 *
 * Social identities already live on the User model (`googleProviderId`,
 * `lastOauthProvider`, alongside the Apple/Facebook equivalents used by the web
 * OAuth flow), and `googleProviderId` already carries a unique partial index, so
 * this adds no schema fields of its own.
 */

// Mirrors routes/auth.js: when mobile OTP is on, a freshly created account is not
// phone-verified yet, exactly as with email OTP signup.
const MOBILE_OTP_ENABLED = () => process.env.ENABLE_MOBILE_OTP === 'true'

/** "john.doe+tag@gmail.com" -> "John doe" — same shape routes/auth.js derives. */
function deriveNameFromEmail (email) {
  const localPart = String(email || '').split('@')[0] || 'User'
  const cleaned = localPart.replace(/[._+-]+/g, ' ').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'User'
}

function pickDisplayName (profile) {
  const fromParts = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
  return profile.fullName || fromParts || deriveNameFromEmail(profile.email)
}

function assertActive (user) {
  if (user.status === 'inactive') {
    // Same message/status the OTP sign-in paths return.
    throw new AppError('Your account has been deactivated', 403, 'ACCOUNT_DEACTIVATED')
  }
}

/**
 * @param {{googleId: string, email: string, firstName: string|null, lastName: string|null,
 *   fullName: string|null, picture: string|null}} profile verified Google profile
 * @returns {Promise<{user: object, isNewUser: boolean, linked: boolean}>}
 */
async function resolveGoogleUser (profile) {
  const googleId = String(profile.googleId)
  const email = String(profile.email).trim().toLowerCase()

  // 1. Known Google identity — the cheapest and most authoritative match, and
  //    what stops a repeat login from ever creating a second account.
  const byGoogleId = await User.findOne({ googleProviderId: googleId })
  if (byGoogleId) {
    assertActive(byGoogleId)
    byGoogleId.lastOauthProvider = 'google'
    // Google vouched for the address on this account's linked identity.
    if (!byGoogleId.isEmailVerified) byGoogleId.isEmailVerified = true
    // Fill only what is missing — a user's own edits are never overwritten.
    if (!byGoogleId.avatar && profile.picture) byGoogleId.avatar = profile.picture
    await byGoogleId.save()
    return { user: byGoogleId, isNewUser: false, linked: false }
  }

  // 2. Fall back to the verified email. Safe to link on because the token
  //    carried email_verified=true; an unverified Google email is rejected
  //    before this service is reached.
  const byEmail = await User.findOne({ email })
  if (byEmail) {
    // The address matches an account that is already tied to a *different*
    // Google identity. Re-pointing it would hand this account to whoever
    // controls the new Google account, so refuse instead.
    if (byEmail.googleProviderId && byEmail.googleProviderId !== googleId) {
      throw new AppError(
        'This email is already linked to a different Google account.',
        409,
        'GOOGLE_ACCOUNT_CONFLICT'
      )
    }

    assertActive(byEmail)
    byEmail.googleProviderId = googleId
    byEmail.lastOauthProvider = 'google'
    byEmail.isEmailVerified = true
    if (!byEmail.avatar && profile.picture) byEmail.avatar = profile.picture
    // Keep any name the user chose; only fill a blank one.
    if (!byEmail.name && profile) byEmail.name = pickDisplayName(profile)
    await byEmail.save()
    return { user: byEmail, isNewUser: false, linked: true }
  }

  // 3. Brand-new account. No password is set at all — Google-only accounts have
  //    no local credential, and `password` is optional on the model.
  const created = new User({
    name: pickDisplayName(profile),
    email,
    avatar: profile.picture || null,
    googleProviderId: googleId,
    lastOauthProvider: 'google',
    isEmailVerified: true,
    isPhoneVerified: !MOBILE_OTP_ENABLED(),
    isProfileComplete: false,
  })

  try {
    await created.save()
  } catch (error) {
    // Two concurrent first-time logins for the same Google account: the unique
    // index on googleProviderId (or email) rejects the loser. Re-read and log
    // that request in rather than failing it.
    if (error?.code === 11000) {
      const existing =
        (await User.findOne({ googleProviderId: googleId })) || (await User.findOne({ email }))
      if (existing) {
        assertActive(existing)
        return { user: existing, isNewUser: false, linked: false }
      }
      throw new AppError('Could not complete Google sign in. Please try again.', 409, 'USER_CREATE_CONFLICT')
    }
    throw error
  }

  return { user: created, isNewUser: true, linked: false }
}

module.exports = {
  resolveGoogleUser,
  deriveNameFromEmail,
  pickDisplayName,
}
