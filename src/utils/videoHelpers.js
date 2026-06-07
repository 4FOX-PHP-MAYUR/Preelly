import { getMediaUrl } from './helpers'

/** Treat legacy "ready" and new "completed" as stream-ready */
export function isVideoStreamReady(stream) {
  if (!stream) return false
  const status = stream.status
  return (status === 'completed' || status === 'ready') && Boolean(stream.hlsUrl || stream.masterPlaylistUrl)
}

export function getVideoHlsUrl(stream) {
  if (!stream) return null
  return stream.masterPlaylistUrl || stream.hlsUrl || null
}

export function getVideoMp4Url(product, stream) {
  return stream?.mp4Url || stream?.originalUrl || product?.video || null
}

export function getVideoThumbnailUrl(product, stream) {
  const s = stream || product?.videoStream
  if (s?.thumbnailUrl) return getMediaUrl(s.thumbnailUrl)
  return null
}

/** Whether a product has an associated video for preview/playback */
export function productHasVideo(product) {
  if (!product) return false
  if (product.video) return true
  const stream = product.videoStream
  if (!stream) return false
  return Boolean(
    stream.hlsUrl ||
      stream.masterPlaylistUrl ||
      stream.mp4Url ||
      stream.originalUrl ||
      isVideoStreamReady(stream),
  )
}

export function getListingPosterUrl(product) {
  const imageSrc = product?.images?.[0] ? getMediaUrl(product.images[0]) || product.images[0] : null
  return imageSrc || getVideoThumbnailUrl(product) || null
}

/** Best URL for playback — prefers HLS when ready, else MP4 */
export function getVideoPlaybackUrl(product) {
  const stream = product?.videoStream
  if (isVideoStreamReady(stream)) {
    return getMediaUrl(getVideoHlsUrl(stream))
  }
  return getMediaUrl(getVideoMp4Url(product, stream))
}

/** Whether playback URL is HLS (for player selection) */
export function isHlsPlayback(product) {
  return isVideoStreamReady(product?.videoStream)
}

export function getProcessingStageLabel(stage, status) {
  const labels = {
    pending: 'Processing Video...',
    processing: 'Processing Video...',
    generating_thumbnail: 'Generating Thumbnail...',
    generating_streams: 'Generating Streaming Files...',
    completed: 'Video Ready',
    ready: 'Video Ready',
    failed: 'Processing Failed',
  }
  return labels[stage] || labels[status] || 'Processing Video...'
}
