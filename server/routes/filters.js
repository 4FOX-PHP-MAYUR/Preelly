const express = require('express')
const router = express.Router()
const Filter = require('../models/Filter')

// @route   GET /api/filters?parent_id=ID
// @desc    Get children of a filter by parent_id (for cascading dropdowns). Omit parent_id for roots.
// @access  Public
router.get('/', async (req, res) => {
  try {
    const parentId = req.query.parent_id ?? req.query.parentId

    const baseFilter = {
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    }

    // If parentId is provided (including explicit null/'')
    if (parentId !== undefined) {
      const id = parentId === 'null' || parentId === '' ? null : parentId
      const children = await Filter.getChildren(id, baseFilter).lean()
      const result = children.map((f) => ({
        id: String(f._id),
        name: f.name,
        slug: f.slug,
        parent_id: f.parentId ? String(f.parentId) : null,
        thumb_image: f.thumbImage || null,
        color_code: f.colorCode || null,
        status: f.isActive !== false,
      }))
      return res.json(result)
    }

    // No parent_id: return root filters by default
    const roots = await Filter.getChildren(null, baseFilter).lean()
    const result = roots.map((f) => ({
      id: String(f._id),
      name: f.name,
      slug: f.slug,
      parent_id: f.parentId ? String(f.parentId) : null,
      thumb_image: f.thumbImage || null,
      color_code: f.colorCode || null,
      status: f.isActive !== false,
    }))
    res.json(result)
  } catch (error) {
    console.error('Error fetching filters:', error)
    res.status(500).json({ message: 'Error fetching filters' })
  }
})

module.exports = router

