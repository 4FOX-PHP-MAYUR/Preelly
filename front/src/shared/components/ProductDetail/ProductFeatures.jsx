import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

const INITIAL_VISIBLE = 10

function toTitleCase(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/**
 * Normalize product.specifications / legacy fields into [{ title, items: string[] }].
 */
export function getFeatureSectionsFromProduct(product) {
  if (!product) return []

  const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/
  const isObjectId = (v) => typeof v === 'string' && OBJECT_ID_RE.test(v.trim())

  const vehicleFeatureSections = [
    { title: 'Driver Assistance & Safety', key: 'driverAssistanceSafetyIdValue' },
    { title: 'Entertainment & Technology', key: 'entertainmentTechnologyIdValue' },
    { title: 'Comfort & Convenience', key: 'comfortConvenienceIdValue' },
    { title: 'Exterior', key: 'exteriorIdValue' },
  ]
    .map(({ title, key }) => {
      const raw = product[key]
      const items = Array.isArray(raw)
        ? raw.map(String).filter((s) => s && !isObjectId(s))
        : raw && !isObjectId(String(raw))
          ? [String(raw)]
          : []
      return items.length ? { title, items } : null
    })
    .filter(Boolean)

  if (vehicleFeatureSections.length) {
    return vehicleFeatureSections
  }

  const spec = product.specifications
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    if (Array.isArray(spec.featureCategories)) {
      return spec.featureCategories
        .map((c) => ({
          title: c?.name || c?.title || 'Features',
          items: Array.isArray(c?.items) ? c.items.filter(Boolean).map(String) : [],
        }))
        .filter((c) => c.items.length)
    }

    const nested = spec.features
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const nestedEntries = Object.entries(nested).filter(
        ([, v]) => Array.isArray(v) && v.some((x) => x != null && String(x).trim() !== '')
      )
      if (nestedEntries.length) {
        return nestedEntries
          .map(([title, items]) => ({
            title: toTitleCase(title),
            items: items.filter((x) => x != null && String(x).trim() !== '').map(String),
          }))
          .filter((c) => c.items.length)
      }
    }

    const skip = new Set(['featureCategories', 'features', '_id', '__v', 'id'])
    const arrayEntries = Object.entries(spec).filter(
      ([k, v]) =>
        !skip.has(k) &&
        Array.isArray(v) &&
        v.length &&
        v.some((x) => x != null && String(x).trim() !== '')
    )
    if (arrayEntries.length) {
      return arrayEntries
        .map(([title, items]) => ({
          title: toTitleCase(title),
          items: items.filter(Boolean).map(String),
        }))
        .filter((c) => c.items.length)
    }

    const boolEntries = Object.entries(spec).filter(([, v]) => v === true)
    if (boolEntries.length) {
      return [
        {
          title: 'Features',
          items: boolEntries.map(([k]) => toTitleCase(k)),
        },
      ]
    }
  }

  if (Array.isArray(spec) && spec.length && typeof spec[0] === 'string') {
    return [{ title: 'Features', items: spec.filter(Boolean).map(String) }]
  }

  const featStr = product.features
  if (typeof featStr === 'string' && featStr.trim()) {
    const items = featStr
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (items.length) return [{ title: 'Features', items }]
  }

  const dd = product.display_data
  if (dd && typeof dd === 'object' && Array.isArray(dd.feature_list)) {
    const items = dd.feature_list.filter(Boolean).map(String)
    if (items.length) return [{ title: 'Features', items }]
  }

  return []
}

function FeatureSection({ title, items, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const [showAll, setShowAll] = useState(false)
  const count = items.length
  const visible = showAll ? items : items.slice(0, INITIAL_VISIBLE)
  const hasMore = items.length > INITIAL_VISIBLE

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-4 text-left hover:bg-gray-50/80 rounded-lg px-1 -mx-1 transition-colors"
      >
        <span className="text-base font-semibold text-gray-900">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{count}</span>
          {open ? (
            <ChevronUp className="h-5 w-5 text-primary-600" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 text-primary-600" aria-hidden />
          )}
        </div>
      </button>

      {open && (
        <div className="pb-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
            {visible.map((item, idx) => (
              <div key={`${title}-${idx}`} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden />
                <span className="text-sm text-gray-800">{item}</span>
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700"
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
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Features</h2>
      <p className="text-sm text-gray-500 mb-2">Equipment and options for this vehicle</p>
      <div className="divide-y divide-gray-200 rounded-lg border border-gray-100 px-4">
        {sections.map((sec, i) => (
          <FeatureSection key={sec.title + i} title={sec.title} items={sec.items} defaultOpen={i < 3} />
        ))}
      </div>
    </div>
  )
}
