const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const Category = require('../models/Category')
const Filter = require('../models/Filter')
const CategoryFilter = require('../models/CategoryFilter')

// @route   GET /api/category-filters?category_id=ID&subcategory_id=ID&child_category_id=ID
// @desc    Get filters by selected category level (child > subcategory > category)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const categoryId = req.query.category_id ?? req.query.categoryId
    const subcategoryId = req.query.subcategory_id ?? req.query.subcategoryId ?? req.query.subCategoryId
    const childCategoryId =
      req.query.child_category_id ?? req.query.childCategoryId ?? req.query.childCategoryID
    const scopeId = childCategoryId || subcategoryId || categoryId

    if (!scopeId || !mongoose.Types.ObjectId.isValid(String(scopeId))) {
      return res.status(400).json({ message: 'Invalid or missing category_id/subcategory_id/child_category_id' })
    }

    const category = await Category.findById(scopeId).lean()
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }

    // Dynamic level handling:
    // - if child_category_id exists => selected level is child
    // - else if subcategory_id exists => selected level is subcategory
    // - else => selected level is category
    const selectedLevelId = String(scopeId)
    const selectedLevelObjId = new mongoose.Types.ObjectId(selectedLevelId)
    let levelQuery = null
    if (childCategoryId) levelQuery = { childCategoryId: selectedLevelObjId }
    else if (subcategoryId) levelQuery = { subcategoryId: selectedLevelObjId }
    else levelQuery = { categoryId: selectedLevelObjId }

    const directLevelFilters = await Filter.find({
      ...levelQuery,
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean()

    // Backward compatibility:
    // Existing datasets may only have CategoryFilter pivot links (without categoryId/subcategoryId/childCategoryId in filters).
    // Include those so old data keeps working.
    const scopedCategories = await Category.find({
      isDeleted: false,
      $or: [{ _id: selectedLevelObjId }, { path: selectedLevelObjId }],
    })
      .select('_id')
      .lean()
    const scopedCategoryIds = scopedCategories.map((c) => c._id)
    const links = await CategoryFilter.find({ categoryId: { $in: scopedCategoryIds } })
      .select('filterId')
      .lean()
    const linkedFilterIds = [...new Set(links.map((l) => String(l.filterId)))]

    let linkedFilters = []
    if (linkedFilterIds.length) {
      linkedFilters = await Filter.find({
        _id: { $in: linkedFilterIds.map((id) => new mongoose.Types.ObjectId(id)) },
        isDeleted: { $ne: true },
        isActive: { $ne: false },
      })
        .sort({ sortOrder: 1, name: 1 })
        .lean()
    }

    const byId = new Map()
    for (const f of [...directLevelFilters, ...linkedFilters]) {
      byId.set(String(f._id), f)
    }

    // Include descendant filters (e.g. "Today" under "Ads Posted") when a parent is assigned.
    const seedIds = [...byId.keys()].map((id) => new mongoose.Types.ObjectId(id))
    if (seedIds.length) {
      const expanded = await Filter.find({
        isDeleted: { $ne: true },
        isActive: { $ne: false },
        $or: [{ _id: { $in: seedIds } }, { path: { $in: seedIds } }],
      })
        .sort({ sortOrder: 1, name: 1 })
        .lean()
      for (const f of expanded) {
        byId.set(String(f._id), f)
      }
    }

    const filters = [...byId.values()].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name)),
    )

    res.json({
      category: category.name,
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
      child_category_id: childCategoryId || null,
      selected_level_id: selectedLevelId,
      filters: filters.map((f) => ({
        _id: f._id,
        name: f.name,
        slug: f.slug,
        parentId: f.parentId || null,
        sortOrder: f.sortOrder ?? 0,
        category_id: f.categoryId || null,
        subcategory_id: f.subcategoryId || null,
        child_category_id: f.childCategoryId || null,
        filterType: f.filterType || null,
        options: Array.isArray(f.options) ? f.options : [],
      })),
    })
  } catch (error) {
    console.error('Error fetching category filters:', error)
    res.status(500).json({ message: 'Error fetching category filters' })
  }
})

module.exports = router

