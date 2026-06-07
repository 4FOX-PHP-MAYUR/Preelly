const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ffmpeg, configureFfmpeg, isFfmpegAvailable, VIDEOS_HLS_ROOT } = require('../services/ffmpegConfig');
const { validateUploadedVideo, sanitizeFilename } = require('../services/videoValidationService');

configureFfmpeg();
const ffmpegAvailable = isFfmpegAvailable();

// Configurable max upload size (default 2GB for production, 20MB legacy cap for compression target)
const MAX_UPLOAD_BYTES = Number(process.env.MAX_VIDEO_UPLOAD_MB || 2048) * 1024 * 1024;
const MAX_COMPRESSED_BYTES = Number(process.env.MAX_COMPRESSED_VIDEO_MB || 20) * 1024 * 1024;

// ---------------------------
//  Create Required Folders
// ---------------------------
const uploadDir = path.join(__dirname, '../uploads');
const videosDir = path.join(uploadDir, 'videos');
const imagesDir = path.join(uploadDir, 'images');
const thumbsDir = path.join(videosDir, 'thumbnails');
const screenshotsDir = path.join(videosDir, 'screenshots');
const chatsDir = path.join(uploadDir, 'chats');

// Ensure all upload folders exist
[uploadDir, videosDir, imagesDir, thumbsDir, screenshotsDir, chatsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ---------------------------
//  Multer Storage (Images & Videos)
// ---------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'video') {
      cb(null, videosDir);
    } else {
      cb(null, imagesDir);
    }
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(sanitizeFilename(file.originalname)) || '.mp4';
    cb(null, file.fieldname + '-' + unique + ext);
  },
});

// ---------------------------
//  Generic File Storage (e.g. Excel/CSV)
// ---------------------------
const genericStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '';
    cb(null, (file.fieldname || 'file') + '-' + unique + ext);
  },
});

// ---------------------------
//  File Filter
// ---------------------------
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'video') {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/x-m4v'];
    const allowedExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (file.mimetype.startsWith('video/') && allowedMimes.includes(file.mimetype.toLowerCase()) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only valid video files are allowed (MP4, MOV, AVI, MKV, WebM)'), false);
    }
  } else {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'), false);
  }
};

// ---------------------------
//  Multer Upload Middleware
// ---------------------------
const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: MAX_UPLOAD_BYTES,
    files: 21 // 1 video + 20 images max
  },
});

// For non-image/video uploads (e.g. Excel/CSV) – no fileFilter
const uploadAny = multer({
  storage: genericStorage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
  },
});

// ---------------------------
//  Video Compression + Thumbnail
// ---------------------------
const compressVideo = (req, res, next) => {
  if (!req.files?.video?.[0]) return next()

  // Default: no auto screenshots (products route will enforce a fallback checklist).
  req.videoScreenshots = []

  // If ffmpeg is not installed, skip compression and screenshots.
  if (!ffmpegAvailable) {
    console.warn('Skipping video compression/screenshots: ffmpeg not available on server.')
    return next()
  }

  const file = req.files.video[0]
  const inputPath = file.path

  const baseName = path.basename(inputPath, path.extname(inputPath))
  const MIN_DURATION_SECONDS = 15
  const MAX_VIDEO_BYTES = MAX_COMPRESSED_BYTES
  const ANGLE_SCREENSHOT_COUNT = 5

  const safeUnlink = (p) => {
    try {
      if (p && fs.existsSync(p)) fs.unlinkSync(p)
    } catch (e) {
      // best-effort
    }
  }

  const ffprobeDurationSeconds = async (videoPath) =>
    new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) return reject(err)
        const d = metadata?.format?.duration
        if (!d || Number.isNaN(Number(d))) return reject(new Error('Unable to read video duration'))
        resolve(Number(d))
      })
    })

  const encodeVideo = async ({ input, output, crf, preset, maxrate }) =>
    new Promise((resolve, reject) => {
      const cmd = ffmpeg(input)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          `-crf ${crf}`,
          `-preset ${preset}`,
          '-movflags +faststart',
          '-pix_fmt yuv420p',
          '-profile:v high',
          '-level 4.1',
        ])

      if (maxrate) {
        // Helpful when enforcing a strict file size cap.
        cmd.outputOptions([`-maxrate ${maxrate}`, `-bufsize ${maxrate}`])
      }

      cmd
        .save(output)
        .on('end', resolve)
        .on('error', reject)
    })

  const extractScreenshots = async ({ input, timestamps, filenamePattern }) =>
    new Promise((resolve, reject) => {
      ffmpeg(input)
        .screenshots({
          timestamps,
          filename: filenamePattern,
          folder: screenshotsDir,
          size: '1280x720',
        })
        .on('end', resolve)
        .on('error', reject)
    })

  const run = async () => {
    // Security: validate MIME, extension, magic bytes
    const validation = validateUploadedVideo(file, { allowedRoot: videosDir })
    if (!validation.valid) {
      safeUnlink(inputPath)
      return res.status(400).json({ message: validation.error })
    }

    console.log('[upload] video upload started:', file.originalname, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`)

    // Duration validation
    const durationSeconds = await ffprobeDurationSeconds(inputPath)
    if (durationSeconds < MIN_DURATION_SECONDS) {
      safeUnlink(inputPath)
      return res.status(400).json({ message: 'Video must be at least 15 seconds long.' })
    }

    // Compression attempts (H.264 / AAC) with a hard size cap.
    const compressedName = `${baseName}-compressed.mp4`
    const compressedPath = path.join(videosDir, compressedName)

    const attempts = [
      { crf: 23, preset: 'medium', maxrate: null },
      { crf: 27, preset: 'fast', maxrate: '1.5M' },
    ]

    let success = false
    let lastError = null
    for (const attempt of attempts) {
      safeUnlink(compressedPath)
      try {
        await encodeVideo({
          input: inputPath,
          output: compressedPath,
          crf: attempt.crf,
          preset: attempt.preset,
          maxrate: attempt.maxrate,
        })

        const stat = fs.statSync(compressedPath)
        if (stat.size <= MAX_VIDEO_BYTES) {
          success = true
          break
        }
      } catch (e) {
        lastError = e
      }
    }

    if (!success) {
      safeUnlink(compressedPath)
      safeUnlink(inputPath)
      return res.status(400).json({
        message: 'Video is too large. Please upload a video that compresses to <= 20MB.',
        details: lastError ? lastError.message : undefined,
      })
    }

    // Thumbnail for backward compatibility (single frame at 1s)
    const thumbName = `${baseName}.jpg`
    try {
      await new Promise((resolve, reject) => {
        ffmpeg(compressedPath)
          .screenshots({
            timestamps: ['1'],
            filename: thumbName,
            folder: thumbsDir,
            size: '720x?',
          })
          .on('end', resolve)
          .on('error', reject)
      })
    } catch (e) {
      // best-effort only
    }

    // Extract keyframe-like “angles” (sample across the timeline).
    // We capture 5 evenly spaced frames and let the DB store a timestamp mapping.
    const safeDuration = Math.max(0, durationSeconds)
    const timestamps = Array.from({ length: ANGLE_SCREENSHOT_COUNT }, (_, i) => {
      const ratio = (i + 1) / (ANGLE_SCREENSHOT_COUNT + 1) // 1/6..5/6
      return Math.max(0, safeDuration * ratio)
    })

    const filenamePattern = `${baseName}-angle-%03d.jpg`
    try {
      await extractScreenshots({ input: compressedPath, timestamps, filenamePattern })
    } catch (e) {
      // Fallback: try extracting only 3 frames.
      try {
        const fallbackTimestamps = [0.25, 0.5, 0.75].map((r) => Math.max(0, safeDuration * r))
        const fallbackPattern = `${baseName}-angle-%03d.jpg`
        await extractScreenshots({ input: compressedPath, timestamps: fallbackTimestamps, filenamePattern: fallbackPattern })
      } catch (fallbackErr) {
        // still continue; product create route will enforce fallback checklist
      }
    }

    // Discover extracted files and map them back to the intended timestamps by order.
    // baseName is unique per upload, so filtering by prefix is safe.
    const extractedFiles = fs
      .readdirSync(screenshotsDir)
      .filter((fn) => fn.startsWith(`${baseName}-angle-`) && fn.endsWith('.jpg'))
      .sort()

    // Map extracted screenshots to our sampling timestamps.
    const mapped = extractedFiles.slice(0, timestamps.length).map((fn, idx) => ({
      url: `/uploads/videos/screenshots/${fn}`,
      timestamp: timestamps[idx],
      source: 'auto',
    }))

    // Ensure we attach something predictable for downstream validation.
    req.videoScreenshots = mapped

    // Update file metadata for products route.
    file.compressedFilename = compressedName
    file.thumbnailFilename = thumbName
    file.path = compressedPath

    // Remove original file once we have the compressed output and screenshots.
    safeUnlink(inputPath)

    next()
  }

  run().catch((e) => {
    console.error('Video processing error:', e)
    safeUnlink(inputPath)
    // Still allow listing creation if the raw upload is valid — product route accepts user images without auto angles.
    if (req.files?.video?.[0]) {
      const file = req.files.video[0]
      if (fs.existsSync(file.path)) {
        file.compressedFilename = path.basename(file.path)
        req.videoScreenshots = []
        return next()
      }
    }
    return res.status(400).json({
      message: 'Video processing failed. Try a shorter clip or upload photos in the images step.',
      details: e?.message,
    })
  })
};

// ---------------------------
//  Chat Attachment Upload
// ---------------------------
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, chatsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '';
    cb(null, 'chat-' + unique + ext);
  },
});

const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

module.exports = { upload, uploadAny, compressVideo, chatUpload };
