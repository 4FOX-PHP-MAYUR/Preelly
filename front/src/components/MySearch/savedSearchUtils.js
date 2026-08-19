import { getMediaUrl } from '@shared/utils/helpers'
import { absoluteUrl } from '@shared/utils/constants'

export function formatSavedDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export function getSearchDisplayName(item) {
  return item?.searchName || item?.title || 'My Search'
}

export function getCategoryPathLabel(item) {
  if (Array.isArray(item?.categoryPath) && item.categoryPath.length) {
    return item.categoryPath.join(' > ')
  }
  const parts = [item?.categoryName, item?.subCategoryName].filter(Boolean)
  return parts.join(' > ')
}

export function getFilterTags(item) {
  if (item?.filters?.tags?.length) return item.filters.tags
  if (item?.selectedFilters?.tags?.length) return item.selectedFilters.tags
  const tags = []
  const loc = item?.location || item?.filters?.location
  tags.push(loc ? String(loc).toUpperCase() : 'ALL CITIES')
  if (item?.filters?.minPrice || item?.filters?.maxPrice) {
    tags.push(`PRICE: ${item.filters.minPrice || '0'}–${item.filters.maxPrice || '∞'}`)
  }
  return tags
}

export function getMatchCount(item) {
  if (typeof item?.matchCount === 'number') return item.matchCount
  if (typeof item?.totalMatchingAdsCount === 'number') return item.totalMatchingAdsCount
  return null
}

export function getPreviewImages(item) {
  const list = item?.previewImages?.length
    ? item.previewImages
    : item?.latestMatchingImages || []
  return list
    .slice(0, 3)
    .map((src) => getMediaUrl(src) || src)
    .filter(Boolean)
}

export function getNotificationsEnabled(item) {
  return Boolean(item?.notificationEnabled ?? item?.notifyEnabled)
}

export function buildShareUrl(item) {
  const path = item?.searchUrl || `/search?q=${encodeURIComponent(item?.query || item?.keyword || '')}`
  // Routed through absoluteUrl so a shared search honours VITE_SITE_URL, like
  // every other outbound link, instead of leaking the current browser origin.
  return absoluteUrl(path)
}
