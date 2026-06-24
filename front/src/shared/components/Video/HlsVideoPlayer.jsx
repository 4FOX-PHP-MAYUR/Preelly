import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { getMediaUrl } from '../../utils/helpers'
import { getVideoHlsUrl, getVideoMp4Url, isVideoStreamReady } from '../../utils/videoHelpers'

/**
 * Universal HLS video player with adaptive bitrate and manual quality selection.
 * Uses native HLS on Safari/iOS; hls.js elsewhere. Falls back to MP4 when HLS unavailable.
 */
export default function HlsVideoPlayer({
  product,
  videoStream,
  mp4Url: mp4UrlProp,
  hlsUrl: hlsUrlProp,
  poster,
  className = '',
  style = {},
  controls = true,
  loop = false,
  muted = false,
  autoPlay = false,
  playsInline = true,
  preload = 'metadata',
  showQualitySelector = true,
  isPlaying,
  isVisible = true,
  onLoadedData,
  onError,
  onTimeUpdate,
  onEnded,
  videoRef: externalVideoRef,
}) {
  const internalRef = useRef(null)
  const hlsRef = useRef(null)
  const [qualities, setQualities] = useState([])
  const [currentQuality, setCurrentQuality] = useState(-1)
  const [loadError, setLoadError] = useState(false)

  const stream = videoStream || product?.videoStream
  const hlsUrl = hlsUrlProp || (isVideoStreamReady(stream) ? getMediaUrl(getVideoHlsUrl(stream)) : null)
  const mp4Url = getMediaUrl(mp4UrlProp || getVideoMp4Url(product, stream))
  const posterUrl = poster || (stream?.thumbnailUrl ? getMediaUrl(stream.thumbnailUrl) : null)

  const setVideoRef = useCallback(
    (node) => {
      internalRef.current = node
      if (typeof externalVideoRef === 'function') {
        externalVideoRef(node)
      } else if (externalVideoRef && 'current' in externalVideoRef) {
        externalVideoRef.current = node
      }
    },
    [externalVideoRef],
  )

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [])

  useEffect(() => {
    const video = internalRef.current
    if (!video) return undefined

    setLoadError(false)
    destroyHls()

    if (!hlsUrl || loadError) {
      if (mp4Url && video.src !== mp4Url) {
        video.src = mp4Url
        video.load()
      }
      return destroyHls
    }

    // Safari / iOS native HLS
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl
      return destroyHls
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1, // auto quality
      })
      hlsRef.current = hls
      hls.loadSource(hlsUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels = (data.levels || []).map((level, index) => ({
          index,
          height: level.height,
          label: level.height ? `${level.height}p` : `Level ${index}`,
        }))
        setQualities(levels)
        setCurrentQuality(hls.currentLevel)
      })

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentQuality(data.level)
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          destroyHls()
          setLoadError(true)
          if (mp4Url) {
            video.src = mp4Url
            video.load()
          }
          onError?.()
        }
      })

      return destroyHls
    }

    if (mp4Url) {
      video.src = mp4Url
    }
    return destroyHls
  }, [hlsUrl, mp4Url, destroyHls, onError, loadError])

  useEffect(() => {
    const video = internalRef.current
    if (!video) return
    try {
      video.muted = muted
      if (typeof isPlaying === 'boolean') {
        if (isPlaying && isVisible) {
          const p = video.play()
          if (p?.catch) p.catch(() => {})
        } else {
          video.pause()
        }
      } else if (autoPlay && isVisible) {
        const p = video.play()
        if (p?.catch) p.catch(() => {})
      }
    } catch {
      // autoplay policy
    }
  }, [isPlaying, isVisible, muted, autoPlay])

  const handleQualityChange = (levelIndex) => {
    const hls = hlsRef.current
    if (!hls) return
    hls.currentLevel = Number(levelIndex)
    setCurrentQuality(Number(levelIndex))
  }

  if (!hlsUrl && !mp4Url) return null

  return (
    <div className="relative w-full h-full">
      <video
        ref={setVideoRef}
        className={className}
        style={style}
        controls={controls}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        preload={preload}
        poster={posterUrl || undefined}
        onLoadedData={onLoadedData}
        onError={onError}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />
      {showQualitySelector && qualities.length > 1 && hlsUrl && !loadError && (
        <div className="absolute top-2 right-2 z-10">
          <select
            value={currentQuality}
            onChange={(e) => handleQualityChange(e.target.value)}
            className="text-xs bg-black/60 text-white border border-white/20 rounded px-2 py-1 backdrop-blur-sm"
            aria-label="Video quality"
          >
            <option value={-1}>Auto</option>
            {qualities.map((q) => (
              <option key={q.index} value={q.index}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
