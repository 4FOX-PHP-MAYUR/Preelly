const mongoose = require('mongoose')

// A user-submitted report against another user, optionally tied to a chat thread.
// Reviewed by admins; `status` moves pending → reviewed / resolved / dismissed.
// Legacy value `actioned` is retained for backward compatibility (treated as resolved).
const REPORT_STATUSES = ['pending', 'reviewed', 'resolved', 'dismissed', 'actioned']

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      default: null,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    details: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'pending',
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminNotes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
)

reportSchema.index({ reportedUser: 1, status: 1, createdAt: -1 })
reportSchema.index({ status: 1, createdAt: -1 })
reportSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Report', reportSchema)
module.exports.REPORT_STATUSES = REPORT_STATUSES
