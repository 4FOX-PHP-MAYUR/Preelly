import HlsVideoPlayer from '../Video/HlsVideoPlayer'

/**
 * Instagram-style reel player: HLS when ready, MP4 fallback, visibility-aware playback.
 */
export default function ReelStreamPlayer({
  product,
  videoRef: externalVideoRef,
  isVisible,
  isMuted,
  isPlaying,
  className = '',
  style = {},
  onLoadedData,
  onError,
  onTimeUpdate,
  onEnded,
}) {
  return (
    <HlsVideoPlayer
      product={product}
      videoRef={externalVideoRef}
      className={className}
      style={style}
      controls={false}
      loop
      muted={isMuted}
      playsInline
      preload={isVisible ? 'auto' : 'metadata'}
      showQualitySelector={false}
      isVisible={isVisible}
      isPlaying={isPlaying}
      onLoadedData={onLoadedData}
      onError={onError}
      onTimeUpdate={onTimeUpdate}
      onEnded={onEnded}
    />
  )
}
