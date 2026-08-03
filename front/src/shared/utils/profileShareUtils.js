import { openInstagramDirectInbox } from './reelShare'

export function buildProfileShareUrl(userId) {
  if (typeof window === 'undefined') return `/user/${userId}`
  return `${window.location.origin}/user/${userId}`
}

export function buildProfileShareText(displayName) {
  return `Check out ${displayName}'s profile on Preelly`
}

export function buildWhatsAppShareUrl(url, text) {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
}

export function buildFacebookShareUrl(url, text) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`
}

export function buildXShareUrl(url, text) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
}

export function buildTelegramShareUrl(url, text) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
}

export function buildLinkedInShareUrl(url) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
}

export function buildEmailShareUrl(url, text, subject) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`
}

export function isNativeShareSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export async function shareProfileNative({ title, text, url }) {
  if (!isNativeShareSupported()) return false
  try {
    await navigator.share({ title, text, url })
    return true
  } catch (error) {
    if (error?.name === 'AbortError') return false
    throw error
  }
}

export async function copyProfileLink(url) {
  await navigator.clipboard.writeText(url)
}

/**
 * Instagram has no web share-intent URL, so the established pattern (see
 * shareReelToInstagram in reelShare.js) is: copy the link, then deep-link
 * into Instagram's DMs so the user can paste and send it themselves.
 */
export async function shareProfileToInstagram(url, text) {
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
  } catch {
    throw new Error('Unable to copy profile link')
  }
  openInstagramDirectInbox()
}
