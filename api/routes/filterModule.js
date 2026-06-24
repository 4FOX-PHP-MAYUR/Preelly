const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { Types } = require('mongoose')
const Filter = require('../models/Filter')
const adminMiddleware = require('../middleware/admin')

// Ensure /uploads/filter directory exists at startup
const filterUploadsDir = path.join(__dirname, '../uploads/filter')
if (!fs.existsSync(filterUploadsDir)) {
  fs.mkdirSync(filterUploadsDir, { recursive: true })
}

const filterImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, filterUploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, 'filter-' + unique + ext)
  },
})

const uploadFilterImage = multer({
  storage: filterImageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true)
    cb(new Error('Only image files are allowed'), false)
  },
  limits: { fileSize: 5 * 1024 * 1024 },
})

// Build tree from flat array and return DFS-ordered flat list with depth
function buildFlatTree(filters) {
  const byId = new Map()
  filters.forEach((f) => byId.set(String(f._id), { ...f, children: [] }))
  const roots = []
  filters.forEach((f) => {
    const node = byId.get(String(f._id))
    if (f.parentId && byId.has(String(f.parentId))) {
      byId.get(String(f.parentId)).children.push(node)
    } else {
      roots.push(node)
    }
  })
  const flat = []
  function dfs(nodes, depth) {
    nodes.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name)))
    for (const node of nodes) {
      flat.push({ ...node, _treeDepth: depth })
      if (node.children && node.children.length) dfs(node.children, depth + 1)
    }
  }
  dfs(roots, 0)
  return flat
}

// GET /api/admin/filter-module  — paginated list in parent-child tree order
router.get('/filter-module', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query
    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.max(1, Math.min(500, Number(limit)))

    const allFilters = await Filter.find({ isDeleted: false })
      .sort({ level: 1, sortOrder: 1, name: 1 })
      .lean()

    // Name map for fast parent-name lookup
    const nameById = new Map(allFilters.map((f) => [String(f._id), f.name]))

    let displayList
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase()
      displayList = allFilters
        .filter((f) => f.name.toLowerCase().includes(q))
        .map((f) => ({
          ...f,
          parentFilterName: f.parentId ? (nameById.get(String(f.parentId)) || '') : '',
          _treeDepth: 0,
        }))
    } else {
      const treeFlat = buildFlatTree(allFilters)
      displayList = treeFlat.map((f) => ({
        ...f,
        parentFilterName: f.parentId ? (nameById.get(String(f.parentId)) || '') : '',
      }))
    }

    const total = displayList.length
    const skip = (pageNum - 1) * limitNum
    const items = displayList.slice(skip, skip + limitNum)

    res.json({
      filters: items,
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: skip + items.length < total,
    })
  } catch (error) {
    console.error('[filter-module] list error:', error)
    res.status(500).json({ message: 'Error fetching filters' })
  }
})

// GET /api/admin/filter-module/parent-options
// Returns ALL non-deleted filters from the filters table, ordered in tree structure,
// suitable for populating the "Parent Filter" dropdown in Add/Edit forms.
// Pass ?excludeId=<id> to exclude a filter and its descendants (used when editing).
router.get('/filter-module/parent-options', adminMiddleware, async (req, res) => {
  try {
    const { excludeId } = req.query

    // Fetch all non-deleted filters from the filters table
    const allFilters = await Filter.find({ isDeleted: false })
      .select('_id name parentId sortOrder level')
      .sort({ level: 1, sortOrder: 1, name: 1 })
      .lean()

    // Build a set of IDs to exclude: the filter being edited + all its descendants
    let excludeSet = new Set()
    if (excludeId && Types.ObjectId.isValid(String(excludeId))) {
      excludeSet.add(String(excludeId))
      allFilters.forEach((f) => {
        if (Array.isArray(f.path) && f.path.some((p) => String(p) === String(excludeId))) {
          excludeSet.add(String(f._id))
        }
      })
    }

    const eligibleFilters = allFilters.filter((f) => !excludeSet.has(String(f._id)))

    // Build DFS tree and flatten with depth info
    const flat = buildFlatTree(eligibleFilters)

    // Build a child-count map so we can label parent groups
    const childCount = {}
    eligibleFilters.forEach((f) => {
      if (f.parentId) {
        const pid = String(f.parentId)
        childCount[pid] = (childCount[pid] || 0) + 1
      }
    })

    const options = flat.map((f) => {
      const indent = f._treeDepth > 0
        ? '│   '.repeat(f._treeDepth - 1) + '└─ '
        : ''
      const kids = childCount[String(f._id)] || 0
      return {
        _id: f._id,
        name: f.name,
        // label used in <option> text — tree-indented + child count hint
        label: indent + f.name + (kids > 0 ? ` (${kids})` : ''),
        depth: f._treeDepth,
        isRoot: !f.parentId,
        childCount: kids,
      }
    })

    res.json({
      options,
      total: options.length,
    })
  } catch (error) {
    console.error('[filter-module] parent-options error:', error)
    res.status(500).json({ message: 'Error fetching parent filter options' })
  }
})

// GET /api/admin/filter-module/:id  — single filter
router.get('/filter-module/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })
    const filter = await Filter.findOne({ _id: id, isDeleted: false }).lean()
    if (!filter) return res.status(404).json({ message: 'Filter not found' })
    if (filter.parentId) {
      const parent = await Filter.findById(filter.parentId).select('name').lean()
      filter.parentFilterName = parent?.name || ''
    }
    res.json(filter)
  } catch (error) {
    console.error('[filter-module] get error:', error)
    res.status(500).json({ message: 'Error fetching filter' })
  }
})

// POST /api/admin/filter-module  — create filter (image uploaded to /uploads/filter, only filename stored)
router.post('/filter-module', adminMiddleware, uploadFilterImage.single('filterImage'), async (req, res) => {
  try {
    const { name, parentId, colorCode, sortOrder, isActive } = req.body

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Filter name is required' })
    }

    if (parentId) {
      if (!Types.ObjectId.isValid(String(parentId))) {
        return res.status(400).json({ message: 'Invalid parent filter ID' })
      }
      const parent = await Filter.findOne({ _id: parentId, isDeleted: false })
      if (!parent) return res.status(400).json({ message: 'Parent filter not found or has been deleted' })
    }

    // Store only the filename in the database (file is in /uploads/filter/)
    const thumbImage = req.file ? req.file.filename : null

    const filter = new Filter({
      name: String(name).trim(),
      parentId: parentId || null,
      colorCode: colorCode || null,
      sortOrder: Number(sortOrder) || 0,
      isActive: String(isActive) === 'false' ? false : true,
      thumbImage,
    })

    await filter.save()
    res.status(201).json({ message: 'Filter created successfully', filter })
  } catch (error) {
    console.error('[filter-module] create error:', error)
    res.status(500).json({ message: 'Error creating filter' })
  }
})

// PATCH /api/admin/filter-module/:id  — update filter
router.patch('/filter-module/:id', adminMiddleware, uploadFilterImage.single('filterImage'), async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })

    const filterDoc = await Filter.findOne({ _id: id, isDeleted: false })
    if (!filterDoc) return res.status(404).json({ message: 'Filter not found' })

    const { name, parentId, colorCode, sortOrder, isActive, clearImage } = req.body

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ message: 'Filter name is required' })
      filterDoc.name = String(name).trim()
    }

    if (parentId !== undefined) {
      if (parentId && String(parentId).trim()) {
        if (!Types.ObjectId.isValid(String(parentId))) return res.status(400).json({ message: 'Invalid parent filter ID' })
        if (String(parentId) === String(filterDoc._id)) return res.status(400).json({ message: 'A filter cannot be its own parent' })
        const parent = await Filter.findOne({ _id: parentId, isDeleted: false }).select('_id path').lean()
        if (!parent) return res.status(400).json({ message: 'Parent filter not found' })
        if (parent.path && parent.path.some((p) => String(p) === String(filterDoc._id))) {
          return res.status(400).json({ message: 'Circular parent relationship detected' })
        }
        filterDoc.parentId = parent._id
      } else {
        filterDoc.parentId = null
      }
    }

    if (colorCode !== undefined) filterDoc.colorCode = colorCode || null
    if (sortOrder !== undefined) filterDoc.sortOrder = Number(sortOrder) || 0
    if (isActive !== undefined) filterDoc.isActive = String(isActive) === 'false' ? false : true

    if (req.file) {
      filterDoc.thumbImage = req.file.filename
    } else if (clearImage === 'true') {
      filterDoc.thumbImage = null
    }

    await filterDoc.save()
    res.json({ message: 'Filter updated successfully', filter: filterDoc })
  } catch (error) {
    console.error('[filter-module] update error:', error)
    res.status(500).json({ message: 'Error updating filter' })
  }
})

// DELETE /api/admin/filter-module/:id  — soft delete (also deletes all descendants)
router.delete('/filter-module/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })

    const filterDoc = await Filter.findOne({ _id: id, isDeleted: false })
    if (!filterDoc) return res.status(404).json({ message: 'Filter not found' })

    const _id = new Types.ObjectId(id)
    const descendants = await Filter.find({ path: _id }).select('_id').lean()
    const idsToDelete = [_id, ...descendants.map((d) => d._id)]

    await Filter.updateMany(
      { _id: { $in: idsToDelete } },
      { $set: { isDeleted: true, isActive: false } }
    )

    res.json({ message: 'Filter deleted successfully', deletedCount: idsToDelete.length })
  } catch (error) {
    console.error('[filter-module] delete error:', error)
    res.status(500).json({ message: 'Error deleting filter' })
  }
})

module.exports = router
