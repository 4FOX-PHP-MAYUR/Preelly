const mongoose = require('mongoose')

const commentReportSchema = new mongoose.Schema(
  {
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      required: true,
      index: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      enum: ['fake', 'abusive', 'spam', 'harassment', 'other'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'resolved-removed', 'resolved-ignored'],
      default: 'pending',
      index: true,
    },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

commentReportSchema.index({ comment: 1, reportedBy: 1 })
commentReportSchema.index({ status: 1, createdAt: -1 })

const CommentReport = mongoose.model('CommentReport', commentReportSchema)

module.exports = CommentReport
