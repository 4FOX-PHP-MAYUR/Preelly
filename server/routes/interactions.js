const express = require('express')
const router = express.Router()
const Product = require('../models/Product')
const User = require('../models/User')
const Comment = require('../models/Comment')
const CommentReport = require('../models/CommentReport')
const authMiddleware = require('../middleware/auth')
const validateObjectId = require('../middleware/validateObjectId')

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
      { new: true, useFindAndModify: false }
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
    const user = await User.findById(req.user._id).populate('savedProducts')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const products = await Product.find({
      _id: { $in: user.savedProducts || [] },
    })
      .populate('category', 'name icon emoji')
      .populate('seller', 'name avatar rating memberSince isVerified')

    res.json(products)
  } catch (error) {
    console.error('Error fetching saved products:', error)
    res.status(500).json({ message: 'Error fetching saved products' })
  }
})

// @route   POST /api/user/:id/follow
// @desc    Follow/Unfollow a user
// @access  Private
router.post('/user/:id/follow', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id)
    const targetUser = await User.findById(req.params.id)

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (currentUser._id.toString() === targetUser._id.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' })
    }

    if (!currentUser.following) {
      currentUser.following = []
    }
    if (!targetUser.followers) {
      targetUser.followers = []
    }

    // Use some() for proper ObjectId comparison
    const isFollowing = currentUser.following.some(
      (id) => id.toString() === targetUser._id.toString()
    )

    if (isFollowing) {
      // Unfollow: remove from currentUser.following and targetUser.followers
      currentUser.following = currentUser.following.filter(
        (id) => id.toString() !== targetUser._id.toString()
      )
      targetUser.followers = targetUser.followers.filter(
        (id) => id.toString() !== currentUser._id.toString()
      )
    } else {
      // Follow: add to currentUser.following and targetUser.followers
      currentUser.following.push(targetUser._id)
      targetUser.followers.push(currentUser._id)
    }

    await currentUser.save()
    await targetUser.save()

    res.json({
      following: !isFollowing,
      followerCount: targetUser.followers.length,
      followingCount: currentUser.following.length,
    })
  } catch (error) {
    console.error('Error toggling follow:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    res.status(500).json({ message: 'Error toggling follow' })
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
      .sort({ createdAt: -1 })
      .lean()

    // Always return a plain array so frontend can bind directly
    const list = Array.isArray(comments) ? comments : []
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
    const { text } = req.body
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' })
    }

    const comment = new Comment({
      product: req.params.id,
      user: req.user._id,
      text: text.trim(),
      status: 'approved',
    })
    await comment.save()

    // Re-fetch with populate + lean so response shape matches GET (frontend can append as-is)
    const saved = await Comment.findById(comment._id)
      .populate('user', 'name avatar')
      .lean()
    const payload = saved || comment.toObject?.() || comment
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

