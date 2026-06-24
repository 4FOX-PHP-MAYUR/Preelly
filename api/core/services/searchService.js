const searchRepository = require('../repositories/searchRepository')
const AppError = require('../errors/AppError')
const { resolvePlatform } = require('../../utils/platformDetection')

const SEARCH_TYPES = new Set([
  'all',
  'products',
  'properties',
  'categories',
  'agents',
  'agencies',
])

const SORT_OPTIONS = new Set(['relevance', 'newest', 'oldest'])
const INCLUDE_OPTIONS = new Set(['recent', 'popular', 'suggestions'])
const SUGGESTION_MIN_LENGTH = 2
const DEFAULT_SUGGESTION_LIMIT = 10
const DEFAULT_POPULAR_LIMIT = 10

function normalizeKeyword(keyword) {
  if (keyword == null) return ''
  return String(keyword).trim().slice(0, 300)
}

function assertKeyword(keyword) {
  const normalized = normalizeKeyword(keyword)
  if (!normalized) {
    throw new AppError('keyword is required', 400, 'KEYWORD_REQUIRED')
  }
  return normalized
}

function buildMeta(page, limit, total) {
  const totalPages = Math.ceil(total / limit) || 0
  const skip = (page - 1) * limit
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: skip + Math.min(limit, total - skip) < total,
  }
}

function dedupeKeywords(rows, limit = 10) {
  const seen = new Set()
  const result = []

  for (const row of rows || []) {
    const keyword = normalizeKeyword(row.keyword || row)
    if (!keyword) continue
    const key = keyword.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(keyword)
    if (result.length >= limit) break
  }

  return result
}

function scoreSuggestion(keyword, query, source, popularBoost = 0) {
  const kw = normalizeKeyword(keyword).toLowerCase()
  const q = normalizeKeyword(query).toLowerCase()
  if (!kw || !q) return 0

  let score = 0
  if (kw === q) score += 100
  else if (kw.startsWith(q)) score += 80
  else if (kw.includes(q)) score += 40

  const sourcePriority = {
    history: 30,
    popular: 28,
    category: 22,
    subcategory: 20,
    product: 18,
    location: 16,
    agent: 12,
    agency: 10,
  }
  score += sourcePriority[source] || 0
  score += Math.min(Number(popularBoost) || 0, 25)

  return score
}

function mergeSuggestions(raw, query, limit = DEFAULT_SUGGESTION_LIMIT) {
  const candidates = []

  for (const row of raw.historyRows || []) {
    candidates.push({ keyword: row.keyword, source: 'history' })
  }
  for (const row of raw.popularRows || []) {
    candidates.push({
      keyword: row.keyword,
      source: 'popular',
      popularBoost: row.searchCount,
    })
  }
  for (const row of raw.categoryRows || []) {
    candidates.push({ keyword: row.name, source: 'category' })
  }
  for (const row of raw.subcategoryRows || []) {
    candidates.push({ keyword: row.name, source: 'subcategory' })
  }
  for (const row of raw.productRows || []) {
    candidates.push({ keyword: row.title, source: 'product' })
  }
  for (const row of raw.locationRows || []) {
    candidates.push({ keyword: row.location, source: 'location' })
  }
  for (const row of raw.agentRows || []) {
    candidates.push({
      keyword: row.displayName || row.name,
      source: 'agent',
    })
  }
  for (const row of raw.agencyRows || []) {
    candidates.push({ keyword: row.dealer_name, source: 'agency' })
  }

  const seen = new Set()
  const ranked = []

  for (const candidate of candidates) {
    const keyword = normalizeKeyword(candidate.keyword)
    if (!keyword) continue
    const key = keyword.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    ranked.push({
      keyword,
      score: scoreSuggestion(keyword, query, candidate.source, candidate.popularBoost),
    })
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.keyword.localeCompare(b.keyword)
  })

  return ranked.slice(0, limit).map((item) => item.keyword)
}

function parseIncludeOptions(includeParam) {
  if (!includeParam) return new Set()

  const values = String(includeParam)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  const parsed = new Set()
  for (const value of values) {
    if (INCLUDE_OPTIONS.has(value)) {
      parsed.add(value)
    }
  }
  return parsed
}

function resolveSort(sort) {
  const normalized = String(sort || 'relevance').trim().toLowerCase()
  return SORT_OPTIONS.has(normalized) ? normalized : 'relevance'
}

/**
 * Record search history and analytics without blocking the caller.
 */
function scheduleSearchSideEffects(payload) {
  setImmediate(async () => {
    try {
      await searchRepository.recordSearchActivity(payload)
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[search] Failed to record search activity:', err.message)
      }
    }
  })
}

// Backward-compatible alias
function scheduleSearchHistorySave(payload) {
  scheduleSearchSideEffects(payload)
}

function buildHistoryPayload(req, keyword) {
  const userId = req.user?._id || null
  return {
    keyword,
    deviceId: req.deviceId,
    userId,
    platform: resolvePlatform(req),
    isLoggedIn: Boolean(userId),
  }
}

async function buildOptionalSearchExtras(keyword, req, query = {}) {
  const include = parseIncludeOptions(query.include)
  if (!include.size) return {}

  const extras = {}
  const suggestionLimit = Math.min(
    20,
    Math.max(1, parseInt(query.suggestionLimit, 10) || DEFAULT_SUGGESTION_LIMIT),
  )
  const popularLimit = Math.min(
    50,
    Math.max(1, parseInt(query.popularLimit, 10) || DEFAULT_POPULAR_LIMIT),
  )

  const tasks = []

  if (include.has('recent')) {
    tasks.push(
      getRecentSearches(req).then((data) => {
        extras.recentSearches = data
      }),
    )
  }

  if (include.has('popular')) {
    tasks.push(
      getPopularSearches({ limit: popularLimit }).then((data) => {
        extras.popularSearches = data
      }),
    )
  }

  if (include.has('suggestions')) {
    tasks.push(
      getSearchSuggestions(keyword, req, { limit: suggestionLimit }).then((data) => {
        extras.suggestions = data
      }),
    )
  }

  await Promise.all(tasks)
  return extras
}

/**
 * Global search across products, properties, categories, agents, and agencies.
 */
async function globalSearch(keyword, query = {}, req = {}) {
  const normalized = assertKeyword(keyword)
  const type = SEARCH_TYPES.has(query.type) ? query.type : 'all'
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20))
  const perCategoryLimit = Math.min(20, Math.max(1, parseInt(query.perCategoryLimit, 10) || 5))
  const sort = resolveSort(query.sort)

  scheduleSearchSideEffects(buildHistoryPayload(req, normalized))

  let searchResult

  if (type === 'products') {
    const result = await searchRepository.searchProducts(normalized, { page, limit, sort })
    searchResult = {
      results: { products: result.items },
      meta: buildMeta(page, limit, result.total),
    }
  } else if (type === 'properties') {
    const result = await searchRepository.searchProducts(normalized, {
      page,
      limit,
      propertyOnly: true,
      sort,
    })
    searchResult = {
      results: { properties: result.items },
      meta: buildMeta(page, limit, result.total),
    }
  } else if (type === 'categories') {
    const result = await searchRepository.searchCategories(normalized, { page, limit, sort })
    searchResult = {
      results: { categories: result.items },
      meta: buildMeta(page, limit, result.total),
    }
  } else if (type === 'agents') {
    const result = await searchRepository.searchAgents(normalized, { page, limit, sort })
    searchResult = {
      results: { agents: result.items },
      meta: buildMeta(page, limit, result.total),
    }
  } else if (type === 'agencies') {
    const result = await searchRepository.searchAgencies(normalized, { page, limit, sort })
    searchResult = {
      results: { agencies: result.items },
      meta: buildMeta(page, limit, result.total),
    }
  } else {
    const [products, properties, categories, agents, agencies] = await Promise.all([
      searchRepository.searchProducts(normalized, { page: 1, limit: perCategoryLimit, sort }),
      searchRepository.searchProducts(normalized, {
        page: 1,
        limit: perCategoryLimit,
        propertyOnly: true,
        sort,
      }),
      searchRepository.searchCategories(normalized, { page: 1, limit: perCategoryLimit, sort }),
      searchRepository.searchAgents(normalized, { page: 1, limit: perCategoryLimit, sort }),
      searchRepository.searchAgencies(normalized, { page: 1, limit: perCategoryLimit, sort }),
    ])

    const total =
      products.total + properties.total + categories.total + agents.total + agencies.total

    searchResult = {
      results: {
        products: products.items,
        properties: properties.items,
        categories: categories.items,
        agents: agents.items,
        agencies: agencies.items,
        projects: [],
        blogs: [],
      },
      meta: {
        page: 1,
        limit: perCategoryLimit,
        total,
        totalPages: 1,
        hasMore: total > perCategoryLimit,
        perCategoryLimit,
      },
    }
  }

  const extras = await buildOptionalSearchExtras(normalized, req, query)
  if (Object.keys(extras).length) {
    searchResult.extras = extras
  }

  return searchResult
}

async function getRecentSearches(req) {
  const userId = req.user?._id || null
  const deviceId = req.deviceId

  if (!userId && !deviceId) {
    throw new AppError('device-id header is required', 400, 'DEVICE_ID_REQUIRED')
  }

  const rows = await searchRepository.findRecentSearchKeywords({
    userId,
    deviceId,
    limit: searchRepository.RECENT_SEARCH_LIMIT,
  })

  const keywords = dedupeKeywords(rows, searchRepository.RECENT_SEARCH_LIMIT)
  const items = []

  for (const keyword of keywords) {
    const row = rows.find(
      (entry) => normalizeKeyword(entry.keyword).toLowerCase() === keyword.toLowerCase(),
    )
    items.push({
      keyword,
      searchedAt: row?.createdAt || null,
    })
  }

  return {
    keywords,
    items,
    total: keywords.length,
  }
}

async function clearRecentSearches(req) {
  const userId = req.user?._id || null
  const deviceId = req.deviceId

  if (!userId && !deviceId) {
    throw new AppError('device-id header is required', 400, 'DEVICE_ID_REQUIRED')
  }

  const result = await searchRepository.clearRecentSearchHistory({ userId, deviceId })
  return {
    cleared: true,
    deletedCount: result.deletedCount,
  }
}

async function getPopularSearches(query = {}) {
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || DEFAULT_POPULAR_LIMIT))

  const rows = await searchRepository.findPopularSearchKeywords({ limit })

  return {
    keywords: rows.map((row) => row.keyword),
    items: rows.map((row) => ({
      keyword: row.keyword,
      searchCount: row.searchCount,
      lastSearchedAt: row.lastSearchedAt,
    })),
    total: rows.length,
  }
}

async function getSearchSuggestions(keyword, req, query = {}) {
  const normalized = normalizeKeyword(keyword)
  if (!normalized) {
    throw new AppError('keyword is required', 400, 'KEYWORD_REQUIRED')
  }

  if (normalized.length < SUGGESTION_MIN_LENGTH) {
    throw new AppError(
      `keyword must be at least ${SUGGESTION_MIN_LENGTH} characters`,
      400,
      'KEYWORD_TOO_SHORT',
    )
  }

  const limit = Math.min(
    20,
    Math.max(1, parseInt(query.limit, 10) || DEFAULT_SUGGESTION_LIMIT),
  )
  const userId = req.user?._id || null
  const deviceId = req.deviceId

  if (!userId && !deviceId) {
    throw new AppError('device-id header is required', 400, 'DEVICE_ID_REQUIRED')
  }

  const raw = await searchRepository.findSuggestionKeywords(normalized, {
    userId,
    deviceId,
    limit,
  })

  return {
    suggestions: mergeSuggestions(raw, normalized, limit),
  }
}

module.exports = {
  SEARCH_TYPES,
  SORT_OPTIONS,
  INCLUDE_OPTIONS,
  SUGGESTION_MIN_LENGTH,
  DEFAULT_SUGGESTION_LIMIT,
  DEFAULT_POPULAR_LIMIT,
  normalizeKeyword,
  assertKeyword,
  dedupeKeywords,
  mergeSuggestions,
  scoreSuggestion,
  globalSearch,
  getRecentSearches,
  clearRecentSearches,
  getPopularSearches,
  getSearchSuggestions,
  scheduleSearchHistorySave,
  scheduleSearchSideEffects,
  buildHistoryPayload,
}
