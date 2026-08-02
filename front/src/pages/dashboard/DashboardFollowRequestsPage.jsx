import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, User, X } from 'lucide-react'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'
import { userService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import { assetUrl } from '@shared/utils/constants'
import { VERIFIED_BADGE_IMAGES } from '@shared/utils/verifiedBadge'
import toast from 'react-hot-toast'

/** Stand-in avatar, resolved through SITE_URL (VITE_SITE_URL in .env). */
const DEFAULT_AVATAR = assetUrl('images/default-avatar.svg')

function avatarSrc(user) {
  return (user?.avatar && getMediaUrl(user.avatar)) || DEFAULT_AVATAR
}

function onAvatarError(e) {
  if (e.currentTarget.src === DEFAULT_AVATAR) return
  e.currentTarget.src = DEFAULT_AVATAR
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Avatar({ user, size = 'md' }) {
  const sz = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'
  return (
    <img
      src={avatarSrc(user)}
      onError={onAvatarError}
      alt={user?.name || 'User'}
      className={`${sz} shrink-0 rounded-full bg-slate-100 object-cover`}
    />
  )
}

/** Shared card chrome — same shape as the order cards. */
const CARD_CLASS =
  'flex items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition duration-200 hover:border-brand/20 sm:gap-4 sm:p-4'

const PRIMARY_BTN =
  'flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand/25 transition duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

const SECONDARY_BTN =
  'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-[#E5E7EB] transition duration-200 hover:text-brand hover:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60'

// ── Follow request card ───────────────────────────────────────────────────────
function RequestCard({ request, onAccept, onDelete }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null) // 'accept' | 'delete'

  const handle = async (action) => {
    setLoading(action)
    try {
      if (action === 'accept') {
        await userService.acceptFollowRequest(request.user._id)
        toast.success(`You are now followed by ${request.user.name}`)
        onAccept(request._id)
      } else {
        await userService.rejectFollowRequest(request.user._id)
        toast.success('Follow request deleted')
        onDelete(request._id)
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className={CARD_CLASS}>
      <button type="button" onClick={() => navigate(`/user/${request.user._id}`)} className="shrink-0">
        <Avatar user={request.user} />
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => navigate(`/user/${request.user._id}`)}
          className="flex max-w-full items-center gap-1.5 text-left"
        >
          <span className="truncate text-sm font-bold text-slate-900 hover:underline sm:text-base">
            {request.user.name}
          </span>
          {request.user.isVerified && (
            <img src={VERIFIED_BADGE_IMAGES.small} alt="Verified" className="h-4 w-4 shrink-0" />
          )}
        </button>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">requested to follow you</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(request.requestedAt)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => handle('accept')} disabled={!!loading} className={PRIMARY_BTN}>
          {loading === 'accept' ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Accept
        </button>
        <button type="button" onClick={() => handle('delete')} disabled={!!loading} className={SECONDARY_BTN}>
          {loading === 'delete' ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
          ) : (
            'Delete'
          )}
        </button>
      </div>
    </div>
  )
}

// ── Suggested user card ───────────────────────────────────────────────────────
function SuggestedCard({ user, onDismiss }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null) // 'follow' | 'dismiss'
  const [followed, setFollowed] = useState(false)

  const handleFollow = async () => {
    if (followed) return
    setLoading('follow')
    try {
      await userService.followUser(user._id)
      setFollowed(true)
      toast.success(`Follow request sent to ${user.name}`)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send request')
    } finally {
      setLoading(null)
    }
  }

  const handleDismiss = async () => {
    setLoading('dismiss')
    onDismiss(user._id)
  }

  return (
    <div className={CARD_CLASS}>
      <button type="button" onClick={() => navigate(`/user/${user._id}`)} className="shrink-0">
        <Avatar user={user} size="sm" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-slate-700">
          <button
            type="button"
            onClick={() => navigate(`/user/${user._id}`)}
            className="mr-1 font-bold text-slate-900 hover:underline"
          >
            {user.name}
          </button>
          {user.isVerified && (
            <img src={VERIFIED_BADGE_IMAGES.small} alt="Verified" className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
          )}
          requested to follow you
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleFollow}
          disabled={!!loading || followed}
          className={followed ? SECONDARY_BTN : PRIMARY_BTN}
        >
          {loading === 'follow' ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : followed ? (
            'Requested'
          ) : (
            'Follow'
          )}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={loading === 'dismiss'}
          aria-label="Dismiss suggestion"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 ring-1 ring-[#E5E7EB] transition duration-200 hover:text-brand hover:ring-brand/30"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardFollowRequestsPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [suggested, setSuggested] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reqRes, sugRes] = await Promise.all([
        userService.getFollowRequests(),
        userService.getSuggestedUsers(10),
      ])
      setRequests(reqRes.data.requests || [])
      setSuggested(sugRes.data.suggested || [])
    } catch {
      // silent — show empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAccept = (recordId) => setRequests((p) => p.filter((r) => r._id !== recordId))
  const handleDelete = (recordId) => setRequests((p) => p.filter((r) => r._id !== recordId))
  const handleDismiss = (userId) => setSuggested((p) => p.filter((u) => u._id !== userId))

  const subtitle = useMemo(() => {
    if (loading) return 'Loading your follow requests…'
    if (!requests.length) return 'Manage who can connect and follow your profile'
    return `${requests.length} pending request${requests.length === 1 ? '' : 's'}`
  }, [loading, requests.length])

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-3xl pb-10">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-400 sm:text-sm">
          <button
            type="button"
            onClick={() => navigate('/dashboard/notifications')}
            className="transition duration-200 hover:text-brand"
          >
            Notifications
          </button>
          <span>›</span>
          <span className="font-semibold text-slate-600">Follow Requests</span>
        </div>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Manage Follow Requests</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[16px] bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Follow requests section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Follow request
                </p>
                {requests.length > 0 && (
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand">
                    {requests.length}
                  </span>
                )}
              </div>

              {requests.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[#E5E7EB] px-4 py-12 text-center">
                  <User className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">No pending requests</p>
                  <p className="mt-1 text-xs text-slate-400">
                    When someone requests to follow you, it&apos;ll appear here.
                  </p>
                </div>
              ) : (
                requests.map((req) => (
                  <RequestCard
                    key={req._id}
                    request={req}
                    onAccept={handleAccept}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>

            {/* Suggested for you section */}
            {suggested.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Suggested for you
                </p>
                {suggested.map((u) => (
                  <SuggestedCard key={u._id} user={u} onDismiss={handleDismiss} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SettingsPageShell>
  )
}
