import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  BadgeCheck,
  Bookmark,
  ChevronRight,
  Grid3X3,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Star,
  User,
  UserPlus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { userService, chatService } from '@shared/services/api'
import { refreshUser } from '@shared/store/slices/authSlice'
import { getMediaUrl, formatPrice } from '@shared/utils/helpers'
import VideoPreview from '@shared/components/Video/VideoPreview'

function formatCompact(n) {
  const num = Number(n || 0)
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(num)
}

function ProductThumb({ product, onClick }) {
  const img = product?.images?.[0] ? getMediaUrl(product.images[0]) || product.images[0] : null
  const vid = product?.video ? getMediaUrl(product.video) || product.video : null
  const currency = product?.currency?.toUpperCase() || 'AED'
  const price = Number(product?.price || 0)

  return (
    <button
      onClick={onClick}
      className="relative group aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-900 text-left"
    >
      {img ? (
        <img src={img} alt={product.title} className="h-full w-full object-cover transition group-hover:scale-105" />
      ) : product?.video || product?.videoStream?.hlsUrl ? (
        <VideoPreview product={product} className="h-full w-full object-cover" autoPlay={false} />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-primary-100 to-slate-200" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="truncate text-[11px] text-white/90 leading-tight">{product.title}</p>
        <p className="text-xs font-semibold text-white">{currency} {price.toLocaleString()}</p>
      </div>
    </button>
  )
}

function ChatRow({ chat, currentUserId }) {
  const navigate = useNavigate()
  const other = chat?.buyer?._id === currentUserId ? chat?.seller : (chat?.seller?._id === currentUserId ? chat?.buyer : chat?.user)
  const avatarSrc = other?.avatar ? getMediaUrl(other.avatar) || other.avatar : null
  const name = other?.displayName || other?.name || 'User'
  const preview = chat?.lastMessageText || chat?.product?.title || ''
  const unread = chat?.unreadCount || 0
  const time = chat?.lastMessageAt
    ? (() => {
        const diff = Math.floor((Date.now() - new Date(chat.lastMessageAt).getTime()) / 60000)
        if (diff < 60) return `${diff}m`
        if (diff < 1440) return `${Math.floor(diff / 60)}h`
        return `${Math.floor(diff / 1440)}d`
      })()
    : ''

  return (
    <button
      onClick={() => navigate(`/chat/${chat._id}`)}
      className="flex items-center gap-3 w-full px-0 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-900 rounded-xl transition text-left"
    >
      {avatarSrc ? (
        <img src={avatarSrc} alt={name} className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-primary-600" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{name}</p>
          <span className="text-[11px] text-gray-400 flex-shrink-0 ml-1">{time}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{preview}</p>
      </div>
      {unread > 0 && (
        <span className="flex-shrink-0 h-5 min-w-5 px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}

const TABS = [
  { id: 'listings', icon: Grid3X3, label: 'Listings' },
  { id: 'saved', icon: Bookmark, label: 'Saved' },
  { id: 'liked', icon: Heart, label: 'Liked' },
]

const TRENDING = ['iPhone 15 Pro', 'Mercedes C Class', 'Toyota 86', '2 People Sofa', 'Gaming PC Corsair']

export default function DashboardOverviewPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((s) => s.auth.user)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [chats, setChats] = useState([])
  const [activeTab, setActiveTab] = useState('listings')
  const [savedItems, setSavedItems] = useState(null)
  const [likedItems, setLikedItems] = useState(null)
  const [tabLoading, setTabLoading] = useState(false)
  const [showVerification, setShowVerification] = useState(false)

  useEffect(() => {
    dispatch(refreshUser()).catch(() => {})
  }, [dispatch])

  const parseItems = (res) => {
    const d = res?.data
    if (Array.isArray(d)) return d
    if (Array.isArray(d?.items)) return d.items
    if (Array.isArray(d?.products)) return d.products
    return []
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const fetchAll = async () => {
      try {
        const [dashRes, chatRes, savedRes, likedRes] = await Promise.all([
          userService.getDashboard(),
          chatService.getChats().catch(() => ({ data: [] })),
          userService.getSavedProducts().catch((e) => { console.error('[saved] fetch error:', e); return { data: [] } }),
          userService.getLikedProducts().catch((e) => { console.error('[liked] fetch error:', e); return { data: [] } }),
        ])
        if (cancelled) return

        const dash = dashRes.data
        console.log('[dashboard] data:', dash)

        const savedList = parseItems(savedRes)
        const likedList = parseItems(likedRes)
        console.log('[saved] items:', savedList.length, savedList)
        console.log('[liked] items:', likedList.length, likedList)

        setData(dash)
        setSavedItems(savedList)
        setLikedItems(likedList)

        const rawChats = chatRes?.data?.chats || chatRes?.data || []
        setChats(Array.isArray(rawChats) ? rawChats.slice(0, 5) : [])
      } catch (e) {
        console.error('[overview] load error:', e)
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (tab === 'saved') {
      setTabLoading(true)
      userService.getSavedProducts()
        .then((res) => setSavedItems(parseItems(res)))
        .catch((e) => console.error('[saved] refresh error:', e))
        .finally(() => setTabLoading(false))
    }
    if (tab === 'liked') {
      setTabLoading(true)
      userService.getLikedProducts()
        .then((res) => setLikedItems(parseItems(res)))
        .catch((e) => console.error('[liked] refresh error:', e))
        .finally(() => setTabLoading(false))
    }
  }

  const stats = useMemo(() => {
    const s = data?.stats || {}
    return {
      total: Number(s.totalProducts || 0),
      active: Number(s.activeProducts || 0),
    }
  }, [data])

  const products = data?.products || []
  const tabItems = activeTab === 'saved'
    ? (savedItems ?? [])
    : activeTab === 'liked'
      ? (likedItems ?? [])
      : products
  const featuredListings = products.filter((p) => p.status === 'active').slice(0, 2)

  const avatarSrc = user?.avatar ? getMediaUrl(user.avatar) || user.avatar : null
  const displayName = user?.displayName || user?.name || 'User'
  const followersCount = Array.isArray(user?.followers) ? user.followers.length : (user?.followersCount || 0)
  const followingCount = Array.isArray(user?.following) ? user.following.length : (user?.followingCount || 0)
  const rating = Number(user?.rating?.average || user?.averageRating || 0).toFixed(1)
  const ratingCount = Number(user?.rating?.count || user?.ratingCount || 0)
  const bio = user?.bio || user?.description || ''

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
      {/* ── Center column ── */}
      <div className="min-w-0 space-y-4">
        {/* Profile card */}
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-900 p-6">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="relative mb-3">
              <div className="h-24 w-24 rounded-full ring-4 ring-primary-100 overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-gray-400" />
                )}
              </div>
              {user?.isVerified && (
                <span className="absolute bottom-1 right-1 h-6 w-6 rounded-full bg-primary-600 border-2 border-white flex items-center justify-center">
                  <BadgeCheck className="h-3.5 w-3.5 text-white" />
                </span>
              )}
            </div>

            {/* Name + rating */}
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{displayName}</h2>
              {user?.isVerified && <BadgeCheck className="h-5 w-5 text-primary-600" />}
            </div>
            {ratingCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-amber-500 mb-3">
                <Star className="h-4 w-4 fill-amber-400 stroke-amber-500" />
                <span className="font-semibold">{rating}</span>
                <span className="text-gray-400 dark:text-gray-500">| {ratingCount} rating{ratingCount !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center divide-x divide-gray-200 dark:divide-gray-800 mb-4 w-full justify-center">
              <div className="px-5 text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCompact(stats.total)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">ads Posted</p>
              </div>
              <div className="px-5 text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCompact(followersCount)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Followers</p>
              </div>
              <div className="px-5 text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCompact(followingCount)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Following</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <Link
                to="/dashboard/settings"
                className="flex items-center gap-1.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white px-4 sm:px-5 py-2 text-sm font-semibold transition"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Profile
              </Link>
              <button
                onClick={() => navigate('/chat')}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 px-4 sm:px-5 py-2 text-sm font-semibold transition"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Messages
              </button>
              <button
                onClick={() => toast('More options coming soon')}
                className="h-9 w-9 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            {/* Verification status */}
            {user?.isVerified ? (
              <span className="mb-3 flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified Account
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowVerification(true)}
                className="mb-3 flex items-center gap-2 px-4 py-2 rounded-full border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold transition"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Get Verified
              </button>
            )}

            {/* Bio */}
            {bio && (
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center max-w-xs leading-relaxed">{bio}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-900 overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-900">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition border-b-2 ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Product grid */}
          <div className="p-4">
            {loading || tabLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-gray-100 dark:bg-gray-900 animate-pulse" />
                ))}
              </div>
            ) : tabItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                {activeTab === 'saved' ? <Bookmark className="h-10 w-10 mb-3 opacity-30" /> : activeTab === 'liked' ? <Heart className="h-10 w-10 mb-3 opacity-30" /> : <Grid3X3 className="h-10 w-10 mb-3 opacity-30" />}
                <p className="text-sm">{activeTab === 'saved' ? 'No saved products yet' : activeTab === 'liked' ? 'No liked products yet' : 'No listings yet'}</p>
                {activeTab === 'listings' && (
                  <Link to="/post-ad" className="mt-3 text-sm text-primary-600 font-medium hover:underline">Post your first ad</Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {tabItems.map((product) => (
                  <ProductThumb
                    key={product._id}
                    product={product}
                    onClick={() => navigate(`/products/${product._id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right sidebar ── */}
      <div className="space-y-4">
        {/* Trending searches */}
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Trending</p>
          <div className="flex flex-wrap gap-2">
            {TRENDING.map((tag) => (
              <button
                key={tag}
                onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)}
                className="rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-primary-400 hover:text-primary-600 transition"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Featured listings */}
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Featured Listings</p>
            <Link to="/dashboard/listings" className="flex items-center gap-0.5 text-xs text-primary-600 font-medium hover:underline">
              See all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-900 animate-pulse" />)}
            </div>
          ) : featuredListings.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No active listings</p>
          ) : (
            <div className="space-y-3">
              {featuredListings.map((product) => {
                const img = product?.images?.[0] ? getMediaUrl(product.images[0]) || product.images[0] : null
                const currency = product?.currency?.toUpperCase() || 'AED'
                const price = Number(product?.price || 0)
                return (
                  <button
                    key={product._id}
                    onClick={() => navigate(`/products/${product._id}`)}
                    className="flex items-center gap-3 w-full text-left hover:bg-slate-50 dark:hover:bg-gray-900 rounded-xl p-1.5 transition"
                  >
                    <div className="h-16 w-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 flex-shrink-0">
                      {img ? (
                        <img src={img} alt={product.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-primary-100 to-slate-200" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{product.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{product.category?.name || ''}</p>
                      <p className="text-sm font-bold text-primary-600 mt-0.5">{currency} {price.toLocaleString()}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-900 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Messages</p>
            <Link to="/chat" className="text-xs text-primary-600 font-medium hover:underline">View all</Link>
          </div>
          {chats.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No recent messages</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-900">
              {chats.map((chat) => <ChatRow key={chat._id} chat={chat} currentUserId={user?._id} />)}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Verification flow modal */}
    {showVerification && (
      <VerificationFlow onClose={() => setShowVerification(false)} />
    )}
    </>
  )
}
