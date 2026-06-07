import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { feedService } from '../../services/api'

const defaultReelsMeta = { nextCursor: null, hasMore: false, limit: 10, feedType: 'trending' }

const initialState = {
  reels: [],
  reelsMeta: defaultReelsMeta,

  // Derived from reels batch (and/or server computation).
  liked: [],
  saved: [],
  counts: { likes: 0, views: 0 },
  // Per-reel comment count is embedded into each `reels[]` item.

  // “Shell” data used by nav/chat UI.
  chats: [],
  unreadCount: 0,
  priceRange: { minPrice: 0, maxPrice: 100000 },
  priceRangeLoaded: false,
  shellLoaded: false,

  loading: false,
  error: null,
  currentFeedType: 'trending',
}

export const fetchFeedShell = createAsyncThunk('feed/fetchFeedShell', async (args, { rejectWithValue }) => {
  try {
    const {
      categoryId,
      includeChats = true,
      includePriceRange = true,
    } = args || {}

    const params = {
      includeReels: 0,
      includeChats: includeChats ? 1 : 0,
      includePriceRange: includePriceRange ? 1 : 0,
      includeCounts: 0,
    }

    if (categoryId) params.categoryId = categoryId

    const response = await feedService.getFeedData(params)
    return response.data
  } catch (error) {
    return rejectWithValue(error.response?.data?.error || error.response?.data?.message || 'Failed to fetch feed shell')
  }
})

export const fetchFeedPage = createAsyncThunk('feed/fetchFeedPage', async (args, { rejectWithValue, signal }) => {
  try {
    const {
      feedType = 'trending',
      limit = 10,
      cursor,
      categoryId,
      subcategoryId,
      location,
      search,
      minPrice,
      maxPrice,
      sortBy,
      refresh = false,
    } = args || {}

    const params = { limit }
    if (cursor) params.cursor = cursor
    if (categoryId) params.categoryId = categoryId
    if (subcategoryId) params.subcategoryId = subcategoryId
    if (location) params.location = location
    if (search) params.search = search
    if (minPrice !== undefined && minPrice !== null && minPrice !== '') params.minPrice = minPrice
    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') params.maxPrice = maxPrice
    if (sortBy) params.sortBy = sortBy

    const requestConfig = { signal }
    const response = feedType === 'following'
      ? await feedService.getFollowingFeed(params, requestConfig)
      : await feedService.getTrendingFeed(params, requestConfig)

    return {
      feedType,
      refresh,
      payload: response.data,
    }
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch feed')
  }
})

const feedSlice = createSlice({
  name: 'feed',
  initialState,
  reducers: {
    clearReels: (state) => {
      state.reels = []
      state.reelsMeta = defaultReelsMeta
      state.loading = false
      state.error = null
      state.liked = []
      state.saved = []
      state.counts = { likes: 0, views: 0 }
    },
    clearAll: (state) => {
      state.reels = []
      state.reelsMeta = defaultReelsMeta
      state.liked = []
      state.saved = []
      state.counts = { likes: 0, views: 0 }
      state.chats = []
      state.unreadCount = 0
      state.priceRange = { minPrice: 0, maxPrice: 100000 }
      state.priceRangeLoaded = false
      state.shellLoaded = false
      state.loading = false
      state.error = null
      state.currentFeedType = 'trending'
    },
    setCurrentFeedType: (state, action) => {
      state.currentFeedType = action.payload || 'trending'
    },
    pinReelAtTop: (state, action) => {
      const product = action.payload
      const id = String(product?._id || '')
      if (!id) return
      state.reels = [product, ...state.reels.filter((p) => String(p?._id) !== id)]
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFeedShell.pending, (state) => {
        state.error = null
      })
      .addCase(fetchFeedShell.fulfilled, (state, action) => {
        const data = action.payload || {}
        if (action.meta.arg?.includeChats) {
          state.chats = Array.isArray(data.chats) ? data.chats : []
          state.unreadCount = typeof data.unreadCount === 'number' ? data.unreadCount : 0
          state.shellLoaded = true
        }

        if (action.meta.arg?.includePriceRange) {
          const pr = data.priceRange || {}
          if (typeof pr.minPrice === 'number' && typeof pr.maxPrice === 'number') {
            state.priceRange = pr
            state.priceRangeLoaded = true
          }
        }
      })
      .addCase(fetchFeedShell.rejected, (state, action) => {
        state.error = action.payload || action.error?.message || 'Failed to fetch feed shell'
      })
      .addCase(fetchFeedPage.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchFeedPage.fulfilled, (state, action) => {
        state.loading = false
        state.error = null
        const data = action.payload?.payload || {}
        const incomingPosts = Array.isArray(data.posts) ? data.posts : []
        const isRefresh = Boolean(action.payload?.refresh)
        const feedType = action.payload?.feedType || 'trending'

        const deduped = []
        const seenIds = new Set()
        const source = isRefresh ? incomingPosts : [...state.reels, ...incomingPosts]

        for (const post of source) {
          const id = String(post?._id || '')
          if (!id || seenIds.has(id)) continue
          seenIds.add(id)
          deduped.push(post)
        }

        state.reels = deduped
        state.currentFeedType = feedType
        state.reelsMeta = {
          nextCursor: data.pageInfo?.nextCursor ?? null,
          hasMore: Boolean(data.pageInfo?.hasMore),
          limit: action.meta.arg?.limit ?? state.reelsMeta.limit,
          feedType,
        }
        state.liked = deduped.filter((post) => post?.liked).map((post) => post._id)
        state.saved = deduped.filter((post) => post?.saved).map((post) => post._id)
        state.counts = {
          likes: deduped.reduce((sum, post) => sum + (post?.likesCount || 0), 0),
          views: deduped.reduce((sum, post) => sum + (post?.views || 0), 0),
        }
      })
      .addCase(fetchFeedPage.rejected, (state, action) => {
        if (action.meta.aborted) {
          state.loading = false
          return
        }
        state.loading = false
        state.error = action.payload || action.error?.message || 'Failed to fetch feed'
      })
  },
})

export const { clearReels, clearAll, setCurrentFeedType, pinReelAtTop } = feedSlice.actions
export default feedSlice.reducer

