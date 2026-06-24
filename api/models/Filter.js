const mongoose = require('mongoose')
const { Schema, Types } = mongoose
const CategoryFilter = require('./CategoryFilter')
const Category = require('./Category')

// Simple slugify helper (copied from Category model for consistency)
function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const FilterSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, index: true },

    // Hierarchy
    parentId: { type: Schema.Types.ObjectId, ref: 'Filter', default: null },
    level: { type: Number, default: 0, index: true },
    path: [{ type: Schema.Types.ObjectId, ref: 'Filter', index: true }],

    sortOrder: { type: Number, default: 0 },

    // Status / soft delete
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },

    // Optional visuals
    thumbImage: { type: String, default: null },
    colorCode: { type: String, default: null },

    // Optional fields used by the Excel import for "Filters" module.
    // These are intentionally optional so existing CRUD for hierarchical filters keeps working.
    filterType: { type: String, default: null },
    options: { type: [String], default: [] },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    // Selected subcategory scope (legacy naming requested by product team: subcategory_id).
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    // Optional level-3 scope id (child category under subcategory).
    childCategoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'filters',
  }
)

// Allow duplicate filter documents.
// We intentionally do NOT enforce uniqueness on (parentId, slug) so the importer
// can create one filter record per category scope when needed.
FilterSchema.index({ parentId: 1, slug: 1 })
FilterSchema.index({ path: 1 })
FilterSchema.index({ parentId: 1, sortOrder: 1 })

FilterSchema.pre('validate', function () {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name)
  }
})

FilterSchema.pre('save', async function () {
  const Model = this.constructor

  if (!this.slug && this.name) {
    this.slug = slugify(this.name)
  }

  // Slug must be unique only within the same parent (scoped uniqueness).
  // Only consider non-deleted filters so the same slug can be reused after a soft-delete.
  if (!this.slug || !String(this.slug).trim()) return
  // Uniqueness check intentionally removed to allow duplicate filter documents.

  if (this.parentId) {
    const parent = await Model.findById(this.parentId).select('path').lean()
    if (!parent) {
      throw new Error('Parent filter not found')
    }

    if (this._id && parent._id && parent._id.equals(this._id)) {
      throw new Error('A filter cannot be its own parent')
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

// ---------- Helper methods for hierarchical filters ----------

FilterSchema.statics.getChildren = function (parentId, extraFilter = {}) {
  const filter = { ...extraFilter }
  if (parentId === null || typeof parentId === 'undefined') {
    filter.parentId = null
  } else {
    filter.parentId = parentId
  }
  return this.find(filter).sort({ sortOrder: 1, name: 1 })
}

FilterSchema.statics.getAncestors = async function (id) {
  const Model = this
  const doc = await Model.findById(id).select('path').lean()
  if (!doc || !Array.isArray(doc.path) || doc.path.length === 0) return []
  const ancestors = await Model.find({ _id: { $in: doc.path } }).lean()
  const map = new Map(ancestors.map((a) => [String(a._id), a]))
  return doc.path.map((aid) => map.get(String(aid))).filter(Boolean)
}

FilterSchema.statics.getFullPath = async function (id, separator = ' > ') {
  const Model = this
  const filter = await Model.findById(id).lean()
  if (!filter) return { filters: [], labels: [], pathString: '' }
  const ancestors = await Model.getAncestors(id)
  const nodes = [...ancestors, filter]
  const labels = nodes.map((n) => n.name)
  return { filters: nodes, labels, pathString: labels.join(separator) }
}

FilterSchema.statics.getTree = async function (filter = {}) {
  const Model = this
  const filters = await Model.find(filter)
    .sort({ level: 1, sortOrder: 1, name: 1 })
    .lean()
  const map = new Map()
  filters.forEach((c) => map.set(String(c._id), { ...c, children: [] }))
  const roots = []
  filters.forEach((c) => {
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

// ---------- Category assignment helpers ----------

FilterSchema.statics.getAssignedCategories = async function (filterId, extraFilter = {}) {
  const filterObjectId = new Types.ObjectId(filterId)
  const links = await CategoryFilter.find({ filterId: filterObjectId }).lean()
  if (!links.length) return []
  const categoryIds = links.map((l) => l.categoryId)
  const categoryQuery = { _id: { $in: categoryIds }, ...extraFilter }
  return Category.find(categoryQuery).sort({ level: 1, sortOrder: 1, name: 1 }).lean()
}

FilterSchema.methods.getAssignedCategories = function (extraFilter = {}) {
  return this.constructor.getAssignedCategories(this._id, extraFilter)
}

FilterSchema.methods.getAncestors = function () {
  return this.constructor.getAncestors(this._id)
}
FilterSchema.methods.getFullPath = function (separator) {
  return this.constructor.getFullPath(this._id, separator)
}
FilterSchema.methods.getChildren = function (extraFilter = {}) {
  return this.constructor.getChildren(this._id, extraFilter)
}

// Export model + helper to drop stale unique indexes.
// This makes the "allow duplicates" behavior effective even with stale DB indexes.
const Filter = mongoose.model('Filter', FilterSchema)
Filter.fixIndexes = async function () {
  try {
    const indexes = await this.collection.indexes()
    let dropped = false

    for (const idx of indexes) {
      if (!idx.unique) continue
      const keys = idx.key || {}
      const hasParentId = Object.prototype.hasOwnProperty.call(keys, 'parentId')
      const hasSlug = Object.prototype.hasOwnProperty.call(keys, 'slug')
      if (!hasParentId || !hasSlug) continue

      await this.collection.dropIndex(idx.name).catch(() => {})
      console.log('[Filter] Dropped unique index:', idx.name)
      dropped = true
    }

    if (dropped) {
      await this.syncIndexes().catch(() => {})
      console.log('[Filter] Indexes re-synced')
    }
  } catch (err) {
    console.error('[Filter] fixIndexes error:', err.message)
  }
}

module.exports = Filter

