const mongoose = require('mongoose')

const phoneOtpSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    purpose: {
      type: String,
      required: true,
      enum: ['register', 'password_reset', 'login'],
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

phoneOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
phoneOtpSchema.index({ phone: 1, purpose: 1 }, { unique: true })

module.exports = mongoose.model('PhoneOtp', phoneOtpSchema)
