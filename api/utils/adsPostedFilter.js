/**
 * "Ads Posted" browse filter — auto-set on listing create/update, not seller-selected.
 */

function normalizeFilterLabel(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[\s\-_]+/g, ' ')
    .trim()
}

function isAdsPostedFilterRoot(root) {
  const n = normalizeFilterLabel(root?.name)
  return (
    n === 'ads posted' ||
    n.includes('ads posted') ||
    n === 'date posted' ||
    n.includes('date posted') ||
    n === 'posted date' ||
    n.includes('posted date')
  )
}

const AGE_BUCKETS = [
  { test: (n) => n === 'today' || n.startsWith('today '), maxAgeMs: 24 * 60 * 60 * 1000 },
  { test: (n) => n.includes('3 day'), maxAgeMs: 3 * 24 * 60 * 60 * 1000 },
  { test: (n) => n.includes('1 week') || (n.includes('week') && !n.includes('2')), maxAgeMs: 7 * 24 * 60 * 60 * 1000 },
  { test: (n) => n.includes('2 week'), maxAgeMs: 14 * 24 * 60 * 60 * 1000 },
  { test: (n) => n.includes('1 month') || n.includes('30 day'), maxAgeMs: 30 * 24 * 60 * 60 * 1000 },
]

function listAdsPostedChildren(filters, root) {
  const list = Array.isArray(filters) ? filters : []
  const rootId = String(root._id)
  return list.filter((f) => f.parentId && String(f.parentId) === rootId)
}

function pickChildForAgeMs(children, ageMs) {
  const ranked = children
    .map((child) => {
      const n = normalizeFilterLabel(child.name)
      const bucket = AGE_BUCKETS.find((b) => b.test(n))
      return bucket ? { child, maxAgeMs: bucket.maxAgeMs } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.maxAgeMs - b.maxAgeMs)

  if (!ranked.length) return null

  let chosen = ranked[ranked.length - 1]
  for (const entry of ranked) {
    if (ageMs <= entry.maxAgeMs) {
      chosen = entry
      break
    }
  }
  return chosen.child
}

function resolveAdsPostedSelectionForDate(postedAt, filters) {
  const list = Array.isArray(filters) ? filters : []
  const roots = list.filter((f) => !f.parentId)
  const root = roots.find(isAdsPostedFilterRoot)
  if (!root) return null

  const fieldKey = `filter_${String(root.slug || root._id)}`
  const children = listAdsPostedChildren(list, root)
  if (!children.length) return null

  const posted = postedAt instanceof Date ? postedAt : new Date(postedAt)
  const ageMs = Math.max(0, Date.now() - posted.getTime())
  const child = pickChildForAgeMs(children, ageMs)
  if (!child) return null

  return {
    fieldKey,
    selectionId: String(child._id),
    parentId: String(root._id),
    label: child.name,
  }
}

module.exports = {
  normalizeFilterLabel,
  isAdsPostedFilterRoot,
  resolveAdsPostedSelectionForDate,
}
