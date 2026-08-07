const User = require('../../models/User')
const AppError = require('../errors/AppError')

/**
 * Maps a verified Apple identity onto a Preelly user: logs an existing one in,
 * links Apple to a matching local account, or creates a new account.
 *
 * `appleId` (the token's `sub`) is the primary identifier — never the email,
 * which Apple only sends on the first authorization and which may be a private
 * relay address that the user can later disable.
 *
 * Social identities already live on the User model (`appleProviderId`,
 * `lastOauthProvider`, alongside the Google/Facebook equivalents), and
 * `appleProviderId` already carries a unique partial index, so this adds no
 * schema fields of its own.
 */

// Mirrors routes/auth.js: when mobile OTP is on, a freshly created account is not
// phone-verified yet, exactly as with email OTP signup.
const MOBILE_OTP_ENABLED = () => process.env.ENABLE_MOBILE_OTP === 'true'

/** "john.doe+tag@example.com" -> "John doe" — same shape routes/auth.js derives. */
function deriveNameFromEmail (email) {
  const localPart = String(email || '').split('@')[0] || 'User'
  const cleaned = localPart.replace(/[._+-]+/g, ' ').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'User'
}

/**
 * Apple sends the name only on first authorization, and only via the client — so
 * unlike the email it cannot be verified. It is display-only data, used just to
 * fill a blank name, never to identify or match an account.
 */
function pickDisplayName ({ clientName, email }) {
  const fromClient = String(clientName || '').trim()
  if (fromClient) return fromClient.slice(0, 80)
  if (email) return deriveNameFromEmail(email)
  return null
}

function assertActive (user) {
  if (user.status === 'inactive') {
    // Same message/status the OTP sign-in paths return.
    throw new AppError('Your account has been deactivated', 403, 'ACCOUNT_DEACTIVATED')
  }
}

/**
 * @param {{appleId: string, email: string|null, isPrivateRelay: boolean}} profile verified Apple profile
 * @param {{name?: string|null, firstName?: string|null, lastName?: string|null}} [clientProfile]
 *        unverified display-name hints from the app's first-login payload
 * @returns {Promise<{user: object, isNewUser: boolean, linked: boolean}>}
 */
async function resolveAppleUser (profile, clientProfile = {}) {
  const appleId = String(profile.appleId)
  const email = profile.email ? String(profile.email).trim().toLowerCase() : null

  const clientName =
    clientProfile.name ||
    [clientProfile.firstName, clientProfile.lastName].filter(Boolean).join(' ').trim() ||
    null

  // 1. Known Apple identity — authoritative, and what stops a repeat login (which
  //    carries no name/email at all) from creating a second account.
  const byAppleId = await User.findOne({ appleProviderId: appleId })
  if (byAppleId) {
    assertActive(byAppleId)
    byAppleId.lastOauthProvider = 'apple'
    if (email && !byAppleId.isEmailVerified) byAppleId.isEmailVerified = true
    // Fill only what is missing — never overwrite with a blank from a later login.
    if (!byAppleId.name && clientName) byAppleId.name = pickDisplayName({ clientName, email })
    if (!byAppleId.email && email) byAppleId.email = email
    await byAppleId.save()
    return { user: byAppleId, isNewUser: false, linked: false }
  }

  // 2. Fall back to the email, but only one Apple verified. An unverified address
  //    is dropped by the verifier before it reaches this service, so matching on
  //    it can never hand an account to someone who only claims the address.
  if (email) {
    const byEmail = await User.findOne({ email })
    if (byEmail) {
      // The address belongs to an account already tied to a *different* Apple
      // identity. Re-pointing it would give this account away, so refuse.
      if (byEmail.appleProviderId && byEmail.appleProviderId !== appleId) {
        throw new AppError(
          'This email is already linked to a different Apple account.',
          409,
          'APPLE_ACCOUNT_CONFLICT'
        )
      }

      assertActive(byEmail)
      byEmail.appleProviderId = appleId
      byEmail.lastOauthProvider = 'apple'
      byEmail.isEmailVerified = true
      if (!byEmail.name && clientName) byEmail.name = pickDisplayName({ clientName, email })
      await byEmail.save()
      return { user: byEmail, isNewUser: false, linked: true }
    }
  }

  // 3. Brand-new account. No password is set at all — Apple-only accounts have no
  //    local credential, and `password` is optional on the model. Apple tokens are
  //    never persisted anywhere on the user.
  const name = pickDisplayName({ clientName, email }) || (await generateFallbackUsername())

  const created = new User({
    name,
    // Apple can withhold the email on later logins; if it is absent here the
    // account is created without one, like the phone-first signup path does.
    ...(email ? { email } : {}),
    appleProviderId: appleId,
    lastOauthProvider: 'apple',
    isEmailVerified: Boolean(email),
    isPhoneVerified: !MOBILE_OTP_ENABLED(),
    isProfileComplete: false,
  })

  try {
    await created.save()
  } catch (error) {
    // Two concurrent first-time logins for the same Apple account: the unique
    // index on appleProviderId (or email) rejects the loser. Re-read and log that
    // request in rather than failing it.
    if (error?.code === 11000) {
      const existing =
        (await User.findOne({ appleProviderId: appleId })) ||
        (email ? await User.findOne({ email }) : null)
      if (existing) {
        assertActive(existing)
        return { user: existing, isNewUser: false, linked: false }
      }
      throw new AppError('Could not complete Apple sign in. Please try again.', 409, 'USER_CREATE_CONFLICT')
    }
    throw error
  }

  return { user: created, isNewUser: true, linked: false }
}

/**
 * Same "U-XXXXXXXX" placeholder the OTP signup path uses when it has no name to
 * work with — so Apple users with a withheld name look like any other new
 * account rather than carrying an invented one.
 */
async function generateFallbackUsername () {
  for (let i = 0; i < 10; i += 1) {
    const digits = String(Math.floor(10000000 + Math.random() * 90000000))
    const candidate = `U-${digits}`
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.exists({ name: candidate })
    if (!exists) return candidate
  }
  return `U-${Date.now().toString().slice(-8)}`
}

module.exports = {
  resolveAppleUser,
  deriveNameFromEmail,
  pickDisplayName,
  generateFallbackUsername,
}
