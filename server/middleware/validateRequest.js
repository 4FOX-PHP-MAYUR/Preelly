const { validationResult } = require('express-validator')

/**
 * Runs express-validator rules and returns 400 on failure.
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array(),
    })
  }
  return next()
}

module.exports = validateRequest
