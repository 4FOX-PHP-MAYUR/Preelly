/**
 * Backward compatibility middleware for legacy /api/* routes.
 * Adds deprecation headers so clients can migrate to /api/v1/web or /api/v1/mobile.
 */
function legacyDeprecationHeaders(req, res, next) {
  if (process.env.API_LEGACY_ENABLED === 'false') {
    return res.status(410).json({
      success: false,
      message: 'This API version has been retired. Use /api/v1/web or /api/v1/mobile.',
      code: 'API_RETIRED',
    })
  }

  res.set('Deprecation', 'true')
  res.set('Sunset', process.env.API_DEPRECATION_DATE || '2026-09-01')
  res.set(
    'Link',
    '</api/v1/web>; rel="successor-version", </api-docs>; rel="help"',
  )
  next()
}

module.exports = { legacyDeprecationHeaders }
