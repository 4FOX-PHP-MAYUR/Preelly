const path = require('path')
const fs = require('fs')
const VideoAsset = require('../models/VideoAsset')
const Product = require('../models/Product')
const {
  transcodeToHlsForListing,
  transcodeToAdaptiveStreaming,
} = require('../services/videoTranscodeService')
const { isFfmpegAvailable } = require('../services/ffmpegConfig')
const { getListingHlsPaths } = require('../services/videoStorageService')

const MAX_RETRIES = Number(process.env.VIDEO_TRANSCODE_MAX_RETRIES || 3)
const RETRY_DELAY_MS = Number(process.env.VIDEO_TRANSCODE_RETRY_DELAY_MS || 5000)

const queue = []
let isProcessing = false

function normalizeStatus(status) {
  if (status === 'ready') return 'completed'
  return status
}

function buildVideoStreamPayload(result, asset, mp4FallbackUrl, stage) {
  const status = stage === 'completed' ? 'completed' : normalizeStatus(stage)
  return {
    status,
    jobId: asset._id,
    originalUrl: mp4FallbackUrl || asset.mp4FallbackUrl || null,
    hlsUrl: result?.hlsUrl || null,
    masterPlaylistUrl: result?.masterPlaylistUrl || result?.hlsUrl || null,
    dashUrl: result?.dashUrl || null,
    thumbnailUrl: result?.thumbnailUrl || null,
    mp4Url: mp4FallbackUrl || asset.mp4FallbackUrl || null,
    duration: result?.duration || 0,
    width: result?.width || 0,
    height: result?.height || 0,
    fileSize: result?.fileSize || 0,
    availableQualities: result?.availableQualities || [],
    renditions: result?.renditions || [],
    processingStartedAt: asset.startedAt || new Date(),
    processingCompletedAt: stage === 'completed' ? new Date() : null,
    error: null,
  }
}

async function updateProductStream(productId, payload) {
  if (!productId) return
  await Product.findByIdAndUpdate(productId, { videoStream: payload }, { new: true })
}

async function updateAssetProgress(assetId, updates) {
  await VideoAsset.findByIdAndUpdate(assetId, updates)
}

async function processJob(job) {
  const { assetId, inputPath, productId, mp4FallbackUrl, listingId, useListingLayout } = job

  const asset = await VideoAsset.findById(assetId)
  if (!asset) return

  const startedAt = new Date()
  console.log(`[transcode] job started asset=${assetId} product=${productId || 'none'} attempt=${(asset.retryCount || 0) + 1}`)

  await updateAssetProgress(assetId, {
    status: 'processing',
    startedAt,
    progress: 0,
    error: null,
    processingStage: 'processing',
  })

  if (productId) {
    await updateProductStream(productId, {
      status: 'processing',
      jobId: assetId,
      originalUrl: mp4FallbackUrl || asset.mp4FallbackUrl,
      mp4Url: mp4FallbackUrl || asset.mp4FallbackUrl,
      processingStartedAt: startedAt,
    })
  }

  const onProgress = async (pct) => {
    await updateAssetProgress(assetId, { progress: pct })
    if (productId) {
      await Product.findByIdAndUpdate(productId, { 'videoStream.progress': pct })
    }
  }

  const onStage = async (stage) => {
    await updateAssetProgress(assetId, { processingStage: stage })
    if (productId) {
      const statusMap = {
        processing: 'processing',
        generating_thumbnail: 'processing',
        generating_streams: 'processing',
        completed: 'completed',
      }
      await Product.findByIdAndUpdate(productId, {
        'videoStream.processingStage': stage,
        'videoStream.status': statusMap[stage] || 'processing',
      })
    }
  }

  try {
    let result
    if (useListingLayout && listingId) {
      result = await transcodeToHlsForListing({
        listingId,
        inputPath,
        onProgress,
        onStage,
      })
    } else {
      result = await transcodeToAdaptiveStreaming({
        assetId,
        inputPath,
        onProgress,
        onStage,
      })
    }

    const update = {
      status: 'completed',
      progress: 100,
      processingStage: 'completed',
      hlsUrl: result.hlsUrl,
      masterPlaylistUrl: result.masterPlaylistUrl || result.hlsUrl,
      dashUrl: result.dashUrl || null,
      thumbnailUrl: result.thumbnailUrl,
      mp4FallbackUrl: mp4FallbackUrl || asset.mp4FallbackUrl,
      duration: result.duration,
      width: result.width,
      height: result.height,
      fileSize: result.fileSize || 0,
      availableQualities: result.availableQualities || [],
      renditions: result.renditions,
      storageProvider: result.storageProvider,
      outputDir: result.outputDir,
      completedAt: new Date(),
      error: null,
      retryCount: asset.retryCount || 0,
    }

    await VideoAsset.findByIdAndUpdate(assetId, update)

    if (productId) {
      await updateProductStream(
        productId,
        buildVideoStreamPayload(result, { ...asset.toObject(), startedAt }, mp4FallbackUrl, 'completed'),
      )
    }

    console.log(`[transcode] job completed asset=${assetId} hls=${result.hlsUrl}`)
  } catch (err) {
    const retryCount = (asset.retryCount || 0) + 1
    const errorLog = [...(asset.errorLog || []), { at: new Date(), message: err.message, attempt: retryCount }]

    console.error(`[transcode] job failed asset=${assetId} attempt=${retryCount}:`, err.message)

    if (retryCount < MAX_RETRIES) {
      await VideoAsset.findByIdAndUpdate(assetId, {
        status: 'pending',
        retryCount,
        error: err.message,
        errorLog,
        processingStage: 'pending',
      })

      console.log(`[transcode] retry scheduled asset=${assetId} in ${RETRY_DELAY_MS}ms (${retryCount}/${MAX_RETRIES})`)
      setTimeout(() => {
        enqueueTranscode({ ...job, _retry: true })
      }, RETRY_DELAY_MS)
      return
    }

    await VideoAsset.findByIdAndUpdate(assetId, {
      status: 'failed',
      retryCount,
      error: err.message,
      errorLog,
      processingStage: 'failed',
      completedAt: new Date(),
    })

    if (productId) {
      await updateProductStream(productId, {
        status: 'failed',
        jobId: assetId,
        originalUrl: mp4FallbackUrl || asset.mp4FallbackUrl,
        mp4Url: mp4FallbackUrl || asset.mp4FallbackUrl,
        error: err.message,
        processingCompletedAt: new Date(),
      })
    }
  }
}

async function drainQueue() {
  if (isProcessing || queue.length === 0) return
  isProcessing = true
  const job = queue.shift()
  try {
    await processJob(job)
  } finally {
    isProcessing = false
    setImmediate(drainQueue)
  }
}

function enqueueTranscode(payload) {
  if (!isFfmpegAvailable()) {
    console.warn('[transcode] skipped — ffmpeg unavailable')
    return null
  }
  queue.push(payload)
  drainQueue()
  return true
}

/**
 * Queue HLS transcode for a product video after upload.
 * Uses uploads/videos/{listingId}/ layout. OpenAI continues using original MP4 (Option A).
 */
async function enqueueProductVideoTranscode(productId, videoRelativeUrl) {
  if (!productId || !videoRelativeUrl) return null

  const absInput = path.isAbsolute(videoRelativeUrl)
    ? videoRelativeUrl
    : path.join(__dirname, '..', videoRelativeUrl.replace(/^\//, ''))

  if (!fs.existsSync(absInput)) {
    console.warn('[transcode] video file missing:', absInput)
    return null
  }

  const mp4FallbackUrl = videoRelativeUrl.startsWith('/') ? videoRelativeUrl : `/${videoRelativeUrl}`
  const listingPaths = getListingHlsPaths(productId)

  let fileSize = 0
  try {
    fileSize = fs.statSync(absInput).size
  } catch {
    // ignore
  }

  const asset = await VideoAsset.create({
    productId,
    status: 'pending',
    originalPath: videoRelativeUrl,
    mp4FallbackUrl,
    outputDir: listingPaths.relBase,
    fileSize,
    processingStage: 'pending',
  })

  console.log(`[transcode] queued product=${productId} asset=${asset._id}`)

  enqueueTranscode({
    assetId: asset._id,
    inputPath: absInput,
    productId,
    listingId: String(productId),
    mp4FallbackUrl,
    useListingLayout: true,
  })

  await updateProductStream(productId, {
    status: 'pending',
    jobId: asset._id,
    originalUrl: mp4FallbackUrl,
    mp4Url: mp4FallbackUrl,
    fileSize,
    processingStage: 'pending',
    processingStartedAt: null,
    processingCompletedAt: null,
  })

  return asset._id
}

module.exports = {
  enqueueTranscode,
  enqueueProductVideoTranscode,
  getQueueLength: () => queue.length,
  isFfmpegAvailable,
  normalizeStatus,
}
