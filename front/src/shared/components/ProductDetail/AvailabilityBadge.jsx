import { getAvailabilityStatus } from './detailHelpers'

const TONE_CLASSES = {
  available: 'bg-[#28C723] text-white',
  sold: 'bg-slate-500 text-white',
  reserved: 'bg-amber-500 text-white',
  neutral: 'bg-slate-100 text-slate-600',
}

function AvailabilityBadge({ product, className = '' }) {
  const status = getAvailabilityStatus(product)
  if (!status) return null

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${TONE_CLASSES[status.tone] || TONE_CLASSES.neutral} ${className}`}
    >
      {status.label}
    </span>
  )
}

export default AvailabilityBadge
