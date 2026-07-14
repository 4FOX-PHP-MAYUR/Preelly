import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListingMedia, formatListingPrice } from '../categoryBrowseShared'
import { getSimilarSectionTitle, isApprovedListing } from './detailHelpers'
import { DETAIL_SECTION_TITLE } from './detailStyles'
import AvailabilityBadge from './AvailabilityBadge'

function SimilarListingCard({ product, onNavigate }) {
  const isBestDeal = product.adType && product.adType !== 'free'
  const title = product.title || 'Listing'
  const headline = isBestDeal ? `Best Deal Alert – ${title}` : title

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(product._id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onNavigate(product._id)
        }
      }}
      className="group relative aspect-[3/4] w-[163px] shrink-0 cursor-pointer overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 sm:w-[172px]"
      aria-label={`View ${title}`}
    >
      <ListingMedia
        product={product}
        className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-black/60 via-black/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      <div className="absolute inset-x-0 top-0 p-2.5 sm:p-3">
        <p className="line-clamp-3 text-[11px] font-semibold leading-snug text-white sm:text-xs">
          {headline}
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1.5 p-2.5 sm:p-3">
        <AvailabilityBadge
          product={product}
          className="!rounded-full !px-2 !py-0.5 !text-[9px] !font-semibold sm:!text-[10px]"
        />
        <p className="shrink-0 text-right text-[11px] font-bold leading-none text-white sm:text-xs">
          {formatListingPrice(product)}
        </p>
      </div>
    </article>
  )
}

function RelatedProducts({ products, referenceProduct }) {
  const navigate = useNavigate()
  const approvedProducts = (products || []).filter(isApprovedListing)
  if (!approvedProducts.length) return null

  const title = getSimilarSectionTitle(referenceProduct || approvedProducts[0])

  return (
    <section aria-label={title}>
      <h2 className={`mb-3 sm:mb-4 ${DETAIL_SECTION_TITLE}`}>{title}</h2>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex gap-3 sm:gap-3.5">
          {approvedProducts.map((product) => (
            <SimilarListingCard key={product._id} product={product} onNavigate={(id) => navigate(`/products/${id}`)} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default memo(RelatedProducts)
