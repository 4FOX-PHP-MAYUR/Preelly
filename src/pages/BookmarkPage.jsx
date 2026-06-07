import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Bookmark, Briefcase, Building2, Car, ChevronRight,
  Heart, LayoutGrid, MessageCircle, Plus, Search,
  Settings, Shirt, Smartphone, Sofa, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import BrandLogo from '../components/BrandLogo'
import { fetchRootCategories } from '../store/slices/categorySlice'
import { selectIsAuthenticated, selectUser } from '../store/slices/authSlice'
import { interactionService, userService } from '../services/api'
import { formatPrice, getCategoryImageUrl, getMediaUrl, truncate } from '../utils/helpers'
import { useChat } from '../components/Chat/ChatContext'

// ── helpers ───────────────────────────────────────────────────────────────────
const categoryIconMap = [
  { pattern: /\b(motor|vehicle|car|auto)\b/i,                icon: Car },
  { pattern: /\b(property|real estate|villa|apartment|home)\b/i, icon: Building2 },
  { pattern: /\b(job|career|work)\b/i,                       icon: Briefcase },
  { pattern: /\b(fashion|clothing|accessories)\b/i,           icon: Shirt },
  { pattern: /\b(furniture|garden|home decor)\b/i,            icon: Sofa },
  { pattern: /\b(electronics|mobile|phone|laptop|gaming)\b/i, icon: Smartphone },
]
function getCategoryIcon(name) {
  return categoryIconMap.find(({ pattern }) => pattern.test(name || ''))?.icon ?? LayoutGrid
}

function formatCompactCount(value) {
  if (!value || Number(value) <= 0) return '0'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatCategoryCount(value) {
  const n = Number(value || 0)
  return n ? n.toLocaleString('en-US') : null
}

function formatListingPrice(product) {
  const amount = Number(product?.price || 0)
  const currency =
    typeof product?.currency === 'string' && product.currency.length === 3
      ? product.currency.toUpperCase()
      : 'AED'
  try { return formatPrice(amount, currency) }
  catch { return `${currency} ${amount.toLocaleString()}` }
}

function formatChatTime(value) {
  if (!value) return ''
  const diff = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (diff < 60)  return `${diff}m`
  if (diff < 1440) return `${Math.floor(diff / 60)}h`
  return `${Math.floor(diff / 1440)}d`
}

function ProductMedia({ product, className }) {
  const src = product?.images?.[0] ? getMediaUrl(product.images[0]) || product.images[0] : null
  return src
    ? <img src={src} alt={product?.title || ''} className={className} />
    : <div className={`${className} bg-gradient-to-br from-primary-100 to-slate-100`} />
}

// ── CategoryBadge (compact) ───────────────────────────────────────────────────
function CategoryBadge({ category }) {
  const Icon = getCategoryIcon(category?.name)
  const [imageFailed, setImageFailed] = useState(false)
  const imageSrc = getCategoryImageUrl(category)

  if (imageSrc && !imageFailed) {
    return (
      <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary-50">
        <img
          src={imageSrc}
          alt={category.name}
          className="h-7 w-7 w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      </div>
    )
  }
  if (category?.emoji) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-sm">
        {category.emoji}
      </div>
    )
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-primary-700">
      <Icon className="h-4 w-4" />
    </div>
  )
}

// ── LeftSidebar ───────────────────────────────────────────────────────────────
function LeftSidebar({ rootCategories, quickLinks }) {
  return (
    <aside className="hidden lg:flex min-h-0 flex-col overflow-y-auto border-r border-slate-200 bg-white p-5">
      {/* Logo */}
      <div className="mb-5">
        <Link to="/">
          <BrandLogo variant="light" className="h-8 w-auto" />
        </Link>
        <p className="mt-1.5 text-[13px] font-medium text-slate-500">Buy. Sell. Watch.</p>
      </div>

      {/* Post Your Ad */}
      <Link
        to="/post-ad-dynamic"
        className="flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 mb-7"
      >
        <Plus className="h-4 w-4" />
        Post Your Ad
      </Link>

      {/* Categories */}
      {rootCategories.length > 0 && (
        <div className="mb-8">
          <Link
            to="/categories"
            className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-3 transition hover:text-primary-700"
          >
            Categories
          </Link>
          <div className="space-y-1">
            {rootCategories.slice(0, 7).map((cat) => (
              <Link
                key={cat._id}
                to={`/categories/${cat._id}`}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
              >
                <CategoryBadge category={cat} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{cat.name}</span>
                <span className="text-xs font-medium text-slate-400">
                  {formatCategoryCount(cat.count) || formatCompactCount(cat.count)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-3">
          Quick Links
        </p>
        <div className="space-y-1">
          {quickLinks.map(({ label, to, icon: Icon, badge, active }) => (
            <Link
              key={label}
              to={to}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition hover:bg-slate-100 ${
                active ? 'bg-primary-50 text-primary-800' : 'text-slate-700'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary-600' : 'text-slate-500'}`} />
              <span className="flex-1">{label}</span>
              {badge != null && (
                <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
                  {Math.min(badge, 99)}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Popular Categories */}
      {rootCategories.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-3">
            Popular Categories
          </p>
          <div className="space-y-3">
            {rootCategories.slice(0, 4).map((cat) => (
              <Link
                key={`pop-${cat._id}`}
                to={`/search?q=${encodeURIComponent(cat.name)}`}
                className="block text-sm text-slate-600 transition hover:text-primary-700"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

// ── RightSidebar ──────────────────────────────────────────────────────────────
function RightSidebar({ trendingTopics, featuredItems, recentChats, user }) {
  const navigate = useNavigate()

  return (
    <aside className="hidden lg:block min-h-0 overflow-y-auto border-l border-slate-200 bg-white p-5">
      {/* Trending */}
      <div>
        <p className="text-lg font-semibold text-slate-900 mb-4">Trending</p>
        <div className="flex flex-wrap gap-2">
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
          {trendingTopics.length === 0 && (
            <p className="text-sm text-slate-400">No trending topics yet.</p>
          )}
        </div>
      </div>

      {/* Featured Listings */}
      <div className="mt-8">
        <div className="flex items-center justify-between gap-3 mb-4">
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
                <ProductMedia product={product} className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-slate-900">{truncate(product.title || 'Listing', 40)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {[product.location, product.category?.name].filter(Boolean).join(' · ') || 'Live on marketplace'}
                </p>
                <p className="mt-3 text-lg font-bold text-primary-700">{formatListingPrice(product)}</p>
              </div>
            </Link>
          ))}
          {featuredItems.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Save items to see featured listings here.
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="mt-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-lg font-semibold text-slate-900">Messages</p>
          <Link to="/chat" className="text-sm font-semibold text-primary-700 transition hover:text-primary-800">
            View all
          </Link>
        </div>
        <div className="space-y-3">
          {recentChats.length > 0 ? (
            recentChats.map((chat) => {
              const isBuyer = String(chat.buyer?.id || chat.buyer?._id) === String(user?._id)
              const other   = chat.type === 'support' ? null : isBuyer ? chat.seller : chat.buyer
              const unread  = isBuyer ? chat.unreadForBuyer || 0 : chat.unreadForSeller || 0
              const avatarSrc = other?.avatar ? getMediaUrl(other.avatar) || other.avatar : null
              return (
                <Link
                  key={chat.id || chat._id}
                  to={`/chat/${chat.id || chat._id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-primary-200"
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={other?.name || 'User'} className="h-11 w-11 rounded-full object-cover shrink-0" />
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
                      <span className="text-[11px] font-medium text-slate-400 shrink-0">
                        {formatChatTime(chat.updatedAt || chat.lastMessageAt)}
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
    </aside>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BookmarkPage() {
  const dispatch        = useDispatch()
  const navigate        = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user            = useSelector(selectUser)
  const { rootCategories } = useSelector((state) => state.categories)
  const { threads }     = useChat()

  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('All')
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    if (rootCategories.length === 0) dispatch(fetchRootCategories())
  }, [dispatch, rootCategories.length])

  const load = async () => {
    setLoading(true)
    try {
      const res = await userService.getWishlist()
      setItems(res.data.items || [])
    } catch {
      toast.error('Failed to load bookmarks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const remove = async (productId) => {
    try {
      await interactionService.saveProduct(productId)
      toast.success('Removed from bookmarks')
      setItems((prev) => prev.filter((p) => p._id !== productId))
    } catch {
      toast.error('Failed to remove')
    }
  }

  const categoryTabs = useMemo(() => {
    const names = [...new Set(items.map((p) => p.category?.name).filter(Boolean))]
    return ['All', ...names]
  }, [items])

  const filtered = useMemo(() => {
    let list = items
    if (activeTab !== 'All') list = list.filter((p) => p.category?.name === activeTab)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(q) ||
          (p.category?.name || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [items, activeTab, search])

  const trendingTopics = useMemo(
    () => rootCategories.slice(0, 5).map((c) => c.name).filter(Boolean),
    [rootCategories],
  )

  const featuredItems = useMemo(() => items.slice(0, 3), [items])

  const recentChats = useMemo(() => threads.slice(0, 4), [threads])

  const unreadCount = useMemo(
    () =>
      threads.reduce((sum, t) => {
        const isBuyer = String(t.buyer?.id || t.buyer?._id) === String(user?._id)
        return sum + (isBuyer ? t.unreadForBuyer || 0 : t.unreadForSeller || 0)
      }, 0),
    [threads, user?._id],
  )

  const quickLinks = [
    { label: 'My Bookmarks', to: '/bookmarks', icon: Bookmark, active: true },
    {
      label: 'Messages',
      to: '/chat',
      icon: MessageCircle,
      badge: unreadCount > 0 ? unreadCount : null,
    },
    { label: 'Settings', to: '/dashboard/settings', icon: Settings },
  ]

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please log in to view your bookmarks.</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 rounded-full bg-primary-600 text-white text-sm font-semibold"
          >
            Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="viewport-below-header overflow-hidden bg-[#f7f8fa]">
      <div className="h-full lg:grid lg:grid-cols-[270px_minmax(0,1fr)_320px]">

        {/* ── Left sidebar ── */}
        <LeftSidebar rootCategories={rootCategories} quickLinks={quickLinks} />

        {/* ── Center ── */}
        <section className="flex min-h-0 flex-col overflow-hidden">
          {/* Category tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-4 overflow-x-auto shrink-0">
            {categoryTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-4 py-4 text-sm font-semibold border-b-2 transition ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
            <div className="ml-auto shrink-0 pl-2 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bookmarks..."
                  className="h-9 w-44 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-3xl border border-slate-200 bg-white overflow-hidden animate-pulse">
                    <div className="h-44 bg-slate-100" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-slate-100 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                      <div className="h-5 bg-slate-100 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-20">
                <div className="h-16 w-16 rounded-full bg-primary-50 flex items-center justify-center mb-4">
                  <Heart className="h-8 w-8 text-primary-300" />
                </div>
                <p className="text-lg font-semibold text-slate-800">
                  {search || activeTab !== 'All' ? 'No results found' : 'Nothing saved yet'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {search || activeTab !== 'All'
                    ? 'Try a different filter or search term.'
                    : 'Tap the heart icon on products to save them here.'}
                </p>
                {!search && activeTab === 'All' && (
                  <Link
                    to="/reels"
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
                  >
                    Browse Products
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map((product) => (
                  <div
                    key={product._id}
                    className="group relative rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => remove(product._id)}
                      title="Remove bookmark"
                      className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-400 shadow backdrop-blur-sm transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <Link to={`/products/${product._id}`} className="block">
                      <div className="h-44 overflow-hidden bg-slate-100">
                        <ProductMedia
                          product={product}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      </div>
                      <div className="p-4">
                        <p className="text-sm font-semibold text-slate-900 truncate">{product.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[product.location, product.category?.name].filter(Boolean).join(' · ') ||
                            'Marketplace listing'}
                        </p>
                        <p className="mt-3 text-base font-bold text-primary-700">
                          {formatListingPrice(product)}
                        </p>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Right sidebar ── */}
        <RightSidebar
          trendingTopics={trendingTopics}
          featuredItems={featuredItems}
          recentChats={recentChats}
          user={user}
        />
      </div>
    </div>
  )
}
