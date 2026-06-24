const path = require('path')
const fs = require('fs')
const { STREAMING_ROOT, VIDEOS_HLS_ROOT } = require('./ffmpegConfig')

const BASE_URL = (process.env.BASE_URL || process.env.BACKEND_URL || 'http://localhost:8029').replace(/\/$/, '')
const CDN_BASE_URL = (process.env.CDN_BASE_URL || '').replace(/\/$/, '')
const STORAGE_PROVIDER = (process.env.VIDEO_STORAGE_PROVIDER || 'local').toLowerCase()

function getPublicBaseUrl() {
  return CDN_BASE_URL || BASE_URL
}

function toPublicUrl(relativePath) {
  if (!relativePath) return null
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath
  }
  const normalized = relativePath.startsWith('/') ? relativePath : `/${relativePath}`
  return `${getPublicBaseUrl()}${normalized}`
}

function getStorageClient() {
  const bucket = process.env.AWS_S3_BUCKET || process.env.R2_BUCKET
  const region = process.env.AWS_REGION || process.env.R2_REGION || 'auto'
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null
  }

  const { S3Client } = require('@aws-sdk/client-s3')
  const config = { region, credentials: { accessKeyId, secretAccessKey } }

  // Cloudflare R2 or custom S3-compatible endpoint
  const endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT
  if (endpoint) {
    config.endpoint = endpoint
    config.forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true'
  }

  return { client: new S3Client(config), bucket }
}

function ensureListingHlsDir(listingId) {
  const dir = path.join(VIDEOS_HLS_ROOT, String(listingId))
  const segmentsDir = path.join(dir, 'segments')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(segmentsDir)) fs.mkdirSync(segmentsDir, { recursive: true })
  return dir
}

/** @deprecated legacy assetId layout — kept for backward-compatible reads */
function ensureStreamingDir(assetId) {
  const dir = path.join(STREAMING_ROOT, String(assetId))
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * HLS output paths for a listing (new layout):
 * uploads/videos/{listingId}/master.m3u8, {quality}.m3u8, segments/, thumbnail.jpg
 */
function getListingHlsPaths(listingId) {
  const root = path.join(VIDEOS_HLS_ROOT, String(listingId))
  const relBase = `/uploads/videos/${listingId}`
  return {
    root,
    segmentsDir: path.join(root, 'segments'),
    thumbnail: path.join(root, 'thumbnail.jpg'),
    masterHls: path.join(root, 'master.m3u8'),
    masterHlsRel: `${relBase}/master.m3u8`,
    thumbnailRel: `${relBase}/thumbnail.jpg`,
    relBase,
  }
}

/** @deprecated legacy paths under uploads/streaming/{assetId} */
function getAssetPaths(assetId) {
  const root = path.join(STREAMING_ROOT, String(assetId))
  return {
    root,
    hlsDir: path.join(root, 'hls'),
    dashDir: path.join(root, 'dash'),
    thumbnail: path.join(root, 'thumbnail.jpg'),
    masterHls: '/uploads/streaming/' + assetId + '/hls/master.m3u8',
    dashManifest: '/uploads/streaming/' + assetId + '/dash/manifest.mpd',
    thumbnailRel: '/uploads/streaming/' + assetId + '/thumbnail.jpg',
  }
}

function mimeFor(filePath) {
  if (filePath.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl'
  if (filePath.endsWith('.mpd')) return 'application/dash+xml'
  if (filePath.endsWith('.ts')) return 'video/mp2t'
  if (filePath.endsWith('.m4s')) return 'video/iso.segment'
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg'
  if (filePath.endsWith('.mp4')) return 'video/mp4'
  return 'application/octet-stream'
}

function walkDir(dir, rel = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    const relPath = rel ? `${rel}/${ent.name}` : ent.name
    if (ent.isDirectory()) files.push(...walkDir(full, relPath))
    else files.push({ full, relPath })
  }
  return files
}

async function uploadFolderToRemote(localRoot, remotePrefix) {
  const storage = getStorageClient()
  if (!storage || (STORAGE_PROVIDER !== 's3' && STORAGE_PROVIDER !== 'r2')) {
    return { provider: 'local', baseUrl: getPublicBaseUrl() }
  }

  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
  const { client, bucket } = storage

  try {
    const files = walkDir(localRoot)
    for (const file of files) {
      const key = `${remotePrefix}/${file.relPath}`.replace(/\\/g, '/')
      const body = fs.createReadStream(file.full)
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: mimeFor(file.full),
          CacheControl:
            file.relPath.endsWith('.m3u8') || file.relPath.endsWith('.mpd')
              ? 'max-age=60'
              : 'max-age=31536000',
        }),
      )
    }

    const publicUrl =
      process.env.R2_PUBLIC_URL ||
      process.env.AWS_S3_PUBLIC_URL ||
      (process.env.R2_ENDPOINT
        ? `${process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT}/${bucket}`
        : `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`)

    return { provider: STORAGE_PROVIDER, baseUrl: publicUrl.replace(/\/$/, '') }
  } catch (err) {
    console.error('[videoStorage] remote upload failed:', err.message)
    return { provider: 'local', baseUrl: getPublicBaseUrl() }
  }
}

/**
 * Publish listing HLS folder to remote storage (S3 / R2) when configured.
 */
async function publishListingToRemote(listingId, localRoot) {
  if (STORAGE_PROVIDER === 'local') {
    return { provider: 'local', baseUrl: getPublicBaseUrl() }
  }
  return uploadFolderToRemote(localRoot, `videos/${listingId}`)
}

/** @deprecated */
async function publishToRemote(assetId, localRoot) {
  if (STORAGE_PROVIDER === 'local') {
    return { provider: 'local', baseUrl: getPublicBaseUrl() }
  }
  return uploadFolderToRemote(localRoot, `streaming/${assetId}`)
}

function buildListingHlsUrls(listingId, storageResult) {
  const base = storageResult.baseUrl
  const prefix =
    storageResult.provider === 'local'
      ? `${base}/uploads/videos/${listingId}`
      : `${base}/videos/${listingId}`

  return {
    hlsUrl: `${prefix}/master.m3u8`,
    masterPlaylistUrl: `${prefix}/master.m3u8`,
    thumbnailUrl: `${prefix}/thumbnail.jpg`,
    storageProvider: storageResult.provider,
  }
}

/** @deprecated legacy URL builder */
function buildStreamingUrls(assetId, storageResult) {
  const base = storageResult.baseUrl
  const prefix =
    storageResult.provider === 's3' || storageResult.provider === 'r2'
      ? `${base}/streaming/${assetId}`
      : `${base}/uploads/streaming/${assetId}`

  return {
    hlsUrl: `${prefix}/hls/master.m3u8`,
    masterPlaylistUrl: `${prefix}/hls/master.m3u8`,
    dashUrl: `${prefix}/dash/manifest.mpd`,
    thumbnailUrl: `${prefix}/thumbnail.jpg`,
    storageProvider: storageResult.provider,
  }
}

function cleanupTempDir(tempDir) {
  if (!tempDir || !fs.existsSync(tempDir)) return
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
    console.log('[videoStorage] cleaned temp dir:', tempDir)
  } catch (err) {
    console.warn('[videoStorage] temp cleanup failed:', err.message)
  }
}

module.exports = {
  STREAMING_ROOT,
  VIDEOS_HLS_ROOT,
  getPublicBaseUrl,
  toPublicUrl,
  ensureListingHlsDir,
  ensureStreamingDir,
  getListingHlsPaths,
  getAssetPaths,
  publishListingToRemote,
  publishToRemote,
  buildListingHlsUrls,
  buildStreamingUrls,
  cleanupTempDir,
  getStorageClient,
}
