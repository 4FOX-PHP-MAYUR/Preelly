const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const ffmpeg = require('fluent-ffmpeg')

let ffmpegAvailable = false
let resolvedPaths = { ffmpegPath: null, ffprobePath: null }

const COMMON_FFMPEG_PATHS = [
  process.env.FFMPEG_PATH,
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/opt/local/bin/ffmpeg',
  '/usr/bin/ffmpeg',
].filter(Boolean)

const COMMON_FFPROBE_PATHS = [
  process.env.FFPROBE_PATH,
  '/opt/homebrew/bin/ffprobe',
  '/usr/local/bin/ffprobe',
  '/opt/local/bin/ffprobe',
  '/usr/bin/ffprobe',
].filter(Boolean)

function fileExists(p) {
  try {
    return p && fs.existsSync(p) && fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function tryWhich(bin) {
  try {
    const which = require('which')
    return which.sync(bin)
  } catch {
    return null
  }
}

function verifyBinary(binPath) {
  try {
    execFileSync(binPath, ['-version'], { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

function resolveBinary(candidates, fallbackName) {
  for (const candidate of candidates) {
    if (fileExists(candidate) && verifyBinary(candidate)) {
      return candidate
    }
  }
  const fromPath = tryWhich(fallbackName)
  if (fromPath && verifyBinary(fromPath)) {
    return fromPath
  }
  return null
}

function configureFfmpeg() {
  const ffmpegPath = resolveBinary(COMMON_FFMPEG_PATHS, 'ffmpeg')
  const ffprobePath = resolveBinary(COMMON_FFPROBE_PATHS, 'ffprobe')

  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath)
  }
  if (ffprobePath) {
    ffmpeg.setFfprobePath(ffprobePath)
  }

  ffmpegAvailable = Boolean(ffmpegPath && ffprobePath)
  resolvedPaths = { ffmpegPath, ffprobePath }

  if (ffmpegAvailable) {
    console.log('[ffmpeg] ready:', ffmpegPath)
  } else {
    const missing = []
    if (!ffmpegPath) missing.push('ffmpeg')
    if (!ffprobePath) missing.push('ffprobe')
    console.warn(
      `[ffmpeg] ${missing.join(' and ')} not found. Install FFmpeg to enable video compression, screenshots, and HLS/DASH streaming.`,
    )
    console.warn(getFfmpegInstallHint())
  }

  return { ...resolvedPaths, available: ffmpegAvailable }
}

function isFfmpegAvailable() {
  return ffmpegAvailable
}

function getResolvedPaths() {
  return { ...resolvedPaths }
}

function getFfmpegInstallHint() {
  return 'Install: macOS → `brew install ffmpeg` | Ubuntu → `sudo apt install ffmpeg` | Then set FFMPEG_PATH and FFPROBE_PATH in .env if needed.'
}

function requireFfmpeg(res) {
  if (ffmpegAvailable) return true
  if (res) {
    res.status(503).json({
      message: 'FFmpeg is not installed on this server. Screenshot and video processing are unavailable.',
      hint: getFfmpegInstallHint(),
      ffmpeg: false,
    })
  }
  return false
}

const UPLOADS_ROOT = path.join(__dirname, '../uploads')
const VIDEOS_HLS_ROOT = path.join(UPLOADS_ROOT, 'videos')

function ensureUploadDirs() {
  for (const dir of [
    UPLOADS_ROOT,
    VIDEOS_HLS_ROOT,
    path.join(UPLOADS_ROOT, 'streaming'),
    path.join(VIDEOS_HLS_ROOT, 'temp'),
  ]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}

ensureUploadDirs()

module.exports = {
  ffmpeg,
  configureFfmpeg,
  isFfmpegAvailable,
  getResolvedPaths,
  getFfmpegInstallHint,
  requireFfmpeg,
  UPLOADS_ROOT,
  VIDEOS_HLS_ROOT,
  STREAMING_ROOT: path.join(UPLOADS_ROOT, 'streaming'),
}
