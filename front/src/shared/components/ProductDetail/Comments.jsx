import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { MessageCircle, Heart, Trash2, Send, User, Flag } from 'lucide-react'
import toast from 'react-hot-toast'
import { interactionService } from '../../services/api'
import { selectIsAuthenticated, selectUser } from '../../store/slices/authSlice'

function Comments({ productId }) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [likedComments, setLikedComments] = useState(new Set())
  const [reportOpenFor, setReportOpenFor] = useState(null)
  const [reportingId, setReportingId] = useState(null)
  const commentsEndRef = useRef(null)

  const REPORT_REASONS = [
    { value: 'fake', label: 'Fake' },
    { value: 'abusive', label: 'Abusive' },
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'other', label: 'Other' },
  ]

  useEffect(() => {
    fetchComments()
  }, [productId])

  useEffect(() => {
    // Scroll to comments section if hash is present
    if (window.location.hash === '#comments') {
      setTimeout(() => {
        document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [])

  useEffect(() => {
    // Scroll to bottom when new comment is added
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments.length])

  const fetchComments = async () => {
    try {
      setLoading(true)
      const response = await interactionService.getComments(productId)
      setComments(response.data)
      
      // Check which comments are liked by current user
      if (isAuthenticated) {
        const likedSet = new Set()
        response.data.forEach((comment) => {
          if (comment.likes?.some((id) => id.toString() === user?._id)) {
            likedSet.add(comment._id)
          }
        })
        setLikedComments(likedSet)
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
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

    if (!commentText.trim()) {
      toast.error('Please enter a comment')
      return
    }

    try {
      setSubmitting(true)
      const response = await interactionService.addComment(productId, commentText.trim())
      const newComment = response?.data ?? response
      if (newComment && newComment._id) {
        setComments((prev) => [newComment, ...prev])
      } else {
        await fetchComments()
      }
      setCommentText('')
      toast.success('Comment added successfully')
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error(error.response?.data?.message || 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return
    }

    try {
      await interactionService.deleteComment(commentId)
      setComments(comments.filter((c) => c._id !== commentId))
      toast.success('Comment deleted successfully')
    } catch (error) {
      console.error('Error deleting comment:', error)
      toast.error(error.response?.data?.message || 'Failed to delete comment')
    }
  }

  const handleReport = async (commentId, reason) => {
    setReportOpenFor(null)
    if (!isAuthenticated) {
      toast.error('Please login to report comments')
      return
    }
    try {
      setReportingId(commentId)
      await interactionService.reportComment(commentId, reason)
      toast.success('Report submitted. Moderators will review it.')
    } catch (error) {
      console.error('Error reporting comment:', error)
      toast.error(error.response?.data?.message || 'Failed to submit report')
    } finally {
      setReportingId(null)
    }
  }

  const handleLike = async (commentId) => {
    if (!isAuthenticated) {
      toast.error('Please login to like comments')
      return
    }

    try {
      const isLiked = likedComments.has(commentId)
      const response = await interactionService.likeComment(commentId)
      
      setComments((prevComments) =>
        prevComments.map((comment) =>
          comment._id === commentId
            ? { ...comment, likes: response.data.likeCount }
            : comment
        )
      )

      const newLikedSet = new Set(likedComments)
      if (response.data.liked) {
        newLikedSet.add(commentId)
      } else {
        newLikedSet.delete(commentId)
      }
      setLikedComments(newLikedSet)
    } catch (error) {
      console.error('Error liking comment:', error)
      toast.error('Failed to like comment')
    }
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
    <div id="comments-section" className="bg-white rounded-lg shadow-md p-6 mt-8">
      <div className="flex items-center space-x-2 mb-6">
        <MessageCircle className="h-6 w-6 text-primary-600" />
        <h2 className="text-2xl font-bold text-gray-900">
          Comments ({comments.length})
        </h2>
      </div>

      {/* Comment Form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex space-x-3">
            <div className="flex-shrink-0">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-primary-600 resize-none"
                maxLength={1000}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">
                  {commentText.length}/1000 characters
                </span>
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-4 w-4" />
                  <span>{submitting ? 'Posting...' : 'Post Comment'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-gray-600">
            Please{' '}
            <a href="/login" className="text-primary-600 hover:underline font-semibold">
              login
            </a>{' '}
            to leave a comment
          </p>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p>No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment._id} className="flex space-x-3 pb-4 border-b border-gray-200 last:border-0">
              <div className="flex-shrink-0">
                {comment.user?.avatar ? (
                  <img
                    src={comment.user.avatar}
                    alt={comment.user.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{comment.user?.name || 'Anonymous'}</h4>
                    <p className="text-xs text-gray-500">{formatTimeAgo(comment.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isAuthenticated && user?._id !== comment.user?._id && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setReportOpenFor(reportOpenFor === comment._id ? null : comment._id)}
                          className="text-gray-400 hover:text-amber-600 transition-colors p-1"
                          title="Report comment"
                          disabled={reportingId === comment._id}
                        >
                          <Flag className="h-4 w-4" />
                        </button>
                        {reportOpenFor === comment._id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setReportOpenFor(null)}
                              aria-hidden
                            />
                            <div className="absolute right-0 top-full mt-1 py-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                              {REPORT_REASONS.map(({ value, label }) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => handleReport(comment._id, value)}
                                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {(user?._id === comment.user?._id || user?.role === 'admin') && (
                      <button
                        onClick={() => handleDelete(comment._id)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1"
                        title="Delete comment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-gray-700 mt-2 whitespace-pre-wrap">{comment.text}</p>
                <div className="flex items-center space-x-4 mt-3">
                  <button
                    onClick={() => handleLike(comment._id)}
                    className={`flex items-center space-x-1 text-sm transition-colors ${
                      likedComments.has(comment._id)
                        ? 'text-red-500'
                        : 'text-gray-500 hover:text-red-500'
                    }`}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        likedComments.has(comment._id) ? 'fill-current' : ''
                      }`}
                    />
                    <span>{comment.likes?.length || 0}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div ref={commentsEndRef} />
        </div>
      )}
    </div>
  )
}

export default Comments

