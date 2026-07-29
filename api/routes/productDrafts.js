const express = require('express')
const router = express.Router()
const authMiddleware = require('../middleware/auth')
const validateObjectId = require('../middleware/validateObjectId')
const productDraftService = require('../services/productDraftService')

function sendError(res, err, fallbackMessage) {
  const status = err.status || 500
  if (status >= 500) {
    console.error('[product-drafts]', err)
  }
  return res.status(status).json({
    success: false,
    message: err.message || fallbackMessage,
  })
}

// @route   POST /api/product-drafts
// @desc    Create or update the user's in-progress Post Your Ad draft
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id
    const { draftId, ...payload } = req.body || {}

    const draft = await productDraftService.upsertDraft({
      userId,
      draftId: draftId || null,
      payload,
    })

    return res.status(draft.createdAt?.getTime() === draft.updatedAt?.getTime() ? 201 : 200).json({
      success: true,
      data: draft,
      draftId: draft._id,
    })
  } catch (err) {
    return sendError(res, err, 'Failed to save draft')
  }
})

// @route   PUT /api/product-drafts/:id
// @desc    Update an existing draft by id (step-aware merge)
// @access  Private
router.put('/:id', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const draft = await productDraftService.upsertDraft({
      userId: req.user._id,
      draftId: req.params.id,
      payload: req.body || {},
    })

    return res.json({
      success: true,
      data: draft,
      draftId: draft._id,
    })
  } catch (err) {
    return sendError(res, err, 'Failed to update draft')
  }
})

// @route   GET /api/product-drafts
// @desc    List the user's live drafts
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const drafts = await productDraftService.listDrafts(req.user._id)
    return res.json({ success: true, data: drafts })
  } catch (err) {
    return sendError(res, err, 'Failed to list drafts')
  }
})

// @route   GET /api/product-drafts/current
// @desc    Get the user's current in-progress draft (if any)
// @access  Private
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const draft = await productDraftService.getCurrentDraft(req.user._id)
    return res.json({ success: true, data: draft || null })
  } catch (err) {
    return sendError(res, err, 'Failed to load draft')
  }
})

// @route   GET /api/product-drafts/:id
// @desc    Get a single draft by id
// @access  Private
router.get('/:id', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const draft = await productDraftService.getDraftById({
      userId: req.user._id,
      draftId: req.params.id,
    })
    return res.json({ success: true, data: draft })
  } catch (err) {
    return sendError(res, err, 'Failed to load draft')
  }
})

// @route   POST /api/product-drafts/:id/publish
// @desc    Mark draft as published after product create succeeds
// @access  Private
router.post('/:id/publish', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const draft = await productDraftService.markPublished({
      userId: req.user._id,
      draftId: req.params.id,
      productId: req.body?.productId || null,
    })
    if (!draft) {
      return res.status(404).json({ success: false, message: 'Draft not found' })
    }
    return res.json({ success: true, data: draft })
  } catch (err) {
    return sendError(res, err, 'Failed to mark draft published')
  }
})

// @route   DELETE /api/product-drafts
// @desc    Discard / delete the user's current live draft (no id required)
// @access  Private
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const soft = String(req.query.soft || '').toLowerCase() === 'true'
    if (soft) {
      const draft = await productDraftService.discardDraft({ userId: req.user._id })
      return res.json({ success: true, data: draft })
    }
    await productDraftService.deleteDraft({ userId: req.user._id })
    return res.json({ success: true, message: 'Draft deleted' })
  } catch (err) {
    return sendError(res, err, 'Failed to delete draft')
  }
})

// @route   DELETE /api/product-drafts/:id
// @desc    Discard / delete a draft
// @access  Private
router.delete('/:id', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const soft = String(req.query.soft || '').toLowerCase() === 'true'
    if (soft) {
      const draft = await productDraftService.discardDraft({
        userId: req.user._id,
        draftId: req.params.id,
      })
      if (!draft) {
        return res.status(404).json({ success: false, message: 'Draft not found' })
      }
      return res.json({ success: true, data: draft })
    }

    const deleted = await productDraftService.deleteDraft({
      userId: req.user._id,
      draftId: req.params.id,
    })
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Draft not found' })
    }
    return res.json({ success: true, message: 'Draft deleted' })
  } catch (err) {
    return sendError(res, err, 'Failed to delete draft')
  }
})

module.exports = router
