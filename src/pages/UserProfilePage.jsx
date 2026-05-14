import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { userService, productService } from '../services/api'
import { isValidObjectId } from '../utils/helpers'
import { User, MapPin, Calendar, Package, Eye, Heart, Phone, Mail, Users, UserPlus } from 'lucide-react'
import { VERIFIED_BADGE_IMAGES } from '../utils/verifiedBadge'
import toast from 'react-hot-toast'
import { selectIsAuthenticated, selectUser } from '../store/slices/authSlice'
import { getMediaUrl, isUserVerified } from '../utils/helpers'

function UserProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUser = useSelector(selectUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const [profileUser, setProfileUser] = useState(null)
  const [products, setProducts] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalViews: 0,
    totalLikes: 0,
  })

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true)
        // Fetch user profile
        const userRes = await userService.getUserProfile(id)
        setProfileUser(userRes.data)
        
        // Fetch followers and following counts
        try {
          const followersRes = await userService.getFollowers(id)
          const followingRes = await userService.getFollowing(id)
          setFollowersCount(followersRes.data.count || 0)
          setFollowingCount(followingRes.data.count || 0)
        } catch (error) {
          console.error('Error fetching followers/following:', error)
        }
        
        // Fetch user's products
        const productsRes = await productService.getProducts({ userId: id, limit: 50 })
        setProducts(productsRes.data.products || [])
        
        // Calculate stats
        const totalViews = productsRes.data.products?.reduce((sum, p) => sum + (p.views || 0), 0) || 0
        const totalLikes = productsRes.data.products?.reduce((sum, p) => sum + (p.likes?.length || 0), 0) || 0
        setStats({
          totalProducts: productsRes.data.products?.length || 0,
          totalViews,
          totalLikes,
        })
        
        // Check if current user is following this user
        if (isAuthenticated && currentUser?._id && currentUser._id !== id) {
          try {
            const currentUserProfile = await userService.getCurrentUserProfile()
            const followingIds = (currentUserProfile.data.following || []).map((u) => u._id || u.toString())
            setIsFollowing(followingIds.includes(id))
          } catch (error) {
            console.error('Error checking follow status:', error)
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
        // Only redirect to home when the API explicitly says user not found (404).
        const status = error?.response?.status
        if (status === 404) {
          navigate('/')
        } else {
          toast.error('Failed to load user profile')
        }
      } finally {
        setLoading(false)
      }
    }

    if (id && isValidObjectId(id)) {
      fetchUserProfile()
    } else {
      setLoading(false)
      // invalid id - show not found
      setProfileUser(null)
    }
  }, [id, isAuthenticated, currentUser, navigate])

  const handleFollow = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to follow users')
      navigate('/login')
      return
    }

    try {
      const res = await userService.followUser(id)
      setIsFollowing(res.data.following)
      setFollowersCount(res.data.followerCount || followersCount)
      toast.success(
        res.data.following
          ? `Following ${profileUser?.name || 'user'}`
          : `Unfollowed ${profileUser?.name || 'user'}`
      )
    } catch (error) {
      toast.error('Failed to follow user')
    }
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  if (!profileUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">User not found</h2>
        <p className="text-gray-600">The user you're looking for doesn't exist.</p>
      </div>
    )
  }

  const isOwnProfile = currentUser?._id === id

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {profileUser.avatar ? (
              <img
                src={getMediaUrl(profileUser.avatar) || profileUser.avatar}
                alt={profileUser.name}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center">
                <User className="h-12 w-12 text-primary-600" />
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-2">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                {profileUser.name}
                {isUserVerified(profileUser) ? (
                  <img 
                    src={VERIFIED_BADGE_IMAGES.large} 
                    alt="Verified" 
                    className="h-6 w-6"
                    title="Verified Account"
                  />
                ) : null}
              </h1>
              {!isOwnProfile && isAuthenticated && (
                <button
                  onClick={handleFollow}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isFollowing
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              {profileUser.email && (
                <div className="flex items-center space-x-1">
                  <Mail className="h-4 w-4" />
                  <span>{profileUser.email}</span>
                </div>
              )}
              {profileUser.phone && (
                <div className="flex items-center space-x-1">
                  <Phone className="h-4 w-4" />
                  <span>{profileUser.phone}</span>
                </div>
              )}
              {profileUser.memberSince && (
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>Member since {new Date(profileUser.memberSince).getFullYear()}</span>
                </div>
              )}
            </div>

            {profileUser.rating > 0 && (
              <div className="mt-2">
                <span className="text-yellow-500">⭐ {profileUser.rating.toFixed(1)}</span>
              </div>
            )}

            {/* Followers/Following Counts */}
            <div className="flex items-center space-x-4 mt-4">
              <button
                onClick={() => navigate(`/user/${id}/followers`)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer border border-gray-200"
              >
                <Users className="h-5 w-5 text-primary-600" />
                <span className="font-bold text-gray-900">{followersCount}</span>
                <span className="text-gray-600">Followers</span>
              </button>
              <button
                onClick={() => navigate(`/user/${id}/following`)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer border border-gray-200"
              >
                <UserPlus className="h-5 w-5 text-primary-600" />
                <span className="font-bold text-gray-900">{followingCount}</span>
                <span className="text-gray-600">Following</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Products</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
            <Package className="h-12 w-12 text-primary-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Views</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalViews}</p>
            </div>
            <Eye className="h-12 w-12 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Likes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalLikes}</p>
            </div>
            <Heart className="h-12 w-12 text-red-600" />
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Products</h2>
        </div>
        {products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products yet</h3>
            <p className="text-gray-600">This user hasn't posted any products.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {products.map((product) => (
              <div
                key={product._id}
                onClick={() => navigate(`/products/${product._id}`)}
                className="bg-gray-50 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              >
                {product.video ? (
                  <video
                    src={getMediaUrl(product.video)}
                    className="w-full h-48 object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={getMediaUrl(product.images?.[0]) || '/placeholder.jpg'}
                    alt={product.title}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                    {product.title}
                  </h3>
                  <p className="text-primary-600 font-bold text-lg mb-2">
                    {formatPrice(product.price)}
                  </p>
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{product.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserProfilePage

