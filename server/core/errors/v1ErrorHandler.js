/**
 * Enhanced error handler for v1 routes — handles AppError + generic errors.
 * Mount before the global handler in server.js for /api/v1 paths.
 */
function v1ErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)

  const status = err.statusCode || err.status || 500
  const isOperational = err.isOperational === true

  if (process.env.NODE_ENV !== 'production' && !isOperational) {
    console.error('[v1]', err.stack || err)
  }

  return res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && !isOperational && { stack: err.stack }),
  })
}

module.exports = v1ErrorHandler
