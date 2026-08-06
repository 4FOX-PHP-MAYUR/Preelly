import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { userService } from '@shared/services/api'
import { User, ArrowLeft } from 'lucide-react'
import { VERIFIED_BADGE_IMAGES } from '@shared/utils/verifiedBadge'
import toast from 'react-hot-toast'
import { refreshUser, selectIsAuthenticated, selectUser } from '@shared/store/slices/authSlice'
import { useRequireAuth } from '@shared/hooks/useRequireAuth'
import { getMediaUrl, isUserVerified } from '@shared/utils/helpers'
import SettingsPageShell from '../components/Dashboard/SettingsPageShell'

function FollowersFollowingPage() {
  const { id, type } = useParams() // type is 'followers' or 'following'
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const currentUser = useSelector(selectUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const requireAuth = useRequireAuth()
  const [users, setUsers] = useState([])
  const [profileUser, setProfileUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [followingMap, setFollowingMap] = useState({}) // Track who current user is following

  const normalizeId = (value) => String(value?._id || value || '')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [profileRes, usersRes] = await Promise.all([
          userService.getUserProfile(id),
          type === 'followers' ? userService.getFollowers(id) : userService.getFollowing(id),
        ])
        setProfileUser(profileRes.data)
        const list = type === 'followers' ? usersRes.data.followers || [] : usersRes.data.following || []
        setUsers(list)

        // The followers/following endpoints already tell us, per user, whether the
        // current requester is following them (isFollowing), so just build the map
        // from that instead of relying on a nonexistent `following` array on the profile.
        if (isAuthenticated && currentUser?._id) {
          const followingMapObj = {}
          list.forEach((user) => {
            const userId = normalizeId(user)
            if (userId) followingMapObj[userId] = Boolean(user.isFollowing)
          })
          setFollowingMap(followingMapObj)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load list')
        navigate(`/user/${id}`)
      } finally {
        setLoading(false)
      }
    }

    if (id && (type === 'followers' || type === 'following')) {
      fetchData()
    } else {
      navigate(`/user/${id}`)
    }
  }, [id, type, navigate, isAuthenticated, currentUser?._id])

  const handleFollow = async (targetUserId) => {
    if (!requireAuth('Please login to follow users')) return

    try {
      const normalizedTargetId = normalizeId(targetUserId)
      const res = await userService.followUser(targetUserId)
      setFollowingMap((prev) => ({
        ...prev,
        [normalizedTargetId]: res.data.following,
      }))
      if (type === 'following' && String(currentUser?._id) === String(id) && !res.data.following) {
        setUsers((prev) => prev.filter((item) => String(item?._id) !== normalizedTargetId))
      }
      dispatch(refreshUser())
      toast.success(res.data.following ? 'Following user' : 'Unfollowed user')
    } catch (error) {
      toast.error('Failed to follow user')
    }
  }

  const title = type === 'followers' ? 'Followers' : 'Following'
  const emptyMessage =
    type === 'followers'
      ? 'This user has no followers yet.'
      : 'This user is not following anyone yet.'
  const isEmpty = !loading && users.length === 0

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-3xl pb-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {profileUser?.name ? `${profileUser.name}'s ${title}` : title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {users.length} {users.length === 1 ? 'person' : 'people'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/user/${id}`)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </button>
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading {title.toLowerCase()}…</span>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <User className="h-10 w-10 text-slate-300" aria-hidden />
            <p className="mt-6 text-base font-bold text-slate-900">No {title.toLowerCase()} yet</p>
            <p className="mt-2 max-w-sm text-sm text-slate-500">{emptyMessage}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100" aria-live="polite">
            {users.map((user) => {
              const isFollowing = followingMap[user._id] || false
              const isCurrentUser = currentUser?._id === user._id
              const avatarSrc = user.avatar ? getMediaUrl(user.avatar) || user.avatar : null

              return (
                <li
                  key={user._id}
                  className="flex items-center gap-3 py-3.5 cursor-pointer"
                  onClick={() => navigate(`/user/${user._id}`)}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-slate-400" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                      {isUserVerified(user) ? (
                        <img
                          src={VERIFIED_BADGE_IMAGES.small}
                          alt="Verified"
                          className="h-4 w-4 shrink-0"
                          title="Verified Account"
                        />
                      ) : null}
                    </div>
                    {user.email ? <p className="truncate text-xs text-slate-500">{user.email}</p> : null}
                    {user.rating > 0 ? (
                      <p className="mt-0.5 text-xs text-amber-600">⭐ {user.rating.toFixed(1)}</p>
                    ) : null}
                  </div>

                  {!isCurrentUser && isAuthenticated ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleFollow(user._id)
                      }}
                      className={`shrink-0 rounded-md px-5 py-2 text-sm font-semibold transition ${
                        isFollowing
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-brand text-white hover:bg-brand-700'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  ) : null}
                  {isCurrentUser ? <span className="shrink-0 px-2 text-sm text-slate-400">You</span> : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </SettingsPageShell>
  )
}

export default FollowersFollowingPage
