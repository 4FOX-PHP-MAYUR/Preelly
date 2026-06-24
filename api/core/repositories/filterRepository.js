const mongoose = require('mongoose')
const Category = require('../../models/Category')
const Filter = require('../../models/Filter')
const CategoryFilter = require('../../models/CategoryFilter')
const { ACTIVE_FILTER } = require('./categoryRepository')

const ACTIVE_FILTER_DOC = {
  isDeleted: { $ne: true },
  isActive: { $ne: false },
}

/**
 * Find an active, non-deleted category by id.
 * @param {string} categoryId
 * @returns {Promise<object|null>}
 */
async function findActiveCategoryById(categoryId) {
  return Category.findOne({
    _id: categoryId,
    ...ACTIVE_FILTER,
  })
    .select('_id name slug level parentId path sortOrder')
    .lean()
}

/**
 * Fetch the category and all active descendants in a single query.
 * @param {string} categoryId
 * @returns {Promise<object[]>}
 */
async function findScopedCategories(categoryId) {
  const categoryObjectId = new mongoose.Types.ObjectId(String(categoryId))
  return Category.find({
    isDeleted: false,
    isActive: { $ne: false },
    $or: [{ _id: categoryObjectId }, { path: categoryObjectId }],
  })
    .select('_id level name sortOrder')
    .lean()
}

/**
 * Build a scoped $or query for direct filter assignment fields.
 * @param {object[]} scopedCategories
 * @returns {object[]}
 */
function buildDirectLevelOrQuery(scopedCategories) {
  const categoryIds = []
  const subcategoryIds = []
  const childCategoryIds = []

  for (const category of scopedCategories) {
    const id = category._id
    if (category.level >= 2) childCategoryIds.push(id)
    else if (category.level === 1) subcategoryIds.push(id)
    else categoryIds.push(id)
  }

  const orClauses = []
  if (categoryIds.length) orClauses.push({ categoryId: { $in: categoryIds } })
  if (subcategoryIds.length) orClauses.push({ subcategoryId: { $in: subcategoryIds } })
  if (childCategoryIds.length) orClauses.push({ childCategoryId: { $in: childCategoryIds } })
  return orClauses
}

/**
 * Fetch filters directly scoped to category levels (categoryId / subcategoryId / childCategoryId).
 * @param {object[]} scopedCategories
 * @returns {Promise<object[]>}
 */
async function findDirectScopedFilters(scopedCategories) {
  const orClauses = buildDirectLevelOrQuery(scopedCategories)
  if (!orClauses.length) return []

  return Filter.find({
    $or: orClauses,
    ...ACTIVE_FILTER_DOC,
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean()
}

/**
 * Resolve filter ids linked through the CategoryFilter pivot table.
 * @param {import('mongoose').Types.ObjectId[]} categoryIds
 * @returns {Promise<string[]>}
 */
async function findLinkedFilterIds(categoryIds) {
  if (!categoryIds.length) return []

  const links = await CategoryFilter.find({ categoryId: { $in: categoryIds } })
    .select('filterId')
    .lean()

  return [...new Set(links.map((link) => String(link.filterId)))]
}

/**
 * Fetch active filters by id list.
 * @param {string[]} filterIds
 * @returns {Promise<object[]>}
 */
async function findFiltersByIds(filterIds) {
  if (!filterIds.length) return []

  return Filter.find({
    _id: { $in: filterIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
    ...ACTIVE_FILTER_DOC,
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean()
}

/**
 * Expand assigned filters to include all descendant value nodes (e.g. options under a root).
 * @param {string[]} seedIds
 * @returns {Promise<object[]>}
 */
async function expandFilterDescendants(seedIds) {
  if (!seedIds.length) return []

  const seedObjectIds = seedIds.map((id) => new mongoose.Types.ObjectId(String(id)))
  return Filter.find({
    ...ACTIVE_FILTER_DOC,
    $or: [{ _id: { $in: seedObjectIds } }, { path: { $in: seedObjectIds } }],
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean()
}

module.exports = {
  ACTIVE_FILTER_DOC,
  findActiveCategoryById,
  findScopedCategories,
  findDirectScopedFilters,
  findLinkedFilterIds,
  findFiltersByIds,
  expandFilterDescendants,
}
