const success = (res, message = 'Success', data = null, meta = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
  });
};

const error = (res, message = 'Error', data = null, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data,
  });
};

module.exports = {
  success,
  error,
};

