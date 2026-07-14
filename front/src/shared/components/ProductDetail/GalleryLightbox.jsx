import { useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import HlsVideoPlayer from '../Video/HlsVideoPlayer'

function GalleryLightbox({ media, selectedIndex, product, posterUrl, onClose, onNavigate }) {
  const total = media.length
  const current = media[selectedIndex]

  const goTo = useCallback(
    (index) => {
      if (total <= 0) return
      onNavigate(((index % total) + total) % total)
    },
    [total, onNavigate]
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goTo(selectedIndex - 1)
      if (e.key === 'ArrowRight') goTo(selectedIndex + 1)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, goTo, selectedIndex])

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery fullscreen preview"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close fullscreen preview"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {total > 1 && (
        <span className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold text-white">
          {selectedIndex + 1} / {total}
        </span>
      )}

      <div className="relative flex h-full w-full max-w-6xl items-center justify-center px-4 py-16 sm:px-16">
        {current.type === 'video' ? (
          <HlsVideoPlayer
            product={product}
            poster={posterUrl}
            className="max-h-full max-w-full object-contain"
            style={{ maxHeight: '85vh', maxWidth: '100%', width: 'auto', height: 'auto' }}
            controls
            loop
            muted={false}
            autoPlay
            showQualitySelector
          />
        ) : (
          <img
            src={current.url}
            alt={product?.title || 'Listing image'}
            className="max-h-[85vh] max-w-full object-contain"
          />
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(selectedIndex - 1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => goTo(selectedIndex + 1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default GalleryLightbox
