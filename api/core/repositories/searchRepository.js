const mongoose = require('mongoose')
const Product = require('../../models/Product')
const Category = require('../../models/Category')
const User = require('../../models/User')
const Dealer = require('../../models/Dealer')
const SearchHistory = require('../../models/SearchHistory')
const SearchAnalytics = require('../../models/SearchAnalytics')
const categoryRepository = require('./categoryRepository')

const ACTIVE_CATEGORY = categoryRepository.ACTIVE_FILTER
const RECENT_SEARCH_LIMIT = 10

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildPartialRegex(keyword) {
  return new RegExp(escapeRegex(keyword), 'i')
}

function buildExactCaseInsensitiveRegex(keyword) {
  return new RegExp(`^${escapeRegex(keyword)}$`, 'i')
}

function buildOwnerFilter({ userId, deviceId }) {
  if (userId) {
    return { userId: new mongoose.Types.ObjectId(String(userId)) }
  }
  return { deviceId, userId: null }
}

function normalizeAnalyticsKeyword(keyword) {
  return String(keyword || '').trim().toLowerCase().slice(0, 300)
}

/**
 * Expand property category scope for property-specific search.
 */
async function getPropertyCategoryScopeIds() {
  const root = await categoryRepository.findPropertyRoot()
  if (!root?._id) return []

  const descendants = await Category.find({
    isDeleted: false,
    $or: [{ _id: root._id }, { path: root._id }],
  })
    .select('_id')
    .lean()

  return (descendants || []).map((d) => d._id)
}

function resolveProductSort(sort = 'relevance') {
  if (sort === 'oldest') return { createdAt: 1 }
  if (sort === 'newest') return { createdAt: -1 }
  return { score: { $meta: 'textScore' }, createdAt: -1 }
}

async function searchProducts(
  keyword,
  { page = 1, limit = 20, propertyOnly = false, sort = 'relevance' } = {},
) {
  const skip = (page - 1) * limit
  const match = { status: 'active' }

  if (propertyOnly) {
    const scopeIds = await getPropertyCategoryScopeIds()
    if (!scopeIds.length) {
      return { items: [], total: 0, page, limit }
    }
    match.$or = [{ category: { $in: scopeIds } }, { subcategory: { $in: scopeIds } }]
  }

  const regex = buildPartialRegex(keyword)

  let items = []
  let total = 0

  const textMatch = { ...match, $text: { $search: keyword } }
  const textSort = resolveProductSort(sort)

  try {
    total = await Product.countDocuments(textMatch)
    items = await Product.find(textMatch)
      .populate('category', 'name slug icon emoji')
      .populate('seller', 'name avatar isVerified')
      .sort(textSort)
      .skip(skip)
      .limit(limit)
      .lean()
  } catch {
    const regexMatch = {
      ...match,
      $or: [{ title: regex }, { description: regex }, { location: regex }],
    }
    const regexSort = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 }
    total = await Product.countDocuments(regexMatch)
    items = await Product.find(regexMatch)
      .populate('category', 'name slug icon emoji')
      .populate('seller', 'name avatar isVerified')
      .sort(regexSort)
      .skip(skip)
      .limit(limit)
      .lean()
  }

  return { items, total, page, limit }
}

function resolveEntitySort(sort = 'relevance') {
  if (sort === 'oldest') return { createdAt: 1 }
  return { createdAt: -1 }
}

async function searchCategories(keyword, { page = 1, limit = 20, sort = 'relevance' } = {}) {
  const skip = (page - 1) * limit
  const regex = buildPartialRegex(keyword)
  const filter = {
    ...ACTIVE_CATEGORY,
    $or: [{ name: regex }, { slug: regex }],
  }

  const entitySort =
    sort === 'oldest'
      ? { createdAt: 1 }
      : sort === 'newest'
        ? { createdAt: -1 }
        : { sortOrder: 1, name: 1 }

  const [items, total] = await Promise.all([
    Category.find(filter).sort(entitySort).skip(skip).limit(limit).lean(),
    Category.countDocuments(filter),
  ])

  return { items, total, page, limit }
}

async function searchAgents(keyword, { page = 1, limit = 20, sort = 'relevance' } = {}) {
  const skip = (page - 1) * limit
  const regex = buildPartialRegex(keyword)
  const filter = {
    role: 'user',
    status: 'active',
    $or: [{ name: regex }, { displayName: regex }, { email: regex }],
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('name displayName avatar isVerified createdAt')
      .sort(resolveEntitySort(sort))
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ])

  return { items, total, page, limit }
}

async function searchAgencies(keyword, { page = 1, limit = 20, sort = 'relevance' } = {}) {
  const skip = (page - 1) * limit
  const regex = buildPartialRegex(keyword)
  const filter = {
    status: true,
    $or: [{ dealer_name: regex }, { dealer_email: regex }, { synopsis: regex }],
  }

  const [items, total] = await Promise.all([
    Dealer.find(filter)
      .sort(resolveEntitySort(sort))
      .skip(skip)
      .limit(limit)
      .lean(),
    Dealer.countDocuments(filter),
  ])

  return { items, total, page, limit }
}

/**
 * Upsert recent search: dedupe by keyword (case-insensitive), move to top, keep latest 10.
 */
async function upsertSearchHistoryEntry(payload) {
  const { keyword, userId, deviceId, platform, isLoggedIn } = payload
  const ownerFilter = buildOwnerFilter({ userId, deviceId })
  const duplicateFilter = {
    ...ownerFilter,
    keyword: buildExactCaseInsensitiveRegex(keyword),
  }

  await SearchHistory.deleteMany(duplicateFilter)

  await SearchHistory.create({
    keyword,
    deviceId,
    userId: userId ? new mongoose.Types.ObjectId(String(userId)) : null,
    platform,
    isLoggedIn,
  })

  const recentRows = await SearchHistory.find(ownerFilter)
    .sort({ createdAt: -1 })
    .select('_id keyword')
    .lean()

  const seen = new Set()
  const idsToDelete = []

  for (const row of recentRows) {
    const key = String(row.keyword || '').trim().toLowerCase()
    if (!key) {
      idsToDelete.push(row._id)
      continue
    }
    if (seen.has(key)) {
      idsToDelete.push(row._id)
      continue
    }
    seen.add(key)
    if (seen.size > RECENT_SEARCH_LIMIT) {
      idsToDelete.push(row._id)
    }
  }

  if (idsToDelete.length) {
    await SearchHistory.deleteMany({ _id: { $in: idsToDelete } })
  }
}

/**
 * Increment search analytics for reporting and popular searches.
 */
async function upsertSearchAnalytics(keyword) {
  const normalized = normalizeAnalyticsKeyword(keyword)
  if (!normalized) return null

  return SearchAnalytics.findOneAndUpdate(
    { keyword: normalized },
    {
      $inc: { searchCount: 1 },
      $set: { lastSearchedAt: new Date() },
      $setOnInsert: { keyword: normalized },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean()
}

async function recordSearchActivity(payload) {
  await upsertSearchHistoryEntry(payload)
  await upsertSearchAnalytics(payload.keyword)
}

async function clearRecentSearchHistory({ userId, deviceId }) {
  const filter = buildOwnerFilter({ userId, deviceId })
  const result = await SearchHistory.deleteMany(filter)
  return { deletedCount: result.deletedCount || 0 }
}

async function findRecentSearchKeywords({ userId, deviceId, limit = RECENT_SEARCH_LIMIT }) {
  const filter = buildOwnerFilter({ userId, deviceId })

  const rows = await SearchHistory.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.max(limit * 3, 30))
    .select('keyword createdAt')
    .lean()

  return rows
}

async function findPopularSearchKeywords({ limit = 10 } = {}) {
  const rows = await SearchAnalytics.find({ searchCount: { $gt: 0 } })
    .sort({ searchCount: -1, lastSearchedAt: -1 })
    .limit(limit)
    .select('keyword searchCount lastSearchedAt')
    .lean()

  return rows
}

async function findPopularSuggestionKeywords(keyword, limit = 5) {
  const regex = buildPartialRegex(keyword)
  const rows = await SearchAnalytics.find({ keyword: regex })
    .sort({ searchCount: -1, lastSearchedAt: -1 })
    .limit(limit)
    .select('keyword searchCount')
    .lean()

  return rows
}

async function findDistinctProductLocations(keyword, limit = 5) {
  const regex = buildPartialRegex(keyword)
  const rows = await Product.aggregate([
    { $match: { status: 'active', location: regex } },
    { $group: { _id: '$location', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, location: '$_id' } },
  ])

  return rows
}

async function findSuggestionKeywords(keyword, { userId, deviceId, limit = 10 }) {
  const regex = buildPartialRegex(keyword)
  const historyFilter = {
    keyword: regex,
    ...buildOwnerFilter({ userId, deviceId }),
  }

  const perSourceLimit = Math.max(3, Math.ceil(limit / 2))

  const [
    historyRows,
    categoryRows,
    subcategoryRows,
    productRows,
    locationRows,
    agentRows,
    agencyRows,
    popularRows,
  ] = await Promise.all([
    SearchHistory.find(historyFilter)
      .sort({ createdAt: -1 })
      .limit(perSourceLimit)
      .select('keyword')
      .lean(),
    Category.find({
      ...ACTIVE_CATEGORY,
      level: 0,
      $or: [{ name: regex }, { slug: regex }],
    })
      .sort({ sortOrder: 1, name: 1 })
      .limit(perSourceLimit)
      .select('name slug level')
      .lean(),
    Category.find({
      ...ACTIVE_CATEGORY,
      level: { $gt: 0 },
      $or: [{ name: regex }, { slug: regex }],
    })
      .sort({ sortOrder: 1, name: 1 })
      .limit(perSourceLimit)
      .select('name slug level')
      .lean(),
    Product.find({
      status: 'active',
      title: regex,
    })
      .sort({ createdAt: -1 })
      .limit(perSourceLimit)
      .select('title')
      .lean(),
    findDistinctProductLocations(keyword, perSourceLimit),
    User.find({
      role: 'user',
      status: 'active',
      $or: [{ name: regex }, { displayName: regex }],
    })
      .sort({ createdAt: -1 })
      .limit(perSourceLimit)
      .select('name displayName')
      .lean(),
    Dealer.find({
      status: true,
      dealer_name: regex,
    })
      .sort({ createdAt: -1 })
      .limit(perSourceLimit)
      .select('dealer_name')
      .lean(),
    findPopularSuggestionKeywords(keyword, perSourceLimit),
  ])

  return {
    historyRows,
    categoryRows,
    subcategoryRows,
    productRows,
    locationRows,
    agentRows,
    agencyRows,
    popularRows,
  }
}

// Backward-compatible alias
async function createSearchHistoryEntry(payload) {
  return recordSearchActivity(payload)
}

module.exports = {
  escapeRegex,
  buildPartialRegex,
  RECENT_SEARCH_LIMIT,
  searchProducts,
  searchCategories,
  searchAgents,
  searchAgencies,
  createSearchHistoryEntry,
  recordSearchActivity,
  upsertSearchHistoryEntry,
  upsertSearchAnalytics,
  clearRecentSearchHistory,
  findRecentSearchKeywords,
  findPopularSearchKeywords,
  findSuggestionKeywords,
}
