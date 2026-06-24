import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Bell, Bookmark, Briefcase, Building2, Car, CheckCircle2, ChevronDown, ChevronRight, LayoutDashboard, LayoutGrid, LogOut, Menu, MessageCircle, Plus, Settings, Shield, Shirt, Smartphone, Sofa, User, X } from 'lucide-react'
import BrandLogo from '@shared/components/BrandLogo'
import SearchBar from '../components/Search/SearchBar'
import ReelsFeed from '@shared/components/Reels/ReelsFeed'
import ReelsSkeleton from '@shared/components/Reels/ReelsSkeleton'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import {
  logout,
  selectAuthHydrating,
  selectIsAdmin,
  selectIsAuthenticated,
  selectUser,
} from '@shared/store/slices/authSlice'
import { clearReels, fetchFeedPage, fetchFeedShell, setCurrentFeedType, REELS_PAGE_LIMIT } from '@shared/store/slices/feedSlice'
import { userService } from '@shared/services/api'
import { formatPrice, getCategoryImageUrl, getMediaUrl, isUserVerified, truncate } from '@shared/utils/helpers'
import { getLocalReelsIndex, getReelsStorageKey, getSavedReelIndex, saveReelIndex } from '@shared/utils/reelsProgress'
import { ADMIN_PANEL_URL } from '@shared/utils/constants'
import { ListingMedia } from '../components/Categories/categoryBrowseShared'

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

function formatListingPrice(product) {
  const amount = Number(product?.price || 0)
  const currency =
    typeof product?.currency === 'string' && product.currency.length === 3
      ? product.currency.toUpperCase()
      : 'AED'

  try {
    return formatPrice(amount, currency)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function formatChatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const diffInMinutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000))
  if (diffInMinutes < 60) return `${diffInMinutes}m`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h`
  return `${Math.floor(diffInHours / 24)}d`
}

function CategoryBadge({ category, compact = false }) {
  const Icon = getFallbackCategoryIcon(category?.name)
  const sizeClass = compact ? 'h-4 w-4' : 'h-5 w-5'
  const shellClass = compact ? 'h-7 w-7 rounded-full' : 'h-10 w-10 rounded-2xl'
  const [imageFailed, setImageFailed] = useState(false)
  const imageSrc = getCategoryImageUrl(category)

  if (imageSrc && !imageFailed) {
    return (
      <div className={`flex items-center justify-center bg-primary-50 overflow-hidden ${shellClass}`}>
        <img
          src={imageSrc}
          alt={category.name}
          className={`${compact ? 'h-7 w-7' : 'h-10 w-10'} w-full object-cover`}
          onError={() => setImageFailed(true)}
        />
      </div>
    )
  }

  if (category?.emoji) {
    return (
      <div className={`flex items-center justify-center bg-primary-50 ${shellClass} ${compact ? 'text-sm' : 'text-lg'}`}>
        {category.emoji}
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center bg-primary-50 text-primary-700 ${shellClass}`}>
      <Icon className={sizeClass} />
    </div>
  )
}

function formatCategoryCount(value) {
  const count = Number(value || 0)
  if (!count) return null
  return count.toLocaleString('en-US')
}

function HomePage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const authHydrating = useSelector(selectAuthHydrating)
  const isAdmin = useSelector(selectIsAdmin)
  const user = useSelector(selectUser)
  const { rootCategories, rootLoading: categoriesLoading, rootError: categoriesError } = useSelector(
    (state) => state.categories
  )
  const { reels, loading, error: feedError, reelsMeta, chats: recentChats, unreadCount: feedUnreadCount, shellLoaded } =
    useSelector((state) => state.feed)

  const [activeTab, setActiveTab] = useState('trending')
  const [savedReelIndex, setSavedReelIndex] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const profileCloseTimer = useRef(null)
  const wasOnHomeRef = useRef(false)

  const profileEnter = () => {
    if (profileCloseTimer.current) clearTimeout(profileCloseTimer.current)
    setProfileOpen(true)
  }
  const profileLeave = () => {
    profileCloseTimer.current = setTimeout(() => setProfileOpen(false), 200)
  }
  const handleLogout = () => {
    dispatch(logout('user-click'))
    navigate('/')
  }
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

  const trendingTopics = useMemo(() => {
    const tags = [
      ...reels.map((product) => truncate(product?.title || '', 18)).filter(Boolean),
      ...rootCategories.map((category) => category?.name).filter(Boolean),
    ]
    return [...new Set(tags)].slice(0, 5)
  }, [reels, rootCategories])

  const videoReels = useMemo(() => reels.filter((product) => Boolean(product?.video)), [reels])
  const featuredListings = useMemo(() => videoReels.slice(0, 3), [videoReels])
  const unreadChatCount = isAuthenticated ? feedUnreadCount || 0 : 0

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

  const avatarSrc = user?.avatar ? getMediaUrl(user.avatar) || user.avatar : null
  const displayName = user?.displayName || user?.name || 'Explore Preelly'
  const userSubcopy = isAuthenticated
    ? isUserVerified(user)
      ? 'Verified account'
      : 'Marketplace member'
    : 'Buy. Sell. Watch.'
  const reelsLockedForGuest = activeTab === 'following' && !isAuthenticated

  const mobileNavContent = (
    <>
      <Link
        to="/post-ad"
        onClick={() => setMobileMenuOpen(false)}
        className="flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
      >
        <Plus className="h-4 w-4" />
        Post Your Ad
      </Link>

      <div className="mt-6">
        <Link
          to="/categories"
          onClick={() => setMobileMenuOpen(false)}
          className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:text-primary-700"
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
                  isSelected ? 'bg-primary-50 text-primary-800' : 'hover:bg-slate-50'
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
                  <span className="ml-auto inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
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

      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[270px_minmax(0,1fr)_320px]">
        <div className="hidden border-b border-slate-200 p-5 lg:block lg:border-b-0 lg:border-r">
          <Link to="/" className="inline-flex items-center">
            <BrandLogo className="h-10 w-auto" />
          </Link>
        </div>

        <div className="border-b border-slate-200 p-3 sm:p-5 lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
          {/* Mobile top bar */}
          <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
            <Link to="/" className="inline-flex shrink-0 items-center">
              <BrandLogo className="h-8 w-auto" />
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
              {!isAuthenticated && (
                <Link
                  to="/login"
                  className="rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white sm:hidden"
                >
                  Login
                </Link>
              )}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link
                to={isAuthenticated ? '/dashboard/notifications' : '/login'}
                className="relative rounded-full border border-slate-200 p-2 text-slate-600"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadChatCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                    {Math.min(unreadChatCount, 99)}
                  </span>
                )}
              </Link>
            </div>
          </div>

          <SearchBar
            variant="home"
            placeholder="Search cars, properties..."
            className="w-full"
          />

          <div className="mt-3 hidden items-center justify-between gap-4 sm:flex lg:mt-0 lg:justify-end">
            {isAuthenticated ? (
              <div
                className="relative flex-shrink-0"
                onMouseEnter={profileEnter}
                onMouseLeave={profileLeave}
              >
                <button
                  type="button"
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 border border-transparent hover:bg-slate-50 hover:border-slate-200 transition-all"
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={displayName} className="h-9 w-9 rounded-full object-cover ring-2 ring-primary-100 flex-shrink-0" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 flex-shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-1">
                      <span className="block truncate text-sm font-semibold text-slate-800 max-w-[110px]">{displayName}</span>
                      {isUserVerified(user) && <CheckCircle2 className="h-3.5 w-3.5 text-primary-600 flex-shrink-0" />}
                    </div>
                    <span className="block text-xs text-slate-400">{userSubcopy}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div
                    className="absolute right-0 top-full pt-1 z-[9999]"
                    onMouseEnter={profileEnter}
                    onMouseLeave={profileLeave}
                  >
                    <div className="w-56 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt={displayName} className="h-9 w-9 rounded-full object-cover ring-2 ring-primary-100 flex-shrink-0" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 flex-shrink-0">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                          <p className="text-xs text-slate-500 truncate">{user?.email || userSubcopy}</p>
                        </div>
                      </div>
                      <nav className="py-1">
                        <Link to="/dashboard" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
                          <LayoutDashboard className="h-4 w-4 text-slate-400" />
                          Profile Overview
                        </Link>
                        <Link to="/dashboard/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
                          <Settings className="h-4 w-4 text-slate-400" />
                          Settings
                        </Link>
                        {isAdmin && (
                          <a href={ADMIN_PANEL_URL} onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-purple-600 hover:bg-purple-50 transition-colors">
                            <Shield className="h-4 w-4" />
                            Admin Panel
                          </a>
                        )}
                      </nav>
                      <div className="border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Logout
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-3 md:flex">
                <Link to="/login" className="text-sm font-medium text-slate-600 transition hover:text-primary-700">
                  Login
                </Link>
                <Link to="/signup" className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700">
                  Sign Up
                </Link>
              </div>
            )}

            <Link
              to={isAuthenticated ? '/dashboard/notifications' : '/login'}
              className="relative hidden rounded-full border border-slate-200 p-3 text-slate-600 transition hover:border-primary-200 hover:text-primary-700 sm:inline-flex"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadChatCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
                  {Math.min(unreadChatCount, 99)}
                </span>
              )}
            </Link>
          </div>
        </div>

        <aside className="hidden min-h-0 overflow-y-auto border-b border-slate-200 bg-white p-5 lg:block lg:border-b-0 lg:border-r">
          <Link
            to="/post-ad"
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Post Your Ad
          </Link>

          <div className="mt-7">
            <Link
              to="/categories"
              className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:text-primary-700"
            >
              Categories
            </Link>
            {categoriesError && (
              <button
                type="button"
                onClick={() => dispatch(fetchRootCategories())}
                className="mt-2 text-xs font-medium text-red-600 hover:text-red-700"
              >
                Could not load categories — tap to retry
              </button>
            )}
            <div className="mt-3 space-y-1">
              {categoriesLoading && rootCategories.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-400">Loading categories…</p>
              )}
              {rootCategories.slice(0, 7).map((category) => {
                const isSelected = category._id === selectedCategoryId

                return (
                  <button
                    key={category._id}
                    onClick={() => handleCategoryClick(category)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected ? 'bg-primary-50 text-primary-800' : 'hover:bg-slate-50'
                    }`}
                  >
                    <CategoryBadge category={category} compact />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{category.name}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-400">{formatCategoryCount(category.count) || formatCompactCount(category.count)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quick Links</p>
            <div className="mt-3 space-y-2">
              {quickLinks.map((item) => {
                const Icon = item.icon

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="ml-auto inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
                        {Math.min(item.badge, 99)}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Popular Categories</p>
              {selectedCategoryId ? (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-xs font-semibold text-primary-700 transition hover:text-primary-800"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {rootCategories.slice(0, 4).map((category) => (
                <button
                  key={`popular-${category._id}`}
                  onClick={() => handleCategoryClick(category)}
                  className="block text-left text-sm text-slate-600 transition hover:text-primary-700"
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-5">
          <div className="mx-auto flex w-full max-w-[min(100%,440px)] sm:max-w-[480px] shrink-0 items-center justify-center gap-4 sm:gap-8">
            <div className="inline-flex items-center gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => handleTabChange('following')}
                className={`border-b-2 px-1 py-1 text-base sm:text-[18px] font-semibold transition ${
                  activeTab === 'following' ? 'border-primary-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Following
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('trending')}
                className={`border-b-2 px-1 py-1 text-base sm:text-[18px] font-semibold transition ${
                  activeTab === 'trending' ? 'border-primary-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
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
                    className="mt-5 rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
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
                      className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-primary-200 hover:text-primary-700"
                    >
                      Switch to Trending
                    </button>
                    <Link
                      to="/login"
                      className="rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
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
                        className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-primary-200 hover:text-primary-700"
                      >
                        Browse Trending
                      </button>
                    ) : null}
                    {selectedCategoryId ? (
                      <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-primary-200 hover:text-primary-700"
                      >
                        Clear category
                      </button>
                    ) : null}
                    <Link
                      to="/post-ad"
                      className="rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
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
                    saveReelIndex(reelsStorageKey, index, isAuthenticated, userService.saveReelsProgress)
                  }}
                />
              </div>
            )}
          </div>
        </section>

        <aside className="hidden min-h-0 overflow-y-auto border-t border-slate-200 bg-white p-5 lg:block lg:border-l lg:border-t-0">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-slate-900">Trending</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {trendingTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(topic)}`)}
                  className="rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:text-primary-700"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-slate-900">Featured Listings</p>
              <Link to="/reels" className="text-sm font-semibold text-primary-700 transition hover:text-primary-800">
                See all
              </Link>
            </div>

            <div className="mt-4 space-y-4">
              {featuredListings.map((product) => (
                <Link
                  key={product._id}
                  to={`/products/${product._id}`}
                  className="block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="h-36 overflow-hidden">
                    <ListingMedia product={product} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-slate-900">{truncate(product.title || 'Listing', 42)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[product.location, product.category?.name].filter(Boolean).join(' . ') || 'Live on marketplace'}
                    </p>
                    <p className="mt-3 text-lg font-bold text-primary-700">{formatListingPrice(product)}</p>
                  </div>
                </Link>
              ))}

              {!loading && featuredListings.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  Featured cards will appear here as soon as reels are available.
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-slate-900">Messages</p>
              <Link to={isAuthenticated ? '/chat' : '/login'} className="text-sm font-semibold text-primary-700 transition hover:text-primary-800">
                View all
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {isAuthenticated ? (
                recentChats.length > 0 ? (
                  recentChats.slice(0, 4).map((chat) => {
                    const isSupportChat = chat.type === 'support'
                    const buyerId = chat?.buyer?._id || chat?.buyer
                    const isBuyer = String(buyerId) === String(user?._id)
                    const otherParty = isSupportChat ? null : isBuyer ? chat.seller : chat.buyer
                    const unread = isSupportChat
                      ? chat.unreadForUser || 0
                      : isBuyer
                      ? chat.unreadForBuyer || 0
                      : chat.unreadForSeller || 0

                    return (
                      <Link
                        key={chat._id}
                        to={`/chat/${chat._id}`}
                        className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-primary-200"
                      >
                        {otherParty?.avatar ? (
                          <img
                            src={getMediaUrl(otherParty.avatar) || otherParty.avatar}
                            alt={otherParty.name || 'User'}
                            className="h-11 w-11 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                            <MessageCircle className="h-5 w-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {isSupportChat ? 'Support team' : otherParty?.name || chat.product?.title || 'Conversation'}
                            </p>
                            <span className="text-[11px] font-medium text-slate-400">{formatChatTime(chat.lastMessageAt)}</span>
                          </div>
                          <p className="truncate text-xs text-slate-500">{chat.lastMessage || 'No messages yet'}</p>
                        </div>

                        {unread > 0 ? (
                          <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
                            {Math.min(unread, 99)}
                          </span>
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        )}
                      </Link>
                    )
                  })
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-900">No recent conversations</p>
                    <p className="mt-1 text-sm text-slate-500">Start a chat from any product page to see it here.</p>
                  </div>
                )
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-900">Login to see your inbox</p>
                  <p className="mt-1 text-sm text-slate-500">Recent buyer and seller messages will appear here.</p>
                  <Link
                    to="/login"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
                  >
                    Login
                  </Link>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default HomePage
