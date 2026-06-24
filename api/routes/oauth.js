const express = require('express')
const crypto = require('crypto')
const axios = require('axios')
const jwt = require('jsonwebtoken')
const passport = require('../auth/passport')
const { generateJwtToken, setJwtCookie } = require('../utils/jwt')
const { getUserIdFromRequest } = require('../utils/authToken')
const { linkSocialAccount } = require('../utils/socialLink')
const User = require('../models/User')

const router = express.Router()

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8031'
const SETTINGS_PATH = '/dashboard/settings'

function getTargetFromRequest(req) {
  const target = String(req.query.target || '').trim().toLowerCase()
  if (target === 'seller') return 'seller'
  return 'buyer'
}

function getRedirectPathForTarget(target) {
  return target === 'seller' ? '/post-ad' : '/'
}

function oauthSuccessRedirect(token, target) {
  return `${FRONTEND_URL}/oauth-success#token=${encodeURIComponent(token)}&target=${encodeURIComponent(target)}`
}

function oauthFailureRedirect(provider) {
  const msg = `OAuth ${provider} login failed`
  return `${FRONTEND_URL}/login?oauthError=${encodeURIComponent(msg)}`
}

function settingsSuccessRedirect(provider) {
  return `${FRONTEND_URL}${SETTINGS_PATH}?socialLinked=${encodeURIComponent(provider)}`
}

function settingsFailureRedirect(message) {
  return `${FRONTEND_URL}${SETTINGS_PATH}?socialError=${encodeURIComponent(message)}`
}

function isStrategyAvailable(provider) {
  return Boolean(passport._strategy(provider))
}

function isLinkMode(req) {
  return String(req.query.mode || req.session?.oauthMode || '').trim().toLowerCase() === 'link'
}

function getLinkUserId(req) {
  const fromRequest = getUserIdFromRequest(req)
  if (fromRequest) return fromRequest

  const queryToken = String(req.query.token || '').trim()
  if (!queryToken) return null

  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key'
    const decoded = jwt.verify(queryToken, secret)
    return decoded.userId || decoded.id || null
  } catch {
    return null
  }
}

function prepareOauthSession(req) {
  if (isLinkMode(req)) {
    const userId = getLinkUserId(req)
    if (!userId) {
      return { error: 'Please sign in to link your social account' }
    }
    req.session.oauthMode = 'link'
    req.session.linkUserId = String(userId)
    return { linkUserId: String(userId) }
  }

  req.session.oauthTarget = getTargetFromRequest(req)
  delete req.session.oauthMode
  delete req.session.linkUserId
  return {}
}

function clearOauthSession(req) {
  const target = req.session.oauthTarget || 'buyer'
  delete req.session.oauthTarget
  delete req.session.oauthMode
  delete req.session.linkUserId
  delete req.session.instagramOAuthState
  return target
}

async function completeLinkFlow(req, res, provider, payload) {
  const linkUserId = req.session.linkUserId || payload?.linkUserId
  clearOauthSession(req)

  try {
    await linkSocialAccount(linkUserId, provider, payload)
    return res.redirect(settingsSuccessRedirect(provider))
  } catch (err) {
    return res.redirect(settingsFailureRedirect(err.message || 'Failed to link account'))
  }
}

async function completeLoginFlow(req, res, user) {
  const target = clearOauthSession(req)
  const token = generateJwtToken(user._id)
  setJwtCookie(res, token)
  return res.redirect(oauthSuccessRedirect(token, target))
}

function handleOauthCallback(provider, req, res, next) {
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)
  if (!isStrategyAvailable(provider)) {
    if (req.session?.oauthMode === 'link') {
      clearOauthSession(req)
      return res.redirect(settingsFailureRedirect(`${providerLabel} is not configured yet`))
    }
    return res.redirect(
      `${FRONTEND_URL}/login?oauthError=${encodeURIComponent(`${providerLabel} sign in is not configured yet`)}`
    )
  }

  passport.authenticate(provider, { session: false }, async (err, user) => {
    try {
      if (err) {
        if (req.session?.oauthMode === 'link') {
          clearOauthSession(req)
          return res.redirect(settingsFailureRedirect(err.message || `Failed to link ${providerLabel}`))
        }
        return res.redirect(oauthFailureRedirect(providerLabel))
      }
      if (!user) {
        if (req.session?.oauthMode === 'link') {
          clearOauthSession(req)
          return res.redirect(settingsFailureRedirect(`Failed to link ${providerLabel}`))
        }
        return res.redirect(oauthFailureRedirect(providerLabel))
      }

      if (user.linkMode || req.session?.oauthMode === 'link') {
        return completeLinkFlow(req, res, provider, {
          linkUserId: user.linkUserId || req.session.linkUserId,
          providerId: user.providerId,
          username: user.username,
          avatar: user.avatar,
        })
      }

      return completeLoginFlow(req, res, user)
    } catch (e) {
      if (req.session?.oauthMode === 'link') {
        clearOauthSession(req)
        return res.redirect(settingsFailureRedirect(e.message || `Failed to link ${providerLabel}`))
      }
      return res.redirect(oauthFailureRedirect(providerLabel))
    }
  })(req, res, next)
}

function startPassportOauth(provider, req, res, next, options = {}) {
  const sessionResult = prepareOauthSession(req)
  if (sessionResult.error) {
    return res.redirect(settingsFailureRedirect(sessionResult.error))
  }

  return passport.authenticate(provider, {
    session: false,
    ...options,
  })(req, res, next)
}

// ---------------------------
// OAuth initiation endpoints
// ---------------------------
router.get('/google', (req, res, next) => {
  try {
    if (!isStrategyAvailable('google')) {
      const msg = 'Google sign in is not configured yet'
      return res.redirect(
        isLinkMode(req) ? settingsFailureRedirect(msg) : `${FRONTEND_URL}/login?oauthError=${encodeURIComponent(msg)}`
      )
    }
    return startPassportOauth('google', req, res, next, { scope: ['profile', 'email'] })
  } catch (e) {
    next(e)
  }
})

router.get('/google/callback', (req, res, next) => handleOauthCallback('google', req, res, next))

router.get('/apple', (req, res, next) => {
  try {
    if (!isStrategyAvailable('apple')) {
      const msg = 'Apple sign in is not configured yet'
      return res.redirect(
        isLinkMode(req) ? settingsFailureRedirect(msg) : `${FRONTEND_URL}/login?oauthError=${encodeURIComponent(msg)}`
      )
    }
    return startPassportOauth('apple', req, res, next)
  } catch (e) {
    next(e)
  }
})

router.all('/apple/callback', (req, res, next) => handleOauthCallback('apple', req, res, next))

router.get('/facebook', (req, res, next) => {
  try {
    if (!isStrategyAvailable('facebook')) {
      const msg = 'Facebook sign in is not configured yet'
      return res.redirect(
        isLinkMode(req) ? settingsFailureRedirect(msg) : `${FRONTEND_URL}/login?oauthError=${encodeURIComponent(msg)}`
      )
    }
    return startPassportOauth('facebook', req, res, next, { scope: ['public_profile', 'email'] })
  } catch (e) {
    next(e)
  }
})

router.get('/facebook/callback', (req, res, next) => handleOauthCallback('facebook', req, res, next))

// ---------------------------
// Instagram Basic Display (manual OAuth — non-standard token response)
// ---------------------------
function isInstagramConfigured() {
  return Boolean(
    process.env.INSTAGRAM_CLIENT_ID &&
      process.env.INSTAGRAM_CLIENT_SECRET &&
      process.env.INSTAGRAM_CALLBACK_URL
  )
}

function buildInstagramAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_CLIENT_ID,
    redirect_uri: process.env.INSTAGRAM_CALLBACK_URL,
    scope: 'user_profile,user_media',
    response_type: 'code',
    state,
  })
  return `https://api.instagram.com/oauth/authorize?${params.toString()}`
}

async function exchangeInstagramCode(code) {
  const body = new URLSearchParams({
    client_id: process.env.INSTAGRAM_CLIENT_ID,
    client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: process.env.INSTAGRAM_CALLBACK_URL,
    code,
  })

  const { data } = await axios.post('https://api.instagram.com/oauth/access_token', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  const accessToken = data?.access_token
  const userId = data?.user_id ? String(data.user_id) : null
  if (!accessToken || !userId) {
    throw new Error('Instagram did not return account details')
  }

  let username = null
  try {
    const profileRes = await axios.get('https://graph.instagram.com/me', {
      params: { fields: 'id,username', access_token: accessToken },
    })
    username = profileRes.data?.username || null
  } catch {
    // Username is optional; user_id from token exchange is enough to link.
  }

  return { providerId: userId, username }
}

router.get('/instagram', (req, res) => {
  try {
    if (!isInstagramConfigured()) {
      const msg = 'Instagram linking is not configured yet'
      return res.redirect(
        isLinkMode(req) ? settingsFailureRedirect(msg) : `${FRONTEND_URL}/login?oauthError=${encodeURIComponent(msg)}`
      )
    }

    const sessionResult = prepareOauthSession(req)
    if (sessionResult.error) {
      return res.redirect(settingsFailureRedirect(sessionResult.error))
    }

    const state = crypto.randomBytes(16).toString('hex')
    req.session.instagramOAuthState = state
    return res.redirect(buildInstagramAuthUrl(state))
  } catch (e) {
    return res.redirect(settingsFailureRedirect(e.message || 'Failed to start Instagram linking'))
  }
})

router.get('/instagram/callback', async (req, res) => {
  const linkMode = req.session?.oauthMode === 'link'
  const oauthError = req.query.error || req.query.error_reason

  if (oauthError) {
    clearOauthSession(req)
    return res.redirect(settingsFailureRedirect(String(oauthError)))
  }

  try {
    if (!isInstagramConfigured()) {
      clearOauthSession(req)
      return res.redirect(settingsFailureRedirect('Instagram linking is not configured yet'))
    }

    const returnedState = String(req.query.state || '')
    const expectedState = String(req.session.instagramOAuthState || '')
    delete req.session.instagramOAuthState

    if (!returnedState || !expectedState || returnedState !== expectedState) {
      clearOauthSession(req)
      return res.redirect(settingsFailureRedirect('Invalid Instagram OAuth state'))
    }

    const code = String(req.query.code || '').trim()
    if (!code) {
      clearOauthSession(req)
      return res.redirect(settingsFailureRedirect('Instagram authorization was cancelled'))
    }

    const profile = await exchangeInstagramCode(code)

    if (linkMode) {
      return completeLinkFlow(req, res, 'instagram', profile)
    }

    // Login/signup via Instagram (match by provider id or create lightweight account).
    let user = await User.findOne({ instagramProviderId: profile.providerId }).exec()
    if (!user) {
      const placeholderEmail = `instagram_${profile.providerId}@social.preelly.local`
      user = await User.create({
        name: profile.username || 'Instagram User',
        email: placeholderEmail,
        phone: '',
        isVerified: true,
        lastOauthProvider: 'instagram',
        instagramProviderId: profile.providerId,
        instagramUsername: profile.username || undefined,
      })
    } else if (profile.username && !user.instagramUsername) {
      user.instagramUsername = profile.username
      user.lastOauthProvider = 'instagram'
      await user.save()
    }

    return completeLoginFlow(req, res, { _id: user._id })
  } catch (err) {
    if (linkMode) {
      clearOauthSession(req)
      return res.redirect(settingsFailureRedirect(err.message || 'Failed to link Instagram'))
    }
    clearOauthSession(req)
    return res.redirect(oauthFailureRedirect('Instagram'))
  }
})

module.exports = router
