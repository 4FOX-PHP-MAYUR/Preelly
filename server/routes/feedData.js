const express = require('express')
const mongoose = require('mongoose')
const Redis = require('ioredis')

const Product = require('../models/Product')
const Category = require('../models/Category')
const User = require('../models/User')
const Chat = require('../models/Chat')
const Comment = require('../models/Comment')
const authMiddleware = require('../middleware/auth')
const { getUserIdFromRequest } = require('../utils/authToken')

const router = express.Router()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const FEED_CACHE_TTL_SECONDS = Number(process.env.FEED_CACHE_TTL_SECONDS || 60)
const TRENDING_CANDIDATE_MULTIPLIER = Math.max(3, Number(process.env.TRENDING_CANDIDATE_MULTIPLIER || 5))
const TRENDING_MAX_CACHED_ITEMS = Math.max(50, Number(process.env.TRENDING_MAX_CACHED_ITEMS || 300))
const inMemoryCache = new Map()

let redisClient = null
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  })

  redisClient.on('error', (error) => {
    console.error('Redis feed cache error:', error.message)
  })

  redisClient.connect().catch((error) => {
    console.error('Redis feed cache connect failed:', error.message)
  })
}

async function getCached (key) {
  if (redisClient?.status === 'ready') {
    const raw = await redisClient.get(key)
    return raw ? JSON.parse(raw) : null
  }

  const entry = inMemoryCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    inMemoryCache.delete(key)
    return null
  }
  return entry.value
}

async function setCached (key, value, ttlSeconds = FEED_CACHE_TTL_SECONDS) {
  if (redisClient?.status === 'ready') {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    return
  }

  inMemoryCache.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000),
  })
}

function parseBooleanFlag (val, defaultValue = true) {
  if (val === undefined) return defaultValue
  if (val === null) return defaultValue
  if (typeof val === 'boolean') return val
  const s = String(val).toLowerCase().trim()
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false
  return defaultValue
}

function getUserIdFromOptionalToken(req) {
  return getUserIdFromRequest(req, JWT_SECRET)
}

function toCanonicalId (id) {
  if (id == null || id === '') return ''
  return String(id).trim()
}

function encodeCursor (payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeCursor (value) {
  if (!value || typeof value !== 'string') return null
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

// Cached admin user IDs: reels-feed checks whether “admin” sellers should be visible even if status != active.
let adminUserIdsCache = { value: null, expiresAt: 0 }
async function getAdminUserIds () {
  const now = Date.now()
  if (adminUserIdsCache.value && now < adminUserIdsCache.expiresAt) return adminUserIdsCache.value
  const ids = await User.find({ role: 'admin' }).select('_id').lean()
  const result = ids.map((a) => a._id)
  adminUserIdsCache = { value: result, expiresAt: now + 60 * 60 * 1000 } // 1h TTL
  return result
}

async function readSavedProductIdsForUser (userId) {
  // Used only to derive per-reel “saved” booleans without doing N queries.
  if (!userId) return new Set()
  const user = await User.findById(userId).select('savedProducts').lean()
  if (!user || !Array.isArray(user.savedProducts)) return new Set()
  const ids = user.savedProducts.map((id) => toCanonicalId(id)).filter(Boolean)
  return new Set(ids)
}

function parseFeedParams (rawQuery) {
  const limit = Math.min(20, Math.max(1, Math.floor(Number(rawQuery.limit)) || 10))
  const categoryId =
    (typeof rawQuery.categoryId === 'string' && rawQuery.categoryId.trim())
      ? rawQuery.categoryId.trim()
      : (typeof rawQuery.category === 'string' && rawQuery.category.trim())
          ? rawQuery.category.trim()
          : null
  const subcategoryId = typeof rawQuery.subcategoryId === 'string' ? rawQuery.subcategoryId.trim() : null
  const location = typeof rawQuery.location === 'string' ? rawQuery.location.trim().slice(0, 200) : ''
  const search = typeof rawQuery.search === 'string' ? rawQuery.search.trim().slice(0, 300) : ''
  const minPrice = rawQuery.minPrice != null && rawQuery.minPrice !== '' ? Number(rawQuery.minPrice) : null
  const maxPrice = rawQuery.maxPrice != null && rawQuery.maxPrice !== '' ? Number(rawQuery.maxPrice) : null
  const sortBy = typeof rawQuery.sortBy === 'string' ? rawQuery.sortBy.trim() : 'latest'
  const cursor = typeof rawQuery.cursor === 'string' ? rawQuery.cursor.trim() : ''
  const validMinPrice = typeof minPrice === 'number' && Number.isFinite(minPrice) ? minPrice : null
  const validMaxPrice = typeof maxPrice === 'number' && Number.isFinite(maxPrice) ? maxPrice : null

  return {
    limit,
    categoryId,
    subcategoryId,
    location,
    search,
    validMinPrice,
    validMaxPrice,
    sortBy,
    cursor,
  }
}

async function resolveCategoryIds (categoryId) {
  if (!categoryId) return null
  if (!mongoose.Types.ObjectId.isValid(categoryId)) return [categoryId]

  const categoryObjectId = new mongoose.Types.ObjectId(categoryId)
  const descendants = await Category.find({
    $or: [{ _id: categoryObjectId }, { path: categoryObjectId }],
  })
    .select('_id')
    .lean()

  return descendants.length > 0 ? descendants.map((doc) => doc._id) : [categoryObjectId]
}

async function buildFeedMatch ({ params, sellerIds }) {
  const query = { status: 'active' }
  const { categoryId, subcategoryId, location, search, validMinPrice, validMaxPrice } = params

  if (sellerIds) {
    query.seller = { $in: sellerIds }
  }

  if (categoryId) {
    const categoryIds = await resolveCategoryIds(categoryId)
    if (categoryIds?.length) query.category = { $in: categoryIds }
  }

  if (subcategoryId) {
    query.subcategory = mongoose.Types.ObjectId.isValid(subcategoryId)
      ? new mongoose.Types.ObjectId(subcategoryId)
      : subcategoryId
  }

  if (location) {
    try {
      query.location = new RegExp(location, 'i')
    } catch {}
  }

  if (validMinPrice != null || validMaxPrice != null) {
    query.price = {}
    if (validMinPrice != null) query.price.$gte = validMinPrice
    if (validMaxPrice != null) query.price.$lte = validMaxPrice
  }

  if (search) {
    query.$text = { $search: search }
  }

  return query
}

function buildPostProjection ({ userObjectId }) {
  return {
    title: 1,
    description: 1,
    caption: { $ifNull: ['$description', ''] },
    price: 1,
    currency: 1,
    location: 1,
    condition: 1,
    images: 1,
    video: 1,
    videoStream: 1,
    views: 1,
    createdAt: 1,
    likesCount: { $size: { $ifNull: ['$likes', []] } },
    liked: userObjectId ? { $in: [userObjectId, { $ifNull: ['$likes', []] }] } : { $literal: false },
    seller: {
      _id: '$_seller._id',
      name: '$_seller.name',
      username: '$_seller.username',
      avatar: '$_seller.avatar',
      isVerified: '$_seller.isVerified',
    },
    commentCount: { $ifNull: [{ $first: '$commentStats.count' }, 0] },
  }
}

async function fetchFeedPostsByIds ({ ids, userObjectId, savedProductIdsSet, scoreById = new Map() }) {
  if (!ids.length) return []

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id))
  const docs = await Product.aggregate([
    { $match: { _id: { $in: objectIds }, status: 'active' } },
    {
      $lookup: {
        from: 'users',
        localField: 'seller',
        foreignField: '_id',
        as: '_seller',
      },
    },
    { $unwind: { path: '$_seller', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'comments',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$product', '$$productId'] },
              status: 'approved',
            },
          },
          { $count: 'count' },
        ],
        as: 'commentStats',
      },
    },
    {
      $project: {
        ...buildPostProjection({ userObjectId }),
      },
    },
  ])

  const byId = new Map(
    docs.map((doc) => {
      const id = String(doc._id)
      return [id, {
        ...doc,
        saved: savedProductIdsSet.has(id),
        trendingScore: scoreById.get(id) || 0,
      }]
    })
  )

  return ids.map((id) => byId.get(String(id))).filter(Boolean)
}

function diversifyTrendingRows (rows, minGap = 2) {
  const selected = []
  const deferred = []

  for (const row of rows) {
    const recentSellerIds = selected.slice(-minGap).map((entry) => entry.sellerId)
    if (!recentSellerIds.includes(row.sellerId)) {
      selected.push(row)
      continue
    }
    deferred.push(row)
  }

  for (const row of deferred) {
    const recentSellerIds = selected.slice(-minGap).map((entry) => entry.sellerId)
    if (!recentSellerIds.includes(row.sellerId)) {
      selected.push(row)
    }
  }

  for (const row of deferred) {
    if (!selected.some((entry) => String(entry._id) === String(row._id))) {
      selected.push(row)
    }
  }

  return selected
}

function createFeedResponse ({ posts, nextCursor, hasMore, feedType }) {
  return {
    feedType,
    posts,
    pageInfo: {
      nextCursor,
      hasMore,
    },
  }
}

async function fetchFollowingFeed ({ userId, userObjectId, params }) {
  const currentUser = await User.findById(userId).select('following').lean()
  const followingIds = Array.isArray(currentUser?.following) ? currentUser.following : []

  if (!followingIds.length) {
    return createFeedResponse({
      feedType: 'following',
      posts: [],
      nextCursor: null,
      hasMore: false,
    })
  }

  const savedProductIdsSet = await readSavedProductIdsForUser(userId)
  const baseMatch = await buildFeedMatch({ params, sellerIds: followingIds })
  const decodedCursor = decodeCursor(params.cursor)
  const match = { ...baseMatch }

  if (decodedCursor?.createdAt && decodedCursor?.id && mongoose.Types.ObjectId.isValid(decodedCursor.id)) {
    match.$or = [
      { createdAt: { $lt: new Date(decodedCursor.createdAt) } },
      {
        createdAt: new Date(decodedCursor.createdAt),
        _id: { $lt: new mongoose.Types.ObjectId(decodedCursor.id) },
      },
    ]
  }

  const posts = await Product.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'seller',
        foreignField: '_id',
        as: '_seller',
      },
    },
    { $unwind: { path: '$_seller', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'comments',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$product', '$$productId'] },
              status: 'approved',
            },
          },
          { $count: 'count' },
        ],
        as: 'commentStats',
      },
    },
    {
      $addFields: {
        likesCount: { $size: { $ifNull: ['$likes', []] } },
        commentsCount: { $ifNull: [{ $first: '$commentStats.count' }, 0] },
      },
    },
    {
      $sort: {
        createdAt: -1,
        ...(params.sortBy === 'engagement' ? { likesCount: -1, commentsCount: -1 } : {}),
        _id: -1,
      },
    },
    { $limit: params.limit + 1 },
    {
      $project: {
        ...buildPostProjection({ userObjectId }),
      },
    },
  ])

  const hasMore = posts.length > params.limit
  const visiblePosts = posts.slice(0, params.limit).map((post) => ({
    ...post,
    saved: savedProductIdsSet.has(String(post._id)),
  }))
  const lastPost = visiblePosts[visiblePosts.length - 1]
  const nextCursor = hasMore && lastPost
    ? encodeCursor({ createdAt: lastPost.createdAt, id: lastPost._id })
    : null

  return createFeedResponse({
    feedType: 'following',
    posts: visiblePosts,
    nextCursor,
    hasMore,
  })
}

async function buildTrendingRanking ({ params }) {
  const cacheKey = `feed:trending:ranking:${JSON.stringify({
    categoryId: params.categoryId || '',
    subcategoryId: params.subcategoryId || '',
    location: params.location || '',
    search: params.search || '',
    minPrice: params.validMinPrice ?? '',
    maxPrice: params.validMaxPrice ?? '',
  })}`

  const cached = await getCached(cacheKey)
  if (cached) return cached

  const match = await buildFeedMatch({ params })
  const ranked = await Product.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'comments',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$product', '$$productId'] },
              status: 'approved',
            },
          },
          { $count: 'count' },
        ],
        as: 'commentStats',
      },
    },
    {
      $project: {
        seller: 1,
        createdAt: 1,
        likesCount: { $size: { $ifNull: ['$likes', []] } },
        commentsCount: { $ifNull: [{ $first: '$commentStats.count' }, 0] },
      },
    },
    {
      $addFields: {
        ageHours: {
          $max: [
            1,
            {
              $divide: [
                { $subtract: [new Date(), '$createdAt'] },
                1000 * 60 * 60,
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        timeDecay: {
          $add: [1, { $pow: ['$ageHours', 0.75] }],
        },
      },
    },
    {
      $addFields: {
        trendingScore: {
          $divide: [
            {
              $add: [
                { $multiply: ['$likesCount', 0.6] },
                { $multiply: ['$commentsCount', 0.4] },
              ],
            },
            '$timeDecay',
          ],
        },
      },
    },
    {
      $sort: {
        trendingScore: -1,
        createdAt: -1,
        _id: -1,
      },
    },
    { $limit: Math.min(TRENDING_MAX_CACHED_ITEMS, params.limit * TRENDING_CANDIDATE_MULTIPLIER * 10) },
    {
      $project: {
        _id: 1,
        sellerId: '$seller',
        createdAt: 1,
        trendingScore: 1,
      },
    },
  ])

  const diversified = diversifyTrendingRows(
    ranked.map((row) => ({
      _id: String(row._id),
      sellerId: String(row.sellerId || ''),
      createdAt: row.createdAt,
      trendingScore: Number(row.trendingScore || 0),
    }))
  )

  await setCached(cacheKey, diversified)
  return diversified
}

async function fetchTrendingFeed ({ userId, userObjectId, params }) {
  const savedProductIdsSet = await readSavedProductIdsForUser(userId)
  const rankedRows = await buildTrendingRanking({ params })
  const decodedCursor = decodeCursor(params.cursor)
  const offset = Math.max(0, Number(decodedCursor?.offset) || 0)
  const slice = rankedRows.slice(offset, offset + params.limit)
  const ids = slice.map((row) => row._id)
  const scoreById = new Map(slice.map((row) => [String(row._id), Number(row.trendingScore || 0)]))
  const posts = await fetchFeedPostsByIds({ ids, userObjectId, savedProductIdsSet, scoreById })
  const hasMore = offset + slice.length < rankedRows.length
  const nextCursor = hasMore ? encodeCursor({ offset: offset + slice.length }) : null

  return createFeedResponse({
    feedType: 'trending',
    posts,
    nextCursor,
    hasMore,
  })
}

function parseReelsFeedParams (rawQuery) {
  const page = Math.max(1, Math.floor(Number(rawQuery.page)) || 1)
  const limit = Math.min(50, Math.max(1, Math.floor(Number(rawQuery.limit)) || 10))

  // Accept either categoryId or category query param
  const categoryId =
    (typeof rawQuery.categoryId === 'string' && rawQuery.categoryId.trim())
      ? rawQuery.categoryId.trim()
      : (typeof rawQuery.category === 'string' && rawQuery.category.trim())
        ? rawQuery.category.trim()
        : null
  const subcategoryId = typeof rawQuery.subcategoryId === 'string' ? rawQuery.subcategoryId.trim() : null
  const location = typeof rawQuery.location === 'string' ? rawQuery.location.trim().slice(0, 200) : ''
  const search = typeof rawQuery.search === 'string' ? rawQuery.search.trim().slice(0, 300) : ''
  const excludeUserId = typeof rawQuery.excludeUserId === 'string' ? rawQuery.excludeUserId.trim() : ''
  const excludeIdsRaw = typeof rawQuery.excludeIds === 'string' ? rawQuery.excludeIds : ''

  const minPrice = rawQuery.minPrice != null && rawQuery.minPrice !== '' ? Number(rawQuery.minPrice) : null
  const maxPrice = rawQuery.maxPrice != null && rawQuery.maxPrice !== '' ? Number(rawQuery.maxPrice) : null
  const validMinPrice = typeof minPrice === 'number' && Number.isFinite(minPrice) ? minPrice : null
  const validMaxPrice = typeof maxPrice === 'number' && Number.isFinite(maxPrice) ? maxPrice : null

  return {
    page,
    limit,
    categoryId,
    subcategoryId,
    location,
    search,
    excludeUserId,
    excludeIdsRaw,
    validMinPrice,
    validMaxPrice,
  }
}

async function fetchPriceRange ({ categoryId }) {
  const matchStage = { status: 'active' }
  if (categoryId) matchStage.category = categoryId

  const priceStats = await Product.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
  ])

  if (!priceStats.length || !priceStats[0].minPrice) {
    return { minPrice: 0, maxPrice: 100000 }
  }

  return {
    minPrice: Math.floor(priceStats[0].minPrice),
    maxPrice: Math.ceil(priceStats[0].maxPrice),
  }
}

async function fetchChatsForUser ({ userId }) {
  if (!userId) {
    return { chats: [], unreadCount: 0 }
  }

  const productChats = await Chat.find({
    type: { $ne: 'support' },
    $or: [{ buyer: userId }, { seller: userId }],
  })
    .select('type product buyer seller user lastMessage lastMessageAt unreadForBuyer unreadForSeller unreadForUser unreadForAdmin updatedAt')
    .populate('product', 'title images video')
    .populate('buyer', 'name username avatar isVerified')
    .populate('seller', 'name username avatar isVerified identityVerificationStatus')
    .lean()

  const supportChat = await Chat.findOne({ type: 'support', user: userId })
    .select('type product buyer seller user lastMessage lastMessageAt unreadForBuyer unreadForSeller unreadForUser unreadForAdmin updatedAt')
    .populate('user', 'name username avatar isVerified')
    .lean()

  const chats = [...productChats]
  if (supportChat) chats.push(supportChat)
  chats.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))

  let unreadCount = 0
  for (const chat of chats) {
    if (chat.type === 'support') {
      unreadCount += chat.unreadForUser || 0
      continue
    }

    if (!chat.buyer || !chat.seller) continue
    const isBuyer = chat.buyer.toString() === userId.toString()
    unreadCount += isBuyer ? (chat.unreadForBuyer || 0) : (chat.unreadForSeller || 0)
  }

  return { chats, unreadCount }
}

async function fetchReelsForUser ({ userId, userObjectId, savedProductIdsSet, params }) {
  const { page, limit, categoryId, subcategoryId, location, search, excludeUserId, excludeIdsRaw, validMinPrice, validMaxPrice } = params
  const excludeIdStrings = excludeIdsRaw
    ? excludeIdsRaw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 1000)
    : []
  const excludeObjectIds = excludeIdStrings
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id))

  const query = {}

  // Filters: category = selected category OR any descendant (products in child categories included)
  if (categoryId) {
    if (mongoose.Types.ObjectId.isValid(categoryId)) {
      const catObjId = new mongoose.Types.ObjectId(categoryId)
      const descendantDocs = await Category.find({
        $or: [{ _id: catObjId }, { path: catObjId }],
      })
        .select('_id')
        .lean()
      const categoryIds = (descendantDocs || []).map((d) => d._id)
      if (categoryIds.length > 0) query.category = { $in: categoryIds }
      else query.category = catObjId
    } else {
      query.category = categoryId
    }
  }

  if (subcategoryId) {
    if (mongoose.Types.ObjectId.isValid(subcategoryId)) query.subcategory = new mongoose.Types.ObjectId(subcategoryId)
    else query.subcategory = subcategoryId
  }

  if (location) {
    try {
      query.location = new RegExp(location, 'i')
    } catch {}
  }

  if (validMinPrice != null || validMaxPrice != null) {
    query.price = {}
    if (validMinPrice != null) query.price.$gte = validMinPrice
    if (validMaxPrice != null) query.price.$lte = validMaxPrice
  }

  if (search) query.$text = { $search: search }

  delete query.seller
  if (excludeUserId) {
    query.seller = { $ne: excludeUserId }
  }

  // Status filter: public feed shows active products, but include “admin sellers” as well.
  const adminUserIds = await getAdminUserIds()
  if (adminUserIds.length > 0) {
    query.$or = [{ status: 'active' }, { seller: { $in: adminUserIds } }]
  } else {
    query.status = 'active'
  }

  // Total count for hasMore
  let total = 0
  try {
    total = await Product.countDocuments(query)
  } catch {
    total = 0
  }

  if (excludeObjectIds.length > 0) {
    query._id = { $nin: excludeObjectIds }
  }

  const likedExpression = userObjectId
    ? { $in: [userObjectId, { $ifNull: ['$likes', []] }] }
    : false
  const likesCountExpression = { $size: { $ifNull: ['$likes', []] } }

  let products = []
  try {
    const pipeline = [
      { $match: query },
      { $sample: { size: limit } },
      {
        $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: '_categoryDoc' },
      },
      { $unwind: { path: '$_categoryDoc', preserveNullAndEmptyArrays: true } },
      {
        $lookup: { from: 'users', localField: 'seller', foreignField: '_id', as: '_sellerDoc' },
      },
      { $unwind: { path: '$_sellerDoc', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          category: {
            name: '$_categoryDoc.name',
            icon: '$_categoryDoc.icon',
            emoji: '$_categoryDoc.emoji',
          },
          seller: {
            _id: '$_sellerDoc._id',
            name: '$_sellerDoc.name',
            avatar: '$_sellerDoc.avatar',
            rating: '$_sellerDoc.rating',
            memberSince: '$_sellerDoc.memberSince',
            isVerified: '$_sellerDoc.isVerified',
            identityVerificationStatus: '$_sellerDoc.identityVerificationStatus',
          },
          likesCount: likesCountExpression,
          liked: likedExpression,
        },
      },
      {
        $project: {
          _categoryDoc: 0,
          _sellerDoc: 0,
          // Only the fields needed by the reels UI.
          title: 1,
          price: 1,
          currency: 1,
          location: 1,
          condition: 1,
          video: 1,
          videoStream: 1,
          images: 1,
          createdAt: 1,
          views: 1,
          seller: 1,
          category: 1,
          liked: 1,
          likesCount: 1,
          // `saved` + `commentCount` are attached after the query.
        },
      },
    ]

    products = await Product.aggregate(pipeline)
  } catch (aggErr) {
    // Fallback: avoid `$rand` (newer Mongo/Mongoose versions can reject it as a field path).
    // Still compute liked + likesCount in JS so the response stays consistent.
    const findQuery = query
    products = await Product.find(findQuery)
      .populate('category', 'name icon emoji')
      .populate('seller', 'name avatar rating memberSince isVerified identityVerificationStatus')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    products = products.map((p) => {
      const likesArr = Array.isArray(p.likes) ? p.likes : []
      const likesCount = likesArr.length
      const liked = userObjectId ? likesArr.some((id) => id.toString() === userId.toString()) : false
      return { ...p, likesCount, liked, likes: undefined }
    })
  }

  const alreadySeen = excludeObjectIds.length
  const hasMore = total > alreadySeen + products.length

  // Add saved + comment counts in batch (no N queries).
  const productsWithSaved = (Array.isArray(products) ? products : []).map((p) => {
    const saved = savedProductIdsSet.has(toCanonicalId(p._id))
    return { ...p, saved }
  })

  const productIds = productsWithSaved
    .map((p) => p._id)
    .filter(Boolean)
    // Avoid re-wrapping ObjectId objects (can throw with newer drivers).
    .map((id) => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id))

  let commentCountByProductId = new Map()
  if (productIds.length > 0) {
    const rows = await Comment.aggregate([
      {
        $match: {
          product: { $in: productIds },
          status: 'approved',
        },
      },
      { $group: { _id: '$product', count: { $sum: 1 } } },
    ])

    commentCountByProductId = new Map(rows.map((r) => [String(r._id), r.count]))
  }

  const reels = productsWithSaved.map((p) => ({
    ...p,
    commentCount: commentCountByProductId.get(String(p._id)) || 0,
  }))

  const liked = reels.filter((r) => r.liked).map((r) => r._id)
  const saved = reels.filter((r) => r.saved).map((r) => r._id)
  const counts = {
    likes: reels.reduce((sum, r) => sum + (r.likesCount || 0), 0),
    views: reels.reduce((sum, r) => sum + (r.views || 0), 0),
  }

  return {
    reels,
    reelsMeta: { page, limit, total, hasMore },
    liked,
    saved,
    counts,
  }
}

router.get('/feed/trending', async (req, res) => {
  try {
    const userId = getUserIdFromOptionalToken(req)
    const userObjectId = userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
    const params = parseFeedParams(req.query || {})
    const payload = await fetchTrendingFeed({ userId, userObjectId, params })
    return res.json(payload)
  } catch (error) {
    console.error('Error in GET /api/feed/trending:', error)
    return res.status(500).json({ message: 'Failed to fetch trending feed' })
  }
})

router.get('/feed/following', authMiddleware, async (req, res) => {
  try {
    const userId = String(req.user._id)
    const userObjectId = new mongoose.Types.ObjectId(userId)
    const params = parseFeedParams(req.query || {})
    const payload = await fetchFollowingFeed({ userId, userObjectId, params })
    return res.json(payload)
  } catch (error) {
    console.error('Error in GET /api/feed/following:', error)
    return res.status(500).json({ message: 'Failed to fetch following feed' })
  }
})

router.get('/feed-data', async (req, res) => {
  try {
    const raw = req.query || {}
    const includeReels = parseBooleanFlag(raw.includeReels, true)
    const includeChats = parseBooleanFlag(raw.includeChats, true)
    const includePriceRange = parseBooleanFlag(raw.includePriceRange, true)
    const includeCounts = parseBooleanFlag(raw.includeCounts, true)

    const pageLimitParams = parseReelsFeedParams(raw)

    const userId = getUserIdFromOptionalToken(req)
    const userObjectId = userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null

    const cacheKey = JSON.stringify({
      includeReels,
      includeChats,
      includePriceRange,
      includeCounts,
      userId: userId ? String(userId) : 'anon',
      reels: { ...pageLimitParams },
    })

    const cached = await getCached(cacheKey)
    if (cached) return res.json(cached)

    const defaults = {
      reels: [],
      reelsMeta: { page: 1, limit: 10, total: 0, hasMore: false },
      liked: [],
      saved: [],
      counts: { likes: 0, views: 0 },
      unreadCount: 0,
      chats: [],
      priceRange: { minPrice: 0, maxPrice: 100000 },
      debugVersion: 'feed-data-v1',
    }

    const savedProductIdsPromise = includeReels ? readSavedProductIdsForUser(userId) : Promise.resolve(new Set())

    const reelsPromise = includeReels
      ? (async () => {
        const params = pageLimitParams
        const savedProductIdsSet = await savedProductIdsPromise
        return fetchReelsForUser({
          userId,
          userObjectId,
          savedProductIdsSet,
          params,
        })
      })()
      : Promise.resolve(null)

    // Independent queries
    const priceRangePromise = includePriceRange
      ? fetchPriceRange({ categoryId: pageLimitParams.categoryId })
      : Promise.resolve(null)

    const chatsPromise = includeChats
      ? fetchChatsForUser({ userId })
      : Promise.resolve({ chats: [], unreadCount: 0 })

    const [reelsResult, priceRange, chatsResult] = await Promise.all([
      reelsPromise,
      priceRangePromise,
      chatsPromise,
    ])

    const responsePayload = {
      ...defaults,
      // The reels block
      ...(reelsResult
        ? {
            reels: reelsResult.reels,
            reelsMeta: reelsResult.reelsMeta,
            liked: reelsResult.liked,
            saved: reelsResult.saved,
            counts: includeCounts ? reelsResult.counts : defaults.counts,
          }
        : {}),
      // The chat/nav block
      ...(chatsResult
        ? {
            unreadCount: chatsResult.unreadCount || 0,
            chats: Array.isArray(chatsResult.chats) ? chatsResult.chats : [],
          }
        : {}),
      // Price range
      ...(priceRange
        ? {
            priceRange: priceRange,
          }
        : {}),
    }

    await setCached(cacheKey, responsePayload, Math.max(15, Math.floor(FEED_CACHE_TTL_SECONDS / 2)))
    return res.json(responsePayload)
  } catch (error) {
    console.error('Error in GET /api/feed-data:', error)
    // Always return the message to unblock debugging.
    // Only include the stack trace when not in production.
    const details = process.env.NODE_ENV !== 'production'
      ? { message: error?.message, stack: error?.stack }
      : { message: error?.message }
    return res.status(500).json({
      reels: [],
      liked: [],
      saved: [],
      counts: { likes: 0, views: 0 },
      unreadCount: 0,
      chats: [],
      priceRange: { minPrice: 0, maxPrice: 100000 },
      reelsMeta: { page: 1, limit: 10, total: 0, hasMore: false },
      error: 'Failed to fetch feed data',
      details,
      debugVersion: 'feed-data-vdebug',
    })
  }
})

module.exports = router

