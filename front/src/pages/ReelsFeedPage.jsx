import { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom'
import { selectUser, selectIsAuthenticated, selectIsAdmin } from '@shared/store/slices/authSlice'
import { productService, userService, globalSearchService } from '@shared/services/api'
import { clearReels, fetchFeedPage, fetchFeedShell, pinReelAtTop, setCurrentFeedType, REELS_PAGE_LIMIT } from '@shared/store/slices/feedSlice'
import { getReelsStorageKey, getLocalReelsIndex, getSavedReelIndex, saveReelIndex } from '@shared/utils/reelsProgress'
import { getMediaUrl, isValidObjectId } from '@shared/utils/helpers'
import { ADMIN_PANEL_URL } from '@shared/utils/constants'
import ReelsFeed from '@shared/components/Reels/ReelsFeed'
import ReelsSkeleton from '@shared/components/Reels/ReelsSkeleton'
import { Search, X, ArrowLeft, Filter, MapPin, DollarSign, Package, TrendingUp, Calendar, Home, Grid3x3, Bell, User, Plus, Shield, MessageCircle, Bookmark, ExternalLink, LogOut } from 'lucide-react'
import BrandLogo from '@shared/components/BrandLogo'
import { chatService } from '@shared/services/api'
import toast from 'react-hot-toast'
import React from 'react'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import { logout } from '@shared/store/slices/authSlice'

// Small link button used in right column
function LinkButton({ to = '#', label, Icon }) {
  return (
    <button
      onClick={() => {
        if (to && to !== '#') window.location.href = to
      }}
      className="flex items-center gap-2 px-3 py-2 bg-gray-800/40 text-white rounded-md hover:bg-gray-800/60 transition-colors"
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span className="text-sm">{label}</span>
    </button>
  )
}

function ReelsFeedPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { categoryId, subcategoryId } = useParams()
  
  // Check if this is a category/subcategory route (should hide header)
  const isCategoryRoute = !!categoryId
  const user = useSelector(selectUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const isAdmin = useSelector(selectIsAdmin)
  const { reels, loading, reelsMeta, priceRange: feedPriceRange, shellLoaded, priceRangeLoaded } = useSelector((state) => state.feed)
  const categoriesState = useSelector((state) => state.categories)
  const { rootCategories = [] } = categoriesState || {}
  const hasMore = Boolean(reelsMeta?.hasMore)
  const nextCursor = reelsMeta?.nextCursor || null
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false)
  const handleToggleCategories = () => {
    console.log('Toggling categories dropdown, current:', showCategoriesDropdown)
    setShowCategoriesDropdown((s) => !s)
  }
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearch, setActiveSearch] = useState('') // The actual search being applied to reels
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState({
    location: '',
    condition: '',
    sortBy: 'random',
    minPrice: '',
    maxPrice: '',
  })
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 })
  const [sliderValues, setSliderValues] = useState({ min: 0, max: 100000 })
  const searchTimeoutRef = useRef(null)
  const searchInputRef = useRef(null)
  const suggestionsRef = useRef(null)
  const advancedSearchRef = useRef(null)
  const hasReadSavedIndexRef = useRef(false)
  const prevFilteredLengthRef = useRef(0)
  const didInitPriceRangeRef = useRef(false)
  const didRequestShellRef = useRef(false)
  const lastReelsQueryKeyRef = useRef(null)
  const didRequestPriceRangeRef = useRef(false)
  const [savedReelIndex, setSavedReelIndex] = useState(null)
  const sharedReelFetchRef = useRef(null)

  const sharedReelId = (() => {
    const id = new URLSearchParams(location.search).get('reel')
    return id && isValidObjectId(id) ? String(id) : null
  })()

  // Feed key for last watched reel (localStorage + backend for logged-in users)
  const reelsStorageKey = getReelsStorageKey(categoryId, subcategoryId)

  // Fetch search suggestions as user types (doesn't affect reels feed)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.trim().length >= 2) {
      setIsSearching(true)
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await globalSearchService.getSuggestions({
            keyword: searchQuery.trim(),
            limit: 5,
          })
          setSearchSuggestions(response.data?.data?.suggestions || [])
          if (isSearchFocused) {
            setShowSuggestions(true)
          }
        } catch (error) {
          console.error('Error fetching suggestions:', error)
          setSearchSuggestions([])
        } finally {
          setIsSearching(false)
        }
      }, 300) // Debounce 300ms
    } else {
      setSearchSuggestions([])
      setShowSuggestions(false)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, isSearchFocused])

  // Initialize slider price range from feed-data (once).
  useEffect(() => {
    if (!priceRangeLoaded) return
    if (!feedPriceRange || typeof feedPriceRange.minPrice !== 'number' || typeof feedPriceRange.maxPrice !== 'number') return
    if (didInitPriceRangeRef.current) return

    didInitPriceRangeRef.current = true
    setPriceRange({ min: feedPriceRange.minPrice, max: feedPriceRange.maxPrice })
    setSliderValues({ min: feedPriceRange.minPrice, max: feedPriceRange.maxPrice })
  }, [priceRangeLoaded, feedPriceRange])

  // Update filters when slider changes
  useEffect(() => {
    setAdvancedFilters(prev => ({
      ...prev,
      minPrice: sliderValues.min.toString(),
      maxPrice: sliderValues.max.toString()
    }))
  }, [sliderValues])

  // Get unique locations from reels
  const uniqueLocations = [...new Set((Array.isArray(reels) ? reels : []).map(p => p && p.location).filter(Boolean))].sort()

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target) &&
        advancedSearchRef.current &&
        !advancedSearchRef.current.contains(event.target)
      ) {
        setShowSuggestions(false)
        setShowAdvancedSearch(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Local tab state for Reels (Trending / Following)
  const [reelsTab, setReelsTab] = useState('trending')

  // Fetch shell-only data once.
  useEffect(() => {
    const query = new URLSearchParams(location.search || '')
    const selectedCategoryFromQuery = query.get('category')
    const selectedCategoryId = selectedCategoryFromQuery || categoryId

    const includeChats = !shellLoaded && !didRequestShellRef.current
    const includePriceRange = !priceRangeLoaded && !didRequestPriceRangeRef.current
    if (!includeChats && !includePriceRange) return

    dispatch(fetchFeedShell({
      categoryId: selectedCategoryId,
      includeChats,
      includePriceRange,
    }))

    if (includeChats) didRequestShellRef.current = true
    if (includePriceRange) didRequestPriceRangeRef.current = true
  }, [dispatch, shellLoaded, priceRangeLoaded, categoryId, location.search])

  // Fetch feed when tab/search/filter changes.
  useEffect(() => {
    if (reelsTab === 'following' && !isAuthenticated) {
      dispatch(setCurrentFeedType(reelsTab))
      dispatch(clearReels())
      return
    }

    const params = { limit: REELS_PAGE_LIMIT, feedType: reelsTab, refresh: true, sortBy: advancedFilters.sortBy || 'random' }
    const query = new URLSearchParams(location.search || '')
    const selectedCategoryFromQuery = query.get('category')
    if (selectedCategoryFromQuery) {
      params.categoryId = selectedCategoryFromQuery
    } else if (categoryId) {
      params.categoryId = categoryId
    }
    if (subcategoryId) {
      params.subcategoryId = subcategoryId
    }
    if (activeSearch.trim()) {
      params.search = activeSearch.trim()
    }
    if (advancedFilters.location) {
      params.location = advancedFilters.location
    }
    if (advancedFilters.minPrice && Number(advancedFilters.minPrice) > priceRange.min) {
      params.minPrice = Number(advancedFilters.minPrice)
    }
    if (advancedFilters.maxPrice && Number(advancedFilters.maxPrice) < priceRange.max) {
      params.maxPrice = Number(advancedFilters.maxPrice)
    }

    const reelsQueryKey = JSON.stringify(params)
    if (lastReelsQueryKeyRef.current === reelsQueryKey) return
    lastReelsQueryKeyRef.current = reelsQueryKey

    dispatch(setCurrentFeedType(reelsTab))
    dispatch(clearReels())
    hasReadSavedIndexRef.current = false
    setSavedReelIndex(null)
    prevFilteredLengthRef.current = 0

    dispatch(fetchFeedPage(params))
  }, [dispatch, activeSearch, advancedFilters, categoryId, subcategoryId, location.search, reelsTab, isAuthenticated])

  // Fetch only root categories for home page dropdown (clicking one shows products in that category + all child categories)
  useEffect(() => {
    dispatch(fetchRootCategories())
  }, [dispatch])

  const loadMore = () => {
    if (!hasMore || loading || !nextCursor) return

    const params = { limit: REELS_PAGE_LIMIT, cursor: nextCursor, feedType: reelsTab, sortBy: advancedFilters.sortBy || 'random' }
    const query = new URLSearchParams(location.search || '')
    const selectedCategoryFromQuery = query.get('category')

    if (selectedCategoryFromQuery) params.categoryId = selectedCategoryFromQuery
    else if (categoryId) params.categoryId = categoryId
    if (subcategoryId) params.subcategoryId = subcategoryId
    if (activeSearch.trim()) params.search = activeSearch.trim()
    if (advancedFilters.location) params.location = advancedFilters.location
    if (advancedFilters.minPrice && Number(advancedFilters.minPrice) > priceRange.min) {
      params.minPrice = Number(advancedFilters.minPrice)
    }
    if (advancedFilters.maxPrice && Number(advancedFilters.maxPrice) < priceRange.max) {
      params.maxPrice = Number(advancedFilters.maxPrice)
    }

    dispatch(fetchFeedPage(params))
  }

  const baseProducts = Array.isArray(reels) ? [...reels] : []
  const byCondition = advancedFilters.condition ? baseProducts.filter(p => p && p.condition === advancedFilters.condition) : baseProducts
  const reelsFilteredProducts = Array.isArray(reelsTab === 'following' ? baseProducts : byCondition)
    ? (reelsTab === 'following' ? baseProducts : byCondition)
    : []

  // Open a specific shared reel from ?reel=PRODUCT_ID
  useEffect(() => {
    if (!sharedReelId) return
    hasReadSavedIndexRef.current = true

    const idx = reelsFilteredProducts.findIndex((p) => String(p?._id) === sharedReelId)
    if (idx >= 0) {
      setSavedReelIndex(idx)
      return
    }

    if (sharedReelFetchRef.current === sharedReelId) return
    sharedReelFetchRef.current = sharedReelId

    let cancelled = false
    productService
      .getProductById(sharedReelId)
      .then((res) => {
        if (cancelled || !res?.data) return
        dispatch(pinReelAtTop(res.data))
        setSavedReelIndex(0)
      })
      .catch(() => {
        if (!cancelled) toast.error('Shared reel not found')
      })

    return () => {
      cancelled = true
    }
  }, [sharedReelId, reelsFilteredProducts, dispatch])

  // Restore last watched reel when feed has products (localStorage + backend for logged-in users)
  useEffect(() => {
    if (sharedReelId) return
    if (!Array.isArray(reelsFilteredProducts) || reelsFilteredProducts.length === 0 || hasReadSavedIndexRef.current) return
    hasReadSavedIndexRef.current = true
    const len = reelsFilteredProducts.length
    // Set from localStorage immediately so first paint has the right index (fixes reload always showing reel 0)
    const localIndex = getLocalReelsIndex(reelsStorageKey)
    if (localIndex != null && localIndex >= 0 && localIndex < len) {
      setSavedReelIndex(localIndex)
    }
    // Optionally override with backend value for logged-in users
    getSavedReelIndex(reelsStorageKey, isAuthenticated, () => userService.getReelsProgress())
      .then((n) => {
        if (n != null && n >= 0 && n < len) setSavedReelIndex(n)
      })
      .catch(() => {})
  }, [reelsFilteredProducts.length, reelsStorageKey, isAuthenticated])

  // Allow restore again when user switches feed (category/search change)
  useEffect(() => {
    return () => {
      hasReadSavedIndexRef.current = false
    }
  }, [categoryId, subcategoryId, activeSearch, reelsTab])

  const handleFilterChange = (key, value) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const clearFilters = () => {
    setAdvancedFilters({
      location: '',
      condition: '',
      sortBy: 'random',
      minPrice: '',
      maxPrice: '',
    })
    setSliderValues({ min: priceRange.min, max: priceRange.max })
  }

  const hasActiveFilters = advancedFilters.location || advancedFilters.condition || 
    (advancedFilters.minPrice && Number(advancedFilters.minPrice) > priceRange.min) ||
    (advancedFilters.maxPrice && Number(advancedFilters.maxPrice) < priceRange.max) ||
    advancedFilters.sortBy !== 'random'

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    // Show suggestions when typing
    if (value.trim().length > 0) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
      // Clear active search when input is empty
      setActiveSearch('')
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setActiveSearch('')
    setIsSearchFocused(false)
    setShowSuggestions(false)
    setSearchSuggestions([])
  }

  const handleSuggestionClick = (product) => {
    // Navigate to product detail
    setShowSuggestions(false)
    navigate(`/products/${product._id}`)
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // Apply search to reels feed
      setActiveSearch(searchQuery.trim())
      setShowSuggestions(false)
    }
  }

  // Handle Enter key to search
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setActiveSearch(searchQuery.trim())
      setShowSuggestions(false)
    }
  }

  const buildFeedParams = ({ cursor = null, refresh = false, targetFeedType = reelsTab } = {}) => {
    const params = { limit: REELS_PAGE_LIMIT, feedType: targetFeedType, refresh, sortBy: advancedFilters.sortBy || 'random' }
    const query = new URLSearchParams(location.search || '')
    const selectedCategoryFromQuery = query.get('category')

    if (cursor) params.cursor = cursor
    if (selectedCategoryFromQuery) params.categoryId = selectedCategoryFromQuery
    else if (categoryId) params.categoryId = categoryId
    if (subcategoryId) params.subcategoryId = subcategoryId
    if (activeSearch.trim()) params.search = activeSearch.trim()
    if (advancedFilters.location) params.location = advancedFilters.location
    if (advancedFilters.minPrice && Number(advancedFilters.minPrice) > priceRange.min) {
      params.minPrice = Number(advancedFilters.minPrice)
    }
    if (advancedFilters.maxPrice && Number(advancedFilters.maxPrice) < priceRange.max) {
      params.maxPrice = Number(advancedFilters.maxPrice)
    }

    return params
  }

  const handleTabChange = (targetTab) => {
    if (targetTab === reelsTab) return

    lastReelsQueryKeyRef.current = null
    hasReadSavedIndexRef.current = false
    setSavedReelIndex(null)
    prevFilteredLengthRef.current = 0
    dispatch(setCurrentFeedType(targetTab))
    dispatch(clearReels())
    setReelsTab(targetTab)

    if (targetTab === 'following' && !isAuthenticated) {
      return
    }

    dispatch(fetchFeedPage(buildFeedParams({ refresh: true, targetFeedType: targetTab })))
  }

  if (loading && reels.length === 0) {
    return (
      <div className="reels-page-viewport bg-black min-h-screen">
        <ReelsSkeleton />
      </div>
    )
  }

  if (reelsFilteredProducts.length === 0 && !loading) {
    return (
      <div className="reels-page-viewport bg-black min-h-screen flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl font-semibold mb-2">
            {reelsTab === 'following'
              ? (isAuthenticated ? 'No posts from people you follow' : 'Login to see your following feed')
              : 'No products found'}
          </p>
          <p className="text-gray-400">
            {reelsTab === 'following'
              ? (isAuthenticated ? 'Follow users to see their latest posts here.' : 'Your home feed is available after you sign in.')
              : 'Check back later for new products'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black reels-page-viewport flex flex-col overflow-visible"
      style={{
        zIndex: 10,
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      {/* Back Button - show only when on a category route (hide on homepage) */}
      {isCategoryRoute && (
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-50 pt-[env(safe-area-inset-top,0)] pl-[env(safe-area-inset-left,0)]">
          <button
            onClick={() => {
              // Navigate back to categories page if coming from category route
              navigate('/categories')
            }}
            className="p-2.5 bg-black/70 backdrop-blur-md rounded-full text-white hover:bg-black/90 transition-all hover:scale-110"
            aria-label="Go back to categories"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      )}

      

      {/* TikTok-style three-column layout on desktop: left nav, center feed, right actions */}
      <div className="bg-black flex flex-1 min-h-0 overflow-hidden relative w-full">
        {/* Left Sidebar - desktop only (fixed so it doesn't affect overlay positioning) */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-72 p-4 z-30" style={{ position: 'fixed', left: 16, top: 12, height: 'calc(100vh - 12px)' }}>
          <nav className="flex flex-col gap-3 mt-2">
            {/* Logo above search */}
            <div className="px-2 mb-4 mt-0">
              <Link to="/" className="flex items-center">
                <BrandLogo variant="dark" className="h-12 w-auto" />
              </Link>
            </div>

            {/* Compact Search in sidebar */}
            <form onSubmit={handleSearchSubmit} className="px-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-3 py-2 text-sm bg-gray-900/80 border border-gray-800 rounded-full text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </form>

            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 text-sm font-medium text-white hover:text-primary-400 transition-colors px-3 py-2 rounded-md"
            >
              <Home className="h-5 w-5" />
              Home
            </button>

            <button
              onClick={() => navigate('/post-ad')}
              className="flex items-center gap-3 text-sm font-medium text-white hover:text-primary-400 transition-colors px-3 py-2 rounded-md"
            >
              <Plus className="h-5 w-5" />
              Post Ad
            </button>

            {/* Categories dropdown */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate('/categories')
                    setShowCategoriesDropdown(false)
                  }}
                  className="flex-1 flex items-center gap-2 text-sm font-medium text-white hover:text-primary-400 transition-colors px-3 py-2 rounded-md bg-transparent text-left"
                >
                  <Grid3x3 className="h-5 w-5" />
                  <span>Categories</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleCategories()
                  }}
                  className="px-2 py-2 rounded-md bg-black/40 text-gray-300 hover:bg-black/60 transition-colors"
                  aria-label="Open Categories"
                >
                  ▼
                </button>
              </div>

              {showCategoriesDropdown && (
                <div className="mt-2 bg-gray-900 border border-gray-800 rounded-md p-2 max-h-64 overflow-y-auto">
                  {rootCategories.length > 0 ? rootCategories.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => {
                        // Show products in this category and all child categories
                        navigate(`/reels?category=${c._id}`)
                        setShowCategoriesDropdown(false)
                      }}
                      className="w-full text-left px-2 py-1 text-sm text-white hover:bg-gray-800 rounded"
                    >
                      {c.name}
                    </button>
                  )) : (
                    <div className="text-gray-400 text-sm px-2 py-1">No categories</div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-3 text-sm font-medium text-white hover:text-primary-400 transition-colors px-3 py-2 rounded-md"
            >
              <MessageCircle className="h-5 w-5" />
              Chat
            </button>

            {/* Chat With Us - support chat (creates or opens a support thread) */}
            <button
              onClick={async () => {
                if (!isAuthenticated) {
                  navigate('/login')
                  return
                }
                try {
                  const res = await chatService.createSupportChat()
                  const chatId = res?.data?.chat?._id
                  if (chatId) {
                    navigate(`/chat/${chatId}`)
                  } else {
                    navigate('/chat')
                  }
                } catch (err) {
                  console.error('Failed to create support chat', err)
                  toast.error('Unable to start support chat. Please try again.')
                }
              }}
              className="flex items-center gap-3 text-sm font-medium text-white hover:text-primary-400 transition-colors px-3 py-2 rounded-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8L3 21l.8-4A8.94 8.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat With Us
            </button>

            <button
              onClick={() => navigate('/dashboard?saved=1')}
              className="flex items-center gap-3 text-sm font-medium text-white hover:text-primary-400 transition-colors px-3 py-2 rounded-md"
            >
              <Bookmark className="h-5 w-5" />
              Saved Products
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-3 text-sm font-medium text-white hover:text-primary-400 transition-colors px-3 py-2 rounded-md"
            >
              <User className="h-5 w-5" />
              Profile
            </button>

            {/* Auth / Admin / Get App menu */}
            <div className="mt-4 border-t border-gray-800 pt-3 flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  {isAdmin && (
                    <button
                      onClick={() => { window.location.href = ADMIN_PANEL_URL }}
                      className="flex items-center gap-3 text-sm font-medium text-white hover:text-primary-400 transition-colors px-3 py-2 rounded-md"
                    >
                      <Shield className="h-5 w-5" />
                      Admin
                    </button>
                  )}
                  <button
                    onClick={() => { dispatch(logout('user-click')); navigate('/'); }}
                    className="flex items-center gap-3 text-sm font-medium text-white hover:text-red-400 transition-colors px-3 py-2 rounded-md"
                  >
                    <LogOut className="h-5 w-5" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-3 text-sm font-medium text-white hover:text-primary-400 transition-colors px-3 py-2 rounded-md"
                  >
                    <User className="h-5 w-5" />
                    Login
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="flex items-center gap-3 text-sm font-medium text-white hover:text-primary-400 transition-colors px-3 py-2 rounded-md"
                  >
                    <Plus className="h-5 w-5" />
                    Sign Up
                  </button>
                </>
              )}

              <a
                href="#"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 text-sm font-medium text-white hover:text-primary-400 transition-colors px-3 py-2 rounded-md"
              >
                <ExternalLink className="h-5 w-5" />
                Get App
              </a>
            </div>
          </nav>
        </aside>

        {/* Center Feed */}
        <main className="flex-1 min-h-0 flex items-center justify-center pt-16">
          <div className="w-full flex justify-center">
            <div className="w-full max-w-[640px]">
              {/* Tabs positioned fixed below header so they are always visible and perfectly centered */}
              <div style={{ position: 'absolute', top: '88px', left: '47.5%', transform: 'translateX(-50%)', zIndex: 2000 }} className="pointer-events-auto">
                <div className="inline-flex items-center gap-3 bg-black/80 backdrop-blur-md rounded-full p-2 px-3 shadow-lg">
                  <button
                    onClick={() => handleTabChange('trending')}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${reelsTab === 'trending' ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                    aria-pressed={reelsTab === 'trending'}
                  >
                    Trending
                  </button>
                  <button
                    onClick={() => handleTabChange('following')}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${reelsTab === 'following' ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                    aria-pressed={reelsTab === 'following'}
                  >
                    Following
                  </button>
                </div>
              </div>

              <ReelsFeed
                key={sharedReelId ? `shared-${sharedReelId}-${savedReelIndex ?? 0}` : `feed-${savedReelIndex ?? 0}`}
                products={reelsFilteredProducts}
                onLoadMore={loadMore}
                hasMore={hasMore}
                loading={loading}
                hasCategoryHeader={false}
                initialIndex={savedReelIndex ?? 0}
                isCategoryFeed={!!(categoryId || subcategoryId)}
                onExploreCategories={categoryId || subcategoryId ? () => navigate('/categories') : undefined}
                onVisibleIndexChange={(index) => {
                  saveReelIndex(reelsStorageKey, index, isAuthenticated, userService.saveReelsProgress)
                }}
              />
            </div>
          </div>
        </main>

        {/* Right Actions Column removed on Reels page (handled per-reel via overlay) */}
      </div>
      {/* Copyright / small branding */}
      <div className="fixed bottom-3 right-3 z-50 text-gray-400 text-xs pointer-events-none">
        @2024 Preelly
      </div>
    </div>
  )
}

export default ReelsFeedPage
