import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, User } from 'lucide-react'
import { userService } from '../../services/api'
import { getMediaUrl } from '../../utils/helpers'
import { VERIFIED_BADGE_IMAGES } from '../../utils/verifiedBadge'
import toast from 'react-hot-toast'

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
  const sz = size === 'sm' ? 'h-10 w-10 text-base' : 'h-12 w-12 text-lg'
  if (user?.avatar) {
    return (
      <img
        src={getMediaUrl(user.avatar)}
        alt={user.name}
        className={`${sz} rounded-full object-cover shrink-0`}
      />
    )
  }
  return (
    <div className={`${sz} rounded-full bg-violet-100 flex items-center justify-center shrink-0`}>
      <User className="h-5 w-5 text-violet-500" />
    </div>
  )
}

// ── Follow request row ────────────────────────────────────────────────────────
function RequestRow({ request, onAccept, onDelete }) {
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
    <div className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-0">
      <button onClick={() => navigate(`/user/${request.user._id}`)} className="shrink-0">
        <Avatar user={request.user} />
      </button>

      <div className="flex-1 min-w-0">
        <button
          onClick={() => navigate(`/user/${request.user._id}`)}
          className="flex items-center gap-1.5 text-left"
        >
          <span className="text-sm font-bold text-gray-900 hover:underline">
            {request.user.name}
          </span>
          {request.user.isVerified && (
            <img src={VERIFIED_BADGE_IMAGES.small} alt="Verified" className="h-4 w-4" />
          )}
        </button>
        <p className="text-xs text-gray-500 mt-0.5">requested to follow you</p>
        <p className="text-xs text-gray-400 mt-0.5">{timeAgo(request.requestedAt)}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => handle('accept')}
          disabled={!!loading}
          className="px-5 py-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1.5"
        >
          {loading === 'accept' ? (
            <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Accept
        </button>
        <button
          onClick={() => handle('delete')}
          disabled={!!loading}
          className="px-5 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-semibold transition disabled:opacity-60"
        >
          {loading === 'delete' ? (
            <span className="h-3.5 w-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
          ) : (
            'Delete'
          )}
        </button>
      </div>
    </div>
  )
}

// ── Suggested user row ────────────────────────────────────────────────────────
function SuggestedRow({ user, onDismiss }) {
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
    <div className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-0">
      <button onClick={() => navigate(`/user/${user._id}`)} className="shrink-0">
        <Avatar user={user} size="sm" />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 leading-snug">
          <button
            onClick={() => navigate(`/user/${user._id}`)}
            className="font-bold text-gray-900 hover:underline mr-1"
          >
            {user.name}
          </button>
          {user.isVerified && (
            <img src={VERIFIED_BADGE_IMAGES.small} alt="Verified" className="h-3.5 w-3.5 inline mb-0.5 mr-1" />
          )}
          requested to follow you
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleFollow}
          disabled={!!loading || followed}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition disabled:opacity-60 ${
            followed
              ? 'bg-gray-200 text-gray-600'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          }`}
        >
          {loading === 'follow' ? (
            <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
          ) : followed ? (
            'Requested'
          ) : (
            'Follow'
          )}
        </button>
        <button
          onClick={handleDismiss}
          disabled={loading === 'dismiss'}
          className="h-8 w-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition"
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <button onClick={() => navigate('/dashboard/notifications')} className="hover:text-violet-600 transition-colors">
          Notifications
        </button>
        <span>›</span>
        <span className="text-violet-600 font-medium">Follow Requests</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Follow Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage who can connect and follow your profile</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors mt-1"
        >
          <ArrowLeft className="h-4 w-4" />
          BACK TO HOME
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-4 animate-pulse">
              <div className="h-12 w-12 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-20 rounded-full bg-gray-200" />
                <div className="h-9 w-16 rounded-full bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Follow requests section */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 pt-5 pb-1">
              <h2 className="text-base font-bold text-gray-900">
                Follow request
                {requests.length > 0 && (
                  <span className="ml-2 text-xs font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                    {requests.length}
                  </span>
                )}
              </h2>
            </div>

            {requests.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <User className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No pending requests</p>
                <p className="text-xs text-gray-400 mt-1">When someone requests to follow you, it'll appear here.</p>
              </div>
            ) : (
              <div className="px-6">
                {requests.map((req) => (
                  <RequestRow
                    key={req._id}
                    request={req}
                    onAccept={handleAccept}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Suggested for you section */}
          {suggested.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 pt-5 pb-1">
                <h2 className="text-base font-bold text-gray-900">Suggested for you</h2>
              </div>
              <div className="px-6">
                {suggested.map((u) => (
                  <SuggestedRow key={u._id} user={u} onDismiss={handleDismiss} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
