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
} from 'lucide-react'
import { VERIFIED_BADGE_IMAGES } from '../../utils/verifiedBadge'
// Use native <video> for precise sizing/control
import toast from 'react-hot-toast'
import { useSelector, useDispatch } from 'react-redux'
import { interactionService, userService } from '../../services/api'
import { refreshUser, selectIsAuthenticated, selectUser } from '../../store/slices/authSlice'
import { selectIsMuted, toggleMute } from '../../store/slices/uiSlice'
import { getMediaUrl, isUserVerified, isValidObjectId } from '../../utils/helpers'
import { navigateToUser } from '../../utils/safeNavigate'
import SafeUserLink from '../Navigation/SafeUserLink'
import ReelCommentsModal from './ReelCommentsModal'

function ProductReelCard({ product, isVisible }) {
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
    if (navigator.share) {
      navigator.share({
        title: product.title,
        text: `Check out ${product.title} - ${formatPrice(product.price)}`,
        url: window.location.origin + `/products/${product._id}`,
      }).catch(() => {
        copyToClipboard()
      })
    } else {
      copyToClipboard()
    }
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
    const url = window.location.origin + `/products/${product._id}`
    navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard!')
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

  return (
    <div className="relative h-full w-full min-h-0 bg-black cursor-default overflow-visible" style={{ position: 'relative' }} onDoubleClick={handleDoubleClick}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center gap-6">
          {/* Reel Card */}
          <div className="relative reel-wrapper mx-auto w-full max-w-[480px] md:max-w-[640px] lg:max-w-[720px] bg-black group shadow-2xl overflow-hidden rounded-2xl" style={{ width: 'min(85vw, 480px)', height: '90vh', maxHeight: '100vh', minHeight: '85vh', zIndex: 10 }}>
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.6)', borderRadius: '18px', zIndex: 5 }} />
            <div className="absolute inset-0 flex items-center justify-center">
              {!showFallback && product.video ? (
                <video
                  ref={videoRef}
                  src={getMediaUrl(product.video)}
                  playsInline
                  loop
                  muted={isMuted}
                  className="w-full h-full object-cover filter brightness-105 contrast-105"
                  style={{ objectPosition: 'center center', position: 'relative', zIndex: 1 }}
                  onLoadedData={() => { setMediaLoaded(true); setShowFallback(false) }}
                  onError={() => { setShowFallback(true); setMediaLoaded(false) }}
                  onTimeUpdate={(e) => {
                    if (isVisible) {
                      const vid = e.target
                      setProgress(vid.currentTime / Math.max(vid.duration || 1, 1))
                    }
                  }}
                  onEnded={() => { setProgress(0) }}
                />
              ) : !showFallback && product.images?.[0] ? (
                <img
                  src={getMediaUrl(product.images?.[0]) || '/placeholder.jpg'}
                  alt={product.title}
                  loading="lazy"
                  className="w-full h-full object-cover mx-auto filter brightness-105 contrast-105"
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

            <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-black/90 to-transparent z-10 pointer-events-none" />

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600/50 z-10">
              <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${progress * 100}%` }} />
            </div>

            <div className="absolute bottom-16 sm:bottom-20 md:bottom-24 left-4 right-20 sm:right-28 md:right-32 sm:left-4 md:left-6 max-w-[85vw] sm:max-w-md md:max-w-[420px] text-white z-40 break-words" style={{ wordBreak: 'break-word' }}>
              <div className="seller-info flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 flex-wrap">
                <SafeUserLink userId={product.seller?._id || product.seller} className="font-semibold text-white hover:underline flex items-center gap-1 text-xs sm:text-sm">
                  <span>{product.seller?.name || product.seller?.username || product.contactName || 'Seller'}</span>
                  {isUserVerified(product.seller) ? (<img src={VERIFIED_BADGE_IMAGES.small} alt="Verified" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />) : null}
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
            </div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button onClick={handleTogglePlay} className="pointer-events-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/10 shadow-lg hover:bg-black/60 transition-transform duration-300 transform-gpu hover:scale-105 flex items-center justify-center opacity-90" aria-label={isPlaying ? 'Pause video' : 'Play video'}>
                {isPlaying ? (<Pause className="h-6 w-6 sm:h-8 sm:w-8" />) : (<Play className="h-6 w-6 sm:h-8 sm:w-8 ml-0.5 sm:ml-1" />)}
              </button>
            </div>
          </div>

          {/* Action column (overlay on mobile, sidebar on desktop) */}
          <div className="flex flex-col items-center gap-4 absolute right-3 bottom-24 z-50 md:static md:right-auto md:bottom-auto">
            <div className="flex flex-col items-center">
              <button onClick={(e) => { e.stopPropagation(); dispatch(toggleMute()) }} className="p-2 rounded-full bg-black/40 hover:scale-110 transition-transform" aria-label={isMuted ? 'Unmute' : 'Mute'}>{isMuted ? <VolumeX className="h-6 w-6 text-white" /> : <Volume2 className="h-6 w-6 text-white" />}</button>
            </div>
            <div className="flex flex-col items-center">
              <button onClick={(e) => { e.stopPropagation(); handleLike(e) }} className="p-2 rounded-full bg-black/40 hover:scale-110 transition-transform" aria-label="Like"><Heart className={`h-7 w-7 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} /></button>
              <span className="text-white text-[10px] sm:text-xs font-semibold mt-1">{formatCount(likeCount)}</span>
            </div>
            <div className="flex flex-col items-center">
              <button type="button" onClick={(e) => { e.stopPropagation(); handleComment(e) }} className="p-2 rounded-full bg-black/40 hover:scale-110 transition-transform" aria-label="Comments"><MessageCircle className="h-7 w-7 text-white" /></button>
              <span className="text-white text-[10px] sm:text-xs font-semibold mt-1">{formatCount(commentCount)}</span>
            </div>
            {product.seller ? (<div className="flex flex-col items-center"><button onClick={(e) => { e.stopPropagation(); handleChat(e) }} className="p-2 rounded-full bg-black/40 hover:scale-110 transition-transform" aria-label="Chat with seller"><MessageCircle className="h-7 w-7 text-white" /></button><span className="text-white text-[10px] sm:text-xs font-semibold mt-1">Chat</span></div>) : null}
            <div className="flex flex-col items-center"><button onClick={(e) => { e.stopPropagation(); handleSave(e) }} className="p-2 rounded-full bg-black/40 hover:scale-110 transition-transform" aria-label="Save"><Bookmark className={`h-6 w-6 ${isSaved ? 'text-primary-400' : 'text-white'}`} /></button><span className="text-white text-[10px] sm:text-xs font-semibold mt-1">Save</span></div>
            <div className="flex flex-col items-center"><button onClick={handleShare} className="p-2 rounded-full bg-transparent hover:scale-110 transition-transform" aria-label="Share"><Send className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white" /></button><span className="text-white text-[10px] sm:text-xs font-semibold mt-0.5 sm:mt-1">Share</span></div>
            {product.seller ? (<div className="flex flex-col items-center pt-1 sm:pt-2"><button onClick={(e) => { e.stopPropagation(); const sellerId = product.seller?._id || product.seller; navigateToUser(navigate, sellerId) }} className="relative w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-white overflow-hidden bg-gray-800 hover:scale-110 transition-transform">{product.seller.avatar ? <img src={getMediaUrl(product.seller.avatar) || product.seller.avatar} alt={product.seller.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-primary-600"><User className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" /></div>}</button></div>) : null}
          </div>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false) }} />
      )}

      {/* Instagram-style comment popup (portal renders at body so it's not clipped) */}
      {showCommentModal && product?._id && (
        <ReelCommentsModal productId={String(product._id)} productTitle={product.title} product={product} initialTab={drawerInitialTab} onClose={() => setShowCommentModal(false)} onCommentAdded={fetchCommentCount} />
      )}
    </div>
  )
}

export default ProductReelCard
