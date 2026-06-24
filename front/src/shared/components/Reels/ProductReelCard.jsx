import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin,
  Heart,
  MessageCircle,
  MessageSquare,
  Bookmark,
  MoreVertical,
  User,
  Eye,
  Volume2,
  VolumeX,
  Flag,
  Copy,
  Send,
  ExternalLink,
  Play,
  Pause,
  Maximize2,
  UserPlus,
  Plus,
} from 'lucide-react'
import { buildSpecsLine } from '@shared/components/categoryBrowseShared'
import { VERIFIED_BADGE_IMAGES } from '@shared/utils/verifiedBadge'
// Use native <video> for precise sizing/control
import toast from 'react-hot-toast'
import { useSelector, useDispatch } from 'react-redux'
import { interactionService, userService } from '@shared/services/api'
import { refreshUser, selectIsAuthenticated, selectUser } from '@shared/store/slices/authSlice'
import { selectIsMuted, toggleMute } from '@shared/store/slices/uiSlice'
import { getMediaUrl, isIdentityVerified, isValidObjectId } from '@shared/utils/helpers'
import { buildReelShareUrl } from '@shared/utils/reelShare'
import { navigateToUser } from '@shared/utils/safeNavigate'
import SafeUserLink from '../Navigation/SafeUserLink'
import ReelCommentsModal from './ReelCommentsModal'
import ReelShareModal from './ReelShareModal'
import QuickViewModal from './QuickViewModal'
import ReelStreamPlayer from './ReelStreamPlayer'

function ProductReelCard({ product, isVisible, embedded = false }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const isMuted = useSelector(selectIsMuted) // Global mute state
  const videoRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [isLiked, setIsLiked] = useState(Boolean(product.liked))
  const [isSaved, setIsSaved] = useState(Boolean(product.saved))
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [likeCount, setLikeCount] = useState(product.likesCount ?? product.likes?.length ?? 0)
  const [viewCount, setViewCount] = useState(product.views || 0)
  const [commentCount, setCommentCount] = useState(product.commentCount ?? 0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showQuickView, setShowQuickView] = useState(false)
  const [drawerInitialTab, setDrawerInitialTab] = useState('comments')
  const [hasIncrementedView, setHasIncrementedView] = useState(false)
  const [progress, setProgress] = useState(0)
  const [mediaLoaded, setMediaLoaded] = useState(false)
  const [showFallback, setShowFallback] = useState(false)
  // Fetch comment count function (memoized)
  const fetchCommentCount = useCallback(async () => {
    if (product._id) {
      try {
        const res = await interactionService.getCommentCount(product._id)
        setCommentCount(res.data.count)
      } catch (error) {
        console.error('Error fetching comment count:', error)
      }
    }
  }, [product._id])



  // Sync like/save/comment counts from the batched `feed-data` response.
  // Fallback to a single comment-count request only if `product.commentCount` is missing.
  useEffect(() => {
    setIsLiked(Boolean(product.liked))
    setIsSaved(Boolean(product.saved))
    setLikeCount(product.likesCount ?? product.likes?.length ?? 0)
    setCommentCount(product.commentCount ?? 0)

    const needsCommentCountFetch = product._id && (product.commentCount === undefined || product.commentCount === null)
    if (needsCommentCountFetch) fetchCommentCount()
  }, [product._id, product.liked, product.saved, product.likesCount, product.likes, product.commentCount, fetchCommentCount])

  // instrumentation removed after verification

  // Initialize following state from current user (if available)
  useEffect(() => {
    try {
      const sellerId = product?.seller?._id ? String(product.seller._id) : String(product.seller || '')
      if (user && Array.isArray(user.following)) {
        setIsFollowing(user.following.some((fid) => String(fid) === sellerId))
      } else {
        setIsFollowing(false)
      }
    } catch (e) {
      setIsFollowing(false)
    }
  }, [user, product])

  useEffect(() => {
      if (isVisible) {
      setIsPlaying(!userPaused)
      // Increment view count when video becomes visible (only once)
      if (!hasIncrementedView && isValidObjectId(product?._id)) {
        interactionService
          .incrementView(product._id)
          .then((res) => {
            if (res?.data && typeof res.data.views === 'number') {
              setViewCount(res.data.views)
            }
            setHasIncrementedView(true)
          })
          .catch((err) => {
            console.debug('incrementView skipped/failed:', err && (err.message || err.response?.data?.message || err))
          })
      }

    } else {
      // Immediately pause when not visible
      setIsPlaying(false)
      setProgress(0) // Reset progress when not visible
    }
    
    // Cleanup: ensure video is paused when component unmounts or becomes invisible
    return () => {
      setIsPlaying(false)
    }
  }, [isVisible, product._id, hasIncrementedView, userPaused])

  // Update video mute state when global mute state changes
  useEffect(() => {
    if (videoRef.current && product.video) {
      // ReactPlayer will automatically update when muted prop changes
      // This effect ensures the state is synced
    }
  }, [isMuted, product.video])

  // Control native video playback when isPlaying / isVisible changes
  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    try {
      vid.muted = isMuted
      if (isPlaying && isVisible) {
        const p = vid.play()
        if (p && p.catch) p.catch(() => {})
      } else {
        vid.pause()
      }
    } catch (err) {
      // ignore playback errors (autoplay policies)
    }
  }, [isPlaying, isVisible, isMuted, product.video])

  const handleDoubleClick = () => {
    if (!isLiked && isAuthenticated) {
      handleLike(null, true)
    } else if (!isAuthenticated) {
      toast.error('Please login to like products')
    }
  }

  const handleLike = async (e, fromDoubleClick = false) => {
    if (e) e.stopPropagation()
    if (!isAuthenticated) {
      toast.error('Please login to like products')
      navigate('/login')
      return
    }

    const previousLiked = isLiked
    setIsLiked(!isLiked)
    setLikeCount((prev) => (previousLiked ? prev - 1 : prev + 1))

    try {
      const res = await interactionService.likeProduct(product._id)
      setIsLiked(res.data.liked)
      setLikeCount(res.data.likeCount)
      if (!previousLiked && !fromDoubleClick) {
        toast.success('Liked!', { duration: 1000 })
      }
    } catch (error) {
      // Revert on error
      setIsLiked(previousLiked)
      setLikeCount((prev) => (previousLiked ? prev + 1 : prev - 1))
      toast.error('Failed to like product')
    }
  }

  const handleComment = (e) => {
    e.stopPropagation()
    setDrawerInitialTab('comments')
    setShowCommentModal(true)
  }

  const handleShare = (e) => {
    e.stopPropagation()
    if (!isAuthenticated) {
      if (navigator.share) {
        navigator.share({
          title: product.title,
          text: `Check out ${product.title} - ${formatPrice(product.price)}`,
          url: buildReelShareUrl(product._id),
        }).catch(() => {
          copyToClipboard()
        })
      } else {
        copyToClipboard()
      }
      return
    }
    setShowShareModal(true)
  }

  const handleChat = (e) => {
    e.stopPropagation()
    if (!product.seller) {
      toast.error('Seller information is not available')
      return
    }
    setDrawerInitialTab('chat')
    setShowCommentModal(true)
  }

  const handleFollow = async (e) => {
    if (e) e.stopPropagation()
    if (!isAuthenticated) {
      toast.error('Please login to follow users')
      navigate('/login')
      return
    }
    const sellerId = product?.seller?._id ? String(product.seller._id) : String(product.seller || '')
    const prev = isFollowing
    // optimistic UI
    setIsFollowing(!prev)
    try {
      const res = await userService.followUser(sellerId)
      // server returns following boolean under res.data.following (or similar)
      if (res && res.data && typeof res.data.following === 'boolean') {
        setIsFollowing(res.data.following)
      } else {
        // fallback: toggle according to prev
        setIsFollowing(!prev)
      }
      dispatch(refreshUser())
    } catch (err) {
      console.error('Follow failed', err)
      setIsFollowing(prev)
      toast.error('Failed to update follow status')
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(buildReelShareUrl(product._id))
    toast.success('Reel link copied!')
  }

  const handleTogglePlay = (e) => {
    if (e) e.stopPropagation()
    setUserPaused((prev) => {
      const next = !prev
      setIsPlaying(!next && isVisible)
      return next
    })
  }

  const handleSave = async (e) => {
    e.stopPropagation()
    if (!isAuthenticated) {
      toast.error('Please login to save products')
      navigate('/login')
      return
    }

    const previousSaved = isSaved
    setIsSaved(!isSaved)

    try {
      const res = await interactionService.saveProduct(product._id)
      setIsSaved(res.data.saved)
      toast.success(res.data.saved ? 'Saved to collection' : 'Removed from saved')
    } catch (error) {
      // Revert on error
      setIsSaved(previousSaved)
      toast.error('Failed to save product')
    }
  }

  const handleReport = async (e) => {
    e.stopPropagation()
    setShowMoreMenu(false)
    
    if (!isAuthenticated) {
      toast.error('Please login to report products')
      navigate('/login')
      return
    }

    // Simple report - in production, you'd want a modal with reason selection
    const reason = prompt('Please provide a reason for reporting this product:')
    if (reason && reason.trim()) {
      try {
        await interactionService.reportProduct(product._id, {
          reason: reason.trim(),
          description: reason.trim(),
        })
        toast.success('Product reported successfully')
      } catch (error) {
        toast.error('Failed to report product')
      }
    }
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: product.currency || 'USD',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatCount = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  const formatTimeAgo = (date) => {
    const now = new Date()
    const diff = now - new Date(date)
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  const showPlaybackButton = !product.video || !isPlaying

  const embeddedSecondaryLine = buildSpecsLine(product) || [product.location, product.category?.name].filter(Boolean).join(' · ') || 'Live listing'

  const listingStatusBadge = (() => {
    const status = product?.status || 'active'
    if (status === 'sold') return { label: 'Sold', className: 'bg-red-500/95' }
    if (status === 'inactive' || status === 'paused') return { label: 'Unavailable', className: 'bg-slate-500/95' }
    return { label: 'Available', className: 'bg-lime-500/95' }
  })()

  const embeddedIconClass = 'h-6 w-6 sm:h-7 sm:w-7 text-slate-900'

  const reelWrapperStyle = embedded
    ? {
        height: 'calc(100% - 12px)',
        maxHeight: 'calc(100% - 12px)',
        aspectRatio: '9 / 16',
        width: 'auto',
        maxWidth: 'calc(100% - 48px)',
        zIndex: 10,
      }
    : {
        width: 'min(85vw, 480px)',
        height: '90vh',
        maxHeight: '100vh',
        minHeight: '85vh',
        zIndex: 10,
      }

  const renderActionButton = (label, count, onClick, icon, filled = false, iconClass = '') => (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        className={`transition-transform hover:scale-110 active:scale-95 ${embedded ? 'p-0.5' : 'p-1'}`}
        aria-label={label}
      >
        {icon}
      </button>
      {count != null && (
        <span className={`mt-1 text-[11px] font-semibold leading-none ${embedded ? 'text-slate-800' : 'text-white'}`}>
          {formatCount(count)}
        </span>
      )}
      {!count && label && !embedded && (
        <span className="mt-1 text-[10px] font-semibold text-white leading-none">{label}</span>
      )}
    </div>
  )

  const actionColumnClass = embedded
    ? 'flex flex-col items-center gap-3 shrink-0 self-end mb-12 sm:mb-14 pt-8'
    : 'flex flex-col items-center gap-5 shrink-0 fixed z-50 right-3 sm:right-4 bottom-[calc(100px+env(safe-area-inset-bottom,0px))] md:static md:relative md:self-end md:mb-24 md:bottom-auto md:right-auto'

  return (
    <div
      className={`relative h-full w-full min-h-0 cursor-default overflow-visible ${embedded ? 'bg-transparent' : 'bg-black'}`}
      style={{ position: 'relative' }}
      onDoubleClick={handleDoubleClick}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`relative flex h-full w-full items-center justify-center ${embedded ? 'px-1' : ''}`}>
          {/* Reel Card + Instagram-style action column */}
          <div className={`relative flex h-full max-h-full items-end justify-center ${embedded ? 'gap-2 sm:gap-3' : 'gap-3 sm:gap-4 md:gap-5'}`}>
          <div
            className={`relative reel-wrapper mx-auto w-full group overflow-hidden rounded-2xl ${embedded ? 'bg-black shadow-none rounded-[20px] sm:rounded-[28px]' : 'bg-black shadow-2xl max-w-[480px] md:max-w-[640px] lg:max-w-[720px]'}`}
            style={reelWrapperStyle}
          >
            {!embedded && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.6)', borderRadius: '18px', zIndex: 5 }}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              {product.video && !showFallback ? (
                <ReelStreamPlayer
                  product={product}
                  videoRef={videoRef}
                  isVisible={isVisible}
                  isMuted={isMuted}
                  isPlaying={isPlaying && isVisible && !userPaused}
                  className={`w-full h-full object-cover ${embedded ? '' : 'filter brightness-105 contrast-105'}`}
                  style={{ objectPosition: 'center center', position: 'relative', zIndex: 1 }}
                  onLoadedData={() => {
                    setMediaLoaded(true)
                    setShowFallback(false)
                  }}
                  onError={() => { setShowFallback(true); setMediaLoaded(false) }}
                  onTimeUpdate={(e) => {
                    if (isVisible) {
                      const vid = e.target
                      setProgress(vid.currentTime / Math.max(vid.duration || 1, 1))
                    }
                  }}
                  onEnded={() => { setProgress(0) }}
                />
              ) : product.images?.[0] ? (
                <img
                  src={getMediaUrl(product.images?.[0]) || '/placeholder.jpg'}
                  alt={product.title}
                  loading="lazy"
                  className={`w-full h-full object-cover mx-auto ${embedded ? '' : 'filter brightness-105 contrast-105'}`}
                  style={{ objectPosition: 'center center', position: 'relative', zIndex: 1 }}
                  onLoad={() => { setMediaLoaded(true) }}
                  onError={() => { setShowFallback(true); setMediaLoaded(false) }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <div className="text-center px-6">
                    <div className="text-white text-lg sm:text-2xl font-semibold mb-2">{product.title || 'Product'}</div>
                    {product.price && <div className="text-primary-600 font-bold mb-2">{formatPrice(product.price)}</div>}
                    <div className="text-gray-300 text-sm">Media unavailable</div>
                  </div>
                </div>
              )}
            </div>

            <div className={`absolute bottom-0 left-0 right-0 ${embedded ? 'h-36' : 'h-56'} bg-gradient-to-t from-black/90 to-transparent z-10 pointer-events-none`} />

            {embedded && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch(toggleMute())
                }}
                className="absolute top-3 left-3 z-40 rounded-full bg-black/35 p-2 backdrop-blur-sm transition-transform hover:scale-105 hover:bg-black/50"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
              </button>
            )}

            {!embedded && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600/50 z-10">
                <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${progress * 100}%` }} />
              </div>
            )}

            <div
              className={`absolute ${embedded ? 'bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4' : 'bottom-16 sm:bottom-20 md:bottom-24 left-4 right-16 sm:right-20 md:right-24 sm:left-4 md:left-6'} max-w-[85vw] sm:max-w-md md:max-w-[420px] text-white z-40 break-words`}
              style={{ wordBreak: 'break-word' }}
            >
              {embedded ? (
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/products/${product._id}`)
                      }}
                      className="block text-left text-[18px] leading-tight font-semibold text-white hover:underline whitespace-normal"
                    >
                      {product.title || 'Product'}
                    </button>
                    <p className="mt-1 text-xs text-white/85">{embeddedSecondaryLine}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-white backdrop-blur-sm">
                      {product.price ? formatPrice(product.price) : 'Price on request'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${listingStatusBadge.className}`}>
                      {listingStatusBadge.label}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="seller-info flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 flex-wrap">
                    <SafeUserLink userId={product.seller?._id || product.seller} className="font-semibold text-white hover:underline flex items-center gap-1 text-xs sm:text-sm">
                      <span>{product.seller?.name || product.seller?.username || product.contactName || 'Seller'}</span>
                      {isIdentityVerified(product.seller) ? (<img src={VERIFIED_BADGE_IMAGES.small} alt="Verified" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />) : null}
                    </SafeUserLink>
                    {product.seller ? (
                      <button onClick={handleFollow} className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-transform ${isFollowing ? 'bg-gray-200 text-gray-900' : 'bg-primary-600 text-white hover:opacity-90'}`} aria-pressed={isFollowing}>
                        {isFollowing ? (<><UserPlus className="h-3 w-3 mr-1" />Following</>) : (<><UserPlus className="h-3 w-3 mr-1" />Follow</>)}
                      </button>
                    ) : null}
                  </div>

                  <button onClick={(e) => { e.stopPropagation(); navigate(`/products/${product._id}`) }} className="text-sm sm:text-base text-white text-left hover:underline mb-1 block whitespace-normal">{product.title || 'Product'}</button>
                  <p className="text-xs sm:text-sm text-gray-200/90 mb-1 max-h-16 overflow-hidden">
                    {product.caption || product.description || 'No caption added.'}
                  </p>

                  <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-300 mt-0.5 sm:mt-1 flex-wrap">
                    {product.price && (<span className="font-semibold text-white">{formatPrice(product.price)}</span>)}
                    {viewCount > 0 && (<span>{formatCount(viewCount)} views</span>)}
                    {product.createdAt && (<span>{formatTimeAgo(product.createdAt)}</span>)}
                  </div>
                </>
              )}
            </div>

            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${embedded ? 'hidden' : ''}`}>
              <button
                onClick={handleTogglePlay}
                className={`pointer-events-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/10 shadow-lg hover:bg-black/60 transition-all duration-300 transform-gpu hover:scale-105 flex items-center justify-center ${
                  showPlaybackButton ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'
                }`}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
              >
                {isPlaying ? (<Pause className="h-6 w-6 sm:h-8 sm:w-8" />) : (<Play className="h-6 w-6 sm:h-8 sm:w-8 ml-0.5 sm:ml-1" />)}
              </button>
            </div>
          </div>

          {/* Instagram-style action column — always to the right of the video */}
          <div className={actionColumnClass}>
            {!embedded && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); dispatch(toggleMute()) }}
                className="p-1.5 rounded-full bg-black/30 hover:scale-110 transition-transform"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="h-5 w-5 text-white" /> : <Volume2 className="h-5 w-5 text-white" />}
              </button>
            )}

            {renderActionButton(
              'Like',
              likeCount,
              (e) => { e.stopPropagation(); handleLike(e) },
              <Heart
                className={`${embedded ? embeddedIconClass : 'h-7 w-7 sm:h-8 sm:w-8'} ${isLiked ? 'fill-red-500 text-red-500' : embedded ? 'text-slate-900' : 'text-white'}`}
                strokeWidth={embedded ? 1.75 : 2}
              />,
            )}

            {renderActionButton(
              'Comment',
              commentCount,
              (e) => { e.stopPropagation(); handleComment(e) },
              <MessageCircle className={`${embedded ? embeddedIconClass : 'h-7 w-7 sm:h-8 sm:w-8'} ${embedded ? 'text-slate-900' : 'text-white'}`} strokeWidth={embedded ? 1.75 : 2} />,
            )}

            {renderActionButton(
              'Share',
              embedded ? 0 : null,
              (e) => { e.stopPropagation(); handleShare(e) },
              <Send className={`${embedded ? embeddedIconClass : 'h-6 w-6 sm:h-7 sm:w-7'} ${embedded ? 'text-slate-900' : 'text-white'}`} strokeWidth={embedded ? 1.75 : 2} />,
            )}

            {embedded && renderActionButton(
              'View',
              viewCount,
              (e) => { e.stopPropagation(); setShowQuickView(true) },
              <Maximize2 className={embeddedIconClass} strokeWidth={1.75} />,
            )}

            {renderActionButton(
              'Save',
              embedded ? 0 : null,
              (e) => { e.stopPropagation(); handleSave(e) },
              <Bookmark
                className={`${embedded ? embeddedIconClass : 'h-6 w-6 sm:h-7 sm:w-7'} ${isSaved ? (embedded ? 'fill-primary-600 text-primary-600' : 'fill-white text-white') : embedded ? 'text-slate-900' : 'text-white'}`}
                strokeWidth={embedded ? 1.75 : 2}
              />,
            )}

            {!embedded && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowMoreMenu((v) => !v) }}
                className="p-1 hover:scale-110 transition-transform"
                aria-label="More options"
              >
                <MoreVertical className="h-6 w-6 text-white" />
              </button>
            )}

            {product.seller ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (embedded && !isFollowing) {
                    handleFollow(e)
                    return
                  }
                  const sellerId = product.seller?._id || product.seller
                  navigateToUser(navigate, sellerId)
                }}
                className={`relative overflow-hidden bg-gray-800 transition-transform hover:scale-110 ${
                  embedded
                    ? 'h-9 w-9 rounded-full border border-slate-300 ring-1 ring-white/80'
                    : 'w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-white ring-2 ring-transparent hover:ring-white/30'
                }`}
                aria-label={embedded && !isFollowing ? 'Follow seller' : 'Seller profile'}
              >
                {product.seller.avatar ? (
                  <img src={getMediaUrl(product.seller.avatar) || product.seller.avatar} alt={product.seller.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary-600">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
                {embedded && !isFollowing ? (
                  <span className="absolute -bottom-0.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-red-500 ring-2 ring-white">
                    <Plus className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>
          </div>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMoreMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false) }} />
          <div className="absolute right-12 bottom-32 z-[70] w-44 rounded-xl bg-gray-900/95 py-1 shadow-xl backdrop-blur-sm">
            <button type="button" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); setShowQuickView(true) }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/10">
              <Eye className="h-4 w-4" /> View details
            </button>
            {product.seller && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); handleChat(e) }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/10">
                <MessageCircle className="h-4 w-4" /> Chat
              </button>
            )}
            <button type="button" onClick={handleReport} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-white/10">
              <Flag className="h-4 w-4" /> Report
            </button>
          </div>
        </>
      )}

      {/* Instagram-style comment popup (portal renders at body so it's not clipped) */}
      {showCommentModal && product?._id && (
        <ReelCommentsModal productId={String(product._id)} productTitle={product.title} product={product} initialTab={drawerInitialTab} onClose={() => setShowCommentModal(false)} onCommentAdded={fetchCommentCount} />
      )}
      <ReelShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        product={product}
        userId={user?._id}
      />
      {showQuickView && (
        <QuickViewModal
          product={product}
          onClose={() => setShowQuickView(false)}
          onOpenChat={() => {
            setDrawerInitialTab('chat')
            setShowCommentModal(true)
          }}
        />
      )}
    </div>
  )
}

export default ProductReelCard
