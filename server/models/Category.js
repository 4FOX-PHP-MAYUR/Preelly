const mongoose = require('mongoose')
const { Schema, Types } = mongoose
const CategoryFilter = require('./CategoryFilter')
const Filter = require('./Filter')

// Simple slugify helper
function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    level: { type: Number, default: 0, index: true },
    path: [{ type: Schema.Types.ObjectId, ref: 'Category', index: true }],
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    icon: { type: String, default: null },
    emoji: { type: String, default: '📦' },
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Non-unique compound index for fast lookups by parent + slug.
// Duplicate slugs under the same parent are allowed.
CategorySchema.index({ parentId: 1, slug: 1 })
CategorySchema.index({ path: 1 })
CategorySchema.index({ parentId: 1, sortOrder: 1 })

CategorySchema.pre('validate', function () {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name)
  }
})

CategorySchema.pre('save', async function () {
  const Model = this.constructor

  if (!this.slug && this.name) {
    this.slug = slugify(this.name)
  }

  if (this.parentId) {
    const parent = await Model.findById(this.parentId).select('path').lean()
    if (!parent) {
      throw new Error('Parent category not found')
    }

    if (this._id && parent._id && parent._id.equals(this._id)) {
      throw new Error('A category cannot be its own parent')
    }

    if (parent.path && parent.path.some((p) => p.equals(this._id))) {
      throw new Error('Circular parent relationship detected')
    }

    this.path = [...(parent.path || []), parent._id]
  } else {
    this.path = []
  }

  this.level = this.path ? this.path.length : 0

  if (!this.isNew && this.isModified('parentId')) {
    const prev = await Model.findById(this._id).select('path').lean()
    const oldPrefix = [...(prev?.path || []), this._id]
    const newPrefix = [...(this.path || []), this._id]

    const descendants = await Model.find({ path: this._id }).select('_id path').lean()
    if (descendants && descendants.length) {
      const bulkOps = descendants.map((d) => {
        const suffix = (d.path || []).slice(oldPrefix.length)
        const updatedPath = [...newPrefix, ...suffix]
        const updatedLevel = updatedPath.length
        return {
          updateOne: {
            filter: { _id: d._id },
            update: { $set: { path: updatedPath, level: updatedLevel } },
          },
        }
      })
      if (bulkOps.length) {
        await Model.bulkWrite(bulkOps, { ordered: false })
      }
    }
  }
})

// ---------- Helper methods for hierarchical categories ----------

CategorySchema.statics.getChildren = function (parentId, extraFilter = {}) {
  const filter = { ...extraFilter }
  if (parentId === null || typeof parentId === 'undefined') {
    filter.parentId = null
  } else {
    filter.parentId = parentId
  }
  return this.find(filter).sort({ sortOrder: 1, name: 1 })
}

CategorySchema.statics.getAncestors = async function (id) {
  const Model = this
  const doc = await Model.findById(id).select('path').lean()
  if (!doc || !Array.isArray(doc.path) || doc.path.length === 0) return []
  const ancestors = await Model.find({ _id: { $in: doc.path } }).lean()
  const map = new Map(ancestors.map((a) => [String(a._id), a]))
  return doc.path.map((aid) => map.get(String(aid))).filter(Boolean)
}

CategorySchema.statics.getFullPath = async function (id, separator = ' > ') {
  const Model = this
  const category = await Model.findById(id).lean()
  if (!category) return { categories: [], labels: [], pathString: '' }
  const ancestors = await Model.getAncestors(id)
  const nodes = [...ancestors, category]
  const labels = nodes.map((n) => n.name)
  return { categories: nodes, labels, pathString: labels.join(separator) }
}

CategorySchema.statics.getTree = async function (filter = {}) {
  const Model = this
  const categories = await Model.find(filter)
    .sort({ level: 1, sortOrder: 1, name: 1 })
    .lean()
  const map = new Map()
  categories.forEach((c) => map.set(String(c._id), { ...c, children: [] }))
  const roots = []
  categories.forEach((c) => {
    const node = map.get(String(c._id))
    if (c.parentId) {
      const parent = map.get(String(c.parentId))
      if (parent) parent.children.push(node)
      else roots.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

// ---------- Filter assignment helpers ----------

CategorySchema.statics.getAssignedFilters = async function (categoryId, extraFilter = {}) {
  const categoryObjectId = new Types.ObjectId(categoryId)
  const links = await CategoryFilter.find({ categoryId: categoryObjectId }).lean()
  if (!links.length) return []
  const filterIds = links.map((l) => l.filterId)
  const filterQuery = { _id: { $in: filterIds }, ...extraFilter }
  return Filter.find(filterQuery).sort({ sortOrder: 1, name: 1 }).lean()
}

CategorySchema.methods.getAssignedFilters = function (extraFilter = {}) {
  return this.constructor.getAssignedFilters(this._id, extraFilter)
}

CategorySchema.methods.getAncestors = function () {
  return this.constructor.getAncestors(this._id)
}
CategorySchema.methods.getFullPath = function (separator) {
  return this.constructor.getFullPath(this._id, separator)
}
CategorySchema.methods.getChildren = function (extraFilter = {}) {
  return this.constructor.getChildren(this._id, extraFilter)
}

const Category = mongoose.model('Category', CategorySchema)

/**
 * Drop any stale unique indexes (name_1, slug_1, compound slug, etc.)
 * so duplicate names and slugs are fully allowed.
 * Called from server.js AFTER MongoDB connection is ready.
 */
Category.fixIndexes = async function () {
  try {
    const indexes = await this.collection.indexes()
    let dropped = false

    for (const idx of indexes) {
      if (idx.name === '_id_') continue
      if (!idx.unique) continue
      const keys = Object.keys(idx.key || {})
      const hasName = idx.key && idx.key.name
      const hasSlug = idx.key && idx.key.slug
      if (hasName || hasSlug) {
        await this.collection.dropIndex(idx.name).catch(() => {})
        console.log('[Category] Dropped unique index:', idx.name, 'keys:', JSON.stringify(idx.key))
        dropped = true
      }
    }

    if (dropped) {
      await this.syncIndexes().catch(() => {})
      console.log('[Category] Indexes re-synced')
    } else {
      console.log('[Category] Indexes OK')
    }
  } catch (err) {
    console.error('[Category] fixIndexes error:', err.message)
  }
}

module.exports = Category

