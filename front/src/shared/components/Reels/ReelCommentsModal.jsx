import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { X, Heart, Send, User, Flag, MoreHorizontal, Check, CheckCheck, MapPin, Package, Pin, Smile } from 'lucide-react'
import toast from 'react-hot-toast'
import { interactionService } from '@shared/services/api'
import { selectIsAuthenticated, selectUser } from '@shared/store/slices/authSlice'
import { useChat } from '../Chat/ChatContext'
import { getMediaUrl } from '@shared/utils/helpers'
import { formatListingPrice, getProductListingPrice } from '@shared/components/categoryBrowseShared'
import ChatMessageRichContent from '../Chat/ChatMessageRichContent'

const REPORT_REASONS = [
  { value: 'fake', label: 'Fake' },
  { value: 'abusive', label: 'Abusive' },
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'other', label: 'Other' },
]

const SLIDE_DURATION_MS = 280

function normalizeParentId(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    if (value._id) return String(value._id)
    if (typeof value.toString === 'function') {
      const asString = value.toString()
      if (/^[a-f\d]{24}$/i.test(asString)) return asString
    }
  }
  return value != null ? String(value) : null
}

function normalizeComment(comment) {
  if (!comment?._id) return comment
  const parentID = normalizeParentId(comment.parentID ?? comment.parentComment)
  return {
    ...comment,
    _id: String(comment._id),
    parentID,
    parentComment: parentID,
  }
}

function ReelCommentsModal({
  productId,
  productTitle,
  product,
  onClose,
  onCommentAdded,
  initialTab = 'comments',
  asPanel = false,
  variant = 'dark',
}) {
  const isLightPanel = variant === 'light' && asPanel
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const { threads, createOrGetThread, sendMessage, markThreadRead } = useChat()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [likedComments, setLikedComments] = useState(new Set())
  const [reportOpenFor, setReportOpenFor] = useState(null)
  const [reportingId, setReportingId] = useState(null)
  const [threadId, setThreadId] = useState(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [slideIn, setSlideIn] = useState(false)
  const [replyingToId, setReplyingToId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const listEndRef = useRef(null)
  const chatEndRef = useRef(null)
  const replyInputRef = useRef(null)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab, productId])

  useEffect(() => {
    if (asPanel) return
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSlideIn(true))
    })
    return () => cancelAnimationFrame(t)
  }, [asPanel])

  useEffect(() => {
    if (productId) fetchComments()
    setReplyingToId(null)
    setReplyText('')
  }, [productId])

  useEffect(() => {
    if (replyingToId) {
      replyInputRef.current?.focus()
    }
  }, [replyingToId])

  useEffect(() => {
    if (comments.length > 0) listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  const loadChatThread = useCallback(async () => {
    if (!product?.seller || !user?._id || !productId) return null
    setChatLoading(true)
    try {
      const sellerId = product.seller._id || product.seller.id
      const productImage = getMediaUrl(product.video) || (product.images?.length && getMediaUrl(product.images[0])) || ''
      const thread = await createOrGetThread({
        product: { id: productId, title: product.title || productTitle, image: productImage },
        buyer: { id: user._id, name: user?.name || user?.email || 'You' },
        seller: { id: sellerId, name: product.seller?.name || product.seller?.username || 'Seller' },
      })
      if (thread) {
        setThreadId(thread.id)
        markThreadRead(thread.id, 'buyer')
      }
      return thread
    } catch (err) {
      console.error('Load chat thread:', err)
      toast.error('Could not load chat')
      return null
    } finally {
      setChatLoading(false)
    }
  }, [product, productId, productTitle, user, createOrGetThread, markThreadRead])

  useEffect(() => {
    if (activeTab === 'chat' && product?.seller) {
      loadChatThread()
    } else {
      setThreadId(null)
    }
  }, [activeTab, product?.seller, product?._id, loadChatThread])

  const chatThread = threadId ? threads.find((t) => t.id === threadId) : null
  const chatMessages = chatThread?.messages || []

  const handleSendChat = async (e) => {
    e.preventDefault()
    if (!threadId || !chatMessage.trim() || !isAuthenticated) return
    setChatSending(true)
    try {
      await sendMessage(threadId, {
        senderId: user._id,
        senderRole: 'buyer',
        text: chatMessage.trim(),
      })
      setChatMessage('')
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (err) {
      console.error('Send message:', err)
      toast.error('Failed to send')
    } finally {
      setChatSending(false)
    }
  }

  const formatChatTime = (date) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  const fetchComments = async () => {
    if (!productId) return
    try {
      setLoading(true)
      const response = await interactionService.getComments(productId)
      const raw = Array.isArray(response.data) ? response.data : []
      const list = raw.map(normalizeComment)
      setComments(list)
      if (isAuthenticated && user?._id) {
        const likedSet = new Set()
        list.forEach((c) => {
          if (c.likes?.some((id) => id.toString() === user._id)) likedSet.add(c._id)
        })
        setLikedComments(likedSet)
      }
    } catch (err) {
      console.error('Fetch comments:', err)
      toast.error('Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) {
      toast.error('Please login to comment')
      return
    }
    if (!commentText.trim()) return
    try {
      setSubmitting(true)
      const response = await interactionService.addComment(productId, commentText.trim())
      const newComment = response?.data ?? response
      if (newComment?._id) {
        setComments((prev) => [normalizeComment(newComment), ...prev])
        onCommentAdded?.()
      } else {
        await fetchComments()
        onCommentAdded?.()
      }
      setCommentText('')
    } catch (err) {
      console.error('Add comment:', err)
      toast.error(err.response?.data?.message || 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReplyClick = (commentId) => {
    const id = String(commentId)
    if (!isAuthenticated) {
      toast.error('Please login to reply')
      return
    }
    if (String(replyingToId) === id) {
      setReplyingToId(null)
      setReplyText('')
      return
    }
    setReplyingToId(id)
    setReplyText('')
  }

  const handleReplySubmit = async (e, parentCommentId) => {
    e.preventDefault()
    if (!isAuthenticated) {
      toast.error('Please login to reply')
      return
    }
    if (!replyText.trim() || submittingReply) return
    const parentId = String(parentCommentId)
    try {
      setSubmittingReply(true)
      const response = await interactionService.addComment(productId, replyText.trim(), parentId)
      const newReply = response?.data ?? response
      if (newReply?._id) {
        setComments((prev) => [
          ...prev,
          normalizeComment({
            ...newReply,
            parentID: newReply.parentID ?? newReply.parentComment ?? parentId,
          }),
        ])
        onCommentAdded?.()
      } else {
        await fetchComments()
        onCommentAdded?.()
      }
      setReplyText('')
      setReplyingToId(null)
    } catch (err) {
      console.error('Add reply:', err)
      toast.error(err.response?.data?.message || 'Failed to add reply')
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleReport = async (commentId, reason) => {
    setReportOpenFor(null)
    if (!isAuthenticated) {
      toast.error('Please login to report')
      return
    }
    try {
      setReportingId(commentId)
      await interactionService.reportComment(commentId, reason)
      toast.success('Report submitted.')
    } catch (err) {
      console.error('Report comment:', err)
      toast.error(err.response?.data?.message || 'Failed to report')
    } finally {
      setReportingId(null)
    }
  }

  const handleLike = async (commentId) => {
    if (!isAuthenticated) {
      toast.error('Please login to like')
      return
    }
    try {
      const response = await interactionService.likeComment(commentId)
      const count = response.data?.likeCount
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId
            ? { ...c, likeCount: count ?? (typeof c.likeCount === 'number' ? c.likeCount : (Array.isArray(c.likes) ? c.likes.length : 0)) }
            : c
        )
      )
      const newSet = new Set(likedComments)
      if (response.data?.liked) newSet.add(commentId)
      else newSet.delete(commentId)
      setLikedComments(newSet)
    } catch (err) {
      console.error('Like comment:', err)
    }
  }

  const formatTimeAgo = (date, short = false) => {
    const d = new Date(date)
    const now = new Date()
    const s = Math.floor((now - d) / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    const day = Math.floor(h / 24)
    if (short) {
      if (day > 0) return `${day}d`
      if (h > 0) return `${h}h`
      if (m > 0) return `${m}m`
      return 'now'
    }
    if (day > 0) return `${day}d ago`
    if (h > 0) return `${h}h ago`
    if (m > 0) return `${m}m ago`
    return 'Just now'
  }

  const getLikeCount = (comment) =>
    typeof comment.likeCount === 'number' ? comment.likeCount : (Array.isArray(comment.likes) ? comment.likes.length : 0)

  const getSellerId = () => {
    const seller = product?.seller
    if (!seller) return null
    return String(seller._id || seller.id || seller)
  }

  const isCommentOwner = (comment) => {
    const sellerId = getSellerId()
    const userId = comment.user?._id || comment.user?.id
    return Boolean(sellerId && userId && String(userId) === sellerId)
  }

  const getCommentAuthorName = (comment) =>
    comment.user?.username || comment.user?.name || 'User'

  const getParentId = (comment) => normalizeParentId(comment?.parentID ?? comment?.parentComment)

  const commentsById = useMemo(() => {
    const map = new Map()
    comments.forEach((comment) => {
      if (comment?._id) map.set(String(comment._id), comment)
    })
    return map
  }, [comments])

  const topLevelComments = useMemo(
    () =>
      comments
        .filter((comment) => !getParentId(comment))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [comments]
  )

  const getDirectReplies = useCallback(
    (parentId) =>
      comments
        .filter((comment) => {
          const pid = getParentId(comment)
          return pid && String(pid) === String(parentId)
        })
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [comments]
  )

  const renderLightReplyForm = (parentCommentId) => {
    const parentId = String(parentCommentId)
    if (String(replyingToId) !== parentId) return null
    const parentComment = commentsById.get(parentId)
    const replyPlaceholder = parentComment
      ? `Reply to ${getCommentAuthorName(parentComment)}...`
      : 'Add a reply'
    return (
      <form onSubmit={(e) => handleReplySubmit(e, parentId)} className="mt-2">
        <div className="relative">
          <input
            ref={replyInputRef}
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={replyPlaceholder}
            className="w-full rounded-full border-0 bg-slate-100 px-3 py-2 pr-14 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={submittingReply || !replyText.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-semibold text-brand transition hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Post
          </button>
        </div>
      </form>
    )
  }

  const renderLightCommentBody = (comment) => (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold text-slate-900">{getCommentAuthorName(comment)}</span>
        <span className="text-xs text-slate-400">{formatTimeAgo(comment.createdAt, true)}</span>
        {isCommentOwner(comment) && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            Owner
            <Pin className="h-3 w-3" strokeWidth={2} />
          </span>
        )}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-slate-800 break-words">{comment.text}</p>
      <button
        type="button"
        onClick={() => handleReplyClick(String(comment._id))}
        className="mt-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-600"
      >
        Reply
      </button>
      {renderLightReplyForm(String(comment._id))}
    </>
  )

  const renderLightCommentLikes = (comment) => (
    <div className="flex flex-shrink-0 flex-col items-center gap-0.5 pt-0.5">
      <button
        type="button"
        onClick={() => handleLike(comment._id)}
        className="rounded-full p-1 transition hover:bg-slate-100"
        aria-label="Like comment"
      >
        <Heart
          className={`h-4 w-4 ${
            likedComments.has(comment._id) ? 'fill-rose-500 text-rose-500' : 'text-slate-500'
          }`}
          strokeWidth={1.75}
        />
      </button>
      <span className="min-w-[1rem] text-center text-xs text-slate-500">{getLikeCount(comment)}</span>
    </div>
  )

  const renderLightCommentAvatar = (comment, nested = false) => {
    const sizeClass = nested ? 'h-8 w-8' : 'h-9 w-9'
    return (
      <div className={`${sizeClass} flex-shrink-0 overflow-hidden rounded-full bg-slate-100`}>
        {comment.user?.avatar ? (
          <img
            src={getMediaUrl(comment.user.avatar) || comment.user.avatar}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className={`${nested ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-slate-400`} />
          </div>
        )}
      </div>
    )
  }

  const renderLightCommentRow = (comment, nested = false) => (
    <div className="flex items-start gap-3">
      {renderLightCommentAvatar(comment, nested)}
      <div className="min-w-0 flex-1">{renderLightCommentBody(comment)}</div>
      {renderLightCommentLikes(comment)}
    </div>
  )

  const renderLightCommentNode = (comment, depth = 0) => {
    const commentId = String(comment._id)
    const directReplies = getDirectReplies(commentId)
    const isNested = depth > 0

    return (
      <div key={commentId} className={isNested ? 'mt-3 ml-12' : undefined}>
        {renderLightCommentRow(comment, isNested)}
        {directReplies.map((reply) => renderLightCommentNode(reply, depth + 1))}
      </div>
    )
  }

  const renderLightCommentThread = (rootComment) => (
    <article key={String(rootComment._id)} className="px-4 py-3.5">
      {renderLightCommentNode(rootComment, 0)}
    </article>
  )

  if (!productId) return null

  const lightCommentsContent = (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-brand" />
          </div>
        ) : topLevelComments.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">No comments yet. Be the first!</div>
        ) : (
          <div>
            {topLevelComments.map((comment) => renderLightCommentThread(comment))}
            <div ref={listEndRef} />
          </div>
        )}
      </div>
      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        {isAuthenticated ? (
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-slate-100">
              {user?.avatar ? (
                <img src={getMediaUrl(user.avatar) || user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
              )}
            </div>
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment"
                className="w-full rounded-full border-0 bg-slate-100 px-4 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20"
                maxLength={1000}
              />
              <Smile className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
            </div>
          </form>
        ) : (
          <p className="py-1 text-center text-sm text-slate-400">Log in to comment.</p>
        )}
      </div>
    </>
  )

  const commentsContent = isLightPanel ? (
    lightCommentsContent
  ) : (
    <>
      <div className="px-3 py-1.5 sm:px-4 border-b border-gray-800">
        <span className="text-gray-400 text-xs sm:text-sm">{comments.length} comments</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 overflow-x-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-6 sm:py-8">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-gray-600 border-t-white" />
          </div>
        ) : comments.length === 0 ? (
          <>
            <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm px-3">No comments yet. Be the first!</div>
            {product && (
              <div className="px-3 py-4 sm:px-4 sm:py-5 border-t border-gray-800 bg-gray-800/40">
                <div className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm font-medium uppercase tracking-wide mb-3">
                  <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Product information</span>
                </div>
                <div className="flex gap-3 sm:gap-4">
                  {(product.images?.[0] || product.video) && (
                    <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-700">
                      <img src={getMediaUrl(product.images?.[0] || product.video)} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm sm:text-base line-clamp-2">{product.title || productTitle || 'Product'}</p>
                    {getProductListingPrice(product) != null && (
                      <p className="text-primary-400 font-semibold text-sm sm:text-base mt-1">
                        {formatListingPrice(product)}
                      </p>
                    )}
                    {product.location && (
                      <p className="text-gray-400 text-xs sm:text-sm mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                        <span className="truncate">{product.location}</span>
                      </p>
                    )}
                    {product.condition && (
                      <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Condition: {product.condition}</p>
                    )}
                    {product.seller && (
                      <p className="text-gray-400 text-xs sm:text-sm mt-1">
                        Seller: <span className="text-white/90">{product.seller.name || product.seller.username || '—'}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="divide-y divide-gray-800">
            {comments.map((comment) => (
              <div key={comment._id} className="flex gap-2 sm:gap-3 px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-gray-800/50 transition-colors">
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-gray-700">
                  {comment.user?.avatar ? (
                    <img src={getMediaUrl(comment.user.avatar) || comment.user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                    <div className="min-w-0">
                      <span className="font-medium text-xs sm:text-sm text-white truncate block">
                        {comment.user?.name || comment.user?.username || 'User'}
                      </span>
                      <p className="text-gray-300 text-xs sm:text-sm mt-0.5 break-words">{comment.text}</p>
                      <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
                        <span className="text-gray-500 text-[10px] sm:text-xs">{formatTimeAgo(comment.createdAt)}</span>
                        <button type="button" className="text-gray-500 text-[10px] sm:text-xs hover:text-white">
                          Reply
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLike(comment._id)}
                        className="p-0.5 sm:p-1 rounded hover:bg-gray-700 transition-colors"
                      >
                        <Heart
                          className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${likedComments.has(comment._id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                        />
                      </button>
                      <span className="text-gray-400 text-[10px] sm:text-xs min-w-[1rem] sm:min-w-[1.25rem]">{getLikeCount(comment)}</span>
                      {isAuthenticated && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setReportOpenFor(reportOpenFor === comment._id ? null : comment._id)}
                            className="p-0.5 sm:p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
                            disabled={reportingId === comment._id}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </button>
                          {reportOpenFor === comment._id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setReportOpenFor(null)} aria-hidden />
                              <div className="absolute right-0 top-full mt-1 py-1 min-w-[8rem] max-w-[min(90vw,14rem)] w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20">
                                {REPORT_REASONS.map(({ value, label }) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => handleReport(comment._id, value)}
                                    className="block w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={listEndRef} />

            {/* Product Information panel – after last comment, inside scroll area */}
            {product && (
              <div className="px-3 py-4 sm:px-4 sm:py-5 border-t border-gray-800 bg-gray-800/40">
                <div className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm font-medium uppercase tracking-wide mb-3">
                  <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Product information</span>
                </div>
                <div className="flex gap-3 sm:gap-4">
                  {(product.images?.[0] || product.video) && (
                    <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-700">
                      <img
                        src={getMediaUrl(product.images?.[0] || product.video)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm sm:text-base line-clamp-2">{product.title || productTitle || 'Product'}</p>
                    {getProductListingPrice(product) != null && (
                      <p className="text-primary-400 font-semibold text-sm sm:text-base mt-1">
                        {formatListingPrice(product)}
                      </p>
                    )}
                    {product.location && (
                      <p className="text-gray-400 text-xs sm:text-sm mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                        <span className="truncate">{product.location}</span>
                      </p>
                    )}
                    {product.condition && (
                      <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Condition: {product.condition}</p>
                    )}
                    {product.seller && (
                      <p className="text-gray-400 text-xs sm:text-sm mt-1">
                        Seller: <span className="text-white/90">{product.seller.name || product.seller.username || '—'}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 p-2 sm:p-3 border-t border-gray-800 bg-gray-900 pb-[env(safe-area-inset-bottom,0)] sm:pb-3">
        {isAuthenticated ? (
          <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2 items-center">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add comment..."
              className="flex-1 min-w-0 px-3 py-2 sm:px-4 sm:py-2.5 bg-gray-800 border border-gray-700 rounded-full text-white placeholder-gray-500 text-xs sm:text-sm focus:outline-none focus:border-primary-500"
              maxLength={1000}
            />
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className="p-2 sm:p-2.5 rounded-full bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </form>
        ) : (
          <p className="text-gray-500 text-xs sm:text-sm text-center py-1.5 sm:py-2">Log in to comment.</p>
        )}
      </div>
    </>
  )

  const isMe = (msg) => msg.senderId === user?._id || msg.senderRole === 'buyer'

  const productName = product?.title || productTitle || 'Product'
  const buyerName = user?.name || user?.username || 'You'
  const sellerName = product?.seller?.name || product?.seller?.username || chatThread?.seller?.name || 'Seller'

  const chatContent = (
    <>
      {/* Chat context: product, buyer, seller */}
      {(product?.seller || chatThread) && (
        <div className="flex-shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 border-b border-gray-800 bg-gray-800/50">
          <p className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wide">Product</p>
          <p className="text-xs sm:text-sm font-medium text-white truncate mt-0.5" title={productName}>{productName}</p>
          <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-0.5 mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-gray-400">
            <span><span className="text-gray-500">Buyer:</span> <span className="text-primary-300 truncate inline-block max-w-[120px] sm:max-w-none" title={buyerName}>{buyerName}</span></span>
            <span><span className="text-gray-500">Seller:</span> <span className="text-white/90 truncate inline-block max-w-[120px] sm:max-w-none" title={sellerName}>{sellerName}</span></span>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-3 flex flex-col gap-1.5 sm:gap-2 overflow-x-hidden">
        {chatLoading ? (
          <div className="flex items-center justify-center py-6 sm:py-8">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-gray-600 border-t-white" />
          </div>
        ) : !product?.seller ? (
          <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm px-3">Seller not available for chat.</div>
        ) : !isAuthenticated ? (
          <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm px-3">Log in to chat with the seller.</div>
        ) : chatMessages.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm px-3">No messages yet. Say hello!</div>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${isMe(msg) ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[90%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 ${
                  isMe(msg)
                    ? 'bg-primary-500 text-white rounded-br-md'
                    : 'bg-gray-700 text-white rounded-bl-md'
                }`}
              >
                <div className="text-xs sm:text-sm break-words">
                  <ChatMessageRichContent text={msg.text} bubbleVariant={isMe(msg) ? 'primary' : 'dark'} />
                </div>
                <p className={`text-[10px] sm:text-xs mt-0.5 flex items-center justify-end gap-1 ${isMe(msg) ? 'text-primary-100' : 'text-gray-400'}`}>
                  <span>{formatChatTime(msg.createdAt)}</span>
                  {isMe(msg) && (
                    msg.readAt ? (
                      <CheckCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0 text-primary-100" aria-label="Read" title="Read" />
                    ) : (
                      <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0 text-primary-200" aria-label="Sent" title="Sent" />
                    )
                  )}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      {isAuthenticated && product?.seller && (
        <div className="flex-shrink-0 p-2 sm:p-3 border-t border-gray-800 bg-gray-900 pb-[env(safe-area-inset-bottom,0)] sm:pb-3">
          <form onSubmit={handleSendChat} className="flex gap-1.5 sm:gap-2 items-center">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Type message…"
              className="flex-1 min-w-0 px-3 py-2 sm:px-4 sm:py-2.5 bg-gray-800 border border-gray-700 rounded-full text-white placeholder-gray-500 text-xs sm:text-sm focus:outline-none focus:border-primary-500"
              maxLength={1000}
            />
            <button
              type="submit"
              disabled={chatSending || !chatMessage.trim()}
              className="p-2 sm:p-2.5 rounded-full bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </form>
        </div>
      )}
    </>
  )

  const content = isLightPanel ? (
    <div className="flex h-full flex-col bg-white text-slate-900">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4">
        <h2 className="text-lg font-bold text-slate-900">Comments</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-rose-500 transition hover:text-rose-600"
        >
          Close
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{commentsContent}</div>
    </div>
  ) : (
    <div className={`flex flex-col bg-gray-900 text-white h-full ${asPanel ? 'rounded-none' : 'w-full max-w-[720px] shadow-2xl'}`}>
      {/* Sticky header: close + tabs */}
      <div className="flex-shrink-0 sticky top-0 z-10 bg-gray-900 border-b border-gray-800 pt-[env(safe-area-inset-top,0)]">
        <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 gap-2">
          <div className="flex gap-1 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'comments'
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Comments
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'chat'
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Chat
            </button>
          </div>
          {!asPanel && (
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-full hover:bg-gray-800 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5 sm:h-5 sm:w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'comments' ? commentsContent : chatContent}
      </div>
    </div>
  )

  if (asPanel) return content

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-[10001] flex flex-col transition-transform ease-out bg-gray-900 shadow-2xl w-full max-w-[100vw] sm:max-w-[400px] md:max-w-[520px] min-w-0"
        style={{
          transitionDuration: `${SLIDE_DURATION_MS}ms`,
          transform: slideIn ? 'translateX(0)' : 'translateX(100%)',
          paddingRight: 'env(safe-area-inset-right, 0)',
        }}
      >
        {content}
      </div>
    </>
  )
}

export default ReelCommentsModal
