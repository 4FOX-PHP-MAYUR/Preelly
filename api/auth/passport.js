const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const AppleStrategy = require('passport-apple')
const FacebookStrategy = require('passport-facebook').Strategy
const jwt = require('jsonwebtoken')
const path = require('path')

const User = require('../models/User')

// We use Passport.js + OAuth strategies because:
// 1) It implements the OAuth 2.0 flows securely (including state/CSRF).
// 2) It integrates cleanly with Express, and we can still issue our own JWT.
// 3) It avoids locking you into a provider-specific auth SDK.

function normalizeEmail (value) {
  return String(value || '').trim().toLowerCase()
}

function pickNameFromProfile (profile) {
  return profile?.displayName || profile?.name?.givenName || profile?.name?.familyName || 'User'
}

function pickAvatarFromProfile (profile) {
  // Google typically: profile.photos[{ value }]
  // Facebook typically: profile.photos[{ value }] too (passport-facebook normalizes)
  return profile?.photos?.[0]?.value || profile?.picture || null
}

function pickAppleName (appleProfile) {
  const givenName = appleProfile?.name?.firstName || ''
  const familyName = appleProfile?.name?.lastName || ''
  const fullName = `${givenName} ${familyName}`.trim()
  return fullName || 'User'
}

function getAppleKeyOptions () {
  const privateKeyString = process.env.APPLE_PRIVATE_KEY
    ? String(process.env.APPLE_PRIVATE_KEY).replace(/\\n/g, '\n')
    : undefined

  const privateKeyPath = process.env.APPLE_PRIVATE_KEY_PATH
    ? path.resolve(__dirname, '..', process.env.APPLE_PRIVATE_KEY_PATH)
    : undefined

  if (privateKeyString) {
    return { privateKeyString }
  }

  if (privateKeyPath) {
    return { privateKeyLocation: privateKeyPath }
  }

  return {}
}

passport.serializeUser((user, done) => done(null, user?._id || user))
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).lean()
    done(null, user)
  } catch (e) {
    done(e)
  }
})

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const providerId = profile?.id
          const email = profile?.emails?.[0]?.value ? normalizeEmail(profile.emails[0].value) : null
          if (!email) return done(new Error('Google did not return an email address'))

          const name = pickNameFromProfile(profile)
          const avatar = pickAvatarFromProfile(profile)

          // Match "existing user" by email (so local + OAuth accounts join).
          let user = await User.findOne({ email }).exec()
          if (!user) {
            user = await User.create({
              name,
              email,
              avatar,
              isVerified: true,
              lastOauthProvider: 'google',
              googleProviderId: providerId,
              // phone/password remain optional for OAuth users
              phone: '',
            })
          } else {
            // Link OAuth account to existing email user if needed.
            user.isVerified = true
            user.avatar = user.avatar || avatar || null
            user.name = user.name || name
            user.lastOauthProvider = 'google'
            if (!user.googleProviderId && providerId) user.googleProviderId = providerId
            await user.save()
          }

          done(null, {
            _id: user._id,
            provider: 'google',
            providerId,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
          })
        } catch (e) {
          done(e)
        }
      },
    ),
  )
}

const appleKeyOptions = getAppleKeyOptions()

if (
  process.env.APPLE_CLIENT_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_KEY_ID &&
  process.env.APPLE_CALLBACK_URL &&
  (appleKeyOptions.privateKeyString || appleKeyOptions.privateKeyLocation)
) {
  passport.use(
    new AppleStrategy(
      {
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        callbackURL: process.env.APPLE_CALLBACK_URL,
        keyID: process.env.APPLE_KEY_ID,
        ...appleKeyOptions,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, idToken, _profile, done) => {
        try {
          const decoded = jwt.decode(idToken) || {}
          const providerId = decoded?.sub
          const email = decoded?.email ? normalizeEmail(decoded.email) : null
          const appleProfile = req.appleProfile || null
          const name = pickAppleName(appleProfile)

          let user = null

          if (providerId) {
            user = await User.findOne({ appleProviderId: providerId }).exec()
          }

          if (!user && email) {
            user = await User.findOne({ email }).exec()
          }

          if (!user) {
            if (!email) {
              return done(
                new Error('Apple did not return an email address. Please try again or use Google/email sign in.')
              )
            }

            user = await User.create({
              name,
              email,
              avatar: null,
              isVerified: true,
              isEmailVerified: true,
              isPhoneVerified: true,
              lastOauthProvider: 'apple',
              appleProviderId: providerId,
              phone: '',
            })
          } else {
            user.isVerified = true
            user.isEmailVerified = true
            user.isPhoneVerified = true
            user.name = user.name || name
            user.lastOauthProvider = 'apple'
            if (!user.appleProviderId && providerId) user.appleProviderId = providerId
            await user.save()
          }

          done(null, {
            _id: user._id,
            provider: 'apple',
            providerId,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
          })
        } catch (e) {
          done(e)
        }
      },
    ),
  )
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET && process.env.FACEBOOK_CALLBACK_URL) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL,
        profileFields: ['id', 'displayName', 'emails', 'photos'],
        scope: ['public_profile', 'email'],
        enableProof: true,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const providerId = profile?.id
          const email = profile?.emails?.[0]?.value ? normalizeEmail(profile.emails[0].value) : null
          const name = pickNameFromProfile(profile)
          const avatar = pickAvatarFromProfile(profile)

          if (req.session?.oauthMode === 'link' && req.session?.linkUserId) {
            return done(null, {
              linkMode: true,
              linkUserId: req.session.linkUserId,
              provider: 'facebook',
              providerId,
              name,
              avatar,
            })
          }

          if (!email) return done(new Error('Facebook did not return an email address'))

          let user = await User.findOne({ email }).exec()
          if (!user) {
            user = await User.create({
              name,
              email,
              avatar,
              isVerified: true,
              lastOauthProvider: 'facebook',
              facebookProviderId: providerId,
              phone: '',
            })
          } else {
            user.isVerified = true
            user.avatar = user.avatar || avatar || null
            user.name = user.name || name
            user.lastOauthProvider = 'facebook'
            if (!user.facebookProviderId && providerId) user.facebookProviderId = providerId
            await user.save()
          }

          done(null, {
            _id: user._id,
            provider: 'facebook',
            providerId,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
          })
        } catch (e) {
          done(e)
        }
      },
    ),
  )
}

module.exports = passport

