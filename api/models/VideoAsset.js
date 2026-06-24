const mongoose = require('mongoose')

const renditionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    height: { type: Number, required: true },
    width: { type: Number, default: 0 },
    bandwidth: { type: Number, default: 0 },
    hlsPath: { type: String, default: null },
  },
  { _id: false },
)

const errorLogEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    message: { type: String, required: true },
    attempt: { type: Number, default: 1 },
  },
  { _id: false },
)

const videoAssetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'ready', 'failed'],
      default: 'pending',
      index: true,
    },
    processingStage: {
      type: String,
      enum: ['pending', 'processing', 'generating_thumbnail', 'generating_streams', 'completed', 'failed'],
      default: 'pending',
    },
    originalFilename: { type: String, default: null },
    originalPath: { type: String, default: null },
    outputDir: { type: String, default: null },
    storageProvider: {
      type: String,
      enum: ['local', 's3', 'r2'],
      default: 'local',
    },
    originalUrl: { type: String, default: null },
    hlsUrl: { type: String, default: null },
    masterPlaylistUrl: { type: String, default: null },
    dashUrl: { type: String, default: null },
    thumbnailUrl: { type: String, default: null },
    mp4FallbackUrl: { type: String, default: null },
    duration: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    fileSize: { type: Number, default: 0 },
    availableQualities: [{ type: String }],
    renditions: [renditionSchema],
    progress: { type: Number, default: 0, min: 0, max: 100 },
    retryCount: { type: Number, default: 0 },
    error: { type: String, default: null },
    errorLog: [errorLogEntrySchema],
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

videoAssetSchema.index({ createdAt: -1 })

module.exports = mongoose.model('VideoAsset', videoAssetSchema)
