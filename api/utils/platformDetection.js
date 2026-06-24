/**
 * Resolve request platform for analytics and search history.
 * Web routes set req.platform = 'web'; mobile routes set req.platform = 'mobile'.
 * Falls back to X-Platform header (ios/android → mobile) or defaults to web.
 */
function resolvePlatform(req) {
  if (req.platform === 'web' || req.platform === 'mobile') {
    return req.platform
  }

  const xPlatform = String(req.headers['x-platform'] || '').trim().toLowerCase()
  if (xPlatform === 'ios' || xPlatform === 'android') {
    return 'mobile'
  }

  const userAgent = String(req.headers['user-agent'] || '').toLowerCase()
  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) {
    return 'mobile'
  }

  return 'web'
}

module.exports = { resolvePlatform }
