import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  BadgeCheck,
  FilePlus,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Star,
  User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { userService, productService, chatService } from '@shared/services/api'
import { isValidObjectId, getMediaUrl, isIdentityVerified } from '@shared/utils/helpers'
import { VERIFIED_BADGE_IMAGES } from '@shared/utils/verifiedBadge'
import { refreshUser, selectIsAuthenticated, selectIsAdmin, selectUser } from '@shared/store/slices/authSlice'
import VerificationFlow, { OtpVerificationCard } from '@shared/components/VerificationFlow'
import IdentityVerificationFlow, { IdentityVerificationCard } from '@shared/components/IdentityVerificationFlow'
import CategoryBrowseLayout from '@shared/components/CategoryBrowseLayout'
import ListingVideoPreview from '@shared/components/Video/ListingVideoPreview'
import ProfileReelsViewer from '@shared/components/Profile/ProfileReelsViewer'
import { productHasVideo } from '@shared/utils/videoHelpers'

function formatCompact(n) {
  const num = Number(n || 0)
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(num)
}

function ProfileProductThumb({ product, onClick }) {
  const currency = product?.currency?.toUpperCase() || 'AED'
  const price = Number(product?.price || 0)

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group aspect-square overflow-hidden rounded-xl bg-gray-100 text-left"
    >
      <ListingVideoPreview
        product={product}
        className="h-full w-full object-cover transition group-hover:scale-105"
        alt={product.title}
        interactive={false}
        autoPlayOnHover
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-2.5">
        <p className="line-clamp-2 text-[11px] font-medium leading-tight text-white">{product.title}</p>
      </div>
      <div className="pointer-events-none absolute bottom-2 right-2 rounded-lg bg-black/55 px-2 py-1">
        <p className="text-xs font-bold text-white">
          {currency} {price.toLocaleString()}
        </p>
      </div>
    </button>
  )
}

function UserProfilePage({ adminMode = false, renderAdminPanel = null }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const currentUser = useSelector(selectUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const isAdmin = useSelector(selectIsAdmin)
  const [profileUser, setProfileUser] = useState(null)
  const [products, setProducts] = useState([])
  const [followStatus, setFollowStatus] = useState('none')
  const [loading, setLoading] = useState(true)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [showOtpVerification, setShowOtpVerification] = useState(false)
  const [showIdentityVerification, setShowIdentityVerification] = useState(false)
  const [activeReelsIndex, setActiveReelsIndex] = useState(null)
  const [stats, setStats] = useState({ totalProducts: 0, totalViews: 0, totalLikes: 0 })

  const profileUserId = id
  const currentUserId = currentUser?._id
  const isOwnProfile = Boolean(
    currentUserId && profileUserId && String(currentUserId) === String(profileUserId),
  )
  const isAdminUserDetail = adminMode || (isAdmin && location.pathname.startsWith('/admin/users/') && !isOwnProfile)

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true)
        const [userRes, followersRes, followingRes, productsRes] = await Promise.all([
          userService.getUserProfile(id),
          userService.getFollowers(id),
          userService.getFollowing(id),
          productService.getProducts({ userId: id, limit: 100 }),
        ])
        setProfileUser(userRes.data)
        setFollowersCount(followersRes.data.count || 0)
        setFollowingCount(followingRes.data.count || 0)
        setProducts(productsRes.data.products || [])

        const apiStats = userRes.data?.stats
        if (apiStats) {
          setStats(apiStats)
        } else {
          const list = productsRes.data.products || []
          setStats({
            totalProducts: list.length,
            totalViews: list.reduce((sum, p) => sum + (p.views || 0), 0),
            totalLikes: list.reduce((sum, p) => sum + (p.likes?.length || 0), 0),
          })
        }

        if (isAuthenticated && currentUserId && String(currentUserId) !== String(profileUserId)) {
          try {
            const statusRes = await userService.getFollowStatus(id)
            setFollowStatus(statusRes.data.status || 'none')
          } catch {
            setFollowStatus('none')
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
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
      setProfileUser(null)
    }
  }, [profileUserId, isAuthenticated, currentUserId, navigate])

  const handleFollow = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to follow users')
      navigate('/login')
      return
    }

    try {
      const res = await userService.followUser(id)
      const newStatus = res.data.status || 'none'
      setFollowStatus(newStatus)
      if (typeof res.data.followerCount === 'number') {
        setFollowersCount(res.data.followerCount)
      }
      if (newStatus === 'pending') {
        toast.success(`Follow request sent to ${profileUser?.displayName || profileUser?.name || 'user'}`)
      } else if (newStatus === 'none') {
        toast.success(
          followStatus === 'pending'
            ? 'Follow request cancelled'
            : `Unfollowed ${profileUser?.displayName || profileUser?.name || 'user'}`,
        )
      }
    } catch (error) {
      if (error?.response?.status === 403) {
        toast.error('You cannot follow this user')
      } else {
        toast.error('Failed to send follow request')
      }
    }
  }

  const handleMessage = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to send messages')
      navigate('/login')
      return
    }
    if (isOwnProfile) {
      navigate('/chat')
      return
    }
    try {
      const chatRes = await chatService.getChats()
      const chats = chatRes?.data?.chats || chatRes?.data || []
      const existing = chats.find((c) => {
        const buyerId = c.buyer?._id || c.buyer?.id
        const sellerId = c.seller?._id || c.seller?.id
        const otherId = String(buyerId) === String(currentUser._id) ? sellerId : buyerId
        return String(otherId) === String(id)
      })
      if (existing) {
        navigate(`/chat/${existing._id || existing.id}`)
        return
      }
      if (products.length > 0) {
        const res = await chatService.createOrGetChat(products[0]._id, id)
        navigate(`/chat/${res.data.chat._id}`)
        return
      }
      navigate('/chat')
    } catch {
      toast.error('Could not open chat')
    }
  }

  const refreshProfileUser = async () => {
    try {
      const userRes = await userService.getUserProfile(id)
      setProfileUser(userRes.data)
    } catch {
      /* ignore */
    }
  }

  const featuredProducts = useMemo(
    () => products.filter((p) => p.status === 'active' || !p.status).slice(0, 3),
    [products],
  )

  const videoProducts = useMemo(() => products.filter(productHasVideo), [products])

  const displayProducts = useMemo(
    () => [
      ...products.filter(productHasVideo),
      ...products.filter((p) => !productHasVideo(p)),
    ],
    [products],
  )

  if (loading) {
    const skeleton = (
      <div className="space-y-4 animate-pulse">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mx-auto h-24 w-24 rounded-full bg-gray-200" />
          <div className="mx-auto mt-4 h-5 w-40 rounded bg-gray-200" />
          <div className="mx-auto mt-2 h-4 w-28 rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-gray-200" />
          ))}
        </div>
      </div>
    )

    if (isAdminUserDetail) {
      return <div className="max-w-7xl mx-auto px-4 py-8">{skeleton}</div>
    }

    return (
      <CategoryBrowseLayout featuredProducts={[]}>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{skeleton}</div>
      </CategoryBrowseLayout>
    )
  }

  if (!profileUser) {
    const notFound = (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">User not found</h2>
        <p className="text-gray-600">The user you&apos;re looking for doesn&apos;t exist.</p>
      </div>
    )

    if (isAdminUserDetail) {
      return <div className="max-w-7xl mx-auto px-4 py-8">{notFound}</div>
    }

    return (
      <CategoryBrowseLayout featuredProducts={[]}>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{notFound}</div>
      </CategoryBrowseLayout>
    )
  }

  const avatarSrc = profileUser.avatar ? getMediaUrl(profileUser.avatar) || profileUser.avatar : null
  const displayName = profileUser.displayName || profileUser.name || 'User'
  const rating = Number(profileUser.rating || 0).toFixed(1)
  const hasRating = Number(profileUser.rating || 0) > 0
  const bio = profileUser.bio || profileUser.description || ''
  const verified = isIdentityVerified(profileUser) || profileUser.isVerified

  const profileBody = (
    <div className="mx-auto w-full min-w-0 space-y-4">
      {/* Profile card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-4 ring-primary-100">
              {avatarSrc ? (
                <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-gray-400" />
              )}
            </div>
            {verified && (
              <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-primary-600">
                <BadgeCheck className="h-3.5 w-3.5 text-white" />
              </span>
            )}
          </div>

          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">{displayName}</h1>
            {verified && (
              isIdentityVerified(profileUser) ? (
                <img src={VERIFIED_BADGE_IMAGES.large} alt="Verified" className="h-5 w-5" title="Identity Verified" />
              ) : (
                <BadgeCheck className="h-5 w-5 text-primary-600" />
              )
            )}
          </div>

          {hasRating && (
            <div className="mb-3 flex items-center gap-1 text-sm text-amber-500">
              <Star className="h-4 w-4 fill-amber-400 stroke-amber-500" />
              <span className="font-semibold">{rating}</span>
              <span className="text-gray-400">| rating</span>
            </div>
          )}

          <div className="mb-4 flex w-full items-center justify-center divide-x divide-gray-200">
            <div className="px-5 text-center">
              <p className="text-lg font-bold text-gray-900">{formatCompact(stats.totalProducts)}</p>
              <p className="text-xs text-gray-500">ads Posted</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/user/${id}/followers`)}
              className="px-5 text-center transition hover:opacity-80"
            >
              <p className="text-lg font-bold text-gray-900">{formatCompact(followersCount)}</p>
              <p className="text-xs text-gray-500">Followers</p>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/user/${id}/following`)}
              className="px-5 text-center transition hover:opacity-80"
            >
              <p className="text-lg font-bold text-gray-900">{formatCompact(followingCount)}</p>
              <p className="text-xs text-gray-500">Following</p>
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            {isOwnProfile ? (
              <>
                <Link
                  to="/dashboard/settings"
                  className="flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 sm:px-5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Profile
                </Link>
                <button
                  type="button"
                  onClick={() => navigate('/chat')}
                  className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:px-5"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Messages
                </button>
              </>
            ) : (
              <>
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={handleFollow}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                      followStatus === 'active'
                        ? 'border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : followStatus === 'pending'
                          ? 'border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {followStatus === 'active' ? 'Following' : followStatus === 'pending' ? 'Requested' : 'Follow'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleMessage}
                  className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:px-5"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Message
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => toast('More options coming soon')}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-50"
              aria-label="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {bio && (
            <p className="max-w-sm text-center text-sm leading-relaxed text-gray-600">{bio}</p>
          )}
        </div>
      </div>

      {isAdminUserDetail && renderAdminPanel?.({
          userId: id,
          userName: displayName,
          onStatusChange: refreshProfileUser,
        })}

      {isOwnProfile && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <OtpVerificationCard onOpenFlow={() => setShowOtpVerification(true)} />
          <IdentityVerificationCard onOpenFlow={() => setShowIdentityVerification(true)} />
        </div>
      )}

      {/* Listings & videos */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4">
        {displayProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <FilePlus className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">No posts yet</p>
            {isOwnProfile && (
              <Link to="/post-ad" className="mt-3 text-sm font-medium text-primary-600 hover:underline">
                Post your first ad
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {videoProducts.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">
                  Videos
                  <span className="ml-1.5 font-normal text-gray-500">({videoProducts.length})</span>
                </h2>
                <p className="text-xs text-gray-500">Tap to open in reels</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {displayProducts.map((product, idx) => (
                <ProfileProductThumb
                  key={product._id}
                  product={product}
                  onClick={() => setActiveReelsIndex(idx)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {isAdminUserDetail ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{profileBody}</div>
      ) : (
        <CategoryBrowseLayout featuredProducts={featuredProducts}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">{profileBody}</div>
          </div>
        </CategoryBrowseLayout>
      )}

      {showOtpVerification && (
        <VerificationFlow
          onClose={() => {
            setShowOtpVerification(false)
            dispatch(refreshUser()).catch(() => {})
          }}
        />
      )}
      {showIdentityVerification && (
        <IdentityVerificationFlow
          onClose={() => {
            setShowIdentityVerification(false)
            refreshProfileUser()
          }}
        />
      )}

      {activeReelsIndex !== null && (
        <ProfileReelsViewer
          products={displayProducts}
          initialIndex={activeReelsIndex}
          profileUser={profileUser}
          onClose={() => setActiveReelsIndex(null)}
        />
      )}
    </>
  )
}

export default UserProfilePage
