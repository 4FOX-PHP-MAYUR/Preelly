import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ChevronDown, ChevronUp, MapPin, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { selectIsAuthenticated, selectUser } from '@shared/store/slices/authSlice'
import { useChat } from '@shared/components/Chat/ChatContext'
import { getMediaUrl } from '@shared/utils/helpers'
import ListingHeaderCard from '@shared/components/ProductDetail/ListingHeaderCard'
import OverviewCard from '@shared/components/ProductDetail/OverviewCard'
import DetailCard from '@shared/components/ProductDetail/DetailCard'
import { buildLocationAddress } from '@shared/components/ProductDetail/detailHelpers'
import { getFeatureSectionsFromProduct } from '@shared/components/ProductDetail/ProductFeatures'

const REEL_PANEL_SECTION_GAP = 'space-y-3'

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
    <DetailCard title="Description" flat>
      <p
        ref={textRef}
        className={`whitespace-pre-line text-sm leading-relaxed text-slate-600 ${expanded ? '' : 'line-clamp-1'}`}
      >
        {text}
      </p>
      {(isTruncated || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-700"
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
    </DetailCard>
  )
}

function FeaturesBlock({ sections }) {
  if (!sections.length) return null

  return (
    <DetailCard title="Features" flat>
      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <span
            key={section.title}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 py-2 pl-4 pr-2 text-sm font-medium text-slate-800"
          >
            <span>{section.title}</span>
            <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-white px-2 text-xs font-semibold text-slate-500">
              {section.items.length}
            </span>
          </span>
        ))}
      </div>
    </DetailCard>
  )
}

function LocationBlock({ product }) {
  const address = buildLocationAddress(product) || product?.location
  if (!address) return null

  return (
    <DetailCard title="Location" flat>
      <p className="flex items-start gap-1.5 text-sm text-slate-600">
        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
        {address}
      </p>
    </DetailCard>
  )
}

function EmptyPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold text-slate-900">Scroll the feed to see details</p>
      <p className="mt-1 text-sm text-slate-500">Product details for the reel you&apos;re watching will show up here.</p>
    </div>
  )
}

function ReelProductDetailPanel({ product }) {
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const { createOrGetThread } = useChat()
  const [startingChat, setStartingChat] = useState(false)

  const featureSections = useFeatureSections(product)

  if (!product) return <EmptyPanel />

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
      <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${REEL_PANEL_SECTION_GAP}`}>
        <ListingHeaderCard product={product} flat />
        <OverviewCard product={product} flat />
        {product.description ? <DescriptionBlock text={product.description} /> : null}
        <FeaturesBlock sections={featureSections} />
        <LocationBlock product={product} />
      </div>

      <div className="mt-4 grid flex-shrink-0 grid-cols-2 gap-3 bg-white pt-4">
        <button
          type="button"
          onClick={() => navigate(`/products/${product._id}`)}
          className="rounded-full bg-brand-50 px-5 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-brand-100"
        >
          More Details
        </button>
        <button
          type="button"
          onClick={handleChatWithSeller}
          disabled={startingChat}
          className="flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          <MessageCircle className="h-4 w-4" />
          Chat With Seller
        </button>
      </div>
    </div>
  )
}

export default ReelProductDetailPanel
