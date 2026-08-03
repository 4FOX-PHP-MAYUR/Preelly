const { Types } = require('mongoose')
const Category = require('../models/Category')

function isValidObjectId(value) {
  return Boolean(value) && Types.ObjectId.isValid(String(value))
}

/**
 * Resolve a category/subcategory filter into a Mongo query fragment matching
 * Product docs, supporting both the normalized shape (category=root,
 * subcategory=child) and the legacy/deep shape (category=selected leaf,
 * subcategory unset) — same scope-resolution semantics already used by the
 * public listing in routes/products.js.
 *
 * Returns null when neither category nor subcategory is provided.
 */
async function buildProductCategoryScopeQuery({ category, subcategory } = {}) {
  const parts = []

  if (isValidObjectId(category)) {
    const catObjId = new Types.ObjectId(String(category))
    const scopeDocs = await Category.find({
      isDeleted: false,
      $or: [{ _id: catObjId }, { path: catObjId }],
    })
      .select('_id')
      .lean()
    const scopeIds = scopeDocs.map((d) => d._id)
    const categoryScope = scopeIds.length ? { $in: scopeIds } : catObjId

    if (isValidObjectId(subcategory)) {
      parts.push({ category: categoryScope })
    } else {
      parts.push({
        $or: [
          { category: categoryScope },
          { subcategory: categoryScope },
          { categoryPath: catObjId },
        ],
      })
    }
  }

  if (isValidObjectId(subcategory)) {
    const subObjId = new Types.ObjectId(String(subcategory))
    const scopeDocs = await Category.find({
      isDeleted: false,
      $or: [{ _id: subObjId }, { path: subObjId }],
    })
      .select('_id')
      .lean()
    const scopeIds = scopeDocs.map((d) => d._id)
    const subScope = scopeIds.length ? { $in: scopeIds } : subObjId

    parts.push({
      $or: [
        { subcategory: subScope },
        { category: subScope },
        { categoryPath: subObjId },
      ],
    })
  }

  if (!parts.length) return null
  return parts.length === 1 ? parts[0] : { $and: parts }
}

module.exports = { buildProductCategoryScopeQuery }
