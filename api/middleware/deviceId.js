const AppError = require('../core/errors/AppError')

/**
 * Reads device ID from request headers.
 * Accepts `device-id` (preferred) or `x-device-id`.
 */
function getDeviceIdFromRequest(req) {
  const raw = req.headers['device-id'] || req.headers['x-device-id']
  if (raw == null) return null
  const trimmed = String(raw).trim()
  return trimmed || null
}

/**
 * Requires a non-empty device ID header before processing search requests.
 */
function requireDeviceId(req, res, next) {
  const deviceId = getDeviceIdFromRequest(req)
  if (!deviceId) {
    return res.status(400).json({
      success: false,
      message: 'device-id header is required',
      code: 'DEVICE_ID_REQUIRED',
    })
  }
  if (deviceId.length > 128) {
    return res.status(400).json({
      success: false,
      message: 'device-id must be 128 characters or fewer',
      code: 'DEVICE_ID_INVALID',
    })
  }
  req.deviceId = deviceId
  return next()
}

/**
 * Optional device ID — attaches req.deviceId when present.
 */
function optionalDeviceId(req, res, next) {
  req.deviceId = getDeviceIdFromRequest(req)
  return next()
}

module.exports = {
  getDeviceIdFromRequest,
  requireDeviceId,
  optionalDeviceId,
}
