import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { productService } from '../../services/api'
import { getMediaUrl, isValidObjectId } from '../../utils/helpers'
import { extractReelIdFromMessage, REEL_URL_RE } from '../../utils/reelShare'

const PRODUCT_URL_RE = /\/products\/([a-f0-9]{24})\b/i

export function extractProductIdFromMessage(text) {
  if (!text || typeof text !== 'string') return null
  const reelId = extractReelIdFromMessage(text)
  if (reelId && isValidObjectId(reelId)) return reelId
  const m = text.match(PRODUCT_URL_RE)
  return m && isValidObjectId(m[1]) ? m[1] : null
}

function stripProductUrls(raw, productId) {
  if (!raw || !productId) return ''
  const esc = productId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const reelPattern = new RegExp(`https?:\\/\\/[^\\s]*\\/reels\\?reel=${esc}[^\\s]*`, 'gi')
  const urlPattern = new RegExp(`https?:\\/\\/[^\\s]*\\/products\\/${esc}[^\\s]*`, 'gi')
  const pathPattern = new RegExp(`\\/products\\/${esc}[^\\s]*`, 'gi')
  const reelPathPattern = new RegExp(`\\/reels\\?reel=${esc}[^\\s]*`, 'gi')
  return raw
    .replace(reelPattern, '')
    .replace(urlPattern, '')
    .replace(pathPattern, '')
    .replace(reelPathPattern, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function messageUsesReelLink(text, productId) {
  if (!text || !productId) return false
  return REEL_URL_RE.test(text) && text.includes(productId)
}

const cardStyles = {
  primary: 'bg-white/95 text-gray-900 border border-white/50 shadow-md',
  neutral: 'bg-gray-50 text-gray-900 border border-gray-200 shadow-sm',
  dark: 'bg-gray-800/95 text-gray-100 border border-gray-600 shadow-md',
}

/**
 * Renders chat message text; if it contains a reel or product URL, shows a listing preview card.
 * @param {'primary'|'neutral'|'dark'} bubbleVariant — primary = sent bubble (blue), neutral = received on light UI, dark = received on dark UI
 */
function ChatMessageRichContent({ text, bubbleVariant = 'neutral' }) {
  const productId = useMemo(() => extractProductIdFromMessage(text), [text])
  const openAsReel = useMemo(() => messageUsesReelLink(text, productId), [text, productId])
  const caption = useMemo(() => (productId ? stripProductUrls(text, productId) : text?.trim() || ''), [text, productId])

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    setProduct(null)
    productService
      .getProductById(productId)
      .then((res) => {
        if (!cancelled) setProduct(res.data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  const captionClass =
    bubbleVariant === 'primary'
      ? 'text-white/95'
      : bubbleVariant === 'dark'
        ? 'text-gray-200'
        : 'text-gray-800'

  if (!productId) {
    return <p className={`leading-relaxed whitespace-pre-wrap ${captionClass}`}>{text}</p>
  }

  const thumb =
    product?.video != null
      ? getMediaUrl(product.video)
      : product?.images?.[0]
        ? getMediaUrl(product.images[0])
        : null

  const priceLabel =
    product?.price != null
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: product.currency || 'USD',
          minimumFractionDigits: 0,
        }).format(product.price)
      : null

  const cardClass = cardStyles[bubbleVariant] || cardStyles.neutral
  const listingLink = openAsReel ? `/reels?reel=${productId}` : `/products/${productId}`

  return (
    <div className="space-y-2">
      {caption ? (
        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${captionClass}`}>{caption}</p>
      ) : null}

      <Link
        to={listingLink}
        className={`block overflow-hidden rounded-xl transition-opacity hover:opacity-95 ${cardClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center gap-3 p-3">
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-gray-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-full max-w-[180px] animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-full max-w-[100px] animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ) : failed || !product ? (
          <div
            className={`flex items-center gap-2 p-3 text-sm ${
              bubbleVariant === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}
          >
            <Package className="h-5 w-5 shrink-0 opacity-60" />
            <span>{openAsReel ? 'Reel · Open in feed' : 'Listing · Open product'}</span>
          </div>
        ) : (
          <div className="flex gap-3 p-2">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-200">
              {thumb ? (
                /\.(mp4|webm|mov)(\?|$)/i.test(String(thumb)) ? (
                  <video src={thumb} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-6 w-6 text-gray-400" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <p className="line-clamp-2 text-sm font-semibold leading-snug">{product.title || 'Product'}</p>
              {priceLabel ? <p className="mt-1 text-sm font-bold text-primary-600">{priceLabel}</p> : null}
              <p
                className={`mt-1 text-[11px] font-medium ${
                  bubbleVariant === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {openAsReel ? 'Tap to watch reel' : 'Tap to view listing'}
              </p>
            </div>
          </div>
        )}
      </Link>
    </div>
  )
}

export default ChatMessageRichContent
