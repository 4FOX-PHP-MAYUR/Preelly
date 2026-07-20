import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListingMedia, formatListingPrice } from '@shared/components/categoryBrowseShared'
import AvailabilityBadge from '@shared/components/ProductDetail/AvailabilityBadge'

function ProductCard({ product, index = 0, bordered = true }) {
  const navigate = useNavigate()
  const title = product?.title || 'Listing'
  const headline = index % 3 === 0 ? `Urgent Sale – ${title}` : title

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/products/${product._id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/products/${product._id}`)
        }
      }}
      className={`group relative aspect-[4/5] w-full cursor-pointer overflow-hidden bg-slate-100 transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand/40 ${
        bordered ? 'shadow-sm ring-1 ring-[#E8EBF2] hover:shadow-md' : ''
      }`}
      aria-label={`View ${title}`}
    >
      <ListingMedia
        product={product}
        showVideoBadge={false}
        interactive={false}
        className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 via-black/20 to-transparent px-3 pb-10 pt-3">
        <p
          className="truncate text-white drop-shadow-sm"
          style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '16px', fontWeight: 700, lineHeight: '16px' }}
        >
          {headline}
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
        <AvailabilityBadge
          product={product}
          className="!rounded-full !px-2.5 !py-0.5 !text-[10px] !font-semibold"
        />
        <span className="rounded-full bg-black/65 px-3 py-1 text-sm font-bold text-white backdrop-blur-sm">
          {formatListingPrice(product)}
        </span>
      </div>
    </article>
  )
}

export default memo(ProductCard)
