import { isNegotiable } from './detailHelpers'

function NegotiableBadge({ product, className = '' }) {
  if (!isNegotiable(product)) return null
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 ${className}`}
    >
      Negotiable
    </span>
  )
}

export default NegotiableBadge
