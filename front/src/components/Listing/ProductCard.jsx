import { memo, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { getMediaUrl } from '@shared/utils/helpers'
import {
  buildVehicleLine,
  formatListingPrice,
  ListingMedia,
} from '../Categories/categoryBrowseShared'
import ListingVideoPreview from '@shared/components/Video/ListingVideoPreview'
import { productHasVideo } from '@shared/utils/videoHelpers'

const ASPECT_RATIOS = ['aspect-[4/5]', 'aspect-[3/4]', 'aspect-[5/4]', 'aspect-square']

function getProductImages(product) {
  const urls = []
  if (Array.isArray(product?.images)) {
    product.images.forEach((img) => {
      const src = img ? getMediaUrl(img) || img : null
      if (src) urls.push(src)
    })
  }
  return urls
}

function ProductCard({ product, index = 0, onToggleSave, isSaved = false }) {
  const images = useMemo(() => getProductImages(product), [product])
  const aspectClass = ASPECT_RATIOS[index % ASPECT_RATIOS.length]
  const isPremium = product?.adType === 'premium'
  const titleLine = buildVehicleLine(product) || product?.title || 'Listing'

  const handleSave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleSave?.(product)
  }

  return (
    <Link
      to={`/products/${product._id}`}
      className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8EBF2] transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-brand/25"
    >
      <div className={`relative overflow-hidden bg-slate-100 ${aspectClass}`}>
        {productHasVideo(product) ? (
          <ListingVideoPreview
            product={product}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            alt={product.title}
          />
        ) : images.length > 0 ? (
          <img
            src={images[0]}
            alt={product.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <ListingMedia product={product} className="h-full w-full object-cover" />
        )}

        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 via-black/20 to-transparent px-3 pb-8 pt-3">
          <p className="line-clamp-2 text-sm font-semibold text-white drop-shadow-sm">{titleLine}</p>
        </div>

        {isPremium ? (
          <span className="absolute left-3 top-12 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm shadow-brand/30">
            Featured
          </span>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow backdrop-blur-sm transition hover:text-red-500"
          aria-label={isSaved ? 'Remove bookmark' : 'Save listing'}
        >
          <Heart className={`h-4 w-4 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} />
        </button>

        <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-sm font-bold text-white backdrop-blur-sm">
          {formatListingPrice(product)}
        </span>
      </div>
    </Link>
  )
}

export default memo(ProductCard)
