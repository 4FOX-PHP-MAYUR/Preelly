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
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import { selectIsAuthenticated, selectUser } from '@shared/store/slices/authSlice'
import { getMediaUrl, truncate } from '@shared/utils/helpers'
import { useChat } from '@shared/components/Chat/ChatContext'
import {
  buildSpecsLine,
  CategoryBadge,
  formatCategoryCount,
  formatCompactCount,
  formatListingPrice,
  formatTimeAgo,
  isVehicleCategoryName,
  ListingMedia,
} from './categoryBrowseShared'

const TRENDING_TOPICS = ['Luxury Cars', 'Sports Cars', 'SUVs', 'Classic Cars', 'Dubai Marina', 'New Listings']

function CategoryBrowseLayout({
  children,
  activeCategoryId = null,
  featuredProducts = [],
  showMessages = true,
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
    if (isVehicleCategoryName(category.name)) {
      navigate(`/categories/${category._id}/products`)
      return
    }
    navigate(`/categories/${category._id}`)
  }

  const popularLabels =
    activeCategoryId && rootCategories.find((c) => c._id === activeCategoryId)
      ? ['Luxury Cars', 'Sports Cars', 'SUVs', 'Classic Cars']
      : rootCategories.slice(0, 4).map((c) => c.name)

  return (
    <div className="viewport-below-header overflow-hidden bg-[#f7f8fa]">
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
              className="mb-7 flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              Post Your Ad
            </Link>

            <div className="mb-8">
              <Link
                to="/categories"
                onClick={() => setMobileMenuOpen(false)}
                className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:text-primary-700"
              >
                Categories
              </Link>
              <div className="space-y-1">
                {rootCategories.slice(0, 7).map((category) => {
                  const isActive = String(category._id) === String(activeCategoryId)
                  return (
                    <button
                      key={category._id}
                      type="button"
                      onClick={() => {
                        handleCategoryNav(category)
                        setMobileMenuOpen(false)
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        isActive ? 'bg-primary-50 text-primary-800' : 'hover:bg-slate-50'
                      }`}
                    >
                      <CategoryBadge category={category} compact />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{category.name}</span>
                    </button>
                  )
                })}
              </div>
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
                      <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
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

      <div className="flex h-full flex-col lg:grid lg:grid-cols-[270px_minmax(0,1fr)_320px]">
        <aside className="hidden min-h-0 flex-col overflow-y-auto border-r border-slate-200 bg-white p-5 lg:flex">
          <div className="mb-5">
            <Link to="/">
              <BrandLogo variant="light" className="h-8 w-auto" />
            </Link>
            <p className="mt-1.5 text-[13px] font-medium text-slate-500">Buy. Sell. Watch.</p>
          </div>

          <Link
            to="/post-ad"
            className="mb-7 flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Post Your Ad
          </Link>

          <div className="mb-8">
            <Link
              to="/categories"
              className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:text-primary-700"
            >
              Categories
            </Link>
            <div className="space-y-1">
              {rootCategories.slice(0, 7).map((category) => {
                const isActive = String(category._id) === String(activeCategoryId)
                return (
                  <button
                    key={category._id}
                    type="button"
                    onClick={() => handleCategoryNav(category)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isActive ? 'bg-primary-50 text-primary-800' : 'hover:bg-slate-50'
                    }`}
                  >
                    <CategoryBadge category={category} compact />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{category.name}</span>
                    <span className="text-xs font-medium text-slate-400">
                      {formatCategoryCount(category.count) || formatCompactCount(category.count)}
                    </span>
                  </button>
                )
              })}
            </div>
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
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
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
                  className="block text-left text-sm text-slate-600 transition hover:text-primary-700"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
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
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white"
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
          {children}
        </section>

        <aside className="hidden min-h-0 overflow-y-auto border-l border-slate-200 bg-white p-5 lg:block">
          <div>
            <p className="mb-4 text-lg font-semibold text-slate-900">Trending</p>
            <div className="flex flex-wrap gap-2">
              {TRENDING_TOPICS.map((topic) => (
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
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-slate-900">Featured Listings</p>
              <Link to="/reels" className="text-sm font-semibold text-primary-700 transition hover:text-primary-800">
                See all
              </Link>
            </div>
            <div className="space-y-4">
              {featuredItems.map((product) => (
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
                      {[buildSpecsLine(product), product.location].filter(Boolean).join(' · ') ||
                        product.category?.name ||
                        'Live on marketplace'}
                    </p>
                    <p className="mt-3 text-lg font-bold text-primary-700">{formatListingPrice(product)}</p>
                  </div>
                </Link>
              ))}
              {featuredItems.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  Featured listings will appear here.
                </div>
              )}
            </div>
          </div>

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
        </aside>
      </div>
    </div>
  )
}

export default CategoryBrowseLayout
