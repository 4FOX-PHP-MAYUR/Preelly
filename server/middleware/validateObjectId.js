const mongoose = require('mongoose')

module.exports = function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const id = req.params && req.params[paramName]
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      console.warn(`Invalid ObjectId for param ${paramName}:`, id, 'path=', req.originalUrl, 'ip=', req.ip)
      return res.status(400).json({ message: 'Invalid or missing id' })
    }
    next()
  }
}

