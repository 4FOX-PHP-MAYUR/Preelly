const fs = require('fs')
const path = require('path')

const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'])
const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/x-m4v',
])

// Magic bytes for common video containers
const MAGIC_SIGNATURES = [
  { ext: '.mp4', bytes: [0x00, 0x00, 0x00], offset: 0, check: (buf) => {
    // MP4/MOV: ftyp box at offset 4
    if (buf.length < 12) return false
    return buf.slice(4, 8).toString('ascii') === 'ftyp'
  }},
  { ext: '.webm', bytes: [0x1a, 0x45, 0xdf, 0xa3], offset: 0 },
  { ext: '.avi', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
  { ext: '.mkv', bytes: [0x1a, 0x45, 0xdf, 0xa3], offset: 0 },
]

function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'video.mp4'
  const base = path.basename(filename)
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}

function isPathTraversal(targetPath, allowedRoot) {
  const resolved = path.resolve(targetPath)
  const root = path.resolve(allowedRoot)
  return !resolved.startsWith(root + path.sep) && resolved !== root
}

function validateVideoExtension(filename) {
  const ext = path.extname(filename || '').toLowerCase()
  if (!ALLOWED_VIDEO_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Invalid video extension: ${ext || 'none'}. Allowed: ${[...ALLOWED_VIDEO_EXTENSIONS].join(', ')}` }
  }
  return { valid: true, ext }
}

function validateVideoMime(mimetype) {
  if (!mimetype || !ALLOWED_VIDEO_MIMES.has(mimetype.toLowerCase())) {
    return { valid: false, error: `Invalid MIME type: ${mimetype || 'unknown'}. Only video files are allowed.` }
  }
  return { valid: true }
}

function validateVideoMagicBytes(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(16)
    fs.readSync(fd, buf, 0, 16, 0)
    fs.closeSync(fd)

    for (const sig of MAGIC_SIGNATURES) {
      if (sig.check) {
        if (sig.check(buf)) return { valid: true }
        continue
      }
      const slice = buf.slice(sig.offset, sig.offset + sig.bytes.length)
      if (slice.length === sig.bytes.length && sig.bytes.every((b, i) => slice[i] === b)) {
        return { valid: true }
      }
    }
    return { valid: false, error: 'File does not appear to be a valid video (corrupted or unsupported format).' }
  } catch (err) {
    return { valid: false, error: `Unable to read file for validation: ${err.message}` }
  }
}

/**
 * Full validation for uploaded video files.
 */
function validateUploadedVideo(file, { allowedRoot } = {}) {
  if (!file || !file.path) {
    return { valid: false, error: 'No video file provided' }
  }

  const extResult = validateVideoExtension(file.originalname || file.filename)
  if (!extResult.valid) return extResult

  const mimeResult = validateVideoMime(file.mimetype)
  if (!mimeResult.valid) return mimeResult

  if (allowedRoot && isPathTraversal(file.path, allowedRoot)) {
    return { valid: false, error: 'Invalid file path (path traversal detected)' }
  }

  const magicResult = validateVideoMagicBytes(file.path)
  if (!magicResult.valid) return magicResult

  return { valid: true, ext: extResult.ext }
}

module.exports = {
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_VIDEO_MIMES,
  sanitizeFilename,
  isPathTraversal,
  validateVideoExtension,
  validateVideoMime,
  validateVideoMagicBytes,
  validateUploadedVideo,
}
