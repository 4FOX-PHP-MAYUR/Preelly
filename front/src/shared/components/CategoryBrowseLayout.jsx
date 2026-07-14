import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Bookmark,
  ChevronRight,
  Menu,
  MessageCircle,
  Plus,
  Settings,
  X,
} from 'lucide-react'
import BrandLogo from '@shared/components/BrandLogo'
import MarketplaceTopBar from '../../components/Layout/MarketplaceTopBar'
import MarketplaceLogoBlock from '../../components/Layout/MarketplaceLogoBlock'
import { MARKETPLACE_LOGO_CELL } from '../../components/Layout/marketplaceLayoutStyles'
import MobileAppPromoCard from '@shared/components/ProductDetail/MobileAppPromoCard'
import SidebarCategoryList from '../../components/Layout/SidebarCategoryList'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import { selectIsAuthenticated, selectUser } from '@shared/store/slices/authSlice'
import { getMediaUrl, truncate } from '@shared/utils/helpers'
import { useChat } from '@shared/components/Chat/ChatContext'
import {
  buildSpecsLine,
  formatListingPrice,
  formatTimeAgo,
  ListingMedia,
} from './categoryBrowseShared'

const TRENDING_TOPICS = ['Luxury Cars', 'Sports Cars', 'SUVs', 'Classic Cars', 'Dubai Marina', 'New Listings']

function CategoryBrowseLayout({
  children,
  activeCategoryId = null,
  featuredProducts = [],
  showMessages = true,
  showTrending = true,
  variant = 'default',
  layoutPreset = 'default',
  filterPanel = null,
  filterPanelOpen = false,
  showMobileAppPromo = false,
}) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const { rootCategories, rootLoading } = useSelector((state) => state.categories)
  const { chats = [], unreadCount = 0 } = useChat() || {}

  useEffect(() => {
    if (rootCategories.length === 0 && !rootLoading) {
      dispatch(fetchRootCategories())
    }
  }, [dispatch, rootCategories.length, rootLoading])

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
      badge: unreadCount > 0 ? unreadCount : null,
    },
    { label: 'Settings', to: isAuthenticated ? '/dashboard/settings' : '/login', icon: Settings },
  ]

  const featuredItems = useMemo(() => featuredProducts.slice(0, 3), [featuredProducts])
  const recentChats = useMemo(() => chats.slice(0, 4), [chats])

  const handleCategoryNav = (category) => {
    // All categories open the unified listing page with the shared filter panel.
    navigate(`/categories/${category._id}/products`)
  }

  const popularLabels =
    activeCategoryId && rootCategories.find((c) => c._id === activeCategoryId)
      ? ['Luxury Cars', 'Sports Cars', 'SUVs', 'Classic Cars']
      : rootCategories.slice(0, 4).map((c) => c.name)

  const isListingVariant = variant === 'listing'
  const isDetailLayout = layoutPreset === 'detail'
  const isMarketplaceShell = layoutPreset === 'marketplace'
  const useFullViewport = isDetailLayout || isMarketplaceShell
  const showRightFilters = isListingVariant && (filterPanelOpen || filterPanel)
  const showDefaultRightPanel = !isListingVariant || isDetailLayout

  const gridColsClass = isMarketplaceShell
    ? showRightFilters
      ? 'lg:grid-cols-[270px_minmax(0,1fr)_465px]'
      : 'lg:grid-cols-[270px_minmax(0,1fr)]'
    : showRightFilters
      ? 'lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_min(400px,28vw)]'
      : isDetailLayout
        ? 'lg:grid-cols-[270px_minmax(0,1fr)_320px]'
        : isListingVariant
          ? 'lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]'
          : 'lg:grid-cols-[270px_minmax(0,1fr)_320px]'

  const accent = {
    pageBg: isListingVariant ? 'bg-[#F7F8FC]' : 'bg-[#f7f8fa]',
    btn: isListingVariant ? 'bg-brand hover:bg-brand-700' : 'bg-primary-600 hover:bg-primary-700',
    btnShadow: isListingVariant ? 'shadow-sm shadow-brand/20' : '',
    link: isListingVariant ? 'hover:text-brand' : 'hover:text-primary-700',
    activeCategory: isListingVariant ? 'bg-brand-50 text-brand' : 'bg-primary-50 text-primary-800',
    badge: isListingVariant ? 'bg-brand' : 'bg-primary-600',
    border: isListingVariant ? 'border-[#E8EBF2]' : 'border-slate-200',
  }

  return (
    <div className={`${useFullViewport ? 'h-[100dvh]' : 'viewport-below-header'} overflow-hidden ${accent.pageBg}`}>
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
                <BrandLogo variant="light" className="h-8 w-auto" />
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

            <Link
              to="/post-ad"
              onClick={() => setMobileMenuOpen(false)}
              className={`mb-7 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition ${accent.btn} ${accent.btnShadow}`}
            >
              <Plus className="h-4 w-4" />
              Post Your Ad
            </Link>

            <div className="mb-8">
              <Link
                to="/categories"
                onClick={() => setMobileMenuOpen(false)}
                className={`mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition ${accent.link}`}
              >
                Categories
              </Link>
              <SidebarCategoryList
                categories={rootCategories}
                activeId={activeCategoryId}
                onSelect={(category) => {
                  handleCategoryNav(category)
                  setMobileMenuOpen(false)
                }}
              />
            </div>

            <div className="mb-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quick Links</p>
              <div className="space-y-1">
                {quickLinks.map(({ label, to, icon: Icon, badge }) => (
                  <Link
                    key={label}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="flex-1">{label}</span>
                    {badge != null ? (
                      <span className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white ${accent.badge}`}>
                        {Math.min(badge, 99)}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </>
      )}

      <div
        className={`grid h-full min-h-0 grid-cols-1 transition-[grid-template-columns] duration-300 ease-in-out ${
          useFullViewport ? 'grid-rows-[auto_minmax(0,1fr)]' : ''
        } ${
          showRightFilters || showDefaultRightPanel ? gridColsClass : isListingVariant ? 'lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]' : ''
        }`}
      >
        {useFullViewport ? (
          <>
            <div className={MARKETPLACE_LOGO_CELL}>
              <MarketplaceLogoBlock />
            </div>
            <MarketplaceTopBar
              onToggleMobileMenu={() => setMobileMenuOpen(true)}
              topBarColSpan={showRightFilters || showDefaultRightPanel ? 'lg:col-span-2' : 'lg:col-span-1'}
            />
          </>
        ) : null}

        <aside className={`hidden min-h-0 flex-col overflow-y-auto border-r bg-white p-5 lg:flex ${accent.border}`}>
          {!useFullViewport ? (
            <MarketplaceLogoBlock compact className="mb-5" />
          ) : null}

          <Link
            to="/post-ad"
            className={`mb-7 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition ${accent.btn} ${accent.btnShadow}`}
          >
            <Plus className="h-4 w-4" />
            Post Your Ad
          </Link>

          <div className="mb-8">
            <Link
              to="/categories"
              className={`mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition ${accent.link}`}
            >
              Categories
            </Link>
            <SidebarCategoryList
              categories={rootCategories}
              activeId={activeCategoryId}
              onSelect={handleCategoryNav}
            />
          </div>

          <div className="mb-8">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quick Links</p>
            <div className="space-y-1">
              {quickLinks.map(({ label, to, icon: Icon, badge }) => (
                <Link
                  key={label}
                  to={to}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="flex-1">{label}</span>
                  {badge != null ? (
                    <span className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white ${accent.badge}`}>
                      {Math.min(badge, 99)}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Popular Categories
            </p>
            <div className="space-y-3">
              {popularLabels.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(label)}`)}
                  className={`block text-left text-sm text-slate-600 transition ${accent.link}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!useFullViewport ? (
            <div className={`flex shrink-0 items-center gap-2 overflow-x-auto border-b bg-white px-3 py-2 lg:hidden ${accent.border}`}>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
              >
                <Menu className="h-4 w-4" />
                Menu
              </button>
              <Link
                to="/post-ad"
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white ${accent.btn}`}
              >
                <Plus className="h-4 w-4" />
                Post Ad
              </Link>
              <Link
                to="/categories"
                className="inline-flex shrink-0 items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Categories
              </Link>
              <Link
                to={isAuthenticated ? '/chat' : '/login'}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
              >
                <MessageCircle className="h-4 w-4" />
                Chat
              </Link>
            </div>
          ) : null}
          {children}
        </section>

        <aside
          className={`${
            showRightFilters
              ? 'hidden min-h-0 overflow-hidden border-l border-slate-200 bg-white p-0 lg:block'
              : showDefaultRightPanel
                ? 'hidden min-h-0 overflow-y-auto border-l border-slate-200 bg-white p-5 lg:block'
                : 'hidden'
          }`}
        >
          {showRightFilters ? (
            filterPanel
          ) : showDefaultRightPanel ? (
            <>
              {showTrending ? (
                <div>
                  <p className="mb-4 text-base font-semibold text-slate-900">Trending</p>
                  <div className="flex flex-wrap gap-2">
                    {TRENDING_TOPICS.map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => navigate(`/search?q=${encodeURIComponent(topic)}`)}
                        className={`rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-[#E8EBF2] transition ${
                          isListingVariant ? 'hover:text-brand' : 'hover:text-primary-700'
                        }`}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

          <div className={showTrending ? 'mt-8' : ''}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-slate-900">Featured Listings</p>
              <Link
                to="/reels"
                className={`text-sm font-semibold transition ${
                  isListingVariant ? 'text-brand hover:text-brand-700' : 'text-primary-700 hover:text-primary-800'
                }`}
              >
                See all
              </Link>
            </div>
            <div className="space-y-3">
              {featuredItems.map((product) => (
                <Link
                  key={product._id}
                  to={`/products/${product._id}`}
                  className="block overflow-hidden rounded-xl border border-[#E8EBF2] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="h-32 overflow-hidden">
                    <ListingMedia product={product} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3.5">
                    <p className="text-sm font-semibold leading-snug text-slate-900">{truncate(product.title || 'Listing', 42)}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {[buildSpecsLine(product), product.location].filter(Boolean).join(' · ') ||
                        product.category?.name ||
                        'Live on marketplace'}
                    </p>
                    <p
                      className={`mt-2.5 text-base font-bold ${
                        isListingVariant ? 'text-brand' : 'text-primary-700'
                      }`}
                    >
                      {formatListingPrice(product)}
                    </p>
                  </div>
                </Link>
              ))}
              {featuredItems.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  Featured listings will appear here.
                </div>
              )}
            </div>
          </div>

          {showMobileAppPromo ? <MobileAppPromoCard className="mt-6" /> : null}

          {showMessages && isAuthenticated ? (
            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-slate-900">Messages</p>
                <Link to="/chat" className="text-sm font-semibold text-primary-700 transition hover:text-primary-800">
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {recentChats.length > 0 ? (
                  recentChats.map((chat) => {
                    const isBuyer = String(chat.buyer?.id || chat.buyer?._id) === String(user?._id)
                    const other = chat.type === 'support' ? null : isBuyer ? chat.seller : chat.buyer
                    const unread = isBuyer ? chat.unreadForBuyer || 0 : chat.unreadForSeller || 0
                    const avatarSrc = other?.avatar ? getMediaUrl(other.avatar) || other.avatar : null
                    return (
                      <Link
                        key={chat.id || chat._id}
                        to={`/chat/${chat.id || chat._id}`}
                        className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-primary-200"
                      >
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt={other?.name || 'User'}
                            className="h-11 w-11 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                            <MessageCircle className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {chat.type === 'support' ? 'Support team' : other?.name || 'Conversation'}
                            </p>
                            <span className="shrink-0 text-[11px] font-medium text-slate-400">
                              {formatTimeAgo(chat.updatedAt || chat.lastMessageAt)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-slate-500">{chat.lastMessage || 'No messages yet'}</p>
                        </div>
                        {unread > 0 ? (
                          <span className="inline-flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
                            {Math.min(unread, 99)}
                          </span>
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                        )}
                      </Link>
                    )
                  })
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-900">No recent conversations</p>
                    <p className="mt-1 text-sm text-slate-500">Start a chat from any product page.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
            </>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

export default CategoryBrowseLayout
