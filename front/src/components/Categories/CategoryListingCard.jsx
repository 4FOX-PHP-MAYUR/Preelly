import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  MessageCircle,
} from 'lucide-react'
import { getMediaUrl } from '@shared/utils/helpers'
import {
  buildSpecsLine,
  buildVehicleLine,
  formatListingPrice,
  formatTimeAgo,
  ListingMedia,
} from './categoryBrowseShared'
import ListingVideoPreview from '@shared/components/Video/ListingVideoPreview'
import { productHasVideo } from '@shared/utils/videoHelpers'

function getProductImages(product) {
  const urls = []
  if (Array.isArray(product?.images)) {
    product.images.forEach((img) => {
      const src = img ? getMediaUrl(img) || img : null
      if (src) urls.push(src)
    })
  }
  if (!urls.length && product?.video) {
    const videoSrc = getMediaUrl(product.video) || product.video
    if (videoSrc) urls.push(videoSrc)
  }
  return urls
}

function CategoryListingCard({ product, onToggleSave, isSaved = false }) {
  const navigate = useNavigate()
  const images = useMemo(() => getProductImages(product), [product])
  const [imageIndex, setImageIndex] = useState(0)
  const totalImages = Math.max(images.length, 1)
  const displayIndex = images.length ? Math.min(imageIndex, images.length - 1) : 0

  const isPremium = product?.adType === 'premium'
  const isRecent =
    !isPremium &&
    product?.createdAt &&
    Date.now() - new Date(product.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000

  const vehicleLine = buildVehicleLine(product)
  const specsLine = buildSpecsLine(product)
  const titleLine = vehicleLine || product?.title
  const subtitleLine = vehicleLine ? product?.title : specsLine

  const seller = product?.seller
  const sellerName = seller?.name || 'Seller'
  const sellerAvatar = seller?.avatar ? getMediaUrl(seller.avatar) || seller.avatar : null

  const handlePrevImage = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (images.length < 2) return
    setImageIndex((i) => (i - 1 + images.length) % images.length)
  }

  const handleNextImage = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (images.length < 2) return
    setImageIndex((i) => (i + 1) % images.length)
  }

  const handleSave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleSave?.(product)
  }

  const handleMessage = (e) => {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/products/${product._id}`)
  }

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/products/${product._id}`} className="block">
        <div className="relative h-52 overflow-hidden bg-slate-100 sm:h-56">
          {productHasVideo(product) ? (
            <ListingVideoPreview
              product={product}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              alt={product.title}
            />
          ) : images.length > 0 ? (
            <img
              src={images[displayIndex]}
              alt={product.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <ListingMedia product={product} className="h-full w-full object-cover" />
          )}

          {(isPremium || isRecent) && (
            <span
              className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white ${
                isPremium ? 'bg-primary-600' : 'bg-sky-500'
              }`}
            >
              {isPremium ? 'Featured' : 'Recent'}
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow backdrop-blur-sm transition hover:text-red-500"
            aria-label={isSaved ? 'Remove bookmark' : 'Save listing'}
          >
            <Heart className={`h-4 w-4 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevImage}
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextImage}
                className="absolute right-12 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Next image"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white">
                {displayIndex + 1}/{images.length}
              </span>
            </>
          )}
        </div>

        <div className="p-4">
          <p className="truncate text-sm font-semibold text-slate-900">{titleLine}</p>
          {subtitleLine ? (
            <p className="mt-1 truncate text-xs text-slate-500">{subtitleLine}</p>
          ) : null}
          <p className="mt-3 text-xl font-bold text-primary-700">{formatListingPrice(product)}</p>
          {product?.location ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{product.location}</span>
            </p>
          ) : null}
        </div>
      </Link>

      <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-3">
        {sellerAvatar ? (
          <img src={sellerAvatar} alt={sellerName} className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <MessageCircle className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-sm font-semibold text-slate-800">{sellerName}</p>
            {seller?.isVerified ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary-600" /> : null}
          </div>
          <p className="text-xs text-slate-400">{formatTimeAgo(product?.createdAt)}</p>
        </div>
        <button
          type="button"
          onClick={handleMessage}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition hover:bg-primary-700"
          aria-label="Message seller"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
      </div>
    </article>
  )
}

export default CategoryListingCard
