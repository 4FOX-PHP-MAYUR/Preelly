const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    // approved = published (live). pending kept for legacy docs only; new comments are always approved.
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
      index: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    parentID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Index for efficient queries
commentSchema.index({ product: 1, createdAt: -1 })
commentSchema.index({ user: 1 })

commentSchema.pre('save', function syncParentFields() {
  if (this.parentID && !this.parentComment) {
    this.parentComment = this.parentID
  } else if (this.parentComment && !this.parentID) {
    this.parentID = this.parentComment
  }
})

// Populate user by default
// Use async/returned middleware (no next) to be compatible with current Mongoose hook signature
commentSchema.pre(/^find/, function () {
  this.populate({
    path: 'user',
    select: 'name avatar',
  })
})

const Comment = mongoose.model('Comment', commentSchema)

module.exports = Comment

