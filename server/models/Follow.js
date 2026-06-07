const mongoose = require('mongoose')

const followSchema = new mongoose.Schema(
  {
    // user who initiated the follow
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // user being followed
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // pending = follow request sent, waiting for acceptance
    // active  = follow request accepted / currently following
    // blocked = following user has blocked the follower
    status: {
      type: String,
      enum: ['pending', 'active', 'blocked'],
      default: 'pending',
    },
    // set when a follow request is sent
    requestedAt: {
      type: Date,
      default: null,
    },
    // set when the request is accepted
    followedAt: {
      type: Date,
      default: null,
    },
    // set when following user blocks the follower
    blockedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, collection: 'users-follow' }
)

// one relationship record per pair
followSchema.index({ follower: 1, following: 1 }, { unique: true })
// fast lookup: "who follows user X?" (followers list)
followSchema.index({ following: 1, status: 1 })
// fast lookup: "who does user X follow?" (following list)
followSchema.index({ follower: 1, status: 1 })

module.exports = mongoose.model('Follow', followSchema)
