import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Heart,
  MessageCircle,
  Send,
  Eye,
  Bookmark,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageSquare,
  Calendar,
  Gauge,
  Settings2,
  CheckCircle2,
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { selectIsAuthenticated, selectUser } from '../../store/slices/authSlice'
import { interactionService } from '../../services/api'
import { getMediaUrl } from '../../utils/helpers'
import { buildReelShareUrl } from '../../utils/reelShare'
import toast from 'react-hot-toast'
import ReelCommentsModal from './ReelCommentsModal'
import ReelShareModal from './ReelShareModal'

function QuickViewModal({ product, onClose, onOpenChat }) {
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const currentUser = useSelector(selectUser)

  // ── local interaction state (mirrors ProductReelCard pattern) ──
  const [isLiked, setIsLiked] = useState(Boolean(product.liked))
  const [likeCount, setLikeCount] = useState(product.likesCount ?? product.likes?.length ?? 0)
  const [isSaved, setIsSaved] = useState(Boolean(product.saved))
  const [commentCount, setCommentCount] = useState(product.commentCount ?? 0)
  const viewCount = product.views ?? 0

  // ── child-modal visibility ──
  const [showComments, setShowComments] = useState(false)
  const [commentTab, setCommentTab] = useState('comments')
  const [showShare, setShowShare] = useState(false)

  // ── image carousel ──
  const allImages = (() => {
    const imgs = []
    if (product.images?.length) product.images.forEach((img) => imgs.push(getMediaUrl(img)))
    if (product.videoScreenshots?.length) product.videoScreenshots.forEach((s) => imgs.push(getMediaUrl(s.image)))
    return imgs.filter(Boolean)
  })()
  const [currentImage, setCurrentImage] = useState(0)

  // ── slide-in animation ──
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 280)
  }, [onClose])

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) handleClose()
  }

  const prevImage = (e) => {
    e.stopPropagation()
    setCurrentImage((p) => (p === 0 ? allImages.length - 1 : p - 1))
  }
  const nextImage = (e) => {
    e.stopPropagation()
    setCurrentImage((p) => (p === allImages.length - 1 ? 0 : p + 1))
  }

  // ── Like ──
  const handleLike = async (e) => {
    e.stopPropagation()
    if (!isAuthenticated) {
      toast.error('Please login to like products')
      navigate('/login')
      return
    }
    const prev = isLiked
    setIsLiked(!prev)
    setLikeCount((c) => (prev ? c - 1 : c + 1))
    try {
      const res = await interactionService.likeProduct(product._id)
      setIsLiked(res.data.liked)
      setLikeCount(res.data.likeCount)
    } catch {
      setIsLiked(prev)
      setLikeCount((c) => (prev ? c + 1 : c - 1))
      toast.error('Failed to like product')
    }
  }

  // ── Save / Bookmark ──
  const handleSave = async (e) => {
    e.stopPropagation()
    if (!isAuthenticated) {
      toast.error('Please login to save products')
      navigate('/login')
      return
    }
    const prev = isSaved
    setIsSaved(!prev)
    try {
      const res = await interactionService.saveProduct(product._id)
      setIsSaved(res.data.saved)
      toast.success(res.data.saved ? 'Saved to collection' : 'Removed from saved')
    } catch {
      setIsSaved(prev)
      toast.error('Failed to save product')
    }
  }

  // ── Comment ──
  const handleComment = (e) => {
    e.stopPropagation()
    setCommentTab('comments')
    setShowComments(true)
  }

  // ── Share ──
  const handleShare = (e) => {
    e.stopPropagation()
    if (!isAuthenticated) {
      // unauthenticated: native share / clipboard fallback
      const url = buildReelShareUrl(product._id)
      if (navigator.share) {
        navigator.share({ title: product.title, url }).catch(() => {})
      } else {
        navigator.clipboard.writeText(url)
        toast.success('Link copied!')
      }
      return
    }
    setShowShare(true)
  }

  // ── Bottom bar ──
  const handleCall = (e) => {
    e.stopPropagation()
    const phone = product.seller?.phone || product.contactPhone
    if (phone) {
      window.location.href = `tel:${phone}`
    } else {
      toast.error('Phone number not available')
    }
  }

  const handleWhatsApp = (e) => {
    e.stopPropagation()
    const phone = product.seller?.phone || product.contactPhone
    if (phone) {
      const text = encodeURIComponent(
        `Hi, I'm interested in your listing: ${product.title} — ${product.currency || 'AED'} ${product.price?.toLocaleString()}`
      )
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${text}`, '_blank')
    } else {
      toast.error('WhatsApp not available')
    }
  }

  const handleChatButton = (e) => {
    e.stopPropagation()
    if (!isAuthenticated) {
      toast.error('Please login to chat')
      navigate('/login')
      return
    }
    handleClose()
    if (onOpenChat) onOpenChat()
  }

  const handleViewFull = (e) => {
    e.stopPropagation()
    handleClose()
    navigate(`/products/${product._id}`)
  }

  // ── Spec rows (vehicle-first, then generic) ──
  const specRows = (() => {
    const rows = []
    if (product.fuelType)     rows.push({ label: 'Fuel Type',             value: product.fuelType })
    if (product.sellerType)   rows.push({ label: 'Seller Type',           value: product.sellerType })
    if (product.engineSize)   rows.push({ label: 'Engine Capacity (cc)',  value: product.engineSize })
    if (product.cylinders)    rows.push({ label: 'No. of Cylinders',      value: product.cylinders })
    if (product.transmission) rows.push({ label: 'Transmission',          value: product.transmission })
    if (product.bodyType)     rows.push({ label: 'Body Type',             value: product.bodyType })
    if (product.drivetrain)   rows.push({ label: 'Drivetrain',            value: product.drivetrain })
    if (product.color)        rows.push({ label: 'Color',                 value: product.color })
    if (product.condition)    rows.push({ label: 'Condition',             value: product.condition })
    if (product.brand)        rows.push({ label: 'Brand',                 value: product.brand })
    if (product.model)        rows.push({ label: 'Model',                 value: product.model })
    if (product.warranty)     rows.push({ label: 'Warranty',              value: product.warranty })
    if (product.material)     rows.push({ label: 'Material',              value: product.material })
    if (product.size)         rows.push({ label: 'Size',                  value: product.size })
    return rows
  })()

  const formatCount = (n) => {
    if (!n) return '0'
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return String(n)
  }

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const sellerName = product.seller?.name || product.seller?.username || product.contactName || 'Seller'
  const sellerAvatar = product.seller?.avatar ? getMediaUrl(product.seller.avatar) : null

  return (
    <>
      {/* ── Quick View bottom sheet ── */}
      <div
        className="fixed inset-0 z-[9999] flex items-end justify-center"
        style={{
          backgroundColor: visible ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
          transition: 'background-color 280ms ease',
        }}
        onClick={handleBackdrop}
      >
        <div
          className="relative w-full max-w-md bg-white flex flex-col overflow-hidden"
          style={{
            borderRadius: '20px 20px 0 0',
            maxHeight: '92vh',
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 280ms cubic-bezier(0.32,0.72,0,1)',
            boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
            <h2 className="text-base font-bold text-gray-900">Quick Details</h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain pb-28">

            {/* Image Carousel */}
            <div className="relative w-full bg-gray-100" style={{ aspectRatio: '16/10' }}>
              {allImages.length > 0 ? (
                <>
                  <img
                    src={allImages[currentImage]}
                    alt={product.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = '/placeholder.jpg' }}
                  />
                  {allImages.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      {currentImage + 1}/{allImages.length}
                    </div>
                  )}
                  {allImages.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <span className="text-gray-400 text-sm">No image</span>
                </div>
              )}
            </div>

            {/* ── Engagement stats row ── */}
            <div className="flex items-center gap-5 px-4 pt-3 pb-2">
              {/* Like */}
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 active:scale-90 transition-transform"
                aria-label="Like"
              >
                <Heart className={`h-5 w-5 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
                <span className={`text-sm font-medium ${isLiked ? 'text-red-500' : 'text-gray-600'}`}>
                  {formatCount(likeCount)}
                </span>
              </button>

              {/* Comment */}
              <button
                onClick={handleComment}
                className="flex items-center gap-1.5 active:scale-90 transition-transform"
                aria-label="Comment"
              >
                <MessageCircle className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-600">{formatCount(commentCount)}</span>
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 active:scale-90 transition-transform"
                aria-label="Share"
              >
                <Send className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-600">{formatCount(product.shares ?? 0)}</span>
              </button>

              {/* Views (read-only) */}
              <div className="flex items-center gap-1.5">
                <Eye className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-500">{formatCount(viewCount)}</span>
              </div>

              {/* Save / Bookmark */}
              <button
                onClick={handleSave}
                className="ml-auto active:scale-90 transition-transform"
                aria-label="Save"
              >
                <Bookmark
                  className={`h-5 w-5 transition-colors ${isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-500'}`}
                />
              </button>
            </div>

            <div className="px-4 space-y-3">
              {/* Title + Price */}
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-gray-900 leading-snug flex-1">{product.title}</h3>
                {product.price != null && (
                  <span
                    className="flex-shrink-0 px-3 py-1 rounded-full text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)' }}
                  >
                    {product.currency || 'AED'} {product.price?.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Quick detail pills */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                {product.year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {product.year}
                  </span>
                )}
                {product.mileage != null && (
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5 text-gray-400" />
                    {product.mileage.toLocaleString()} km
                  </span>
                )}
                {(product.targetMarket || product.specs || product.condition) && (
                  <span className="flex items-center gap-1">
                    <Settings2 className="h-3.5 w-3.5 text-gray-400" />
                    {product.targetMarket || product.specs || product.condition}
                  </span>
                )}
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                  <CheckCircle2 className="h-3 w-3" />
                  Available
                </span>
              </div>

              {/* Seen by + Posted date */}
              <div className="flex items-center gap-2">
                {sellerAvatar ? (
                  <img src={sellerAvatar} alt={sellerName} className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-200" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-600 text-xs font-bold">{sellerName.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className="text-xs text-gray-500 leading-tight">
                  {viewCount > 0 ? (
                    <span>
                      Seen by <span className="font-medium text-gray-700">{sellerName}</span> and{' '}
                      {viewCount > 1 ? `${formatCount(viewCount - 1)} others` : 'others'}
                    </span>
                  ) : (
                    <span>
                      Posted by <span className="font-medium text-gray-700">{sellerName}</span>
                    </span>
                  )}
                  {product.createdAt && (
                    <span>
                      {' '}Posted On:{' '}
                      <span className="font-semibold text-gray-800">{formatDate(product.createdAt)}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* Location */}
              {product.location && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Location</p>
                  <div className="flex items-start gap-1.5 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="leading-snug">{product.location}</span>
                  </div>
                </div>
              )}

              {/* Specifications grid */}
              {specRows.length > 0 && (
                <div>
                  <div className="border-t border-gray-100 mb-3" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {specRows.map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-400 leading-none mb-0.5">{label}</p>
                        <p className="text-sm font-bold text-gray-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* View full listing */}
              <button
                onClick={handleViewFull}
                className="w-full text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 py-1"
              >
                View Full Listing →
              </button>
            </div>
          </div>

          {/* Fixed bottom action bar */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-3 bg-white border-t border-gray-100"
            style={{ boxShadow: '0 -2px 16px rgba(0,0,0,0.08)' }}
          >
            <button
              onClick={handleCall}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm text-white transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)' }}
            >
              <Phone className="h-4 w-4" />
              <span>Call</span>
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm text-white transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg,#22c55e 0%,#16a34a 100%)' }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span>WhatsApp</span>
            </button>
            <button
              onClick={handleChatButton}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm text-white transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg,#a78bfa 0%,#7c3aed 100%)' }}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Chat</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Comments / Chat drawer (renders on top of quick view) ── */}
      {showComments && product?._id && (
        <ReelCommentsModal
          productId={String(product._id)}
          productTitle={product.title}
          product={product}
          initialTab={commentTab}
          onClose={() => setShowComments(false)}
          onCommentAdded={() => setCommentCount((c) => c + 1)}
        />
      )}

      {/* ── Share modal (renders on top of quick view) ── */}
      <ReelShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        product={product}
        userId={currentUser?._id}
      />
    </>
  )
}

export default QuickViewModal
