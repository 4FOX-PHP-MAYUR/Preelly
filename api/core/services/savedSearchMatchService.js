const SavedSearch = require('../../models/SavedSearch')
const Product = require('../../models/Product')
const User = require('../../models/User')
const Notification = require('../../models/Notification')
const { sendEmail } = require('../../utils/mailer')
const { isBlockedBetween } = require('./blockService')

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build a Mongo product query from a saved-search document.
 * Supports both legacy filters and extended selectedFilters / location fields.
 */
function buildProductMatchFromSavedSearch(doc) {
  const match = { status: 'active' }
  const categoryId = doc.categoryId || null
  const subcategoryId = doc.subcategoryId || doc.subCategoryId || null

  if (categoryId) match.category = categoryId
  if (subcategoryId) match.subcategory = subcategoryId

  const location = doc.location || doc.filters?.location || ''
  if (location) {
    const loc = escapeRegex(location)
    match.$and = match.$and || []
    match.$and.push({
      $or: [
        { location: new RegExp(loc, 'i') },
        { city: new RegExp(loc, 'i') },
        { area: new RegExp(loc, 'i') },
      ],
    })
  }

  const minRaw = doc.filters?.minPrice ?? doc.selectedFilters?.minPrice
  const maxRaw = doc.filters?.maxPrice ?? doc.selectedFilters?.maxPrice
  const min = minRaw !== '' && minRaw != null ? Number(minRaw) : null
  const max = maxRaw !== '' && maxRaw != null ? Number(maxRaw) : null
  if ((min != null && !Number.isNaN(min)) || (max != null && !Number.isNaN(max))) {
    match.price = {}
    if (min != null && !Number.isNaN(min)) match.price.$gte = min
    if (max != null && !Number.isNaN(max)) match.price.$lte = max
  }

  const queryText = doc.query || doc.keyword || ''
  if (queryText) {
    const re = new RegExp(escapeRegex(queryText), 'i')
    match.$and = match.$and || []
    match.$and.push({
      $or: [{ title: re }, { description: re }],
    })
  }

  // Hierarchical category path ids stored in selectedFilters (best-effort)
  const pathIds = doc.selectedFilters?.categoryPathIds
  if (Array.isArray(pathIds) && pathIds.length >= 2) {
    // Only constrain when we have a meaningful path beyond root
    match.categoryPath = { $all: pathIds.map(String) }
  }

  return match
}

function extractPreviewImages(products, limit = 3) {
  return (products || [])
    .map((p) => (Array.isArray(p.images) && p.images[0] ? p.images[0] : null))
    .filter(Boolean)
    .slice(0, limit)
}

async function enrichSavedSearch(doc) {
  const plain = doc.toObject ? doc.toObject() : { ...doc }
  if (plain.isDeleted || plain.status === 'deleted') {
    return {
      ...plain,
      searchName: plain.searchName || plain.title,
      matchCount: plain.totalMatchingAdsCount || 0,
      newAdsCount: 0,
      previewImages: plain.latestMatchingImages || [],
    }
  }

  const match = buildProductMatchFromSavedSearch(plain)
  const since = plain.lastViewedAt || plain.createdAt || new Date(0)

  const [totalMatches, newAdsCount, previewProducts] = await Promise.all([
    Product.countDocuments(match),
    Product.countDocuments({ ...match, createdAt: { $gt: since } }),
    Product.find(match)
      .sort({ createdAt: -1 })
      .limit(3)
      .select('images title price currency')
      .lean(),
  ])

  const previewImages = extractPreviewImages(previewProducts, 3)

  // Persist cached counters when they drift (fire-and-forget style update)
  const needsCacheUpdate =
    plain.totalMatchingAdsCount !== totalMatches ||
    plain.newAdsCount !== newAdsCount ||
    JSON.stringify(plain.latestMatchingImages || []) !== JSON.stringify(previewImages)

  if (needsCacheUpdate && plain._id) {
    SavedSearch.updateOne(
      { _id: plain._id },
      {
        $set: {
          totalMatchingAdsCount: totalMatches,
          newAdsCount,
          latestMatchingImages: previewImages,
        },
      }
    ).catch(() => {})
  }

  return {
    ...plain,
    title: plain.title || plain.searchName,
    searchName: plain.searchName || plain.title,
    notifyEnabled: plain.notificationEnabled ?? plain.notifyEnabled,
    notificationEnabled: plain.notificationEnabled ?? plain.notifyEnabled,
    matchCount: totalMatches,
    totalMatchingAdsCount: totalMatches,
    newAdsCount,
    previewImages,
    latestMatchingImages: previewImages,
  }
}

function productMatchesSavedSearch(product, doc) {
  if (!product || !doc) return false
  if (doc.isDeleted || doc.status === 'deleted') return false

  const categoryId = doc.categoryId ? String(doc.categoryId) : null
  const subcategoryId = doc.subcategoryId || doc.subCategoryId
    ? String(doc.subcategoryId || doc.subCategoryId)
    : null

  if (categoryId && String(product.category) !== categoryId) return false
  if (subcategoryId && String(product.subcategory || '') !== subcategoryId) return false

  const location = (doc.location || doc.filters?.location || '').trim().toLowerCase()
  if (location) {
    const hay = [product.location, product.city, product.area]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase())
      .join(' ')
    if (!hay.includes(location)) return false
  }

  const minRaw = doc.filters?.minPrice ?? doc.selectedFilters?.minPrice
  const maxRaw = doc.filters?.maxPrice ?? doc.selectedFilters?.maxPrice
  const min = minRaw !== '' && minRaw != null ? Number(minRaw) : null
  const max = maxRaw !== '' && maxRaw != null ? Number(maxRaw) : null
  const price = Number(product.price)
  if (min != null && !Number.isNaN(min) && !Number.isNaN(price) && price < min) return false
  if (max != null && !Number.isNaN(max) && !Number.isNaN(price) && price > max) return false

  const queryText = (doc.query || doc.keyword || '').trim().toLowerCase()
  if (queryText) {
    const blob = `${product.title || ''} ${product.description || ''}`.toLowerCase()
    if (!blob.includes(queryText)) return false
  }

  const pathIds = doc.selectedFilters?.categoryPathIds
  if (Array.isArray(pathIds) && pathIds.length) {
    const productPath = (product.categoryPath || []).map(String)
    const ok = pathIds.every((id) => productPath.includes(String(id)))
    if (!ok) return false
  }

  return true
}

async function notifySavedSearchMatch(savedSearch, product, user) {
  const searchName = savedSearch.searchName || savedSearch.title || 'your saved search'
  const adTitle = product.title || 'a new listing'
  const masterOn = savedSearch.notificationEnabled ?? savedSearch.notifyEnabled
  if (!masterOn) return

  // A saved search must never surface a listing from a blocked account —
  // this covers the in-app, push and email channels below.
  if (product.seller && (await isBlockedBetween(savedSearch.userId, product.seller))) return

  const tasks = []

  // In-app / "push" notification (no FCM in codebase — dashboard notifications act as push channel)
  if (savedSearch.pushNotificationEnabled !== false) {
    tasks.push(
      Notification.create({
        user: savedSearch.userId,
        actor: product.seller || null,
        relatedProduct: product._id,
        type: 'listing',
        tab: 'buying',
        title: `New ad for “${searchName}”`,
        body: `“${adTitle}” matches your saved search.`,
        data: {
          kind: 'saved_search_match',
          savedSearchId: String(savedSearch._id),
          productId: String(product._id),
          searchUrl: savedSearch.searchUrl || '/search',
        },
      }).catch((err) => {
        console.error('Saved search in-app notification failed:', err.message)
      })
    )
  }

  if (savedSearch.emailNotificationEnabled !== false && user?.email) {
    const subject = `New listing matches “${searchName}”`
    const text = `Hi ${user.name || 'there'},\n\nA new ad “${adTitle}” matches your saved search “${searchName}”.\n\nOpen Preelly to view matching ads.\n\nThanks,\nPreelly Team`
    const html = `<p>Hi ${user.name || 'there'},</p><p>A new ad <strong>${adTitle}</strong> matches your saved search <strong>${searchName}</strong>.</p><p>Open Preelly to view matching ads.</p><p>Thanks,<br/>Preelly Team</p>`
    tasks.push(
      sendEmail({ to: user.email, subject, text, html }).catch((err) => {
        console.error('Saved search email notification failed:', err.message)
      })
    )
  }

  await Promise.all(tasks)
  await SavedSearch.updateOne(
    { _id: savedSearch._id },
    { $set: { lastNotificationSentAt: new Date() } }
  ).catch(() => {})
}

/**
 * When a product becomes active, match against all active saved searches,
 * bump counters / preview images, and notify users when enabled.
 */
async function matchProductAgainstSavedSearches(product) {
  if (!product || product.status !== 'active') return { matched: 0 }

  const cursor = SavedSearch.find({
    isDeleted: { $ne: true },
    status: { $ne: 'deleted' },
  }).lean()

  const docs = await cursor
  let matched = 0
  const userCache = new Map()

  for (const doc of docs) {
    if (!productMatchesSavedSearch(product, doc)) continue
    matched += 1

    const image = Array.isArray(product.images) && product.images[0] ? product.images[0] : null
    const nextImages = image
      ? [image, ...(doc.latestMatchingImages || []).filter((src) => src !== image)].slice(0, 3)
      : doc.latestMatchingImages || []

    await SavedSearch.updateOne(
      { _id: doc._id },
      {
        $inc: { newAdsCount: 1, totalMatchingAdsCount: 1 },
        $set: { latestMatchingImages: nextImages },
      }
    )

    const masterOn = doc.notificationEnabled ?? doc.notifyEnabled
    if (!masterOn) continue

    let user = userCache.get(String(doc.userId))
    if (user === undefined) {
      user = await User.findById(doc.userId).select('name email').lean()
      userCache.set(String(doc.userId), user || null)
    }
    if (user) {
      await notifySavedSearchMatch(doc, product, user)
    }
  }

  return { matched }
}

module.exports = {
  buildProductMatchFromSavedSearch,
  enrichSavedSearch,
  productMatchesSavedSearch,
  matchProductAgainstSavedSearches,
  notifySavedSearchMatch,
  extractPreviewImages,
}
