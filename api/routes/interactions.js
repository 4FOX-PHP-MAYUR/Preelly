const express = require('express')
const router = express.Router()
const Product = require('../models/Product')
const User = require('../models/User')
const Follow = require('../models/Follow')
const Notification = require('../models/Notification')
const Comment = require('../models/Comment')
const CommentReport = require('../models/CommentReport')
const ProductView = require('../models/ProductView')
const authMiddleware = require('../middleware/auth')
const validateObjectId = require('../middleware/validateObjectId')

function toObjectIdString(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) {
    return String(value._id || value)
  }
  return String(value)
}

function serializeComment(comment) {
  if (!comment) return null
  const parentId = toObjectIdString(comment.parentID || comment.parentComment)
  return {
    ...comment,
    _id: String(comment._id),
    product: comment.product ? String(comment.product) : comment.product,
    parentID: parentId,
    parentComment: parentId,
    likes: Array.isArray(comment.likes) ? comment.likes.map((id) => String(id)) : [],
  }
}

// @route   POST /api/products/:id/like
// @desc    Like/Unlike a product
// @access  Private
router.post('/products/:id/like', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const userId = req.user._id
    
    // Use some() for proper ObjectId comparison
    const isLiked = product.likes?.some(
      (id) => id.toString() === userId.toString()
    ) || false

    if (isLiked) {
      product.likes = product.likes.filter(
        (id) => id.toString() !== userId.toString()
      )
    } else {
      if (!product.likes) {
        product.likes = []
      }
      product.likes.push(userId)
    }

    await product.save()

    res.json({
      liked: !isLiked,
      likeCount: product.likes.length,
    })
  } catch (error) {
    console.error('Error toggling like:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error toggling like' })
  }
})

// @route   POST /api/products/:id/view
// @desc    Increment product view count
// @access  Public
router.post('/products/:id/view', validateObjectId('id'), async (req, res) => {
  try {
    const id = req.params.id
    // Atomic increment to avoid race conditions and model save validation issues
    const updated = await Product.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { returnDocument: 'after' }
    ).lean()

    if (!updated) {
      return res.status(404).json({ message: 'Product not found' })
    }

    return res.json({ views: updated.views })
  } catch (error) {
    console.error('Error incrementing views:', error)
    if (error && error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    // Return safe JSON error message (avoid crashing client flows)
    return res.status(500).json({ message: 'Error incrementing views' })
  }
})

// @route   POST /api/products/:id/video-view
// @desc    Record authenticated video view (>=50% watched on client). Inserts productview row and syncs product.views.
// @access  Private
router.post('/products/:id/video-view', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const productId = req.params.id
    const userId = req.user._id

    const product = await Product.findById(productId).select('_id status').lean()
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const existing = await ProductView.findOne({
      productID: productId,
      userID: userId,
      status: 'active',
    }).lean()

    let recorded = false
    if (!existing) {
      try {
        await ProductView.create({
          productID: productId,
          userID: userId,
          dateAdded: new Date(),
          status: 'active',
        })
        recorded = true
      } catch (createErr) {
        if (createErr?.code !== 11000) throw createErr
        // Duplicate key — another concurrent request inserted first
      }
    }

    const views = await ProductView.countDocuments({
      productID: productId,
      status: 'active',
    })

    await Product.findByIdAndUpdate(productId, { $set: { views } })

    return res.json({ views, recorded: recorded || Boolean(existing) })
  } catch (error) {
    console.error('Error recording video view:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    return res.status(500).json({ message: 'Error recording video view' })
  }
})

// @route   POST /api/products/:id/share
// @desc    Increment product share count
// @access  Public
router.post('/products/:id/share', validateObjectId('id'), async (req, res) => {
  try {
    const id = req.params.id
    // Atomic increment to avoid race conditions and model save validation issues
    const updated = await Product.findByIdAndUpdate(
      id,
      { $inc: { shares: 1 } },
      { returnDocument: 'after' }
    ).lean()

    if (!updated) {
      return res.status(404).json({ message: 'Product not found' })
    }

    return res.json({ shares: updated.shares })
  } catch (error) {
    console.error('Error incrementing shares:', error)
    if (error && error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    return res.status(500).json({ message: 'Error incrementing shares' })
  }
})

// @route   POST /api/products/:id/save
// @desc    Save/Unsave a product
// @access  Private
router.post('/products/:id/save', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const productId = req.params.id
    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    if (!user.savedProducts) {
      user.savedProducts = []
    }

    // Use some() for proper ObjectId comparison
    const isSaved = user.savedProducts.some(
      (id) => id.toString() === productId.toString()
    )

    if (isSaved) {
      user.savedProducts = user.savedProducts.filter(
        (id) => id.toString() !== productId.toString()
      )
    } else {
      user.savedProducts.push(productId)
    }

    await user.save()

    res.json({
      saved: !isSaved,
    })
  } catch (error) {
    console.error('Error toggling save:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error toggling save' })
  }
})

// @route   GET /api/user/saved
// @desc    Get user's saved products
// @access  Private
router.get('/user/saved', authMiddleware, async (req, res) => {
  try {
    // Use lean() so savedProducts stays as plain ObjectId array (not populated docs)
    const user = await User.findById(req.user._id).select('savedProducts').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })

    const savedIds = (user.savedProducts || []).filter(Boolean)
    const products = await Product.find({ _id: { $in: savedIds } })
      .populate('category', 'name icon emoji')
      .populate('seller', 'name avatar rating isVerified identityVerificationStatus')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ items: products })
  } catch (error) {
    console.error('Error fetching saved products:', error)
    res.status(500).json({ message: 'Error fetching saved products' })
  }
})

// @route   GET /api/user/:id/follow-status
// @desc    Get the follow relationship status between current user and target
// @access  Private
router.get('/user/:id/follow-status', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const followerId = req.user._id
    const followingId = req.params.id

    if (followerId.toString() === followingId) {
      return res.json({ status: 'self' })
    }

    const record = await Follow.findOne({ follower: followerId, following: followingId })
    res.json({ status: record ? record.status : 'none' })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching follow status' })
  }
})

// @route   POST /api/user/:id/follow
// @desc    Send a follow request (pending) or cancel/unfollow if already pending/active
// @access  Private
router.post('/user/:id/follow', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const followerId = req.user._id
    const followingId = req.params.id

    if (followerId.toString() === followingId) {
      return res.status(400).json({ message: 'Cannot follow yourself' })
    }

    const targetUser = await User.findById(followingId).select('name').lean()
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    const existing = await Follow.findOne({ follower: followerId, following: followingId })

    if (existing) {
      if (existing.status === 'blocked') {
        return res.status(403).json({ message: 'You cannot follow this user' })
      }
      // cancel pending request or unfollow active — remove record
      const wasPending = existing.status === 'pending'
      await existing.deleteOne()

      // remove the follow_request notification if cancelling a pending request
      if (wasPending) {
        await Notification.deleteOne({
          user: followingId,
          actor: followerId,
          type: 'follow_request',
        })
      }

      const followerCount = await Follow.countDocuments({ following: followingId, status: 'active' })
      const followingCount = await Follow.countDocuments({ follower: followerId, status: 'active' })
      return res.json({
        status: 'none',
        following: false,
        pending: false,
        followerCount,
        followingCount,
      })
    }

    // check if the target has blocked this user
    const blockedByTarget = await Follow.findOne({
      follower: followingId,
      following: followerId,
      status: 'blocked',
    })
    if (blockedByTarget) {
      return res.status(403).json({ message: 'You cannot follow this user' })
    }

    // create pending follow request
    await Follow.create({
      follower: followerId,
      following: followingId,
      status: 'pending',
      requestedAt: new Date(),
    })

    // notify the target user about the follow request
    const requester = await User.findById(followerId).select('name').lean()
    await Notification.create({
      user: followingId,
      actor: followerId,
      type: 'follow_request',
      tab: 'general',
      title: 'New follow request',
      body: `${requester.name} wants to follow you`,
      data: { followerId: followerId.toString() },
    })

    const followerCount = await Follow.countDocuments({ following: followingId, status: 'active' })
    const followingCount = await Follow.countDocuments({ follower: followerId, status: 'active' })
    res.json({ status: 'pending', following: false, pending: true, followerCount, followingCount })
  } catch (error) {
    console.error('Error sending follow request:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error sending follow request' })
  }
})

// @route   POST /api/user/:id/follow/accept
// @desc    Accept a follow request from user :id
// @access  Private
router.post('/user/:id/follow/accept', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const followingId = req.user._id   // the one accepting
    const followerId = req.params.id   // the one who sent the request

    const record = await Follow.findOne({ follower: followerId, following: followingId, status: 'pending' })
    if (!record) {
      return res.status(404).json({ message: 'No pending follow request from this user' })
    }

    record.status = 'active'
    record.followedAt = new Date()
    await record.save()

    // mark the follow_request notification as read
    await Notification.updateOne(
      { user: followingId, actor: followerId, type: 'follow_request' },
      { isRead: true }
    )

    // notify the requester that their request was accepted
    const accepter = await User.findById(followingId).select('name').lean()
    await Notification.create({
      user: followerId,
      actor: followingId,
      type: 'follow',
      tab: 'general',
      title: 'Follow request accepted',
      body: `${accepter.name} accepted your follow request`,
    })

    const followerCount = await Follow.countDocuments({ following: followingId, status: 'active' })
    res.json({ accepted: true, followerCount })
  } catch (error) {
    console.error('Error accepting follow request:', error)
    res.status(500).json({ message: 'Error accepting follow request' })
  }
})

// @route   POST /api/user/:id/follow/reject
// @desc    Reject (delete) a follow request from user :id
// @access  Private
router.post('/user/:id/follow/reject', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const followingId = req.user._id   // the one rejecting
    const followerId = req.params.id   // the one who sent the request

    const record = await Follow.findOne({ follower: followerId, following: followingId, status: 'pending' })
    if (!record) {
      return res.status(404).json({ message: 'No pending follow request from this user' })
    }

    await record.deleteOne()

    // mark the notification as read and remove it
    await Notification.deleteOne({ user: followingId, actor: followerId, type: 'follow_request' })

    const followerCount = await Follow.countDocuments({ following: followingId, status: 'active' })
    res.json({ rejected: true, followerCount })
  } catch (error) {
    console.error('Error rejecting follow request:', error)
    res.status(500).json({ message: 'Error rejecting follow request' })
  }
})

// @route   POST /api/user/:id/block
// @desc    Block/Unblock a user — blocked user cannot follow you
// @access  Private
router.post('/user/:id/block', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const blockerId = req.user._id
    const targetId = req.params.id

    if (blockerId.toString() === targetId) {
      return res.status(400).json({ message: 'Cannot block yourself' })
    }

    const targetExists = await User.exists({ _id: targetId })
    if (!targetExists) {
      return res.status(404).json({ message: 'User not found' })
    }

    // The block record lives as: follower=targetId, following=blockerId, status=blocked
    // meaning: targetId is blocked from following blockerId
    const existing = await Follow.findOne({ follower: targetId, following: blockerId })

    if (existing && existing.status === 'blocked') {
      // unblock — remove the record
      await existing.deleteOne()
      return res.json({ blocked: false, message: 'User unblocked' })
    }

    if (existing) {
      // was following — upgrade to blocked
      existing.status = 'blocked'
      existing.followedAt = null
      existing.blockedAt = new Date()
      await existing.save()
    } else {
      await Follow.create({
        follower: targetId,
        following: blockerId,
        status: 'blocked',
        blockedAt: new Date(),
      })
    }

    res.json({ blocked: true, message: 'User blocked' })
  } catch (error) {
    console.error('Error toggling block:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error toggling block' })
  }
})

// @route   GET /api/products/:id/liked
// @desc    Check if product is liked by current user
// @access  Private
router.get('/products/:id/liked', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // Use some() for proper ObjectId comparison
    const isLiked = product.likes?.some(
      (id) => id.toString() === req.user._id.toString()
    ) || false

    res.json({ liked: isLiked })
  } catch (error) {
    console.error('Error checking like status:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error checking like status' })
  }
})

// @route   GET /api/products/:id/saved
// @desc    Check if product is saved by current user
// @access  Private
router.get('/products/:id/saved', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Convert to string for comparison (ObjectId comparison)
    const productId = req.params.id
    const isSaved = user.savedProducts?.some(
      (id) => id.toString() === productId.toString()
    ) || false

    res.json({ saved: isSaved })
  } catch (error) {
    console.error('Error checking save status:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error checking save status' })
  }
})

// @route   POST /api/products/:id/report
// @desc    Report a product
// @access  Private
router.post('/products/:id/report', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const { reason, description } = req.body
    const product = await Product.findById(req.params.id)
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // In a real app, you would save this to a reports collection
    // For now, we'll just log it
    console.log('Product reported:', {
      productId: req.params.id,
      reportedBy: req.user._id,
      reason,
      description,
      timestamp: new Date(),
    })

    res.json({ message: 'Product reported successfully' })
  } catch (error) {
    console.error('Error reporting product:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error reporting product' })
  }
})

// @route   GET /api/products/:id/comments
// @desc    Get all published comments for a product (persisted in DB). Returns array only.
// @access  Public
router.get('/products/:id/comments', validateObjectId('id'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const comments = await Comment.find({
      product: req.params.id,
      status: 'approved',
    })
      .populate('user', 'name avatar')
      .select('product user text status likes parentID parentComment createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean()

    // Backfill parentID on legacy reply documents (parentComment set but parentID missing)
    const legacyReplies = comments.filter((c) => c.parentComment && !c.parentID)
    if (legacyReplies.length > 0) {
      await Promise.all(
        legacyReplies.map((c) =>
          Comment.updateOne(
            { _id: c._id },
            { $set: { parentID: c.parentComment, parentComment: c.parentComment } }
          )
        )
      )
      legacyReplies.forEach((c) => {
        c.parentID = c.parentComment
      })
    }

    // Always return a plain array so frontend can bind directly
    const list = (Array.isArray(comments) ? comments : []).map(serializeComment)
    res.json(list)
  } catch (error) {
    console.error('Error fetching comments:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error fetching comments' })
  }
})

// @route   POST /api/products/:id/comments
// @desc    Add a comment (saved to DB immediately, published, no approval)
// @access  Private
router.post('/products/:id/comments', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const { text, parentID, parentComment } = req.body
    const parentId = parentID || parentComment
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' })
    }

    if (parentId) {
      const parent = await Comment.findById(parentId)
      if (!parent) {
        return res.status(404).json({ message: 'Parent comment not found' })
      }
      if (parent.product.toString() !== req.params.id) {
        return res.status(400).json({ message: 'Parent comment does not belong to this product' })
      }
    }

    const comment = new Comment({
      product: req.params.id,
      user: req.user._id,
      text: text.trim(),
      status: 'approved',
    })
    if (parentId) {
      const parentIdString = String(parentId)
      comment.parentID = parentIdString
      comment.parentComment = parentIdString
    }
    await comment.save()

    // Ensure parent linkage is persisted even if schema cache is stale
    if (parentId) {
      await Comment.updateOne(
        { _id: comment._id },
        { $set: { parentID: String(parentId), parentComment: String(parentId) } }
      )
    }

    // Re-fetch with populate + lean so response shape matches GET (frontend can append as-is)
    const saved = await Comment.findById(comment._id)
      .populate('user', 'name avatar')
      .select('product user text status likes parentID parentComment createdAt updatedAt')
      .lean()
    const payload = serializeComment(saved || comment.toObject?.() || comment)
    res.status(201).json(payload)
  } catch (error) {
    console.error('Error creating comment:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error creating comment' })
  }
})

// @route   POST /api/comments/:id/report
// @desc    Report a comment. Saves: commentId, reporterUserId, reason, timestamp.
// @access  Private
router.post('/comments/:id/report', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body
    const validReasons = ['fake', 'abusive', 'spam', 'harassment', 'other']
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({ message: 'Valid reason is required: fake, abusive, spam, harassment, or other' })
    }

    const comment = await Comment.findById(req.params.id)
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' })
    }
    if (comment.user.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot report your own comment' })
    }

    const existing = await CommentReport.findOne({
      comment: req.params.id,
      reportedBy: req.user._id,
      status: 'pending',
    })
    if (existing) {
      return res.status(400).json({ message: 'You have already reported this comment' })
    }

    const report = new CommentReport({
      comment: req.params.id,
      reportedBy: req.user._id,
      reason,
    })
    await report.save()

    res.status(201).json({ message: 'Report submitted. It will be reviewed by moderators.' })
  } catch (error) {
    console.error('Error reporting comment:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid comment ID' })
    }
    res.status(500).json({ message: 'Error reporting comment' })
  }
})

// @route   DELETE /api/comments/:id
// @desc    Delete a comment
// @access  Private (only comment owner or admin)
router.delete('/comments/:id', authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' })
    }

    // Check if user is the comment owner or admin
    const isOwner = comment.user.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin'

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' })
    }

    await Comment.findByIdAndDelete(req.params.id)

    res.json({ message: 'Comment deleted successfully' })
  } catch (error) {
    console.error('Error deleting comment:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid comment ID' })
    }
    res.status(500).json({ message: 'Error deleting comment' })
  }
})

// @route   POST /api/comments/:id/like
// @desc    Like/Unlike a comment
// @access  Private
router.post('/comments/:id/like', authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' })
    }

    const userId = req.user._id
    const isLiked = comment.likes?.some(
      (id) => id.toString() === userId.toString()
    ) || false

    if (isLiked) {
      comment.likes = comment.likes.filter(
        (id) => id.toString() !== userId.toString()
      )
    } else {
      if (!comment.likes) {
        comment.likes = []
      }
      comment.likes.push(userId)
    }

    await comment.save()

    res.json({
      liked: !isLiked,
      likeCount: comment.likes.length,
    })
  } catch (error) {
    console.error('Error toggling comment like:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid comment ID' })
    }
    res.status(500).json({ message: 'Error toggling comment like' })
  }
})

// @route   GET /api/products/:id/comments/count
// @desc    Get comment count for a product
// @access  Public
router.get('/products/:id/comments/count', validateObjectId('id'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const count = await Comment.countDocuments({
      product: req.params.id,
      status: 'approved', // Only count approved comments
    })

    res.json({ count })
  } catch (error) {
    console.error('Error fetching comment count:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error fetching comment count' })
  }
})

module.exports = router

