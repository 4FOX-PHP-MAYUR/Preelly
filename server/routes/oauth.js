const express = require('express')
const passport = require('../auth/passport')
const { generateJwtToken, setJwtCookie } = require('../utils/jwt')

const router = express.Router()

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3002'

function getTargetFromRequest (req) {
  // Requirement: Buyer -> homepage, Seller -> post-product page (mock logic is fine).
  // We allow the frontend to pass `?target=seller|buyer` when starting OAuth.
  const target = String(req.query.target || '').trim().toLowerCase()
  if (target === 'seller') return 'seller'
  return 'buyer'
}

function getRedirectPathForTarget (target) {
  return target === 'seller' ? '/post-ad' : '/'
}

function oauthSuccessRedirect (token, target) {
  // Also pass the JWT to the frontend so it can populate localStorage.
  // This avoids cases where cookies aren't forwarded in dev proxies / cross-origin calls.
  return `${FRONTEND_URL}/oauth-success#token=${encodeURIComponent(token)}&target=${encodeURIComponent(target)}`
}

function oauthFailureRedirect (provider, req) {
  const msg = `OAuth ${provider} login failed`
  // Keep it simple; front-end can show a generic message.
  return `${FRONTEND_URL}/login?oauthError=${encodeURIComponent(msg)}`
}

// ---------------------------
// OAuth initiation endpoints
// ---------------------------
router.get('/google', (req, res, next) => {
  try {
    req.session.oauthTarget = getTargetFromRequest(req)
    return passport.authenticate('google', {
      session: false, // We only use session for OAuth state; final auth is via our JWT cookie.
      scope: ['profile', 'email'],
    })(req, res, next)
  } catch (e) {
    next(e)
  }
})

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, user) => {
    try {
      if (err) return res.redirect(oauthFailureRedirect('Google', req))
      if (!user) return res.redirect(oauthFailureRedirect('Google', req))

      // Issue JWT + HTTP-only cookie.
      const token = generateJwtToken(user._id)
      setJwtCookie(res, token)

      const target = req.session.oauthTarget || 'buyer'
      delete req.session.oauthTarget

      return res.redirect(oauthSuccessRedirect(token, target))
    } catch (e) {
      return res.redirect(oauthFailureRedirect('Google', req))
    }
  })(req, res, next)
})

router.get('/facebook', (req, res, next) => {
  try {
    req.session.oauthTarget = getTargetFromRequest(req)
    return passport.authenticate('facebook', {
      session: false,
      scope: ['public_profile', 'email'],
    })(req, res, next)
  } catch (e) {
    next(e)
  }
})

router.get('/facebook/callback', (req, res, next) => {
  passport.authenticate('facebook', { session: false }, async (err, user) => {
    try {
      if (err) return res.redirect(oauthFailureRedirect('Facebook', req))
      if (!user) return res.redirect(oauthFailureRedirect('Facebook', req))

      const token = generateJwtToken(user._id)
      setJwtCookie(res, token)

      const target = req.session.oauthTarget || 'buyer'
      delete req.session.oauthTarget

      return res.redirect(oauthSuccessRedirect(token, target))
    } catch (e) {
      return res.redirect(oauthFailureRedirect('Facebook', req))
    }
  })(req, res, next)
})

module.exports = router

