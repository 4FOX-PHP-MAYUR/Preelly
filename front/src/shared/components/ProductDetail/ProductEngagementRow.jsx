import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Heart, MessageCircle, Send, Bookmark, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { interactionService } from '../../services/api'
import { selectIsAuthenticated } from '../../store/slices/authSlice'
import { formatCompactCount } from './detailHelpers'

function ActionPill({ icon: Icon, count, onClick, label, iconClassName = 'text-slate-500' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full border border-[#E8EBF2] bg-white px-2.5 py-1 text-xs font-medium text-slate-600 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[13px]"
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} />
      <span>{formatCompactCount(count)}</span>
    </button>
  )
}

function ProductEngagementRow({ product, viewCount: viewCountProp, embedded = false }) {
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(Boolean(product.saved))
  const [likeCount, setLikeCount] = useState(product.likes?.length || 0)
  const [shareCount, setShareCount] = useState(product.shares || 0)
  const [viewCount, setViewCount] = useState(viewCountProp ?? product.views ?? 0)

  useEffect(() => {
    setViewCount(viewCountProp ?? product.views ?? 0)
  }, [viewCountProp, product._id, product.views])

  useEffect(() => {
    if (isAuthenticated && product._id) {
      interactionService
        .checkLiked(product._id)
        .then((res) => setIsLiked(res.data.liked))
        .catch(() => {})
      interactionService
        .checkSaved(product._id)
        .then((res) => setIsSaved(res.data.saved))
        .catch(() => {})
    }
  }, [isAuthenticated, product._id])

  const requireAuth = (message) => {
    toast.error(message)
    navigate('/login')
  }

  const handleLike = async () => {
    if (!isAuthenticated) return requireAuth('Please login to like products')
    const previousLiked = isLiked
    const previousCount = likeCount
    setIsLiked(!previousLiked)
    setLikeCount(previousLiked ? previousCount - 1 : previousCount + 1)
    try {
      const res = await interactionService.likeProduct(product._id)
      setIsLiked(res.data.liked)
      setLikeCount(res.data.likeCount)
    } catch {
      setIsLiked(previousLiked)
      setLikeCount(previousCount)
      toast.error('Failed to like product')
    }
  }

  const handleSave = async () => {
    if (!isAuthenticated) return requireAuth('Please login to save products')
    const previousSaved = isSaved
    setIsSaved(!previousSaved)
    try {
      const res = await interactionService.saveProduct(product._id)
      setIsSaved(res.data.saved)
      toast.success(res.data.saved ? 'Saved to collection' : 'Removed from saved')
    } catch {
      setIsSaved(previousSaved)
      toast.error('Failed to save product')
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      navigator
        .share({ title: product.title, text: product.title, url: window.location.href })
        .catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied to clipboard!')
    }
    try {
      const res = await interactionService.shareProduct(product._id)
      setShareCount(res.data.shares)
    } catch {
      // Non-critical
    }
  }

  return (
    <div
      className={`flex w-full items-center gap-1.5 sm:gap-2 ${
        embedded ? '' : 'rounded-xl border border-[#E8EBF2] px-3 py-2.5 shadow-sm sm:px-4'
      }`}
    >
      <ActionPill
        icon={Heart}
        count={likeCount}
        onClick={handleLike}
        label="Like"
        iconClassName={isLiked ? 'fill-red-500 text-red-500' : 'text-slate-500'}
      />
      <ActionPill
        icon={MessageCircle}
        count={product.commentCount ?? 0}
        onClick={() => document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth' })}
        label="Comments"
      />
      <ActionPill icon={Send} count={shareCount} onClick={handleShare} label="Share" />
      <div className="inline-flex items-center gap-1 rounded-full border border-[#E8EBF2] bg-white px-2.5 py-1 text-xs font-medium text-slate-600 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[13px]">
        <Eye className="h-3.5 w-3.5 text-slate-500 sm:h-4 sm:w-4" />
        <span>{formatCompactCount(viewCount)}</span>
      </div>
      <button
        type="button"
        onClick={handleSave}
        aria-label={isSaved ? 'Remove bookmark' : 'Bookmark listing'}
        className={`ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E8EBF2] bg-white sm:h-9 sm:w-9 ${
          isSaved ? 'text-brand' : 'text-slate-500'
        }`}
      >
        <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
      </button>
    </div>
  )
}

export default ProductEngagementRow
