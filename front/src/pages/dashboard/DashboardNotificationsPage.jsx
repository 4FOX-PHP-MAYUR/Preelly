import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, UserPlus, ShoppingBag, CheckCircle, Bell, ArrowLeft, ChevronRight, Reply, Check, X } from 'lucide-react'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'
import { userService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import { assetUrl } from '@shared/utils/constants'
import { emitNotificationUnreadChanged } from '@shared/utils/notificationBadge'
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

/**
 * Stand-in avatar for actors with no profile picture (or a broken one).
 * Resolved through SITE_URL (VITE_SITE_URL in .env) so it loads from the app's
 * own origin rather than a bare root-relative path.
 */
const DEFAULT_AVATAR = assetUrl('images/default-avatar.svg')

function avatarSrc(actor) {
  return (actor?.avatar && getMediaUrl(actor.avatar)) || DEFAULT_AVATAR
}

function onAvatarError(e) {
  if (e.currentTarget.src === DEFAULT_AVATAR) return
  e.currentTarget.src = DEFAULT_AVATAR
}

/** Filter chips over the notification tabs. */
const TAB_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'buying', label: 'Buying' },
  { key: 'selling', label: 'Selling' },
]

// ── Avatar with type badge ────────────────────────────────────────────────────
function NotifAvatar({ notification }) {
  const cfg = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system
  const Icon = cfg.icon
  const actor = notification.actor

  // System / listing notifications — show icon circle instead of avatar
  if (!actor || notification.type === 'listing' || notification.type === 'system') {
    return (
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    )
  }

  return (
    <div className="relative shrink-0">
      <img
        src={avatarSrc(actor)}
        onError={onAvatarError}
        alt={actor.name || 'User'}
        className="h-12 w-12 rounded-full bg-slate-100 object-cover"
      />
      {/* type badge */}
      <span className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${cfg.bg}`}>
        <Icon className="h-2.5 w-2.5 text-white" />
      </span>
    </div>
  )
}

// ── Single notification card ──────────────────────────────────────────────────
function NotificationCard({ notification, onRead, onRemove }) {
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
      className={`flex cursor-pointer items-center gap-3 rounded-[16px] border p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition duration-200 hover:border-brand/20 sm:gap-4 sm:p-4 ${
        notification.isRead ? 'border-[#E5E7EB] bg-white' : 'border-brand/20 bg-brand-50/40'
      }`}
    >
      <NotifAvatar notification={notification} />

      {/* text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm leading-snug text-slate-700">
            {notification.actor && (
              <span className="font-bold text-slate-900">{notification.actor.name} </span>
            )}
            {notification.body || notification.title}
          </p>
          {!notification.isRead && !isFollowRequest && (
            <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand">
              New
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-[11px] text-slate-400">{timeAgo(notification.createdAt)}</span>
          {notification.type === 'comment' && (
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] text-slate-400 transition duration-200 hover:text-brand"
            >
              <Reply className="h-3 w-3" /> Reply
            </button>
          )}
        </div>

        {/* Accept / Reject buttons for follow requests */}
        {isFollowRequest && notification.actor && (
          <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleAccept}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-brand/25 transition duration-200 hover:bg-brand-700 disabled:opacity-60"
            >
              {actionLoading === 'accept' ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Accept
            </button>
            <button
              onClick={handleReject}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-[#E5E7EB] transition duration-200 hover:text-brand hover:ring-brand/30 disabled:opacity-60"
            >
              {actionLoading === 'reject' ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
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
        <div className="ml-2 h-14 w-14 shrink-0 overflow-hidden rounded-[12px] bg-slate-100">
          {product.video ? (
            <video
              src={getMediaUrl(product.video)}
              className="h-full w-full object-cover"
              muted
              playsInline
            />
          ) : product.images?.[0] ? (
            <img
              src={getMediaUrl(product.images[0])}
              alt={product.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
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
    emitNotificationUnreadChanged()
  }

  const handleRemove = (id) => {
    setItems((prev) => prev.filter((n) => n._id !== id))
    emitNotificationUnreadChanged()
  }

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
    await userService.markAllNotificationsRead().catch(() => {})
    emitNotificationUnreadChanged()
  }

  const followNotifications = items.filter((n) => n.type === 'follow_request' && !n.isRead)
  const grouped = groupByDay(items)
  const totalUnread = items.filter((n) => !n.isRead).length

  const subtitle = useMemo(() => {
    if (loading) return 'Loading your latest activity…'
    if (!items.length) return 'Your activity and alerts appear here'
    if (totalUnread) return `${totalUnread} unread notification${totalUnread === 1 ? '' : 's'}`
    return `${items.length} notification${items.length === 1 ? '' : 's'} · you're all caught up`
  }, [loading, items.length, totalUnread])

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-3xl pb-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Notifications</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {totalUnread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </button>
          </div>
        </div>

        {/* Follow requests banner */}
        {followNotifications.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/dashboard/notifications/follow-requests')}
            className="mb-4 flex w-full items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition duration-200 hover:border-brand/20 sm:gap-4 sm:p-4"
          >
            <div className="flex -space-x-2">
              {followNotifications.slice(0, 3).map((n) => (
                <img
                  key={n._id}
                  src={avatarSrc(n.actor)}
                  onError={onAvatarError}
                  alt={n.actor?.name || 'User'}
                  className="h-9 w-9 rounded-full border-2 border-white bg-slate-100 object-cover"
                />
              ))}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-bold text-slate-900">Follow requests</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {followNotifications[0]?.actor?.name}
                {followNotifications.length > 1 && ` + ${followNotifications.length - 1} others`}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
          </button>
        )}

        {/* Tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          {TAB_FILTERS.map((tab) => {
            const badge = tab.key === 'buying' ? buyingUnread : tab.key === 'selling' ? sellingUnread : 0
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative rounded-full px-3.5 py-2 text-sm font-medium transition duration-200 ${
                  activeTab === tab.key
                    ? 'bg-brand text-white shadow-sm shadow-brand/25'
                    : 'bg-white text-slate-600 ring-1 ring-[#E5E7EB] hover:text-brand hover:ring-brand/30'
                }`}
              >
                {tab.label}
                {badge > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {error ? (
          <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[16px] bg-slate-100" />
            ))
          ) : items.length ? (
            grouped.map(([label, notifs]) => (
              <div key={label} className="space-y-3">
                <p className="pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {label}
                </p>
                {notifs.map((n) => (
                  <NotificationCard
                    key={n._id}
                    notification={n}
                    onRead={handleRead}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            ))
          ) : (
            <div className="rounded-[16px] border border-dashed border-[#E5E7EB] px-4 py-12 text-center">
              <Bell className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {activeTab === 'all' ? 'No notifications yet' : 'No notifications in this tab'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {activeTab === 'all'
                  ? 'Activity like likes, comments and follows will appear here.'
                  : 'Try another tab to see more of your activity.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </SettingsPageShell>
  )
}
