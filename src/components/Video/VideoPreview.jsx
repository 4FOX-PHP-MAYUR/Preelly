import HlsVideoPlayer from './HlsVideoPlayer'

/**
 * Lightweight muted preview for listing cards — HLS when ready, MP4 fallback.
 */
export default function VideoPreview({
  product,
  className = 'w-full h-full object-cover',
  style,
  loop = true,
  muted = true,
  autoPlay = true,
  playsInline = true,
  preload = 'metadata',
  showQualitySelector = false,
  isVisible = true,
}) {
  if (!product?.video && !product?.videoStream?.hlsUrl) return null

  return (
    <HlsVideoPlayer
      product={product}
      className={className}
      style={style}
      controls={false}
      loop={loop}
      muted={muted}
      autoPlay={autoPlay}
      playsInline={playsInline}
      preload={preload}
      showQualitySelector={showQualitySelector}
      isVisible={isVisible}
      isPlaying={autoPlay && isVisible}
    />
  )
}
