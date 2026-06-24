const express = require('express')
const router = express.Router()
const Category = require('../models/Category')
const Product = require('../models/Product')
const categoryService = require('../core/services/categoryService')
const categoryDto = require('../dto/category.dto')
const apiResponse = require('../utils/apiResponse')

let CATEGORY_LEVEL_LABELS, getLevelLabelsForRoot
try {
  const labels = require('../config/categoryLevelLabels')
  CATEGORY_LEVEL_LABELS = labels.CATEGORY_LEVEL_LABELS
  getLevelLabelsForRoot = labels.getLevelLabelsForRoot
} catch {
  CATEGORY_LEVEL_LABELS = {
    Electronics: ['Category', 'Sub Category', 'Brand', 'Model'],
    Vehicles: ['Category', 'Vehicle Type', 'Brand', 'Model', 'Variant'],
    Fashion: ['Category', 'Sub Category', 'Brand', 'Type'],
    Furniture: ['Category', 'Sub Category', 'Brand', 'Type'],
    'Home & Garden': ['Category', 'Sub Category', 'Brand', 'Type'],
  }
  const DEFAULT = ['Category', 'Level 2', 'Level 3', 'Level 4', 'Level 5']
  getLevelLabelsForRoot = (name) => {
    if (!name) return [...DEFAULT]
    const key = Object.keys(CATEGORY_LEVEL_LABELS).find((k) => k.toLowerCase() === String(name).trim().toLowerCase())
    return key ? [...CATEGORY_LEVEL_LABELS[key]] : [...DEFAULT]
  }
}

// @route   GET /api/categories/property-categories
// @desc    Get property parent categories with nested subcategories
// @access  Public
router.get('/property-categories', async (req, res) => {
  try {
    const categories = await categoryService.getPropertyCategories()
    return apiResponse.success(
      res,
      'Property categories fetched successfully',
      categoryDto.propertyCategoriesList(categories),
    )
  } catch (error) {
    console.error('Error fetching property categories:', error)
    res.status(500).json({ success: false, message: 'Error fetching property categories' })
  }
})

// @route   GET /api/categories/roots
// @desc    Get only root categories (parentId null) for home page dropdown
// @access  Public
router.get('/roots', async (req, res) => {
  try {
    const roots = await Category.find({
      parentId: null,
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean()

    // Keep UI consistent with /api/categories (adds active product counts).
    const rootsWithCounts = await Promise.all(
      roots.map(async (category) => {
        const count = await Product.countDocuments({
          category: category._id,
          status: 'active',
        })
        return { ...category, count }
      }),
    )

    res.json(rootsWithCounts)
  } catch (error) {
    console.error('Error fetching root categories:', error)
    res.status(500).json({ message: 'Error fetching root categories' })
  }
})

// @route   GET /api/categories/level-labels
// @route   GET /api/categories/level-labels?root=Name
// @desc    Get level labels for cascading dropdowns. Optional ?root=Name returns labels for that root only.
// @access  Public
router.get('/level-labels', (req, res) => {
  try {
    const root = req.query.root
    if (root != null && String(root).trim() !== '') {
      const labels = getLevelLabelsForRoot(String(root).trim())
      return res.json({ root: String(root).trim(), labels })
    }
    res.json(CATEGORY_LEVEL_LABELS)
  } catch (error) {
    console.error('Error fetching level labels:', error)
    res.status(500).json({ message: 'Error fetching level labels' })
  }
})

// @route   GET /api/categories?parent_id=ID
// @desc    Get children of a category by parent_id (for cascading dropdowns). Omit parent_id for roots.
// @access  Public
router.get('/', async (req, res) => {
  try {
    const parentId = req.query.parent_id ?? req.query.parentId
    if (parentId !== undefined) {
      const filter = { isDeleted: { $ne: true }, isActive: { $ne: false } }
      const id = parentId === 'null' || parentId === '' ? null : parentId
      const children = await Category.getChildren(id, filter).lean()
      return res.json(children)
    }

    // No parent_id: get all categories with counts (for reels feed / legacy)
    const categories = await Category.find().sort({ name: 1 })
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const count = await Product.countDocuments({
          category: category._id,
          status: 'active',
        })
        return { ...category.toObject(), count }
      })
    )
    res.json(categoriesWithCounts)
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({ message: 'Error fetching categories' })
  }
})

// @route   GET /api/categories/:id/path
// @desc    Get full path (ancestors + self) for a category (for restoring cascading selection on edit)
// @access  Public
router.get('/:id/path', async (req, res) => {
  try {
    const pathInfo = await Category.getFullPath(req.params.id)
    res.json(pathInfo)
  } catch (error) {
    console.error('Error fetching category path:', error)
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid category ID' })
    res.status(500).json({ message: 'Error fetching category path' })
  }
})

// @route   GET /api/categories/:id
// @desc    Get single category with subcategories and active product count
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }
    
    // Count active products in this category (same as reels feed)
    const count = await Product.countDocuments({
      category: category._id,
      status: 'active',
    })
    
    // Return category with product count
    const categoryWithCount = {
      ...category.toObject(),
      count,
    }
    
    res.json(categoryWithCount)
  } catch (error) {
    console.error('Error fetching category:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid category ID' })
    }
    res.status(500).json({ message: 'Error fetching category' })
  }
})

module.exports = router

