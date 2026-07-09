import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Calendar, ChevronDown, ChevronUp, Gauge, MapPin, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { selectIsAuthenticated, selectUser } from '@shared/store/slices/authSlice'
import { useChat } from '@shared/components/Chat/ChatContext'
import { getMediaUrl } from '@shared/utils/helpers'
import {
  formatListingPrice,
  isPropertyCategoryName,
  isVehicleCategoryName,
} from '@shared/components/categoryBrowseShared'
import { getFeatureSectionsFromProduct } from '@shared/components/ProductDetail/ProductFeatures'

/** Generic fallback fields used only when the category has no admin-configured quick-view fields. */
const GENERIC_FALLBACK_KEYS = [
  ['brand', 'Brand'],
  ['model', 'Model'],
  ['condition', 'Condition'],
  ['color', 'Color'],
  ['material', 'Material'],
  ['size', 'Size'],
]

function getOverviewTitle(categoryName) {
  if (isVehicleCategoryName(categoryName)) return 'Car Overview'
  if (isPropertyCategoryName(categoryName)) return 'Property Overview'
  if (categoryName) return `${categoryName} Overview`
  return 'Overview'
}

/** Field label/value rows — sourced from the backend's per-category quickViewData
 *  (admin-configured via FormField.showOnQuickView) so labels change with category
 *  automatically. Falls back to a few generic product fields for older listings. */
function useOverviewRows(product) {
  return useMemo(() => {
    const quickView = Array.isArray(product?.quickViewData) ? product.quickViewData : []
    if (quickView.length) {
      return quickView
        .map((entry) => ({
          label: entry.fieldTitle,
          value: Array.isArray(entry.fieldValues) ? entry.fieldValues.join(', ') : entry.fieldValue,
        }))
        .filter((row) => row.label && row.value != null && row.value !== '')
    }

    return GENERIC_FALLBACK_KEYS
      .map(([key, label]) => ({ label, value: product?.[key] }))
      .filter((row) => row.value != null && row.value !== '')
  }, [product])
}

/** Feature groups — prefers the backend's category-agnostic `features` field
 *  (admin-configured multi-select FormFields, additive alongside quickViewData).
 *  Falls back to the vehicle-only client helper for older listings without it. */
function useFeatureSections(product) {
  return useMemo(() => {
    const fromApi = Array.isArray(product?.features) ? product.features : []
    if (fromApi.length) {
      return fromApi
        .map((section) => ({
          title: section.title || section.fieldTitle,
          items: Array.isArray(section.values)
            ? section.values
            : Array.isArray(section.items)
              ? section.items
              : Array.isArray(section.fieldValues)
                ? section.fieldValues
                : [],
        }))
        .filter((section) => section.title && section.items.length)
    }
    return getFeatureSectionsFromProduct(product)
  }, [product])
}

function DescriptionBlock({ text }) {
  const [expanded, setExpanded] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const textRef = useRef(null)

  useEffect(() => {
    setExpanded(false)
  }, [text])

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    setIsTruncated(el.scrollHeight > el.clientHeight)
  }, [text, expanded])

  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold text-slate-900">Description</h3>
      <p
        ref={textRef}
        className={`whitespace-pre-line text-sm text-slate-600 ${expanded ? '' : 'line-clamp-1'}`}
      >
        {text}
      </p>
      {(isTruncated || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-700"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  )
}

function formatPostedDate(value) {
  if (!value) return null
  try {
    return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: '2-digit' }).format(new Date(value))
  } catch {
    return null
  }
}

function EmptyPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold text-slate-900">Scroll the feed to see details</p>
      <p className="mt-1 text-sm text-slate-500">Product details for the reel you're watching will show up here.</p>
    </div>
  )
}

function ReelProductDetailPanel({ product }) {
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const { createOrGetThread } = useChat()
  const [startingChat, setStartingChat] = useState(false)

  const overviewRows = useOverviewRows(product)
  const featureSections = useFeatureSections(product)

  if (!product) return <EmptyPanel />

  const categoryName = product.category?.name || product.categoryName || ''
  const overviewTitle = getOverviewTitle(categoryName)
  const postedDate = formatPostedDate(product.createdAt)
  const km = product.kilometers ?? product.mileage
  const statusLabel = product.status === 'sold' ? 'Sold' : product.status === 'inactive' || product.status === 'paused' ? 'Unavailable' : 'Available'
  const statusClass = product.status === 'sold' ? 'bg-red-500' : product.status === 'inactive' || product.status === 'paused' ? 'bg-slate-400' : 'bg-lime-500'

  const handleChatWithSeller = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to chat with sellers')
      navigate('/login')
      return
    }
    const sellerId = product.seller?._id || product.seller?.id || product.seller
    if (sellerId && user?._id && String(sellerId) === String(user._id)) {
      toast.error('You cannot chat with yourself for your own product')
      return
    }
    setStartingChat(true)
    try {
      const thread = await createOrGetThread({
        product: {
          id: product._id,
          title: product.title,
          image: product.video ? getMediaUrl(product.video) : getMediaUrl(product.images?.[0]) || '',
        },
        buyer: { id: user?._id, name: user?.name || user?.email || 'You' },
        seller: {
          id: sellerId || 'seller',
          name: product.seller?.name || product.seller?.email || 'Seller',
        },
      })
      if (thread) navigate(`/chat/${thread.id}`)
      else toast.error('Unable to start chat right now')
    } catch {
      toast.error('Failed to start chat. Please try again.')
    } finally {
      setStartingChat(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-brand px-4 py-1.5 text-base font-bold text-white">
            {formatListingPrice(product)}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${statusClass}`}>
            {statusLabel}
          </span>
        </div>

        <div>
          <h2 className="text-lg font-bold leading-snug text-slate-900">{product.title || 'Listing'}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {product.year ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {product.year}
              </span>
            ) : null}
            {km != null ? (
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5 text-slate-400" />
                {Number(km).toLocaleString()} km
              </span>
            ) : null}
            {product.condition ? <span>{product.condition}</span> : null}
            {postedDate ? <span>{postedDate}</span> : null}
          </div>
        </div>

        {overviewRows.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">{overviewTitle}</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {overviewRows.map((row, idx) => (
                <div key={`${row.label}-${idx}`} className="min-w-0">
                  <p className="text-[11px] text-slate-400">{row.label}</p>
                  <p className="truncate text-sm font-semibold text-slate-800" title={row.value}>{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {product.description ? <DescriptionBlock text={product.description} /> : null}

        {featureSections.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Features</h3>
            <div className="flex flex-wrap gap-2">
              {featureSections.map((section) => (
                <span
                  key={section.title}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {section.title}
                  <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-slate-500">
                    {section.items.length}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {product.location ? (
          <div>
            <h3 className="mb-1.5 text-sm font-semibold text-slate-900">Location</h3>
            <p className="flex items-start gap-1.5 text-sm text-slate-600">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
              {product.location}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid flex-shrink-0 grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => navigate(`/products/${product._id}`)}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand"
        >
          More Details
        </button>
        <button
          type="button"
          onClick={handleChatWithSeller}
          disabled={startingChat}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          <MessageCircle className="h-4 w-4" />
          Chat With Seller
        </button>
      </div>
    </div>
  )
}

export default ReelProductDetailPanel
