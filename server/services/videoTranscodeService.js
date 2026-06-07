const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const { promisify } = require('util')
const { ffmpeg, isFfmpegAvailable, configureFfmpeg } = require('./ffmpegConfig')

const execFileAsync = promisify(execFile)

function getFfmpegBin() {
  configureFfmpeg()
  try {
    const which = require('which')
    return process.env.FFMPEG_PATH || which.sync('ffmpeg')
  } catch {
    return process.env.FFMPEG_PATH || 'ffmpeg'
  }
}

const {
  ensureListingHlsDir,
  ensureStreamingDir,
  getListingHlsPaths,
  getAssetPaths,
  publishListingToRemote,
  publishToRemote,
  buildListingHlsUrls,
  buildStreamingUrls,
  cleanupTempDir,
} = require('./videoStorageService')

/** Adaptive bitrate ladder — 1080p / 720p / 480p / 360p per spec */
const RENDITION_PRESETS = [
  {
    id: '360p',
    width: 640,
    height: 360,
    bandwidth: 800000,
    videoBitrate: '800k',
    audioBitrate: '96k',
    maxrate: '856k',
    bufsize: '1200k',
  },
  {
    id: '480p',
    width: 854,
    height: 480,
    bandwidth: 1400000,
    videoBitrate: '1400k',
    audioBitrate: '128k',
    maxrate: '1498k',
    bufsize: '2100k',
  },
  {
    id: '720p',
    width: 1280,
    height: 720,
    bandwidth: 2500000,
    videoBitrate: '2500k',
    audioBitrate: '128k',
    maxrate: '2675k',
    bufsize: '3750k',
  },
  {
    id: '1080p',
    width: 1920,
    height: 1080,
    bandwidth: 5000000,
    videoBitrate: '5000k',
    audioBitrate: '192k',
    maxrate: '5350k',
    bufsize: '7500k',
  },
]

function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err)
      const videoStream = (metadata.streams || []).find((s) => s.codec_type === 'video')
      const duration = Number(metadata?.format?.duration || 0)
      const width = videoStream?.width || 0
      const height = videoStream?.height || 0
      const fileSize = Number(metadata?.format?.size || 0)
      resolve({ duration, width, height, fileSize })
    })
  })
}

function runFfmpeg(inputPath, outputOptions, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath)
    if (Array.isArray(outputOptions)) {
      cmd.outputOptions(outputOptions)
    }
    cmd
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })
}

function selectRenditions(sourceHeight) {
  const h = sourceHeight || 720
  const selected = RENDITION_PRESETS.filter((r) => h >= r.height * 0.85)
  if (!selected.length) return [RENDITION_PRESETS[0]]
  return selected
}

/**
 * Extract thumbnail — prefer frame at ~3s; use best available for short clips.
 */
async function generateThumbnail(inputPath, outputPath, durationSeconds) {
  const dur = durationSeconds || 0
  const timestamp = dur >= 3 ? 3 : Math.max(0, dur * 0.35)
  const tsLabel = timestamp.toFixed(2)

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [tsLabel],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '1280x720',
      })
      .on('end', resolve)
      .on('error', reject)
  })

  console.log(`[transcode] thumbnail generated at ${tsLabel}s → ${outputPath}`)
}

/**
 * Encode one HLS rendition: playlist at root ({id}.m3u8), segments in segments/
 */
async function encodeHlsRendition(inputPath, paths, preset) {
  const playlistPath = path.join(paths.root, `${preset.id}.m3u8`)
  const segmentPattern = path.join(paths.segmentsDir, `${preset.id}_%03d.ts`)

  const scaleFilter = `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2`

  await runFfmpeg(inputPath, [
    `-vf ${scaleFilter}`,
    '-c:v libx264',
    '-preset veryfast',
    '-profile:v main',
    '-pix_fmt yuv420p',
    `-b:v ${preset.videoBitrate}`,
    `-maxrate ${preset.maxrate}`,
    `-bufsize ${preset.bufsize}`,
    '-c:a aac',
    `-b:a ${preset.audioBitrate}`,
    '-ac 2',
    '-ar 48000',
    '-hls_time 4',
    '-hls_playlist_type vod',
    '-hls_flags independent_segments',
    `-hls_segment_filename ${segmentPattern}`,
    '-f hls',
  ], playlistPath)

  console.log(`[transcode] encoded ${preset.id} → ${playlistPath}`)

  return {
    id: preset.id,
    height: preset.height,
    width: preset.width,
    bandwidth: preset.bandwidth,
    hlsPath: `/${preset.id}.m3u8`,
  }
}

function writeMasterPlaylist(rootDir, renditions) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3']
  for (const r of renditions) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height},CODECS="avc1.4d401f,mp4a.40.2"`,
    )
    lines.push(`${r.id}.m3u8`)
  }
  const masterPath = path.join(rootDir, 'master.m3u8')
  fs.writeFileSync(masterPath, lines.join('\n') + '\n')
  console.log(`[transcode] master playlist → ${masterPath}`)
}

/** Legacy nested HLS layout for backward-compatible standalone uploads */
async function encodeLegacyHlsRendition(inputPath, hlsDir, preset) {
  const renditionDir = path.join(hlsDir, preset.id)
  fs.mkdirSync(renditionDir, { recursive: true })
  const playlistPath = path.join(renditionDir, 'index.m3u8')
  const segmentPattern = path.join(renditionDir, 'seg%03d.ts')

  await runFfmpeg(inputPath, [
    `-vf scale=-2:${preset.height}`,
    '-c:v libx264',
    '-preset veryfast',
    '-profile:v main',
    '-pix_fmt yuv420p',
    `-b:v ${preset.videoBitrate}`,
    `-maxrate ${preset.maxrate}`,
    `-bufsize ${preset.bufsize}`,
    '-c:a aac',
    `-b:a ${preset.audioBitrate}`,
    '-ac 2',
    '-ar 48000',
    '-hls_time 4',
    '-hls_playlist_type vod',
    '-hls_flags independent_segments',
    `-hls_segment_filename ${segmentPattern}`,
    '-f hls',
  ], playlistPath)

  return {
    id: preset.id,
    height: preset.height,
    width: Math.round((preset.height * 16) / 9),
    bandwidth: preset.bandwidth,
    hlsPath: `/${preset.id}/index.m3u8`,
  }
}

function writeLegacyMasterPlaylist(hlsDir, renditions, sourceWidth, sourceHeight) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3']
  for (const r of renditions) {
    const w = r.width || Math.round((r.height * sourceWidth) / Math.max(sourceHeight, 1)) || 640
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${w}x${r.height},CODECS="avc1.4d401f,mp4a.40.2"`,
    )
    lines.push(`${r.id}/index.m3u8`)
  }
  fs.writeFileSync(path.join(hlsDir, 'master.m3u8'), lines.join('\n') + '\n')
}

async function encodeDash(inputPath, dashDir, presets) {
  fs.mkdirSync(dashDir, { recursive: true })
  const manifestPath = path.join(dashDir, 'manifest.mpd')
  if (!presets.length) throw new Error('No renditions selected for DASH')

  const args = ['-y', '-i', inputPath]
  for (let i = 0; i < presets.length; i += 1) {
    args.push('-map', '0:v:0', '-map', '0:a:0')
  }
  args.push('-c:v', 'libx264', '-c:a', 'aac', '-preset', 'veryfast', '-pix_fmt', 'yuv420p')
  presets.forEach((p, idx) => {
    args.push(`-filter:v:${idx}`, `scale=-2:${p.height}`)
    args.push(`-b:v:${idx}`, p.videoBitrate)
    args.push(`-maxrate:v:${idx}`, p.maxrate)
    args.push(`-bufsize:v:${idx}`, p.bufsize)
    args.push(`-b:a:${idx}`, p.audioBitrate)
  })
  args.push(
    '-use_timeline', '1',
    '-use_template', '1',
    '-seg_duration', '4',
    '-init_seg_name', 'init-$RepresentationID$.m4s',
    '-media_seg_name', 'chunk-$RepresentationID$-$Number%05d$.m4s',
    '-adaptation_sets', 'id=0,streams=v id=1,streams=a',
    '-f', 'dash',
    manifestPath,
  )

  await execFileAsync(getFfmpegBin(), args, { maxBuffer: 1024 * 1024 * 64 })
}

/**
 * Product-linked HLS transcode — uploads/videos/{listingId}/ layout.
 */
async function transcodeToHlsForListing({
  listingId,
  inputPath,
  onProgress,
  onStage,
}) {
  if (!isFfmpegAvailable()) {
    throw new Error('FFmpeg is not installed. Set FFMPEG_PATH or install ffmpeg on the server.')
  }
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input video not found: ${inputPath}`)
  }

  console.log(`[transcode] started listing=${listingId} input=${inputPath}`)
  const stage = (name, pct) => {
    if (typeof onStage === 'function') onStage(name)
    if (typeof onProgress === 'function') onProgress(Math.min(100, Math.max(0, pct)))
  }

  ensureListingHlsDir(listingId)
  const paths = getListingHlsPaths(listingId)

  stage('processing', 5)
  const probe = await probeVideo(inputPath)
  stage('generating_thumbnail', 10)

  await generateThumbnail(inputPath, paths.thumbnail, probe.duration)
  stage('generating_streams', 20)

  const presets = selectRenditions(probe.height)
  const renditions = []
  const perRendition = 55 / Math.max(presets.length, 1)

  for (let i = 0; i < presets.length; i += 1) {
    const r = await encodeHlsRendition(inputPath, paths, presets[i])
    renditions.push(r)
    stage('generating_streams', 20 + perRendition * (i + 1))
  }

  writeMasterPlaylist(paths.root, renditions)
  stage('generating_streams', 80)

  const storageResult = await publishListingToRemote(listingId, paths.root)
  const urls = buildListingHlsUrls(listingId, storageResult)
  stage('completed', 100)

  console.log(`[transcode] completed listing=${listingId} hls=${urls.hlsUrl}`)

  return {
    ...urls,
    duration: probe.duration,
    width: probe.width,
    height: probe.height,
    fileSize: probe.fileSize,
    renditions,
    availableQualities: renditions.map((r) => r.id),
    outputDir: paths.relBase,
  }
}

/**
 * Legacy adaptive transcode (standalone uploads) — HLS + DASH under uploads/streaming/{assetId}/.
 */
async function transcodeToAdaptiveStreaming({
  assetId,
  inputPath,
  onProgress,
  onStage,
}) {
  if (!isFfmpegAvailable()) {
    throw new Error('FFmpeg is not installed. Set FFMPEG_PATH or install ffmpeg on the server.')
  }
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input video not found: ${inputPath}`)
  }

  const stage = (name, pct) => {
    if (typeof onStage === 'function') onStage(name)
    if (typeof onProgress === 'function') onProgress(Math.min(100, Math.max(0, pct)))
  }

  const root = ensureStreamingDir(assetId)
  const paths = getAssetPaths(assetId)
  fs.mkdirSync(paths.hlsDir, { recursive: true })
  fs.mkdirSync(paths.dashDir, { recursive: true })

  stage('processing', 5)
  const probe = await probeVideo(inputPath)
  stage('generating_thumbnail', 10)

  await generateThumbnail(inputPath, paths.thumbnail, probe.duration)
  stage('generating_streams', 15)

  const presets = selectRenditions(probe.height || 720)
  const renditions = []

  const perRendition = 50 / Math.max(presets.length, 1)
  for (let i = 0; i < presets.length; i += 1) {
    const r = await encodeLegacyHlsRendition(inputPath, paths.hlsDir, presets[i])
    renditions.push(r)
    stage('generating_streams', 15 + perRendition * (i + 1))
  }

  writeLegacyMasterPlaylist(paths.hlsDir, renditions, probe.width, probe.height)
  stage('generating_streams', 70)

  try {
    await encodeDash(inputPath, paths.dashDir, presets)
  } catch (dashErr) {
    console.warn('[transcode] DASH generation failed (HLS still available):', dashErr.message)
  }
  stage('generating_streams', 90)

  const storageResult = await publishToRemote(assetId, root)
  const urls = buildStreamingUrls(assetId, storageResult)
  stage('completed', 100)

  return {
    ...urls,
    duration: probe.duration,
    width: probe.width,
    height: probe.height,
    fileSize: probe.fileSize,
    renditions,
    availableQualities: renditions.map((r) => r.id),
    outputDir: root,
  }
}

module.exports = {
  RENDITION_PRESETS,
  probeVideo,
  transcodeToHlsForListing,
  transcodeToAdaptiveStreaming,
  selectRenditions,
  generateThumbnail,
  cleanupTempDir,
}
