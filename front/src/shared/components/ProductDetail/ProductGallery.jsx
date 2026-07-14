import { memo, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Image } from 'lucide-react'
import HlsVideoPlayer from '../Video/HlsVideoPlayer'
import useProductVideoViewTracking from '@shared/hooks/useProductVideoViewTracking'
import { getMediaUrl } from '../../utils/helpers'
import { getListingPosterUrl } from '../../utils/videoHelpers'
import { buildGalleryMedia } from './detailHelpers'
import {
  DETAIL_GALLERY_ASPECT,
  DETAIL_GALLERY_OVERLAY,
  DETAIL_GALLERY_OVERLAY_PADDING,
  DETAIL_GALLERY_SHELL,
} from './detailStyles'
import GalleryLightbox from './GalleryLightbox'
import ListingHeaderCard from './ListingHeaderCard'
import ProductEngagementRow from './ProductEngagementRow'

function ImageCounter({ current, total, onClick }) {
  if (total <= 1) return null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View all ${total} images`}
      className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] font-semibold text-white sm:text-xs"
    >
      <Image className="h-3.5 w-3.5" aria-hidden />
      {current}/{total}
    </button>
  )
}

function GalleryMedia({ product, current, isVideo, posterUrl, selectedIndex, onOpenLightbox, onVideoTimeUpdate }) {
  if (isVideo) {
    return (
      <div className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover">
        <HlsVideoPlayer
          product={product}
          poster={posterUrl}
          className="h-full w-full object-cover"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          controls
          loop
          muted
          autoPlay
          showQualitySelector
          onTimeUpdate={onVideoTimeUpdate}
        />
      </div>
    )
  }

  return (
    <img
      src={current?.url}
      alt={product.title}
      className="absolute inset-0 h-full w-full cursor-zoom-in object-cover"
      loading={selectedIndex === 0 ? 'eager' : 'lazy'}
      onClick={onOpenLightbox}
    />
  )
}

function GalleryOverlay({ product, viewCount }) {
  return (
    <div className={`${DETAIL_GALLERY_OVERLAY} ${DETAIL_GALLERY_OVERLAY_PADDING}`}>
      <ListingHeaderCard product={product} />
      <div className="mt-[10px]">
        <ProductEngagementRow product={product} viewCount={viewCount} embedded />
      </div>
    </div>
  )
}

function ProductGallery({ product, viewCount, onViewCountChange }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const allMedia = useMemo(() => buildGalleryMedia(product, getMediaUrl), [product])
  const posterUrl = useMemo(() => getListingPosterUrl(product), [product])
  const total = allMedia.length
  const current = allMedia[selectedIndex]
  const isVideo = current?.type === 'video'

  const { handleVideoTimeUpdate } = useProductVideoViewTracking({
    productId: product._id,
    enabled: isVideo && Boolean(product?.video),
    onViewsUpdated: onViewCountChange,
  })

  const goTo = (index) => {
    if (total <= 0) return
    setSelectedIndex(((index % total) + total) % total)
  }

  return (
    <>
      <div className="relative">
        <div className={DETAIL_GALLERY_SHELL}>
          <div className={`relative overflow-hidden ${DETAIL_GALLERY_ASPECT}`}>
            {total > 0 ? (
              <>
                <GalleryMedia
                  product={product}
                  current={current}
                  isVideo={isVideo}
                  posterUrl={posterUrl}
                  selectedIndex={selectedIndex}
                  onOpenLightbox={() => setLightboxOpen(true)}
                  onVideoTimeUpdate={handleVideoTimeUpdate}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-black/55 via-black/20 to-transparent sm:h-40"
                  aria-hidden
                />
                <GalleryOverlay product={product} viewCount={viewCount} />
              </>
            ) : (
              <div className="flex h-full min-h-[220px] items-center justify-center bg-slate-100 text-sm text-slate-400 sm:min-h-[280px]">
                No media available
              </div>
            )}

            <ImageCounter current={selectedIndex + 1} total={total} onClick={() => setLightboxOpen(true)} />

            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(selectedIndex - 1)}
                  aria-label="Previous media"
                  className="absolute left-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white sm:left-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(selectedIndex + 1)}
                  aria-label="Next media"
                  className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white sm:right-3"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {lightboxOpen && total > 0 && (
        <GalleryLightbox
          media={allMedia}
          selectedIndex={selectedIndex}
          product={product}
          posterUrl={posterUrl}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setSelectedIndex}
        />
      )}
    </>
  )
}

export default memo(ProductGallery)
