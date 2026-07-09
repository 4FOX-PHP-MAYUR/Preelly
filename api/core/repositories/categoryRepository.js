const Category = require('../../models/Category')
const { PROPERTY_ROOT_SLUGS, PROPERTY_ROOT_NAMES } = require('../../config/propertyCategoryConfig')
const { CLASSIFIED_ROOT_SLUGS, CLASSIFIED_ROOT_NAMES } = require('../../config/classifiedCategoryConfig')

const ACTIVE_FILTER = {
  isDeleted: false,
  isActive: true,
}

/**
 * Find the active Property root category.
 * @returns {Promise<object|null>}
 */
async function findPropertyRoot() {
  return Category.findOne({
    parentId: null,
    ...ACTIVE_FILTER,
    $or: [
      { slug: { $in: PROPERTY_ROOT_SLUGS } },
      { name: { $in: PROPERTY_ROOT_NAMES } },
    ],
  }).lean()
}

/**
 * Fetch property sub-tree categories for the given levels in a single query.
 * Uses the `path` array to avoid recursive round-trips.
 *
 * @param {import('mongoose').Types.ObjectId} rootId
 * @param {number[]} levels — e.g. [1, 2] for parents + subcategories
 * @returns {Promise<object[]>}
 */
async function findCategoriesUnderRootByLevels(rootId, levels = [1, 2]) {
  return Category.find({
    path: rootId,
    level: { $in: levels },
    ...ACTIVE_FILTER,
  })
    .sort({ xOrder: 1, name: 1 })
    .lean()
}

/**
 * Find the active Classifieds root category.
 * @returns {Promise<object|null>}
 */
async function findClassifiedRoot() {
  return Category.findOne({
    parentId: null,
    ...ACTIVE_FILTER,
    $or: [
      { slug: { $in: CLASSIFIED_ROOT_SLUGS } },
      { name: { $in: CLASSIFIED_ROOT_NAMES } },
    ],
  }).lean()
}

/**
 * Fetch classified parent categories with nested subcategories in a single aggregation.
 * Uses $lookup to avoid N+1 queries.
 *
 * @param {import('mongoose').Types.ObjectId} classifiedRootId
 * @returns {Promise<object[]>}
 */
async function getClassifiedCategories(classifiedRootId) {
  return Category.aggregate([
    {
      $match: {
        parentId: classifiedRootId,
        isActive: true,
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: 'categories',
        let: { categoryId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$parentId', '$$categoryId'],
              },
              isActive: true,
              isDeleted: false,
            },
          },
          {
            $sort: {
              sortOrder: 1,
            },
          },
        ],
        as: 'subcategories',
      },
    },
    {
      $sort: {
        sortOrder: 1,
      },
    },
  ])
}

module.exports = {
  findPropertyRoot,
  findCategoriesUnderRootByLevels,
  findClassifiedRoot,
  getClassifiedCategories,
  ACTIVE_FILTER,
}
