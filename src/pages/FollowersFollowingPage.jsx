import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { userService } from '../services/api'
import { User, ArrowLeft, Users, UserPlus } from 'lucide-react'
import { VERIFIED_BADGE_IMAGES } from '../utils/verifiedBadge'
import toast from 'react-hot-toast'
import { refreshUser, selectIsAuthenticated, selectUser } from '../store/slices/authSlice'
import { getMediaUrl } from '../utils/helpers'
import { isUserVerified } from '../utils/helpers'

function FollowersFollowingPage() {
  const { id, type } = useParams() // type is 'followers' or 'following'
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const currentUser = useSelector(selectUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
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
        setUsers(type === 'followers' ? usersRes.data.followers || [] : usersRes.data.following || [])

        // If current user is authenticated, check which users they're following
        if (isAuthenticated && currentUser?._id) {
          const localFollowing = Array.isArray(currentUser.following) ? currentUser.following : []
          const optimisticMap = {}
          localFollowing.forEach((followedUser) => {
            const followedId = normalizeId(followedUser)
            if (followedId) optimisticMap[followedId] = true
          })
          setFollowingMap(optimisticMap)

          const currentUserProfile = await userService.getCurrentUserProfile()
          const followingIds = (currentUserProfile.data.following || []).map((u) => normalizeId(u))
          const followingMapObj = {}
          followingIds.filter(Boolean).forEach((userId) => {
            followingMapObj[userId] = true
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
    if (!isAuthenticated) {
      toast.error('Please login to follow users')
      navigate('/login')
      return
    }

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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded-lg mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const isOwnProfile = currentUser?._id === id
  const title = type === 'followers' ? 'Followers' : 'Following'
  const emptyMessage =
    type === 'followers'
      ? 'This user has no followers yet.'
      : 'This user is not following anyone yet.'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/user/${id}`)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Profile
        </button>
        <div className="flex items-center space-x-3">
          {type === 'followers' ? (
            <Users className="h-8 w-8 text-primary-600" />
          ) : (
            <UserPlus className="h-8 w-8 text-primary-600" />
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {profileUser?.name}'s {title}
            </h1>
            <p className="text-gray-600 mt-1">
              {users.length} {users.length === 1 ? 'person' : 'people'}
            </p>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow-md">
        {users.length === 0 ? (
          <div className="p-12 text-center">
            <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No {title.toLowerCase()} yet
            </h3>
            <p className="text-gray-600">{emptyMessage}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {users.map((user) => {
              const isFollowing = followingMap[user._id] || false
              const isCurrentUser = currentUser?._id === user._id

              return (
                <div
                  key={user._id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/user/${user._id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      {/* Avatar */}
                      {user.avatar ? (
                        <img
                          src={getMediaUrl(user.avatar) || user.avatar}
                          alt={user.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary-600" />
                        </div>
                      )}

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {user.name}
                          </h3>
                          {isUserVerified(user) && (
                            <img
                              src={VERIFIED_BADGE_IMAGES.small}
                              alt="Verified"
                              className="h-4 w-4"
                              title="Verified Account"
                            />
                          )}
                        </div>
                        {user.email && (
                          <p className="text-sm text-gray-600 truncate">
                            {user.email}
                          </p>
                        )}
                        {user.rating > 0 && (
                          <p className="text-sm text-yellow-600">
                            ⭐ {user.rating.toFixed(1)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Follow Button */}
                    {!isCurrentUser && isAuthenticated && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleFollow(user._id)
                        }}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                          isFollowing
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                    {isCurrentUser && (
                      <span className="px-4 py-2 text-gray-500 text-sm">
                        You
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default FollowersFollowingPage

