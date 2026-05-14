const mongoose = require('mongoose')

const emailOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    purpose: {
      type: String,
      required: true,
      enum: ['register'],
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

// Mongo TTL index to automatically expire OTP docs.
emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
emailOtpSchema.index({ email: 1, purpose: 1 }, { unique: true })

module.exports = mongoose.model('EmailOtp', emailOtpSchema)

