import { getMediaUrl } from './helpers'

export function buildReelShareUrl(productId, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  if (!productId) return origin
  return `${origin}/reels?reel=${encodeURIComponent(String(productId))}`
}

export function formatReelPrice(product) {
  if (product?.price == null) return ''
  const currency =
    typeof product?.currency === 'string' && product.currency.length === 3
      ? product.currency.toUpperCase()
      : 'AED'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(Number(product.price))
  } catch {
    return `${currency} ${Number(product.price).toLocaleString()}`
  }
}

export function buildReelShareText(product, message = '', origin) {
  const title = product?.title || 'this reel'
  const price = formatReelPrice(product)
  const reelUrl = buildReelShareUrl(product?._id, origin)
  const lines = [
    message.trim() || `Check out ${title} on Preelly`,
    price,
    reelUrl,
  ].filter(Boolean)
  return lines.join('\n')
}

export function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
}

export function openInstagramDirectInbox() {
  const ua = navigator.userAgent || ''
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)

  if (isIOS) {
    window.location.href = 'instagram://direct-inbox'
    return
  }

  if (isAndroid) {
    window.location.href =
      'intent://instagram.com/direct/inbox/#Intent;package=com.instagram.android;scheme=https;end'
    return
  }

  window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener,noreferrer')
}

async function tryNativeVideoShare(product, shareText) {
  if (!product?.video || !navigator.share) return false

  const videoUrl = getMediaUrl(product.video)
  if (!videoUrl) return false

  try {
    const response = await fetch(videoUrl)
    if (!response.ok) return false

    const blob = await response.blob()
    const ext = blob.type?.includes('webm') ? 'webm' : 'mp4'
    const file = new File([blob], `preelly-reel-${product._id}.${ext}`, {
      type: blob.type || 'video/mp4',
    })

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return false
    }

    await navigator.share({
      files: [file],
      title: product.title || 'Preelly reel',
      text: shareText,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Share a reel to Instagram: native video share on mobile when possible,
 * otherwise copy link + open Instagram DMs directly.
 */
export async function shareReelToInstagram({ product, message = '' }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareText = buildReelShareText(product, message, origin)

  const sharedNatively = await tryNativeVideoShare(product, shareText)
  if (sharedNatively) {
    return { method: 'native' }
  }

  try {
    await navigator.clipboard.writeText(shareText)
  } catch {
    throw new Error('Unable to copy reel link')
  }

  openInstagramDirectInbox()
  return { method: 'clipboard-dm' }
}

export const REEL_URL_RE = /\/reels\?reel=([a-f0-9]{24})\b/i

export function extractReelIdFromMessage(text) {
  if (!text || typeof text !== 'string') return null
  const m = text.match(REEL_URL_RE)
  return m?.[1] || null
}
