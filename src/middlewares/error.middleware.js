const { validationResult } = require('express-validator');
const { error: apiError } = require('../utils/apiResponse');

// Middleware to handle express-validator results
const validationResultHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const extracted = errors.array().map((err) => ({ param: err.param, msg: err.msg }));
    return apiError(res, 'Validation failed', { errors: extracted }, 400);
  }
  return next();
};

// Centralized error handler for app
const errorHandler = (err, req, res, next) => {
  // If response already sent, delegate to default
  if (res.headersSent) {
    return next(err);
  }
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  // For debug, you might include stack in non-production
  return apiError(res, message, process.env.NODE_ENV === 'production' ? null : { stack: err.stack }, statusCode);
};

module.exports = {
  validationResultHandler,
  errorHandler,
};

