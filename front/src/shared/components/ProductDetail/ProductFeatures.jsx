import { useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import DetailCard from './DetailCard'
import { getFeatureSectionsFromProduct } from './detailHelpers'

const INITIAL_VISIBLE = 10

function FeatureSection({ title, items, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const [showAll, setShowAll] = useState(false)
  const count = items.length
  const visible = showAll ? items : items.slice(0, INITIAL_VISIBLE)
  const hasMore = items.length > INITIAL_VISIBLE

  return (
    <div className="border-b border-[#E8EBF2] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition hover:bg-slate-50/60"
      >
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand">
            {count}
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white">
            <Plus
              className={`h-4 w-4 transition-transform ${open ? 'rotate-45' : ''}`}
              aria-hidden
            />
          </span>
        </div>
      </button>

      {open && (
        <div className="pb-4">
          <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {visible.map((item, idx) => (
              <div key={`${title}-${idx}`} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                <span className="text-sm text-slate-700">{item}</span>
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="mt-4 text-sm font-semibold text-brand hover:text-brand-700"
            >
              {showAll ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProductFeatures({ product }) {
  const sections = useMemo(() => getFeatureSectionsFromProduct(product), [product])

  if (!sections.length) return null

  return (
    <DetailCard title="Features">
      <div className="-mx-1">
        {sections.map((sec, i) => (
          <FeatureSection key={sec.title + i} title={sec.title} items={sec.items} defaultOpen={false} />
        ))}
      </div>
    </DetailCard>
  )
}

// Re-export for tests or other consumers
export { getFeatureSectionsFromProduct } from './detailHelpers'
