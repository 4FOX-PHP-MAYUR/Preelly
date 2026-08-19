const mongoose = require('mongoose')

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      // Mobile only — the browser client does not register FCM tokens, so a
      // 'web' value is rejected rather than silently stored and pushed to.
      enum: ['android', 'ios'],
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
      trim: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('DeviceToken', deviceTokenSchema)
