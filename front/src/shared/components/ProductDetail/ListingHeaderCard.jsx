import { formatListingPrice } from '../categoryBrowseShared'
import AvailabilityBadge from './AvailabilityBadge'
import NegotiableBadge from './NegotiableBadge'
import ListingMetaRow from './ListingMetaRow'
import { DETAIL_HEADER_CARD, DETAIL_HEADER_CARD_FLAT, DETAIL_PRICE_BADGE } from './detailStyles'

function ListingHeaderCard({ product, flat = false }) {
  return (
    <div className={flat ? DETAIL_HEADER_CARD_FLAT : DETAIL_HEADER_CARD}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={DETAIL_PRICE_BADGE}>{formatListingPrice(product)}</span>
          <NegotiableBadge product={product} />
        </div>
        <AvailabilityBadge
          product={product}
          className="!rounded-full !px-2.5 !py-0.5 !text-[10px] !font-semibold sm:!px-3 sm:!py-1 sm:!text-[11px]"
        />
      </div>

      <h1 className="mb-2 line-clamp-2 text-[17px] font-bold leading-snug text-slate-900 sm:text-lg">
        {product.title}
      </h1>

      <ListingMetaRow product={product} />
    </div>
  )
}

export default ListingHeaderCard
