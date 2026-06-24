const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'call', 'file'],
      default: 'text',
    },
    text: {
      type: String,
      required: function () { return this.type === 'text' },
      default: '',
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    attachment: {
      url:      { type: String },
      mimeType: { type: String },
      name:     { type: String },
      size:     { type: Number },
    },
    attachments: [{
      url:      { type: String },
      mimeType: { type: String },
      name:     { type: String },
      size:     { type: Number },
    }],
    callMeta: {
      callType: { type: String, enum: ['video', 'audio'] },
      status:   { type: String, enum: ['completed', 'missed', 'rejected', 'cancelled'] },
      duration: { type: Number, default: 0 },
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Index for efficient queries
messageSchema.index({ chat: 1, createdAt: 1 })
messageSchema.index({ sender: 1 })
messageSchema.index({ read: 1 })

module.exports = mongoose.model('Message', messageSchema)
