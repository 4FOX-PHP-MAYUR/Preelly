import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, UserPlus, ShoppingBag, CheckCircle, Bell, ArrowLeft, ChevronRight, Reply, Check, X } from 'lucide-react'
import { userService } from '../../services/api'
import { getMediaUrl } from '../../utils/helpers'
import toast from 'react-hot-toast'

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dayLabel(dateStr) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function groupByDay(items) {
  const map = new Map()
  items.forEach((item) => {
    const label = dayLabel(item.createdAt)
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(item)
  })
  return Array.from(map.entries()) // [[label, items], ...]
}

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  like:           { icon: Heart,        bg: 'bg-red-500'    },
  comment:        { icon: MessageCircle,bg: 'bg-blue-500'   },
  follow:         { icon: UserPlus,     bg: 'bg-violet-500' },
  follow_request: { icon: UserPlus,     bg: 'bg-violet-500' },
  message:        { icon: MessageCircle,bg: 'bg-green-500'  },
  order:          { icon: ShoppingBag,  bg: 'bg-orange-500' },
  listing:        { icon: CheckCircle,  bg: 'bg-emerald-500'},
  system:         { icon: Bell,         bg: 'bg-gray-400'   },
}

// ── Avatar with type badge ────────────────────────────────────────────────────
function NotifAvatar({ notification }) {
  const cfg = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system
  const Icon = cfg.icon
  const actor = notification.actor

  // System / listing notifications — show icon circle instead of avatar
  if (!actor || notification.type === 'listing' || notification.type === 'system') {
    return (
      <div className={`h-12 w-12 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    )
  }

  return (
    <div className="relative shrink-0">
      {actor.avatar ? (
        <img
          src={getMediaUrl(actor.avatar)}
          alt={actor.name}
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg">
          {actor.name?.[0]?.toUpperCase() || '?'}
        </div>
      )}
      {/* type badge */}
      <span className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full ${cfg.bg} flex items-center justify-center border-2 border-white`}>
        <Icon className="h-2.5 w-2.5 text-white" />
      </span>
    </div>
  )
}

// ── Single notification row ───────────────────────────────────────────────────
function NotifRow({ notification, onRead, onRemove }) {
  const navigate = useNavigate()
  const product = notification.relatedProduct
  const [actionLoading, setActionLoading] = useState(null) // 'accept' | 'reject'

  const handleClick = () => {
    if (!notification.isRead) onRead(notification._id)
    if ((notification.type === 'follow' || notification.type === 'follow_request') && notification.actor) {
      navigate(`/user/${notification.actor._id}`)
    } else if (product) {
      navigate(`/products/${product._id}`)
    } else if (notification.type === 'message') {
      const chatId = notification.data?.chatId
      navigate(chatId ? `/chat/${chatId}` : '/chat')
    }
  }

  const handleAccept = async (e) => {
    e.stopPropagation()
    setActionLoading('accept')
    try {
      await userService.acceptFollowRequest(notification.actor._id)
      toast.success(`You are now followed by ${notification.actor.name}`)
      onRemove(notification._id)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to accept request')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (e) => {
    e.stopPropagation()
    setActionLoading('reject')
    try {
      await userService.rejectFollowRequest(notification.actor._id)
      toast.success('Follow request declined')
      onRemove(notification._id)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reject request')
    } finally {
      setActionLoading(null)
    }
  }

  const isFollowRequest = notification.type === 'follow_request'

  return (
    <div
      onClick={handleClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
        !notification.isRead ? 'bg-violet-50/40' : ''
      }`}
    >
      <NotifAvatar notification={notification} />

      {/* text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 leading-snug">
          {notification.actor && (
            <span className="font-semibold">{notification.actor.name} </span>
          )}
          {notification.body || notification.title}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-gray-400">{timeAgo(notification.createdAt)}</span>
          {notification.type === 'comment' && (
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 transition-colors"
            >
              <Reply className="h-3 w-3" /> Reply
            </button>
          )}
        </div>

        {/* Accept / Reject buttons for follow requests */}
        {isFollowRequest && notification.actor && (
          <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleAccept}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-full transition disabled:opacity-60"
            >
              {actionLoading === 'accept' ? (
                <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Accept
            </button>
            <button
              onClick={handleReject}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-full transition disabled:opacity-60"
            >
              {actionLoading === 'reject' ? (
                <span className="h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
              Decline
            </button>
          </div>
        )}
      </div>

      {/* product thumbnail */}
      {product && (
        <div className="shrink-0 ml-2">
          {product.video ? (
            <video
              src={getMediaUrl(product.video)}
              className="h-14 w-14 rounded-xl object-cover"
              muted
              playsInline
            />
          ) : product.images?.[0] ? (
            <img
              src={getMediaUrl(product.images[0])}
              alt={product.title}
              className="h-14 w-14 rounded-xl object-cover"
            />
          ) : null}
        </div>
      )}

      {!notification.isRead && !isFollowRequest && (
        <div className="h-2.5 w-2.5 rounded-full bg-violet-500 shrink-0" />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardNotificationsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [buyingUnread, setBuyingUnread] = useState(0)
  const [sellingUnread, setSellingUnread] = useState(0)
  const [activeTab, setActiveTab] = useState('all')
  const [error, setError] = useState(null)

  const fetchNotifications = useCallback(async (tab = 'all') => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: 100 }
      if (tab !== 'all') params.tab = tab
      const res = await userService.getNotifications(params)
      setItems(res.data.items || [])
      setBuyingUnread(res.data.buyingUnread || 0)
      setSellingUnread(res.data.sellingUnread || 0)
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications(activeTab)
  }, [activeTab, fetchNotifications])

  const handleRead = async (id) => {
    setItems((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n))
    await userService.markNotificationRead(id).catch(() => {})
  }

  const handleRemove = (id) => {
    setItems((prev) => prev.filter((n) => n._id !== id))
  }

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
    await userService.markAllNotificationsRead().catch(() => {})
  }

  const followNotifications = items.filter((n) => n.type === 'follow_request' && !n.isRead)
  const grouped = groupByDay(items)
  const totalUnread = items.filter((n) => !n.isRead).length

  return (
    <div className="max-w-2xl mx-auto space-y-0">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-violet-600 mt-0.5">Stay updated with your latest activity and alerts</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {totalUnread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-violet-600 hover:underline"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">BACK TO HOME</span>
            <span className="sm:hidden">Home</span>
          </button>
        </div>
      </div>

      {/* Follow requests banner */}
      {followNotifications.length > 0 && (
        <button
          onClick={() => navigate('/dashboard/notifications/follow-requests')}
          className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex -space-x-2">
            {followNotifications.slice(0, 3).map((n) =>
              n.actor?.avatar ? (
                <img
                  key={n._id}
                  src={getMediaUrl(n.actor.avatar)}
                  alt={n.actor.name}
                  className="h-9 w-9 rounded-full object-cover border-2 border-white"
                />
              ) : (
                <div
                  key={n._id}
                  className="h-9 w-9 rounded-full bg-violet-200 border-2 border-white flex items-center justify-center text-violet-700 font-bold text-sm"
                >
                  {n.actor?.name?.[0]?.toUpperCase() || '?'}
                </div>
              )
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-gray-900">Follow requests</p>
            <p className="text-xs text-gray-500">
              {followNotifications[0]?.actor?.name}
              {followNotifications.length > 1 && ` + ${followNotifications.length - 1} others`}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: 'All', badge: 0 },
          { key: 'buying', label: 'Buying', badge: buyingUnread },
          { key: 'selling', label: 'Selling', badge: sellingUnread },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-300'
            }`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-6 text-center text-sm text-red-600">{error}</div>
        ) : loading ? (
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="h-14 w-14 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-gray-800">No notifications yet</p>
            <p className="text-sm text-gray-500 mt-1">Activity like likes, comments and follows will appear here.</p>
          </div>
        ) : (
          <div>
            {grouped.map(([label, notifs]) => (
              <div key={label}>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {notifs.map((n) => (
                    <NotifRow
                      key={n._id}
                      notification={n}
                      onRead={handleRead}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
