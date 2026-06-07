import { useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { getListingPosterUrl, productHasVideo } from '../../utils/videoHelpers'
import HlsVideoPlayer from './HlsVideoPlayer'

/**
 * Listing media with optional video — poster image, hover preview, and inline play for anyone.
 */
export default function ListingVideoPreview({
  product,
  className = 'h-full w-full object-cover',
  alt = 'Listing',
  interactive = true,
  autoPlayOnHover = true,
}) {
  const hasVideo = productHasVideo(product)
  const posterUrl = getListingPosterUrl(product)

  const [hovered, setHovered] = useState(false)
  const [manualPlay, setManualPlay] = useState(false)

  const previewActive = hasVideo && autoPlayOnHover && hovered && !manualPlay
  const playerActive = hasVideo && (previewActive || manualPlay)

  if (!hasVideo) {
    if (posterUrl) {
      return <img src={posterUrl} alt={alt} className={className} />
    }
    return <div className={`${className} bg-gradient-to-br from-primary-100 to-slate-200`} />
  }

  const togglePlay = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setManualPlay((playing) => !playing)
  }

  return (
    <div
      className="group/video relative h-full w-full overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {posterUrl && !playerActive && (
        <img src={posterUrl} alt={alt} className={className} />
      )}

      {playerActive && (
        <HlsVideoPlayer
          product={product}
          poster={posterUrl}
          className={`${className} ${posterUrl && previewActive ? 'absolute inset-0' : ''}`}
          controls={manualPlay}
          muted={!manualPlay}
          loop={!manualPlay}
          autoPlay={false}
          isPlaying={playerActive}
          isVisible
          showQualitySelector={manualPlay}
        />
      )}

      {interactive && (
        <button
          type="button"
          onClick={togglePlay}
          className={`absolute z-10 flex items-center justify-center rounded-full border border-white/20 bg-black/50 text-white shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-black/65 ${
            manualPlay
              ? 'right-2 top-2 h-8 w-8 opacity-90'
              : 'left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 opacity-80 group-hover/video:opacity-100'
          }`}
          aria-label={manualPlay ? 'Pause video' : 'Play video'}
        >
          {manualPlay ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" />
          )}
        </button>
      )}

      {!manualPlay && !hovered && (
        <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          <Play className="h-2.5 w-2.5 fill-white" />
          Video
        </span>
      )}
    </div>
  )
}
