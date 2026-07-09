import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Bookmark, Building2, Briefcase, Car, ChevronLeft, ChevronRight, LayoutGrid, MessageCircle, Plus, Settings, Shirt, Smartphone, Sofa, X } from 'lucide-react'
import BrandLogo from '@shared/components/BrandLogo'
import HomeTopBar from '../components/Home/HomeTopBar'
import ReelsFeed from '@shared/components/Reels/ReelsFeed'
import ReelsSkeleton from '@shared/components/Reels/ReelsSkeleton'
import ReelProductDetailPanel from '@shared/components/Reels/ReelProductDetailPanel'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import {
  selectAuthHydrating,
  selectIsAuthenticated,
  selectUser,
} from '@shared/store/slices/authSlice'
import { clearReels, fetchFeedPage, fetchFeedShell, setCurrentFeedType, REELS_PAGE_LIMIT } from '@shared/store/slices/feedSlice'
import { userService } from '@shared/services/api'
import { getCategoryImageUrl } from '@shared/utils/helpers'
import { getLocalReelsIndex, getReelsStorageKey, getSavedReelIndex, saveReelIndex } from '@shared/utils/reelsProgress'

const categoryIconMap = [
  { pattern: /\b(motor|vehicle|car|auto)\b/i, icon: Car },
  { pattern: /\b(property|real estate|villa|apartment|home)\b/i, icon: Building2 },
  { pattern: /\b(job|career|work)\b/i, icon: Briefcase },
  { pattern: /\b(fashion|clothing|accessories)\b/i, icon: Shirt },
  { pattern: /\b(furniture|garden|home decor)\b/i, icon: Sofa },
  { pattern: /\b(electronics|mobile|phone|laptop|gaming)\b/i, icon: Smartphone },
]

function getFallbackCategoryIcon(name) {
  const match = categoryIconMap.find((item) => item.pattern.test(name || ''))
  return match?.icon || LayoutGrid
}

function formatCompactCount(value) {
  if (!value || Number(value) <= 0) return '0'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatCategoryCount(value) {
  const count = Number(value || 0)
  if (!count) return null
  return count.toLocaleString('en-US')
}

function CategoryBadge({ category, compact = false }) {
  const Icon = getFallbackCategoryIcon(category?.name)
  const sizeClass = compact ? 'h-4 w-4' : 'h-5 w-5'
  const [imageFailed, setImageFailed] = useState(false)
  const imageSrc = getCategoryImageUrl(category)

  if (imageSrc && !imageFailed) {
    return (
      <div className={`flex items-center justify-center overflow-hidden rounded-md ${compact ? 'h-4 w-4' : 'h-5 w-5'}`}>
        <img
          src={imageSrc}
          alt={category.name}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      </div>
    )
  }

  if (category?.emoji) {
    return (
      <span className={compact ? 'text-sm' : 'text-lg'} aria-hidden="true">
        {category.emoji}
      </span>
    )
  }

  return <Icon className={`${sizeClass} flex-shrink-0 text-slate-700`} strokeWidth={1.75} />
}

function HomePage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const authHydrating = useSelector(selectAuthHydrating)
  const user = useSelector(selectUser)
  const { rootCategories, rootLoading: categoriesLoading, rootError: categoriesError } = useSelector(
    (state) => state.categories
  )
  const { reels, loading, error: feedError, reelsMeta, unreadCount: feedUnreadCount, shellLoaded } =
    useSelector((state) => state.feed)

  const [activeTab, setActiveTab] = useState('trending')
  const [savedReelIndex, setSavedReelIndex] = useState(null)
  const [visibleReelIndex, setVisibleReelIndex] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const wasOnHomeRef = useRef(false)
  const hasReadSavedIndexRef = useRef(false)

  const selectedCategoryId = useMemo(
    () => new URLSearchParams(location.search || '').get('category') || '',
    [location.search]
  )
  const reelsStorageKey = getReelsStorageKey(selectedCategoryId || undefined, undefined)
  const hasMore = Boolean(reelsMeta?.hasMore)
  const nextCursor = reelsMeta?.nextCursor || null

  useEffect(() => {
    if (!isAuthenticated || shellLoaded) return
    dispatch(fetchFeedShell({ includeChats: true, includePriceRange: false }))
  }, [dispatch, isAuthenticated, shellLoaded])

  const buildFeedParams = ({ cursor = null, refresh = false, targetFeedType = activeTab } = {}) => {
    const params = { limit: REELS_PAGE_LIMIT, feedType: targetFeedType, refresh, sortBy: 'random' }
    if (cursor) params.cursor = cursor
    if (selectedCategoryId) params.categoryId = selectedCategoryId
    return params
  }

  const canLoadFeed = activeTab !== 'following' || isAuthenticated

  // Load categories when entering home.
  useEffect(() => {
    const isHome = location.pathname === '/'
    const enteredHome = isHome && !wasOnHomeRef.current
    wasOnHomeRef.current = isHome
    if (enteredHome) {
      dispatch(fetchRootCategories())
    }
  }, [dispatch, location.pathname])

  // Load trending/following feed (tab/filter changes refetch; leaving home aborts via route scope).
  useEffect(() => {
    if (location.pathname !== '/') return undefined

    if (!canLoadFeed) {
      dispatch(setCurrentFeedType(activeTab))
      dispatch(clearReels())
      return undefined
    }

    hasReadSavedIndexRef.current = false
    setSavedReelIndex(null)

    const params = buildFeedParams({ refresh: true })
    dispatch(setCurrentFeedType(activeTab))
    dispatch(clearReels())
    const promise = dispatch(fetchFeedPage(params))
    return () => {
      promise.abort()
    }
  }, [dispatch, location.pathname, activeTab, selectedCategoryId, canLoadFeed])

  useEffect(() => {
    if (!Array.isArray(reels) || reels.length === 0 || hasReadSavedIndexRef.current) return

    hasReadSavedIndexRef.current = true
    const length = reels.length
    const localIndex = getLocalReelsIndex(reelsStorageKey)
    if (localIndex != null && localIndex >= 0 && localIndex < length) {
      setSavedReelIndex(localIndex)
    }

    const canSyncProgress = isAuthenticated && !authHydrating
    getSavedReelIndex(reelsStorageKey, canSyncProgress, () => userService.getReelsProgress())
      .then((index) => {
        if (index != null && index >= 0 && index < length) {
          setSavedReelIndex(index)
        }
      })
      .catch(() => {})
  }, [reels.length, reelsStorageKey, isAuthenticated, authHydrating])

  useEffect(() => {
    hasReadSavedIndexRef.current = false
    setSavedReelIndex(null)
    setVisibleReelIndex(0)
    return () => {
      hasReadSavedIndexRef.current = false
    }
  }, [selectedCategoryId, activeTab])

  const handleCategoryClick = (category) => {
    const categoryId = category?._id
    if (!categoryId) return

    const params = new URLSearchParams(location.search || '')
    if (params.get('category') === categoryId) {
      params.delete('category')
    } else {
      params.set('category', categoryId)
    }

    navigate({
      pathname: '/',
      search: params.toString() ? `?${params.toString()}` : '',
    })
  }

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) return
    setActiveTab(nextTab)
  }

  const loadMore = () => {
    if (!hasMore || loading || !nextCursor) return
    dispatch(fetchFeedPage(buildFeedParams({ cursor: nextCursor })))
  }

  const handleRefreshFeed = () => {
    hasReadSavedIndexRef.current = false
    setSavedReelIndex(null)
    dispatch(clearReels())
    dispatch(fetchFeedPage(buildFeedParams({ refresh: true })))
  }

  const videoReels = useMemo(() => reels.filter((product) => Boolean(product?.video)), [reels])
  const unreadChatCount = isAuthenticated ? feedUnreadCount || 0 : 0
  const currentReel = videoReels[visibleReelIndex] || videoReels[0] || null

  const quickLinks = [
    {
      label: 'My Bookmarks',
      to: isAuthenticated ? '/bookmarks' : '/login',
      icon: Bookmark,
    },
    {
      label: 'Messages',
      to: isAuthenticated ? '/chat' : '/login',
      icon: MessageCircle,
      badge: unreadChatCount > 0 ? unreadChatCount : null,
    },
    {
      label: 'Settings',
      to: isAuthenticated ? '/dashboard/settings' : '/login',
      icon: Settings,
    },
  ]

  const reelsLockedForGuest = activeTab === 'following' && !isAuthenticated

  const mobileNavContent = (
    <>
      <Link
        to="/post-ad"
        onClick={() => setMobileMenuOpen(false)}
        className="flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" />
        Post Your Ad
      </Link>

      <div className="mt-6">
        <Link
          to="/categories"
          onClick={() => setMobileMenuOpen(false)}
          className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:text-brand"
        >
          Categories
        </Link>
        <div className="mt-3 space-y-1">
          {rootCategories.slice(0, 7).map((category) => {
            const isSelected = category._id === selectedCategoryId
            return (
              <button
                key={category._id}
                type="button"
                onClick={() => {
                  handleCategoryClick(category)
                  setMobileMenuOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  isSelected ? 'bg-brand-50 text-brand' : 'hover:bg-slate-50'
                }`}
              >
                <CategoryBadge category={category} compact />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{category.name}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quick Links</p>
        <div className="mt-3 space-y-2">
          {quickLinks.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <Icon className="h-4 w-4 text-slate-500" />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                    {Math.min(item.badge, 99)}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#f7f8fa]">
      {/* Mobile slide-out navigation */}
      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[60] bg-black/40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-[70] w-[min(320px,88vw)] overflow-y-auto bg-white p-5 shadow-2xl lg:hidden">
            <div className="mb-5 flex items-center justify-between">
              <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                <BrandLogo className="h-9 w-auto" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {mobileNavContent}
          </aside>
        </>
      )}

      <div
        className={`grid h-full grid-rows-[auto_minmax(0,1fr)] ${
          sidebarCollapsed ? 'lg:grid-cols-[84px_minmax(0,1fr)_320px]' : 'lg:grid-cols-[270px_minmax(0,1fr)_320px]'
        }`}
      >
        <div className="hidden border-b border-slate-200 p-5 lg:block lg:border-b-0 lg:border-r">
          <Link to="/" className="inline-flex items-center overflow-hidden">
            <BrandLogo className={sidebarCollapsed ? 'h-8 w-auto flex-shrink-0' : 'h-10 w-auto'} />
          </Link>
        </div>

        <HomeTopBar mobileMenuOpen={mobileMenuOpen} onToggleMobileMenu={() => setMobileMenuOpen(true)} />

        <aside className="hidden min-h-0 flex-col overflow-y-auto border-b border-slate-200 bg-white p-5 lg:flex lg:border-b-0 lg:border-r">
          <Link
            to="/post-ad"
            className="flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            title="Post Your Ad"
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            {!sidebarCollapsed && 'Post Your Ad'}
          </Link>

          <div className="mt-7">
            {!sidebarCollapsed && (
              <Link
                to="/categories"
                className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:text-brand"
              >
                Categories
              </Link>
            )}
            {categoriesError && !sidebarCollapsed && (
              <button
                type="button"
                onClick={() => dispatch(fetchRootCategories())}
                className="mt-2 text-xs font-medium text-red-600 hover:text-red-700"
              >
                Could not load categories — tap to retry
              </button>
            )}
            <div className="mt-3 space-y-1">
              {categoriesLoading && rootCategories.length === 0 && !sidebarCollapsed && (
                <p className="px-3 py-2 text-sm text-slate-400">Loading categories…</p>
              )}
              {rootCategories.slice(0, 7).map((category) => {
                const isSelected = category._id === selectedCategoryId

                return (
                  <button
                    key={category._id}
                    onClick={() => handleCategoryClick(category)}
                    title={category.name}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected ? 'bg-brand-50 text-brand' : 'hover:bg-slate-50'
                    }`}
                  >
                    <CategoryBadge category={category} compact />
                    {!sidebarCollapsed && (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{category.name}</p>
                        </div>
                        <span className="text-xs font-medium text-slate-400">{formatCategoryCount(category.count) || formatCompactCount(category.count)}</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-8">
            {!sidebarCollapsed && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quick Links</p>}
            <div className="mt-3 space-y-2">
              {quickLinks.map((item) => {
                const Icon = item.icon

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    title={item.label}
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                    {item.badge ? (
                      <span className="ml-auto inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                        {Math.min(item.badge, 99)}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="mt-auto flex items-center gap-2 self-start rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!sidebarCollapsed && 'Collapse'}
          </button>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-5">
          <div className="mx-auto flex w-full max-w-[min(100%,440px)] sm:max-w-[480px] shrink-0 items-center justify-center gap-4 sm:gap-8">
            <div className="inline-flex items-center gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => handleTabChange('following')}
                className={`border-b-2 px-1 py-1 text-base sm:text-[18px] font-semibold transition ${
                  activeTab === 'following' ? 'border-brand text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Following
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('trending')}
                className={`border-b-2 px-1 py-1 text-base sm:text-[18px] font-semibold transition ${
                  activeTab === 'trending' ? 'border-brand text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Trending
              </button>
            </div>
          </div>

          <div className="mx-auto mt-2 sm:mt-4 flex min-h-0 w-full max-w-[min(100%,440px)] sm:max-w-[480px] flex-1 overflow-hidden">
            {feedError && videoReels.length === 0 && !loading ? (
              <div className="flex h-full w-full items-center justify-center rounded-[32px] border border-dashed border-red-200 bg-red-50 px-6 text-center">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Could not load reels</p>
                  <p className="mt-2 text-sm text-slate-500">{feedError}</p>
                  <button
                    type="button"
                    onClick={handleRefreshFeed}
                    className="mt-5 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : loading && videoReels.length === 0 ? (
              <div className="h-full w-full overflow-hidden">
                <ReelsSkeleton />
              </div>
            ) : reelsLockedForGuest ? (
              <div className="flex h-full w-full items-center justify-center rounded-[32px] border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Login to view your following feed</p>
                  <p className="mt-2 text-sm text-slate-500">Trending reels are still available without signing in.</p>
                  <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleTabChange('trending')}
                      className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand"
                    >
                      Switch to Trending
                    </button>
                    <Link
                      to="/login"
                      className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      Login
                    </Link>
                  </div>
                </div>
              </div>
            ) : videoReels.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center rounded-[32px] border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {activeTab === 'following' ? 'No reels from followed sellers yet' : 'No video reels found'}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {activeTab === 'following'
                      ? 'Follow sellers from reels or profiles to build your Following feed.'
                      : selectedCategoryId
                      ? 'Try another category or clear the filter to see more video listings.'
                      : 'Add listings with videos and they will appear here.'}
                  </p>
                  <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    {activeTab === 'following' && isAuthenticated ? (
                      <button
                        type="button"
                        onClick={() => handleTabChange('trending')}
                        className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand"
                      >
                        Browse Trending
                      </button>
                    ) : null}
                    {selectedCategoryId ? (
                      <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand"
                      >
                        Clear category
                      </button>
                    ) : null}
                    <Link
                      to="/post-ad"
                      className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      Post Your Ad
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full w-full overflow-hidden">
                <ReelsFeed
                  products={videoReels}
                  onLoadMore={loadMore}
                  hasMore={hasMore}
                  loading={loading}
                  initialIndex={savedReelIndex ?? 0}
                  heightOverride="100%"
                  embedded
                  onVisibleIndexChange={(index) => {
                    setVisibleReelIndex(index)
                    saveReelIndex(reelsStorageKey, index, isAuthenticated, userService.saveReelsProgress)
                  }}
                />
              </div>
            )}
          </div>
        </section>

        <aside className="hidden min-h-0 overflow-hidden border-t border-slate-200 bg-white p-5 lg:block lg:border-l lg:border-t-0">
          <ReelProductDetailPanel product={currentReel} />
        </aside>
      </div>
    </div>
  )
}

export default HomePage
