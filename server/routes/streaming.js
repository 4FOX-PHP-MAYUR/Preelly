const express = require('express')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const authMiddleware = require('../middleware/auth')
const VideoAsset = require('../models/VideoAsset')
const { enqueueTranscode, isFfmpegAvailable, normalizeStatus } = require('../jobs/videoTranscodeQueue')
const { STREAMING_ROOT } = require('../services/ffmpegConfig')
const { validateUploadedVideo, sanitizeFilename } = require('../services/videoValidationService')

const router = express.Router()

if (!fs.existsSync(STREAMING_ROOT)) {
  fs.mkdirSync(STREAMING_ROOT, { recursive: true })
}

const incomingDir = path.join(STREAMING_ROOT, '_incoming')
if (!fs.existsSync(incomingDir)) {
  fs.mkdirSync(incomingDir, { recursive: true })
}

const MAX_UPLOAD_MB = Number(process.env.MAX_STREAMING_UPLOAD_MB || process.env.MAX_VIDEO_UPLOAD_MB || 2048)

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, incomingDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(sanitizeFilename(file.originalname)) || '.mp4'
      cb(null, `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
    },
  }),
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
    const ext = path.extname(file.originalname || '').toLowerCase()
    if (file.mimetype.startsWith('video/') && allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Only valid video files are allowed'))
    }
  },
})

/**
 * POST /api/streaming/upload
 * Upload MP4 → queue HLS transcode → poll GET /api/streaming/jobs/:id
 */
router.post('/upload', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'video file is required (field name: video)' })
    }

    const validation = validateUploadedVideo(req.file, { allowedRoot: incomingDir })
    if (!validation.valid) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ message: validation.error })
    }

    if (!isFfmpegAvailable()) {
      return res.status(503).json({
        message: 'FFmpeg is not available on this server. Install ffmpeg to enable adaptive streaming.',
      })
    }

    console.log('[streaming/upload] started:', req.file.originalname)

    const asset = await VideoAsset.create({
      userId: req.user._id,
      status: 'pending',
      originalFilename: req.file.originalname,
      originalPath: req.file.path,
      mp4FallbackUrl: null,
      fileSize: req.file.size,
      processingStage: 'pending',
    })

    const dest = path.join(STREAMING_ROOT, String(asset._id), 'source.mp4')
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.renameSync(req.file.path, dest)

    await VideoAsset.findByIdAndUpdate(asset._id, {
      originalPath: dest,
      outputDir: `/uploads/streaming/${asset._id}`,
    })

    enqueueTranscode({
      assetId: asset._id,
      inputPath: dest,
      productId: null,
      mp4FallbackUrl: null,
      useListingLayout: false,
    })

    console.log('[streaming/upload] completed, job queued:', asset._id)

    return res.status(202).json({
      jobId: asset._id,
      status: 'pending',
      message: 'Video uploaded. Transcoding started.',
      pollUrl: `/api/streaming/jobs/${asset._id}`,
    })
  } catch (err) {
    console.error('[streaming/upload]', err)
    return res.status(500).json({ message: err.message || 'Upload failed' })
  }
})

/**
 * GET /api/streaming/jobs/:id
 */
router.get('/jobs/:id', authMiddleware, async (req, res) => {
  try {
    const asset = await VideoAsset.findById(req.params.id).lean()
    if (!asset) return res.status(404).json({ message: 'Job not found' })

    const isOwner =
      String(asset.userId) === String(req.user._id) ||
      req.user.role === 'admin'
    if (!isOwner && asset.userId) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const status = normalizeStatus(asset.status)
    const stageLabels = {
      pending: 'Processing Video...',
      processing: 'Processing Video...',
      generating_thumbnail: 'Generating Thumbnail...',
      generating_streams: 'Generating Streaming Files...',
      completed: 'Video Ready',
      failed: 'Processing Failed',
    }

    return res.json({
      jobId: asset._id,
      status,
      processingStage: asset.processingStage || asset.status,
      message: stageLabels[asset.processingStage] || stageLabels[status] || 'Processing Video...',
      progress: asset.progress,
      originalUrl: asset.originalUrl || asset.mp4FallbackUrl,
      hlsUrl: asset.hlsUrl,
      masterPlaylistUrl: asset.masterPlaylistUrl || asset.hlsUrl,
      dashUrl: asset.dashUrl,
      thumbnail: asset.thumbnailUrl,
      thumbnailUrl: asset.thumbnailUrl,
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
      availableQualities: asset.availableQualities || (asset.renditions || []).map((r) => r.id),
      renditions: asset.renditions,
      retryCount: asset.retryCount,
      error: asset.error,
      errorLog: asset.errorLog,
      createdAt: asset.createdAt,
      startedAt: asset.startedAt,
      completedAt: asset.completedAt,
    })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

/**
 * GET /api/streaming/health
 */
router.get('/health', (_req, res) => {
  res.json({
    ffmpeg: isFfmpegAvailable(),
    storage: process.env.VIDEO_STORAGE_PROVIDER || 'local',
    streamingRoot: '/uploads/streaming',
    hlsRoot: '/uploads/videos',
    maxUploadMb: MAX_UPLOAD_MB,
  })
})

module.exports = router
