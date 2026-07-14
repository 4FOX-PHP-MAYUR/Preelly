import { useState } from 'react'
import DetailCard from './DetailCard'

function DescriptionCard({ product }) {
  const [expanded, setExpanded] = useState(false)
  const description = product?.description?.trim()
  if (!description) return null

  const isLong = description.length > 320
  const preview = isLong && !expanded ? `${description.slice(0, 320)}...` : description

  return (
    <DetailCard title={product.title}>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{preview}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-sm font-semibold text-brand transition hover:text-brand-700"
        >
          {expanded ? 'Read Less' : 'Read More'}
        </button>
      )}
      {product.brand && (
        <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
          <span className="text-slate-500">Brand: </span>
          <span className="font-semibold text-slate-900">{product.brand}</span>
        </div>
      )}
    </DetailCard>
  )
}

export default DescriptionCard
