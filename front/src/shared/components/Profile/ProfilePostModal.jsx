import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import {
  Bookmark,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Send,
  Smile,
  X,
} from 'lucide-react'
import { interactionService, productService } from '@shared/services/api'
import { selectIsAuthenticated, selectIsGuest, selectUser } from '@shared/store/slices/authSlice'
import { formatPrice, getMediaUrl, isIdentityVerified } from '@shared/utils/helpers'
import { VERIFIED_BADGE_IMAGES } from '@shared/utils/verifiedBadge'
import { navigateToUser } from '@shared/utils/safeNavigate'
import AdMoreOptionsModal from './AdMoreOptionsModal'
import MarkAsSoldFlow from './MarkAsSoldFlow'
import ListingVideoPreview from '../Video/ListingVideoPreview'

function formatPostDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

function formatRelative(value) {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff) || diff < 0) return ''
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  if (weeks < 8) return `${weeks}w`
  return formatPostDate(value)
}

/**
 * Instagram-style post detail modal for My Profile ads.
 * Uses Preelly brand / light surface colors (not Instagram dark theme).
 */
export default function ProfilePostModal({
  product,
  profileUser,
  isOwnProfile = false,
  onClose,
  onProductArchived,
  onProductDeleted,
  onProductUpdated,
}) {
  const navigate = useNavigate()
  const titleId = useId()
  const commentInputRef = useRef(null)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const isGuest = useSelector(selectIsGuest)
  const currentUser = useSelector(selectUser)

  const [visible, setVisible] = useState(false)
  const [isLiked, setIsLiked] = useState(Boolean(product?.liked))
  const [likeCount, setLikeCount] = useState(product?.likesCount ?? product?.likes?.length ?? 0)
  const [isSaved, setIsSaved] = useState(Boolean(product?.saved))
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [showMarkSoldFlow, setShowMarkSoldFlow] = useState(false)
  const [busy, setBusy] = useState(false)

  const seller = product?.seller || profileUser || {}
  const sellerId = seller?._id || seller
  const displayName = seller?.displayName || seller?.name || profileUser?.name || 'Seller'
  const avatarUrl = getMediaUrl(seller?.avatar || profileUser?.avatar) || null
  const locationLabel = product?.location || seller?.city || profileUser?.city || ''
  const mediaSrc = product?.images?.[0] ? getMediaUrl(product.images[0]) : null
  const priceLabel = formatPrice(Number(product?.price || 0), (product?.currency || 'AED').toUpperCase())

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(() => onClose?.(), 220)
  }, [onClose])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!product?._id) return
      setCommentsLoading(true)
      try {
        const res = await interactionService.getComments(product._id)
        if (!cancelled) {
          const raw = Array.isArray(res?.data) ? res.data : res?.data?.comments || []
          setComments(raw)
        }
      } catch {
        if (!cancelled) setComments([])
      } finally {
        if (!cancelled) setCommentsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [product?._id])

  const requireAuth = () => {
    if (isAuthenticated) return true
    toast.error('Please login to continue')
    if (!isGuest) navigate('/login')
    return false
  }

  const handleLike = async () => {
    if (!requireAuth()) return
    const prevLiked = isLiked
    const prevCount = likeCount
    setIsLiked(!prevLiked)
    setLikeCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)))
    try {
      const res = await interactionService.likeProduct(product._id)
      setIsLiked(Boolean(res?.data?.liked ?? !prevLiked))
      if (typeof res?.data?.likesCount === 'number') setLikeCount(res.data.likesCount)
    } catch {
      setIsLiked(prevLiked)
      setLikeCount(prevCount)
      toast.error('Failed to update like')
    }
  }

  const handleSave = async () => {
    if (!requireAuth()) return
    const prev = isSaved
    setIsSaved(!prev)
    try {
      const res = await interactionService.saveProduct(product._id)
      setIsSaved(Boolean(res?.data?.saved ?? !prev))
      toast.success(res?.data?.saved ? 'Saved' : 'Removed from saved')
    } catch {
      setIsSaved(prev)
      toast.error('Failed to save')
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/products/${product._id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: product.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      }
    } catch {
      /* cancelled */
    }
  }

  const handlePostComment = async (e) => {
    e?.preventDefault?.()
    if (!requireAuth()) return
    const text = commentText.trim()
    if (!text) return
    setPosting(true)
    try {
      const res = await interactionService.addComment(product._id, text)
      const created = res?.data?.comment || res?.data
      if (created) setComments((prev) => [...prev, created])
      setCommentText('')
      toast.success('Comment posted')
    } catch {
      toast.error('Failed to post comment')
    } finally {
      setPosting(false)
    }
  }

  const handleEdit = () => {
    navigate(`/post-ad?edit=${encodeURIComponent(product._id)}`)
  }

  const handleComingSoon = (label) => {
    toast(`${label} — coming soon`)
  }

  const handleMarkSold = () => {
    setShowMarkSoldFlow(true)
  }

  const handleMarkUnsold = async () => {
    if (!window.confirm('Mark this ad as unsold and list it as active again?')) return false
    setBusy(true)
    try {
      const res = await productService.markProductUnsold(product._id)
      toast.success('Marked as unsold')
      onProductUpdated?.(product._id, res.data.product || { status: 'active', isSold: false })
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to mark as unsold')
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleUnpublish = async () => {
    setBusy(true)
    try {
      await productService.archiveProduct(product._id)
      toast.success('Ad moved to My Archives')
      onProductArchived?.(product._id)
      handleClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to unpublish ad')
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this ad permanently? This cannot be undone.')) return false
    setBusy(true)
    try {
      await productService.deleteProduct(product._id)
      toast.success('Ad deleted')
      onProductDeleted?.(product._id)
      handleClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete ad')
      return false
    } finally {
      setBusy(false)
    }
  }

  if (!product) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55"
        aria-label="Close post"
        onClick={handleClose}
      />

      <div
        className={`relative z-10 flex h-[min(92dvh,860px)] w-full max-w-[980px] overflow-hidden rounded-[16px] bg-white shadow-2xl transition duration-200 ${
          visible ? 'scale-100' : 'scale-[0.98]'
        } flex-col md:flex-row`}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow md:hidden"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Media */}
        <div className="relative flex min-h-[240px] flex-[1.15] items-center justify-center bg-slate-100 md:min-h-0">
          {product.video || mediaSrc ? (
            <ListingVideoPreview
              product={product}
              className="h-full w-full object-contain"
              alt={product.title}
              interactive
              autoPlayOnHover={false}
              showVideoBadge={Boolean(product.video)}
            />
          ) : (
            <div className="p-8 text-center text-slate-400">No media</div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex w-full shrink-0 flex-col border-t border-[#E5E7EB] bg-white md:w-[380px] md:border-l md:border-t-0">
          <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-4 py-3">
            <button
              type="button"
              onClick={() => sellerId && navigateToUser(navigate, sellerId)}
              className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-brand/10"
              aria-label={`${displayName} profile`}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-brand">
                  {String(displayName).charAt(0).toUpperCase()}
                </span>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p id={titleId} className="truncate text-sm font-semibold text-slate-900">
                  {displayName}
                </p>
                {isIdentityVerified(seller) || isIdentityVerified(profileUser) ? (
                  <img src={VERIFIED_BADGE_IMAGES.small} alt="" className="h-3.5 w-3.5" />
                ) : null}
              </div>
              {locationLabel ? (
                <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  {locationLabel}
                </p>
              ) : null}
            </div>
            {isOwnProfile ? (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
                aria-label="More options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="hidden h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 md:flex"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
            <div className="flex gap-3">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-brand/10">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">
                  <span className="font-semibold text-slate-900">{displayName}</span>{' '}
                  {product.title}
                </p>
                {product.description ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 line-clamp-6">
                    {product.description}
                  </p>
                ) : null}
                <p className="mt-1 text-xs font-semibold text-brand">{priceLabel}</p>
                <p className="mt-1 text-[11px] text-slate-400">{formatRelative(product.createdAt)}</p>
              </div>
            </div>

            {commentsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : comments.length ? (
              comments.map((c) => {
                const author = c.user || c.author || {}
                const name = author.displayName || author.name || 'User'
                const aUrl = getMediaUrl(author.avatar)
                return (
                  <div key={c._id || `${name}-${c.createdAt}`} className="flex gap-3">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      {aUrl ? <img src={aUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        <span className="font-semibold text-slate-900">{name}</span> {c.text || c.content || c.comment}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                        <span>{formatRelative(c.createdAt)}</span>
                        <button type="button" className="font-semibold hover:text-brand">
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-slate-400">No comments yet</p>
            )}
          </div>

          <div className="border-t border-[#E5E7EB] px-3 py-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleLike}
                className="rounded-full p-2 text-slate-700 transition hover:bg-slate-50"
                aria-label="Like"
              >
                <Heart className={`h-6 w-6 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => commentInputRef.current?.focus()}
                className="rounded-full p-2 text-slate-700 transition hover:bg-slate-50"
                aria-label="Comment"
              >
                <MessageCircle className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="rounded-full p-2 text-slate-700 transition hover:bg-slate-50"
                aria-label="Share"
              >
                <Send className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="ml-auto rounded-full p-2 text-slate-700 transition hover:bg-slate-50"
                aria-label="Save"
              >
                <Bookmark className={`h-6 w-6 ${isSaved ? 'fill-brand text-brand' : ''}`} />
              </button>
            </div>
            <p className="px-2 pt-1 text-sm font-semibold text-slate-900">
              {likeCount > 0 ? `${likeCount.toLocaleString()} likes` : 'Be the first to like this'}
            </p>
            <p className="px-2 pb-2 text-[11px] uppercase tracking-wide text-slate-400">
              {formatPostDate(product.createdAt)}
            </p>
          </div>

          <form
            onSubmit={handlePostComment}
            className="flex items-center gap-2 border-t border-[#E5E7EB] px-3 py-2.5"
          >
            <Smile className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              ref={commentInputRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              aria-label="Add a comment"
            />
            <button
              type="submit"
              disabled={posting || !commentText.trim()}
              className="text-sm font-semibold text-brand disabled:opacity-40"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </form>
        </aside>
      </div>

      {isOwnProfile ? (
        <AdMoreOptionsModal
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          busy={busy}
          onEdit={handleEdit}
          onWarehouse={() => handleComingSoon('Move to Warehouse')}
          onInsight={() => handleComingSoon('See Insight')}
          onBoost={() => handleComingSoon('Boost this Ad')}
          onMarkSold={handleMarkSold}
          onMarkUnsold={handleMarkUnsold}
          isSold={product.status === 'sold' || product.isSold}
          onUnpublish={handleUnpublish}
          onDelete={handleDelete}
        />
      ) : null}

      {isOwnProfile ? (
        <MarkAsSoldFlow
          open={showMarkSoldFlow}
          product={product}
          onClose={() => setShowMarkSoldFlow(false)}
          onSold={(updated) => onProductUpdated?.(product._id, updated || { status: 'sold', isSold: true })}
        />
      ) : null}
    </div>,
    document.body,
  )
}
