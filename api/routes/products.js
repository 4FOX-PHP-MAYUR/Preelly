const express = require('express')
const router = express.Router()
const Product = require('../models/Product')
const Category = require('../models/Category')
const Filter = require('../models/Filter')
const CategoryFilter = require('../models/CategoryFilter')
const mongoose = require('mongoose')
const authMiddleware = require('../middleware/auth')
const validateObjectId = require('../middleware/validateObjectId')
const { upload, compressVideo } = require('../middleware/upload')
const { enqueueProductVideoTranscode, normalizeStatus } = require('../jobs/videoTranscodeQueue')
const { resolveFiltersFromProductData } = require('../services/filterMatchingService')
const { parseFilterValues } = require('../utils/filterValueUtils')
const { getJwtFromRequest } = require('../utils/authToken')
const adTypes = require('../config/adTypes')
const { extractStructuredCarDetails } = require('../services/structuredCarDetailsService')
const { validationResult } = require('express-validator')
const { createProductRules, updateProductRules } = require('../core/validators/product.validator')
const {
  parseAndResolveProductVehicleFields,
  applyProductVehicleFields,
  buildVehicleDetailPresentation,
  HANDLED_REQUEST_KEYS,
} = require('../utils/productVehicleFields')
const { buildProductAttributesPresentation } = require('../utils/productAttributesResolver')
const { enrichReelsProducts } = require('../utils/reelsProductFields')

function parseBooleanField (value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (['true', '1'].includes(normalized)) return true
  if (['false', '0'].includes(normalized)) return false
  return null
}

// Helper function to safely parse JSON strings
const parseJSONField = (field) => {
  if (!field) return null
  if (typeof field === 'object') return field
  try {
    return JSON.parse(field)
  } catch (e) {
    return field
  }
}

// Normalize MongoDB ObjectId to canonical string (same format as saved storage)
const toCanonicalId = (id) => {
  if (id == null || id === '') return ''
  return String(id).trim()
}

// ---------------------------------------------------------------------------
// HARD RULE: saved = EXISTS(user_id + product_id in saved storage)
// - Saved storage = User.savedProducts (same as POST /api/products/:id/save)
// - No cache. No default. No global flag. Real-time lookup only.
// ---------------------------------------------------------------------------

const User = require('../models/User')
const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

/**
 * Read saved storage for the current request. One read per request, no cache.
 * Returns: { userId: string | null, savedProductIds: Set<string> }
 * - If no valid user in request: userId null, savedProductIds empty (no record can exist).
 * - If valid user: userId set, savedProductIds = that user's savedProducts from DB (real-time).
 */
async function readSavedStorageForRequest (req) {
  const token = getJwtFromRequest(req)
  if (!token) return { userId: null, savedProductIds: new Set() }
  let decoded
  try {
    decoded = jwt.verify(token, JWT_SECRET)
  } catch (err) {
    return { userId: null, savedProductIds: new Set() }
  }
  const userId = decoded.userId || decoded.id
  if (!userId) return { userId: null, savedProductIds: new Set() }
  const user = await User.findById(userId).select('savedProducts').lean()
  if (!user || !Array.isArray(user.savedProducts)) return { userId: String(userId), savedProductIds: new Set() }
  const ids = user.savedProducts.map((id) => toCanonicalId(id)).filter(Boolean)
  return { userId: String(userId), savedProductIds: new Set(ids) }
}

/**
 * Compute saved for one product from saved storage result.
 * saved = EXISTS(user_id + product_id in saved storage). No default; derived only from storage.
 */
function savedExists (productId, storage) {
  if (!storage || !storage.savedProductIds) return false
  const pid = toCanonicalId(productId)
  if (!pid) return false
  return storage.savedProductIds.has(pid)
}

/**
 * Add "saved" to a product object. saved is set only from storage result (real-time).
 */
function withSaved (product, storage) {
  if (!product) return { saved: false }
  const item = typeof product.toObject === 'function' ? product.toObject() : { ...product }
  item.saved = savedExists(product._id, storage)
  return item
}

// @route   GET /api/products/price-range
// @desc    Get min and max price from active products (optionally filtered by category)
// @access  Public
router.get('/price-range', async (req, res) => {
  try {
    const { categoryId } = req.query
    
    const matchStage = { status: 'active' }
    if (categoryId) {
      if (mongoose.Types.ObjectId.isValid(String(categoryId))) {
        const catObjId = new mongoose.Types.ObjectId(String(categoryId))
        const scopeDocs = await Category.find({
          isDeleted: false,
          $or: [{ _id: catObjId }, { path: catObjId }],
        })
          .select('_id')
          .lean()
        const scopeIds = (scopeDocs || []).map((d) => d._id)
        const scopeExpr = scopeIds.length ? { $in: scopeIds } : catObjId
        // Support both normalized and legacy storage:
        // - normalized: product.category is root/main
        // - legacy: product.category or product.subcategory can be selected level
        matchStage.$or = [{ category: scopeExpr }, { subcategory: scopeExpr }]
      } else {
        matchStage.$or = [{ category: categoryId }, { subcategory: categoryId }]
      }
    }

    const priceStats = await Product.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
        },
      },
    ])

    if (priceStats.length === 0 || !priceStats[0].minPrice) {
      return res.json({
        minPrice: 0,
        maxPrice: 100000,
      })
    }

    res.json({
      minPrice: Math.floor(priceStats[0].minPrice),
      maxPrice: Math.ceil(priceStats[0].maxPrice),
    })
  } catch (error) {
    console.error('Error fetching price range:', error)
    res.json({
      minPrice: 0,
      maxPrice: 100000,
    })
  }
})

// @route   GET /api/products/facets
// @desc    Get filter facets (cities/years/mileage range) from DB (optionally filtered by category/subcategory)
// @access  Public
router.get('/facets', async (req, res) => {
  try {
    const { categoryId, subcategoryId } = req.query

    const matchStage = { status: 'active' }

    // Category scope: include descendants (same logic as /price-range)
    if (categoryId) {
      if (mongoose.Types.ObjectId.isValid(String(categoryId))) {
        const catObjId = new mongoose.Types.ObjectId(String(categoryId))
        const scopeDocs = await Category.find({
          isDeleted: false,
          $or: [{ _id: catObjId }, { path: catObjId }],
        })
          .select('_id')
          .lean()
        const scopeIds = (scopeDocs || []).map((d) => d._id)
        const scopeExpr = scopeIds.length ? { $in: scopeIds } : catObjId
        matchStage.$or = [{ category: scopeExpr }, { subcategory: scopeExpr }]
      } else {
        matchStage.$or = [{ category: categoryId }, { subcategory: categoryId }]
      }
    }

    if (subcategoryId) {
      if (mongoose.Types.ObjectId.isValid(String(subcategoryId))) {
        matchStage.subcategory = new mongoose.Types.ObjectId(String(subcategoryId))
      } else {
        matchStage.subcategory = subcategoryId
      }
    }

    const result = await Product.aggregate([
      { $match: matchStage },
      {
        $facet: {
          cities: [
            { $project: { cityFacet: { $ifNull: ['$city', '$location'] } } },
            { $match: { cityFacet: { $type: 'string', $ne: '' } } },
            { $group: { _id: '$cityFacet', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 200 },
          ],
          years: [
            { $match: { year: { $ne: null } } },
            { $group: { _id: '$year', count: { $sum: 1 } } },
            { $sort: { _id: -1 } },
            { $limit: 80 },
          ],
          mileage: [
            { $match: { mileage: { $ne: null } } },
            {
              $group: {
                _id: null,
                minMileage: { $min: '$mileage' },
                maxMileage: { $max: '$mileage' },
              },
            },
          ],
        },
      },
    ])

    const row = Array.isArray(result) && result.length ? result[0] : null

    const cities = (row?.cities || [])
      .map((c) => String(c?._id || '').trim())
      .filter(Boolean)
      .map((s) => ({ value: s, label: s }))

    const years = (row?.years || [])
      .map((y) => y?._id)
      .filter((y) => y != null && y !== '')
      .map((y) => ({ value: String(y), label: String(y) }))

    const mileageRow = Array.isArray(row?.mileage) && row.mileage.length ? row.mileage[0] : null
    const minMileage =
      typeof mileageRow?.minMileage === 'number' && Number.isFinite(mileageRow.minMileage)
        ? Math.floor(mileageRow.minMileage)
        : 0
    const maxMileage =
      typeof mileageRow?.maxMileage === 'number' && Number.isFinite(mileageRow.maxMileage)
        ? Math.ceil(mileageRow.maxMileage)
        : 0

    return res.json({
      cities,
      years,
      mileageRange: { min: minMileage, max: maxMileage },
    })
  } catch (error) {
    console.error('Error fetching facets:', error)
    return res.json({
      cities: [],
      years: [],
      mileageRange: { min: 0, max: 0 },
    })
  }
})

// @route   GET /api/products
// @desc    Get all products (with pagination and filters)
// @access  Public (but admins can see all statuses)
router.get('/', async (req, res) => {
  try {
    const {
      categoryId,
      subcategoryId,
      location,
      minPrice,
      maxPrice,
      search,
      page = 1,
      limit = 10,
      userId,
      year,
      minMileage,
      maxMileage,
      make,
      model,
      trim,
      condition,
      transmission,
      fuelType,
      sortBy = 'newest',
    } = req.query

    // Accept common alias param names from different UIs.
    // (Some codepaths use `subcategory_id`, `subCategoryId`, etc.)
    const normalizedCategoryId = req.query.categoryId ?? req.query.category_id ?? categoryId
    const normalizedChildCategoryId =
      req.query.childCategoryId ?? req.query.child_category_id ?? req.query.childCategoryID ?? null
    const normalizedSubcategoryId =
      normalizedChildCategoryId ??
      req.query.subcategoryId ??
      req.query.subcategory_id ??
      req.query.subCategoryId ??
      req.query.sub_category_id ??
      subcategoryId

    const debugFilters = String(req.query.debugFilters || '').toLowerCase() === 'true'

    // Check admin access and load current user's saved products for "saved" field
    const token = getJwtFromRequest(req)
    let isAdmin = false
    if (token) {
      try {
        const jwt = require('jsonwebtoken')
        const User = require('../models/User')
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
        const user = await User.findById(decoded.userId).select('role')
        if (user?.role === 'admin') isAdmin = true
      } catch (err) {
        console.error('Token verification error:', err.message)
      }
    }
    const savedStorage = await readSavedStorageForRequest(req)

    const query = {}
    const filterDebug = debugFilters ? { input: {} } : null

    const parseObjectIdList = (value) => {
      if (!value) return []
      if (Array.isArray(value)) return value.map(String).filter(Boolean)
      if (typeof value === 'string') return value.split(',').map((s) => String(s).trim()).filter(Boolean)
      return []
    }

    // Filters
    // Category/subcategory matching supports both:
    // 1) normalized shape:   product.category = root, product.subcategory = selected child
    // 2) legacy/deep shape:  product.category = selected child (subcategory not stored)
    //
    // When both category + subcategory are supplied, we require BOTH semantics by enforcing:
    // - product belongs to selected category scope
    // - product belongs to selected subcategory scope (via subcategory or category fallback)
    if (normalizedCategoryId && mongoose.Types.ObjectId.isValid(String(normalizedCategoryId))) {
      const catObjId = new mongoose.Types.ObjectId(String(normalizedCategoryId))
      const categoryScopeDocs = await Category.find({
        isDeleted: false,
        $or: [{ _id: catObjId }, { path: catObjId }],
      })
        .select('_id')
        .lean()
      const categoryScopeIds = (categoryScopeDocs || []).map((d) => d._id)
      if (categoryScopeIds.length) {
        query.category = { $in: categoryScopeIds }
      } else {
        query.category = catObjId
      }
      // When only category level is provided (no explicit subcategory),
      // include products where selected level is stored in `subcategory` or `categoryPath`.
      if (!normalizedSubcategoryId) {
        const categoryScope = query.category
        delete query.category
        query.$or = [
          { category: categoryScope },
          { subcategory: categoryScope },
          { categoryPath: catObjId },
        ]
      }
    } else if (normalizedCategoryId) {
      query.category = normalizedCategoryId
      if (!normalizedSubcategoryId) {
        const categoryScope = query.category
        delete query.category
        query.$or = [
          { category: categoryScope },
          { subcategory: categoryScope },
          { categoryPath: normalizedCategoryId },
        ]
      }
    }

    if (normalizedSubcategoryId && mongoose.Types.ObjectId.isValid(String(normalizedSubcategoryId))) {
      const subObjId = new mongoose.Types.ObjectId(String(normalizedSubcategoryId))
      const subScopeDocs = await Category.find({
        isDeleted: false,
        $or: [{ _id: subObjId }, { path: subObjId }],
      })
        .select('_id')
        .lean()
      const subScopeIds = (subScopeDocs || []).map((d) => d._id)
      const subScope = subScopeIds.length ? { $in: subScopeIds } : subObjId

      // If a main category is selected too, enforce both scopes together.
      if (query.category) {
        const categoryQuery = query.category
        delete query.category
        query.$and = query.$and || []
        query.$and.push({ category: categoryQuery })
        query.$and.push({
          $or: [
            { subcategory: subScope },
            { category: subScope },
            { categoryPath: subObjId },
          ],
        })
      } else {
        query.$or = [
          { subcategory: subScope },
          { category: subScope },
          { categoryPath: subObjId },
        ]
      }
    } else if (normalizedSubcategoryId) {
      if (query.category) {
        const categoryQuery = query.category
        delete query.category
        query.$and = query.$and || []
        query.$and.push({ category: categoryQuery })
        query.$and.push({
          $or: [
            { subcategory: normalizedSubcategoryId },
            { category: normalizedSubcategoryId },
            { categoryPath: normalizedSubcategoryId },
          ],
        })
      } else {
        query.$or = [
          { subcategory: normalizedSubcategoryId },
          { category: normalizedSubcategoryId },
          { categoryPath: normalizedSubcategoryId },
        ]
      }
    }
    if (location && location.trim() !== '') {
      query.location = new RegExp(location.trim(), 'i')
    }

    if (minPrice || maxPrice) {
      query.price = {}
      if (minPrice) query.price.$gte = Number(minPrice)
      if (maxPrice) query.price.$lte = Number(maxPrice)
    }

    if (search && search.trim() !== '') {
      query.$text = { $search: search.trim() }
    }

    // -----------------------------------------------------
    // Generic reusable Filter support (hierarchical parent -> include children).
    // Two strategies are used together:
    //   1. Direct match via product.selectedFilters array (DB-stored filter IDs)
    //   2. Legacy name-mapping: maps Filter.name to product fields (condition, transmission, fuelType, etc.)
    //
    // Expected usage (typical):
    //   /api/products?categoryId=...&subcategoryId=...&filterIds=<comma-separated filter ObjectIds>
    // -----------------------------------------------------
    const filterIdsParam = req.query.filterIds ?? req.query.filterId ?? req.query.filters ?? req.query.selectedFilterIds ?? null
    const inputFilterIds = parseObjectIdList(filterIdsParam)
    if (inputFilterIds.length) {
      try {
        const filterObjIds = inputFilterIds
          .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
          .map((id) => new mongoose.Types.ObjectId(String(id)))

        if (filterDebug) filterDebug.input.filterIds = inputFilterIds

        if (filterObjIds.length) {
          // Expand parent filters to include descendant filters.
          const expandedFilters = await Filter.find({
            $or: [{ _id: { $in: filterObjIds } }, { path: { $in: filterObjIds } }],
            isDeleted: { $ne: true },
            isActive: { $ne: false },
          })
            .select('_id name path')
            .lean()

          const expandedIdsStr = expandedFilters.map((f) => String(f._id))
          if (filterDebug) {
            filterDebug.expandedFilterIds = expandedIdsStr
          }

          // Validate selected filters are assigned to the currently selected category scope.
          // If `subcategoryId` is provided, we treat that as the primary scope (priority).
          const scopeId = normalizedSubcategoryId || normalizedCategoryId
          let assignedFilterIdSet = null

          if (scopeId && mongoose.Types.ObjectId.isValid(scopeId)) {
            const scopeObjId = new mongoose.Types.ObjectId(scopeId)
            const scopedCategoryDocs = await Category.find({
              isDeleted: false,
              $or: [{ _id: scopeObjId }, { path: scopeObjId }],
            })
              .select('_id')
              .lean()

            const scopedCategoryIds = (scopedCategoryDocs || []).map((d) => d._id)

            // CategoryFilter rows might exist for parent filters only.
            // To support "select parent => include children", a child filter is considered valid
            // when ANY ancestor (including itself) is assigned to the category scope.
            const candidateFilterIdMap = new Map()
            for (const f of expandedFilters) {
              if (f._id) candidateFilterIdMap.set(String(f._id), f._id)
              for (const pid of f.path || []) {
                if (pid) candidateFilterIdMap.set(String(pid), pid)
              }
            }
            const candidateFilterIds = [...candidateFilterIdMap.values()]

            const assigned = await CategoryFilter.find({
              categoryId: { $in: scopedCategoryIds },
              filterId: { $in: candidateFilterIds },
            })
              .select('filterId')
              .lean()

            assignedFilterIdSet = new Set(assigned.map((a) => String(a.filterId)))
          }

          const validFilters = assignedFilterIdSet
            ? expandedFilters.filter((f) => {
                const idStr = String(f._id)
                if (assignedFilterIdSet.has(idStr)) return true
                return (f.path || []).some((pid) => assignedFilterIdSet.has(String(pid)))
              })
            : expandedFilters

          if (filterDebug) {
            filterDebug.validAssignedFilterIds = validFilters.map((f) => String(f._id))
          }

          const conditionMap = new Map(
            ['Brand New', 'Like New', 'Good', 'Fair', 'Poor'].map((v) => [v.toLowerCase(), v]),
          )
          const transmissionMap = new Map(
            ['Automatic', 'Manual', 'Semi-Automatic', 'CVT', 'Dual Clutch'].map((v) => [v.toLowerCase(), v]),
          )
          const fuelTypeMap = new Map(
            ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'LPG', 'CNG'].map((v) => [v.toLowerCase(), v]),
          )

          const matchedCondition = []
          const matchedTransmission = []
          const matchedFuelType = []
          let createdAtGte = null

          const now = Date.now()
          const parseTimeWindowMs = (name) => {
            const n = String(name || '').toLowerCase()
            if (n.includes('today')) return 24 * 60 * 60 * 1000
            // Common Dubizzle-like labels
            if (n.includes('within 1 week') || n.includes('1 week') || n.includes('7 day') || n.includes('7 days')) {
              return 7 * 24 * 60 * 60 * 1000
            }
            if (n.includes('within 2 week') || n.includes('2 weeks') || n.includes('14 day') || n.includes('14 days')) {
              return 14 * 24 * 60 * 60 * 1000
            }
            if (n.includes('within 1 month') || n.includes('1 month') || n.includes('30 day') || n.includes('30 days')) {
              return 30 * 24 * 60 * 60 * 1000
            }
            return null
          }

          for (const f of validFilters) {
            const name = String(f.name || '').trim()
            if (!name) continue

            const lc = name.toLowerCase()
            if (conditionMap.has(lc)) matchedCondition.push(conditionMap.get(lc))
            if (transmissionMap.has(lc)) matchedTransmission.push(transmissionMap.get(lc))
            if (fuelTypeMap.has(lc)) matchedFuelType.push(fuelTypeMap.get(lc))

            const windowMs = parseTimeWindowMs(name)
            if (windowMs) {
              const candidate = new Date(now - windowMs)
              createdAtGte = createdAtGte ? new Date(Math.max(createdAtGte.getTime(), candidate.getTime())) : candidate
            }
          }

          const uniq = (arr) => [...new Set(arr)]
          if (uniq(matchedCondition).length) query.condition = uniq(matchedCondition).length === 1 ? uniq(matchedCondition)[0] : { $in: uniq(matchedCondition) }
          if (uniq(matchedTransmission).length) query.transmission = uniq(matchedTransmission).length === 1 ? uniq(matchedTransmission)[0] : { $in: uniq(matchedTransmission) }
          if (uniq(matchedFuelType).length) query.fuelType = uniq(matchedFuelType).length === 1 ? uniq(matchedFuelType)[0] : { $in: uniq(matchedFuelType) }
          if (createdAtGte) {
            if (!query.createdAt) query.createdAt = { $gte: createdAtGte }
            else if (query.createdAt.$gte) query.createdAt.$gte = new Date(Math.max(query.createdAt.$gte.getTime(), createdAtGte.getTime()))
            else query.createdAt = { $gte: createdAtGte }
          }

          // Direct DB match: products that have these filter IDs in their selectedFilters array.
          // This catches products where the filter name didn't map to a known field above.
          const allExpandedFilterObjIds = expandedFilters.map((f) => f._id)
          if (allExpandedFilterObjIds.length) {
            const fieldBasedConditions = []
            if (query.condition) fieldBasedConditions.push({ condition: query.condition })
            if (query.transmission) fieldBasedConditions.push({ transmission: query.transmission })
            if (query.fuelType) fieldBasedConditions.push({ fuelType: query.fuelType })
            if (query.createdAt) fieldBasedConditions.push({ createdAt: query.createdAt })

            const directFilterCondition = { selectedFilters: { $in: allExpandedFilterObjIds } }

            if (fieldBasedConditions.length) {
              // Combine: product matches EITHER the field-based conditions OR has the filter in selectedFilters
              delete query.condition
              delete query.transmission
              delete query.fuelType
              delete query.createdAt
              query.$and = query.$and || []
              query.$and.push({ $or: [...fieldBasedConditions, directFilterCondition] })
            } else {
              // No known field matches — rely solely on selectedFilters
              query.$and = query.$and || []
              query.$and.push(directFilterCondition)
            }
          }
        }
      } catch (e) {
        console.error('Error applying filterIds to product query:', e)
      }
    }

    // Vehicle filters
    if (year && year.trim() !== '') {
      const y = Number(year)
      if (!isNaN(y)) query.year = y
    }
    if (minMileage !== undefined && minMileage !== null && minMileage !== '') {
      const min = Number(minMileage)
      if (!isNaN(min)) {
        query.mileage = query.mileage || {}
        query.mileage.$gte = min
      }
    }
    if (maxMileage !== undefined && maxMileage !== null && maxMileage !== '') {
      const max = Number(maxMileage)
      if (!isNaN(max)) {
        query.mileage = query.mileage || {}
        query.mileage.$lte = max
      }
    }
    // brandId/modelId/trimId are CATEGORY IDs from the cascading category tree,
    // not Filter IDs. Products may store these as category/subcategory references,
    // or as text in make/model/brand fields, or in filterData.
    const brandId = req.query.brandId ?? null
    const modelId = req.query.modelId ?? null
    const trimId = req.query.trimId ?? null

    // Helper: expand a category ID to include itself + all descendant category IDs
    const expandCategoryScope = async (catId) => {
      if (!catId || !mongoose.Types.ObjectId.isValid(catId)) return []
      const objId = new mongoose.Types.ObjectId(String(catId))
      const docs = await Category.find({
        isDeleted: false,
        $or: [{ _id: objId }, { path: objId }],
      }).select('_id').lean()
      return docs.map((d) => d._id)
    }

    // Vehicle hierarchy: brandId / modelId / trimId are Category tree IDs (see PostAd categoryPath).
    // When any ID is present, require exact categoryPath membership (AND) — do not OR-match
    // "any BMW in tree" or title text, or wrong models (e.g. X7) appear for 2-Series filters.
    const hasBrandId = brandId && mongoose.Types.ObjectId.isValid(brandId)
    const hasModelId = modelId && mongoose.Types.ObjectId.isValid(modelId)
    const hasTrimId = trimId && mongoose.Types.ObjectId.isValid(trimId)

    if (hasBrandId || hasModelId || hasTrimId) {
      query.$and = query.$and || []
      if (hasBrandId) {
        query.$and.push({ categoryPath: new mongoose.Types.ObjectId(String(brandId)) })
      }
      if (hasModelId) {
        query.$and.push({ categoryPath: new mongoose.Types.ObjectId(String(modelId)) })
      }
      if (hasTrimId) {
        query.$and.push({ categoryPath: new mongoose.Types.ObjectId(String(trimId)) })
      }
    } else {
      // Legacy: text-only filters (no hierarchy IDs) — keep OR matching across fields.
      if (make && make.trim() !== '') {
        const makeRx = new RegExp(make.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        const makeOrConditions = [
          { make: makeRx },
          { brand: makeRx },
          { 'additionalFields.filter_brand': makeRx },
          { 'filterData.brand.value': makeRx },
          { 'filterData.make.value': makeRx },
        ]
        query.$and = query.$and || []
        query.$and.push({ $or: makeOrConditions })
      }
      if (model && model.trim() !== '') {
        const m = model.trim()
        const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const buildLooseWordRx = (s) => {
          const raw = String(s || '').trim()
          if (!raw) return null
          const canon = raw.replace(/[\s\-_.]+/g, ' ').trim()
          if (!canon) return null
          const parts = canon.split(' ').filter(Boolean)
          if (!parts.length) return null
          const pattern = parts.map(escapeRx).join('[\\s\\-_.]*')
          return new RegExp(`\\b${pattern}\\b`, 'i')
        }
        const rx = buildLooseWordRx(m) || new RegExp(escapeRx(m), 'i')
        const modelOrConditions = [
          { model: rx },
          { 'additionalFields.model': rx },
          { 'additionalFields.filter_model': rx },
          { 'filterData.model.value': rx },
          ...(m.replace(/[\s\-_.]/g, '').length >= 3 ? [{ title: rx }] : []),
        ]
        query.$and = query.$and || []
        query.$and.push({ $or: modelOrConditions })
      }
      if (trim && trim.trim() !== '') {
        const t = trim.trim()
        const normalized = t.replace(/[\s\-_.]/g, '')
        const loose = (input) => {
          const raw = String(input || '').trim()
          if (!raw) return null
          const canon = raw.replace(/[\s\-_.]/g, '')
          if (!canon) return null
          const escaped = canon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const pattern = escaped.split('').join('[\\s\\-_.]*')
          return new RegExp(pattern, 'i')
        }
        const rxLoose = loose(normalized) || new RegExp(t, 'i')
        const trimOrConditions = [
          { trim: rxLoose },
          { variant: rxLoose },
          { 'additionalFields.trim': rxLoose },
          { 'additionalFields.variant': rxLoose },
          { 'additionalFields.version': rxLoose },
          { 'additionalFields.subModel': rxLoose },
          { 'additionalFields.filter_trim': rxLoose },
          { 'filterData.trim.value': rxLoose },
          { 'filterData.variant.value': rxLoose },
        ]
        query.$and = query.$and || []
        query.$and.push({ $or: trimOrConditions })
      }
    }

    if (condition && condition.trim() !== '') {
      query.condition = condition.trim()
    }
    if (transmission && transmission.trim() !== '') {
      query.transmission = new RegExp(transmission.trim(), 'i')
    }
    if (fuelType && fuelType.trim() !== '') {
      query.fuelType = new RegExp(fuelType.trim(), 'i')
    }

    // -----------------------------------------------------
    // 🚀 FIXED USER FILTER ISSUE
    // ONLY apply userId filter when explicitly requested
    // -----------------------------------------------------
    if (userId && userId.trim() !== '') {
      // "My Listings" → show only this user's products
      query.seller = userId

      // Let users + admins see all statuses for their own listings
    } else {
      // PUBLIC FEED (REELS FEED)
      // ALWAYS show active products only
      if (!isAdmin) {
        query.status = 'active'
      }
    }
    // -----------------------------------------------------

    const skip = (Number(page) - 1) * Number(limit)

    let sort = { createdAt: -1 }
    if (sortBy === 'price_asc') sort = { price: 1, createdAt: -1 }
    else if (sortBy === 'price_desc') sort = { price: -1, createdAt: -1 }

    // Debug: log the full query when filters are applied
    if (make || model || trim || req.query.brandId || req.query.modelId || req.query.trimId) {
      console.log('[ProductQuery] Filters — make:', make, 'model:', model, 'trim:', trim,
        'brandId:', req.query.brandId, 'modelId:', req.query.modelId, 'trimId:', req.query.trimId)
      console.log('[ProductQuery] Full query:', JSON.stringify(query, null, 2))

      // Count ALL products (any status) to diagnose
      const totalAll = await Product.countDocuments({})
      const totalActive = await Product.countDocuments({ status: 'active' })
      const totalPending = await Product.countDocuments({ status: 'pending' })
      console.log(`[ProductQuery] DB totals — all: ${totalAll}, active: ${totalActive}, pending: ${totalPending}`)

      // Count in category scope only
      if (normalizedCategoryId) {
        const catCount = await Product.countDocuments({ 
          category: new mongoose.Types.ObjectId(String(normalizedCategoryId))
        })
        const catCountAny = await Product.countDocuments({
          $or: [
            { category: new mongoose.Types.ObjectId(String(normalizedCategoryId)) },
            { subcategory: new mongoose.Types.ObjectId(String(normalizedCategoryId)) },
          ]
        })
        console.log(`[ProductQuery] In categoryId ${normalizedCategoryId}: direct=${catCount}, anyField=${catCountAny}`)
      }

      // Sample a product to inspect data shape
      const sampleQ = normalizedCategoryId 
        ? { $or: [
            { category: new mongoose.Types.ObjectId(String(normalizedCategoryId)) },
            { subcategory: new mongoose.Types.ObjectId(String(normalizedCategoryId)) },
          ]}
        : {}
      const sample = await Product.findOne(sampleQ)
        .select('title status make model brand category subcategory filterData selectedFilters')
        .lean()
      if (sample) {
        console.log('[ProductQuery] Sample product:', JSON.stringify({
          title: sample.title, status: sample.status,
          make: sample.make, model: sample.model, brand: sample.brand,
          category: sample.category, subcategory: sample.subcategory,
          filterData: sample.filterData,
          selectedFilterCount: sample.selectedFilters?.length || 0,
        }, null, 2))
      }
    }

    const products = await Product.find(query)
      .populate('category', 'name icon emoji')
      .populate('seller', 'name avatar rating memberSince isVerified identityVerificationStatus')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean()

    const total = await Product.countDocuments(query)
    
    if ((make || model || trim) && total === 0) {
      console.log('[ProductQuery] 0 results with filters. Query:', JSON.stringify(query))
    }
    const hasMore = skip + products.length < total

    const productsWithSaved = products.map((p) => withSaved(p, savedStorage))

    res.json({
      products: productsWithSaved,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore,
      ...(filterDebug ? { filterDebug } : {}),
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    res.status(500).json({ message: 'Error fetching products' })
  }
})

// Consistent reels-feed response shape (success or error) to prevent frontend crashes
function reelsFeedErrorResponse (res, statusCode = 500, message = 'Error fetching products') {
  return res.status(statusCode).json({
    products: [],
    page: 1,
    limit: 10,
    total: 0,
    hasMore: false,
    message,
  })
}

// @route   GET /api/products/reels-feed
// @desc    Get products for reels feed (random order; optional excludeUserId, excludeIds for pagination)
// @access  Public
router.get('/reels-feed', async (req, res) => {
  const mongoose = require('mongoose')

  // Validate and sanitize query parameters
  const raw = req.query || {}
  const page = Math.max(1, Math.floor(Number(raw.page)) || 1)
  const limit = Math.min(50, Math.max(1, Math.floor(Number(raw.limit)) || 10))
  // Accept either categoryId or category query param
  const categoryId = (typeof raw.categoryId === 'string' && raw.categoryId.trim()) ? raw.categoryId.trim() : (typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : null)
  const subcategoryId = typeof raw.subcategoryId === 'string' ? raw.subcategoryId.trim() : null
  const location = typeof raw.location === 'string' ? raw.location.trim().slice(0, 200) : ''
  const search = typeof raw.search === 'string' ? raw.search.trim().slice(0, 300) : ''
  const excludeUserId = typeof raw.excludeUserId === 'string' ? raw.excludeUserId.trim() : ''
  const excludeIdsRaw = typeof raw.excludeIds === 'string' ? raw.excludeIds : ''

  const minPrice = raw.minPrice != null && raw.minPrice !== '' ? Number(raw.minPrice) : null
  const maxPrice = raw.maxPrice != null && raw.maxPrice !== '' ? Number(raw.maxPrice) : null
  const validMinPrice = typeof minPrice === 'number' && Number.isFinite(minPrice) ? minPrice : null
  const validMaxPrice = typeof maxPrice === 'number' && Number.isFinite(maxPrice) ? maxPrice : null

  let savedStorage = { userId: null, savedProductIds: new Set() }
  try {
    savedStorage = await readSavedStorageForRequest(req)
  } catch (e) {
    // Continue with empty saved storage
  }

  try {
    const query = {}
    console.log('reels-feed req.query =>', req.query)

    // Filters: category = selected category OR any descendant (products in child categories included)
    if (categoryId) {
      if (mongoose.Types.ObjectId.isValid(categoryId)) {
        const catObjId = new mongoose.Types.ObjectId(categoryId)
        const descendantDocs = await Category.find({
          $or: [
            { _id: catObjId },
            { path: catObjId },
          ],
        })
          .select('_id')
          .lean()
        const categoryIds = (descendantDocs || []).map((d) => d._id)
        if (categoryIds.length > 0) {
          query.category = { $in: categoryIds }
        } else {
          query.category = catObjId
        }
        if (!subcategoryId) {
          const categoryScope = query.category
          delete query.category
          query.$and = query.$and || []
          query.$and.push({ $or: [{ category: categoryScope }, { subcategory: categoryScope }] })
        }
      } else {
        query.category = categoryId
        if (!subcategoryId) {
          const categoryScope = query.category
          delete query.category
          query.$and = query.$and || []
          query.$and.push({ $or: [{ category: categoryScope }, { subcategory: categoryScope }] })
        }
      }
    }
    if (subcategoryId) {
      if (mongoose.Types.ObjectId.isValid(subcategoryId)) {
        query.subcategory = new mongoose.Types.ObjectId(subcategoryId)
      } else {
        query.subcategory = subcategoryId
      }
    }
    if (location) {
      try {
        query.location = new RegExp(location, 'i')
      } catch (e) {
        // Invalid regex, skip
      }
    }
    if (validMinPrice != null || validMaxPrice != null) {
      query.price = {}
      if (validMinPrice != null) query.price.$gte = validMinPrice
      if (validMaxPrice != null) query.price.$lte = validMaxPrice
    }
    if (search) {
      query.$text = { $search: search }
    }

    delete query.seller
    if (excludeUserId) {
      query.seller = { $ne: excludeUserId }
    }

    const adminUsers = await User.find({ role: 'admin' }).select('_id').lean()
    const adminUserIds = adminUsers.map((a) => a._id)
    if (adminUserIds.length > 0) {
      query.$or = [
        { status: 'active' },
        { seller: { $in: adminUserIds } },
      ]
    } else {
      query.status = 'active'
    }

    // Log final filter for debugging
    console.log('reels-feed final filter =>', query)

    // Total count before excluding IDs (for hasMore)
    let total = 0
    try {
      total = await Product.countDocuments(query)
    } catch (e) {
      console.error('Reels feed countDocuments error:', e)
      return reelsFeedErrorResponse(res, 500, 'Error fetching products')
    }

    // Exclude already-seen IDs so no duplicate reels within the same session (pagination)
    const excludeIdStrings = excludeIdsRaw
      ? excludeIdsRaw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 1000)
      : []
    const validExcludeIds = excludeIdStrings.filter(Boolean)
    if (validExcludeIds.length > 0) {
      // Use string IDs and let Mongoose cast them.
      query._id = { $nin: validExcludeIds }
    }

    let products = []
    try {
      // Primary: aggregation $sample for randomized results (works on MongoDB 3.2+; no $rand dependency)
      const pipeline = [
        { $match: query },
        { $sample: { size: limit } },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: '_categoryDoc',
          },
        },
        { $unwind: { path: '$_categoryDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'seller',
            foreignField: '_id',
            as: '_sellerDoc',
          },
        },
        { $unwind: { path: '$_sellerDoc', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            category: {
              name: '$_categoryDoc.name',
              icon: '$_categoryDoc.icon',
              emoji: '$_categoryDoc.emoji',
            },
            seller: {
              _id: '$_sellerDoc._id',
              name: '$_sellerDoc.name',
              avatar: '$_sellerDoc.avatar',
              rating: '$_sellerDoc.rating',
              memberSince: '$_sellerDoc.memberSince',
              isVerified: '$_sellerDoc.isVerified',
              identityVerificationStatus: '$_sellerDoc.identityVerificationStatus',
            },
          },
        },
        { $project: { _categoryDoc: 0, _sellerDoc: 0 } },
      ]
      const aggResult = await Product.aggregate(pipeline)
      products = aggResult || []
    } catch (aggErr) {
      console.warn('Reels feed $sample aggregation failed, trying $rand fallback:', aggErr.message)
      try {
        products = await Product.find(query)
          .populate('category', 'name icon emoji')
          .populate('seller', 'name avatar rating memberSince isVerified identityVerificationStatus')
          .sort({ $rand: 1 })
          .limit(limit)
          .lean()
      } catch (randErr) {
        console.warn('Reels feed $rand failed, using createdAt fallback:', randErr.message)
        const skip = (page - 1) * limit
        products = await Product.find(query)
          .populate('category', 'name icon emoji')
          .populate('seller', 'name avatar rating memberSince isVerified identityVerificationStatus')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      }
    }

    const alreadySeen = validExcludeIds.length
    const hasMore = total > alreadySeen + products.length
    console.log(`reels-feed results: returned=${products.length} total=${total} hasMore=${hasMore}`)
    const enrichedProducts = await enrichReelsProducts(Array.isArray(products) ? products : [])
    const productsWithSaved = enrichedProducts.map((p) => withSaved(p, savedStorage))

    res.json({
      products: productsWithSaved,
      page,
      limit,
      total,
      hasMore,
    })
  } catch (error) {
    console.error('Error fetching reels feed:', error)
    return reelsFeedErrorResponse(res, 500, error.message || 'Error fetching products')
  }
})


// @route   GET /api/products/:id/related
// @desc    Get related products
// @access  Public
// NOTE: This route must come BEFORE /:id to avoid route conflicts
router.get('/:id/related', validateObjectId('id'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const { categoryId, location } = req.query

    const query = {
      _id: { $ne: product._id },
      status: 'active', // Only show approved products in related
    }

    if (categoryId || product.category) {
      // Prefer explicit categoryId query param, otherwise use product's category
      if (categoryId) query.category = categoryId
      else query.category = product.category
    }
    // Also filter by subcategory when available (query param takes precedence)
    const relatedSub = req.query.subcategoryId || product.subcategory
    if (relatedSub) {
      query.subcategory = relatedSub
    }

    if (location || product.location) {
      query.location = new RegExp(location || product.location, 'i')
    }

    const relatedProducts = await Product.find(query)
      .populate('category', 'name')
      .limit(10)
      .sort({ createdAt: -1 })
      .lean()

    const savedStorage = await readSavedStorageForRequest(req)
    const relatedWithSaved = relatedProducts.map((p) => withSaved(p, savedStorage))

    res.json(relatedWithSaved)
  } catch (error) {
    console.error('Error fetching related products:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error fetching related products' })
  }
})

// @route   GET /api/products/search
// @desc    Search products by text, category, location and price range
// @access  Public
router.get('/search', async (req, res) => {
  const mongoose = require('mongoose')
  const raw = req.query || {}
  const q = typeof raw.q === 'string' ? raw.q.trim().slice(0, 300) : ''
  const categoryId = typeof raw.categoryId === 'string' ? raw.categoryId.trim() : null
  const subcategoryId = typeof raw.subcategoryId === 'string' ? raw.subcategoryId.trim() : null
  const location = typeof raw.location === 'string' ? raw.location.trim().slice(0, 200) : ''
  const page = Math.max(1, Math.floor(Number(raw.page)) || 1)
  const limit = Math.min(50, Math.max(1, Math.floor(Number(raw.limit)) || 20))
  const minPrice = raw.minPrice != null && raw.minPrice !== '' ? Number(raw.minPrice) : null
  const maxPrice = raw.maxPrice != null && raw.maxPrice !== '' ? Number(raw.maxPrice) : null

  try {
    const match = { status: 'active' }

    if (categoryId && mongoose.Types.ObjectId.isValid(String(categoryId))) {
      const catObjId = new mongoose.Types.ObjectId(String(categoryId))
      const categoryScopeDocs = await Category.find({
        isDeleted: false,
        $or: [{ _id: catObjId }, { path: catObjId }],
      })
        .select('_id')
        .lean()
      const categoryScopeIds = (categoryScopeDocs || []).map((d) => d._id)
      match.category = categoryScopeIds.length ? { $in: categoryScopeIds } : catObjId
    } else if (categoryId) {
      // allow searching by slug/name string
      match.category = categoryId
    }
    if (subcategoryId && mongoose.Types.ObjectId.isValid(String(subcategoryId))) {
      const subObjId = new mongoose.Types.ObjectId(String(subcategoryId))
      const subScopeDocs = await Category.find({
        isDeleted: false,
        $or: [{ _id: subObjId }, { path: subObjId }],
      })
        .select('_id')
        .lean()
      const subScopeIds = (subScopeDocs || []).map((d) => d._id)
      const subScope = subScopeIds.length ? { $in: subScopeIds } : subObjId
      if (match.category) {
        const categoryQuery = match.category
        delete match.category
        match.$and = match.$and || []
        match.$and.push({ category: categoryQuery })
        match.$and.push({ $or: [{ subcategory: subScope }, { category: subScope }] })
      } else {
        match.$or = [{ subcategory: subScope }, { category: subScope }]
      }
    } else if (subcategoryId) {
      if (match.category) {
        const categoryQuery = match.category
        delete match.category
        match.$and = match.$and || []
        match.$and.push({ category: categoryQuery })
        match.$and.push({ $or: [{ subcategory: subcategoryId }, { category: subcategoryId }] })
      } else {
        match.$or = [{ subcategory: subcategoryId }, { category: subcategoryId }]
      }
    }

    if (location) {
      try { match.location = new RegExp(location, 'i') } catch (e) {}
    }

    if (minPrice != null || maxPrice != null) {
      match.price = {}
      if (minPrice != null && Number.isFinite(minPrice)) match.price.$gte = minPrice
      if (maxPrice != null && Number.isFinite(maxPrice)) match.price.$lte = maxPrice
    }

    let products = []
    let total = 0

    if (q) {
      // Prefer text index when available
      try {
        match.$text = { $search: q }
        total = await Product.countDocuments(match)
        products = await Product.find(match)
          .populate('category', 'name icon emoji')
          .populate('seller', 'name avatar rating memberSince isVerified identityVerificationStatus')
          .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
      } catch (textErr) {
        // Fallback to regex search if $text not supported or fails
        delete match.$text
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        match.$or = [{ title: regex }, { description: regex }]
        total = await Product.countDocuments(match)
        products = await Product.find(match)
          .populate('category', 'name icon emoji')
          .populate('seller', 'name avatar rating memberSince isVerified identityVerificationStatus')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
      }
    } else {
      total = await Product.countDocuments(match)
      products = await Product.find(match)
        .populate('category', 'name icon emoji')
        .populate('seller', 'name avatar rating memberSince isVerified identityVerificationStatus')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    }

    const savedStorage = await readSavedStorageForRequest(req)
    const productsWithSaved = Array.isArray(products) ? products.map((p) => withSaved(p, savedStorage)) : []
    const hasMore = total > page * limit

    return res.json({
      products: productsWithSaved,
      page,
      limit,
      total,
      hasMore,
    })
  } catch (error) {
    console.error('Error searching products:', error)
    return res.status(500).json({
      products: [],
      page: 1,
      limit: 20,
      total: 0,
      hasMore: false,
      message: error.message || 'Error searching products',
    })
  }
})

// @route   GET /api/products/:id/video-processing
// @desc    Poll HLS transcoding status for a product video
// @access  Public (owners/admins get full error details)
router.get('/:id/video-processing', validateObjectId('id'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .select('video videoStream seller')
      .lean()

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const stream = product.videoStream || {}
    const status = normalizeStatus(stream.status)

    const stageLabels = {
      pending: 'Processing Video...',
      processing: 'Processing Video...',
      generating_thumbnail: 'Generating Thumbnail...',
      generating_streams: 'Generating Streaming Files...',
      completed: 'Video Ready',
      failed: 'Processing Failed',
    }

    const processingStage = stream.processingStage || stream.status || 'pending'

    return res.json({
      productId: product._id,
      originalUrl: stream.originalUrl || product.video,
      status,
      processingStage,
      message: stageLabels[processingStage] || stageLabels[status] || 'Processing Video...',
      progress: stream.progress ?? null,
      hlsUrl: stream.hlsUrl || null,
      masterPlaylistUrl: stream.masterPlaylistUrl || stream.hlsUrl || null,
      thumbnailUrl: stream.thumbnailUrl || null,
      duration: stream.duration || 0,
      width: stream.width || 0,
      height: stream.height || 0,
      fileSize: stream.fileSize || 0,
      availableQualities: stream.availableQualities || (stream.renditions || []).map((r) => r.id),
      processingStartedAt: stream.processingStartedAt || null,
      processingCompletedAt: stream.processingCompletedAt || null,
      jobId: stream.jobId || null,
      error: status === 'failed' ? stream.error : null,
    })
  } catch (error) {
    console.error('[products] video-processing status error:', error)
    return res.status(500).json({ message: error.message || 'Error fetching video processing status' })
  }
})

// @route   GET /api/products/:id
// @desc    Get single product by ID
// @access  Public (but only active products visible to non-owners)
router.get('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name icon emoji')
      .populate('categoryPath', 'name icon emoji')
      .populate('seller', 'name email phone avatar rating memberSince isVerified identityVerificationStatus')

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // Check if user is the owner or admin (from token if provided)
    const token = getJwtFromRequest(req)
    let isOwnerOrAdmin = false

    if (token) {
      try {
        const jwt = require('jsonwebtoken')
        const User = require('../models/User')
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
        const user = await User.findById(decoded.userId)
        if (user) {
          // Handle both populated and unpopulated seller field
          let sellerId
          // Seller is populated (object with _id)
          if (product.seller && typeof product.seller === 'object' && product.seller._id) {
            sellerId = product.seller._id.toString()
          } 
          // Seller is ObjectId or string
          else if (product.seller) {
            sellerId = product.seller.toString()
          } else {
            console.error('Product has no seller field!', product)
            sellerId = null
          }
          
          const userId = user._id.toString()
          isOwnerOrAdmin = 
            (sellerId && sellerId === userId) || 
            user.role === 'admin'
          
          console.log('Product access check:', {
            productId: req.params.id,
            productStatus: product.status,
            sellerId,
            userId,
            isOwner: sellerId === userId,
            isAdmin: user.role === 'admin',
            isOwnerOrAdmin,
            sellerType: typeof product.seller,
            sellerIsObject: product.seller && typeof product.seller === 'object',
            sellerIdValue: product.seller?._id || product.seller,
          })
        } else {
          console.log('No user found from token')
        }
      } catch (err) {
        console.error('Token verification error:', err)
        // Token invalid or expired, continue as public user
      }
    }

    // Only show active products to non-owners (including non-logged-in users)
    // Non-authenticated users can view active products
    // Owners and admins can see products with any status (active, inactive, sold, pending, rejected)
    if (!isOwnerOrAdmin && product.status !== 'active') {
      console.log('Access denied - not owner/admin and product is not active', {
        isOwnerOrAdmin,
        productStatus: product.status,
        hasToken: !!token,
      })
      return res.status(404).json({ message: 'Product not found' })
    }
    
    console.log('✅ Product access granted:', { 
      productId: req.params.id, 
      status: product.status, 
      isOwnerOrAdmin,
      hasToken: !!token,
    })

    // Increment views only for active products
    if (product.status === 'active') {
      try {
        await product.incrementViews()
      } catch (viewErr) {
        console.error('Error incrementing views:', viewErr)
        // continue - still return the product
      }
    }

    // saved = EXISTS(user_id + product_id in saved storage). Real-time read, no cache.
    let savedStorage
    try {
      savedStorage = await readSavedStorageForRequest(req)
    } catch (err) {
      console.error('Error reading saved storage:', err)
      savedStorage = { userId: null, savedProductIds: new Set() }
    }
    const productWithSaved = withSaved(product, savedStorage)
    const [presentation, attributesPresentation] = await Promise.all([
      buildVehicleDetailPresentation(productWithSaved),
      buildProductAttributesPresentation(productWithSaved),
    ])
    res.json({
      ...productWithSaved,
      ...presentation.legacyFields,
      ...presentation.vehicleListingFields,
      carOverview: presentation.carOverview,
      vehicleFeatures: presentation.vehicleFeatures,
      productAttributes: attributesPresentation.productAttributes,
      productMultiAttributes: attributesPresentation.productMultiAttributes,
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error fetching product' })
  }
})

// @route   POST /api/products
// @desc    Create new product
// @access  Private
router.post(
  '/',
  authMiddleware,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'images', maxCount: 20 },
  ]),
  compressVideo,
  createProductRules,
  async (req, res) => {
    try {
      const validationErrors = validationResult(req)
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          message: validationErrors.array()[0]?.msg || 'Validation failed',
          errors: validationErrors.array(),
        })
      }

      const { values: vehicleFieldValues, errors: vehicleFieldErrors } =
        await parseAndResolveProductVehicleFields(req.body)
      if (vehicleFieldErrors.length) {
        return res.status(400).json({ message: vehicleFieldErrors[0], errors: vehicleFieldErrors })
      }

      // Check if user is verified (admins can bypass this check)
      const isAdmin = req.user.role === 'admin'
      if (!isAdmin && !req.user.isVerified) {
        return res.status(403).json({ message: 'Verified account required to post ads' })
      }

      const {
        title,
        description,
        price,
        currency,
        category,
        subcategory,
        location,
        country,
        city,
        area,
        brand,
        condition,
        material,
        color,
        seatingCapacity,
        assemblyStatus,
        purchaseYear,
        usageDuration,
        reasonForSelling,
        priceType,
        deliveryOptions,
        contactName,
        contactPhone,
        contactOptions,
        dimensions,
        adType,
        // AI listing extraction JSON payloads
        display_data,
        filter_data,
        specifications,
        vehicleSpecifications,
        missing_fields,
        ai_raw_response,
      } = req.body
      
      // Get all other dynamic fields from body
      const allFields = Object.keys(req.body)
      const handledFields = [
        'title', 'description', 'price', 'currency', 'category', 'subcategory',
        'childCategory', 'categoryPath', 'categoryPathNames',
        'location', 'country', 'city', 'area', 'brand', 'condition', 'material',
        'color', 'seatingCapacity', 'assemblyStatus', 'purchaseYear', 'usageDuration',
        'reasonForSelling', 'priceType', 'deliveryOptions', 'contactName',
        'contactPhone', 'contactOptions', 'dimensions',
        'adType',
        // AI listing extraction payloads
        'display_data',
        'filter_data',
        'specifications',
        'vehicleSpecifications',
        'missing_fields',
        'ai_raw_response',
        ...HANDLED_REQUEST_KEYS,
      ]
      const dynamicFields = {}
      allFields.forEach(key => {
        if (!handledFields.includes(key) && req.body[key] !== undefined && req.body[key] !== null && req.body[key] !== '') {
          dynamicFields[key] = req.body[key]
        }
      })

      // Validation: Video is required
      const hasVideo = req.files?.video?.[0]
      
      if (!hasVideo) {
        return res.status(400).json({ message: 'Video is required. Please upload 1 video.' })
      }

      // Note: Image validation removed - handled on frontend only
      const uploadedImageFiles = Array.isArray(req.files?.images) ? req.files.images : []
      const autoScreenshots = Array.isArray(req.videoScreenshots) ? req.videoScreenshots : []

      // Images: prefer auto angles from video; otherwise require at least one user-uploaded image (matches Post Ad UI).
      const totalImageCount = uploadedImageFiles.length + autoScreenshots.length
      if (totalImageCount < 1) {
        return res.status(400).json({
          message: 'Please upload at least 1 image or capture screenshots from your video.',
        })
      }
      if (autoScreenshots.length === 0 && uploadedImageFiles.length < 1) {
        return res.status(400).json({
          message: 'Please upload at least 1 image. Auto screenshots from video were not available on the server.',
        })
      }
      if (autoScreenshots.length > 0 && autoScreenshots.length < 3 && uploadedImageFiles.length < 1) {
        return res.status(400).json({
          message:
            'Could not extract enough angles from your video. Upload at least 1 photo or capture screenshots in the video step.',
          angleChecklist: ['Front view', 'Side view', 'Top/close-up view'],
        })
      }

      // Maximum 20 images check (includes auto screenshots)
      if (uploadedImageFiles.length > 20) {
        return res.status(400).json({ message: 'Maximum 20 photos allowed' })
      }

      let selectedUploadedImageFiles = uploadedImageFiles
      let selectedAutoScreenshots = autoScreenshots

      // If total would exceed 20, trim user images first (keep auto screenshots if possible).
      const totalImages = uploadedImageFiles.length + autoScreenshots.length
      if (totalImages > 20) {
        const remainingForAuto = 20 - uploadedImageFiles.length
        if (remainingForAuto >= 3) {
          selectedAutoScreenshots = autoScreenshots.slice(0, remainingForAuto)
        } else {
          // Not enough room to keep 3 angles.
          return res.status(400).json({
            message: 'Too many photos. Please upload fewer than 17 photos so we can include at least 3 angle screenshots.',
          })
        }
      }

      // Validation: Description length
      if (!description || description.length < 30) {
        return res.status(400).json({ message: 'Description must be at least 30 characters' })
      }
      if (description.length > 2500) {
        return res.status(400).json({ message: 'Description cannot exceed 2500 characters' })
      }

      // Validation: Check for prohibited content in description
      if (description.match(/[A-Z]{10,}/)) {
        return res.status(400).json({ message: 'Avoid ALL CAPS spam in description' })
      }
      // Prohibited content checks (stricter patterns to reduce false positives)
      // 1) URLs: http(s) or www.* patterns
      const urlRegex = /\b(?:https?:\/\/|www\.)\S+\b/i
      if (urlRegex.test(description)) {
        return res.status(400).json({ message: 'External links are not allowed in description' })
      }

      // 2) Phone numbers
      // Allow phone numbers in description (do not hard-block posting).
      // Note: contact details are already supported via `contactPhone` and moderation can handle abuse.

      // 3) Email addresses
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
      if (emailRegex.test(description)) {
        return res.status(400).json({ message: 'Email addresses should not be in description' })
      }

      // Validation: Price validation
      const priceNum = Number(price)
      if (!priceNum || priceNum <= 0) {
        return res.status(400).json({ message: 'Valid price is required' })
      }
      if (priceNum > 10000000) {
        return res.status(400).json({ message: 'Price seems unrealistic. Please verify.' })
      }

      // Check for duplicate listings (same seller, exact same title)
      const escapedTitle = title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const existingProduct = await Product.findOne({
        seller: req.user._id,
        title: new RegExp(`^${escapedTitle}$`, 'i'),
        status: { $in: ['pending', 'active'] }
      })
      if (existingProduct) {
        return res.status(400).json({ message: 'You already have a similar active listing. Please edit or delete it first.' })
      }

      // Validate selected categories exist in the database
      let validCategoryId = category || null
      let validSubcategoryId = subcategory || null
      if (!validCategoryId || !mongoose.Types.ObjectId.isValid(String(validCategoryId))) {
        return res.status(400).json({ message: 'Category is required. Please go back and select a category.' })
      }
      if (validCategoryId && mongoose.Types.ObjectId.isValid(validCategoryId)) {
        const catDoc = await Category.findOne({ _id: validCategoryId, isDeleted: false }).select('_id name').lean()
        if (!catDoc) {
          return res.status(400).json({ message: 'Selected category not found. Please choose a valid category.' })
        }
        console.log(`[PostProduct] Category validated: ${catDoc.name} (${catDoc._id})`)
      }
      if (validSubcategoryId && mongoose.Types.ObjectId.isValid(validSubcategoryId)) {
        const subDoc = await Category.findOne({ _id: validSubcategoryId, isDeleted: false }).select('_id name').lean()
        if (!subDoc) {
          console.warn(`[PostProduct] Subcategory ${validSubcategoryId} not found, ignoring`)
          validSubcategoryId = null
        } else {
          console.log(`[PostProduct] Subcategory validated: ${subDoc.name} (${subDoc._id})`)
        }
      }

      // Parse and validate categoryPath (full hierarchy of IDs)
      let parsedCategoryPath = []
      let parsedCategoryPathNames = []
      try {
        if (req.body.categoryPath) {
          const raw = typeof req.body.categoryPath === 'string' ? JSON.parse(req.body.categoryPath) : req.body.categoryPath
          if (Array.isArray(raw)) {
            parsedCategoryPath = raw.filter(id => id && mongoose.Types.ObjectId.isValid(String(id)))
          }
        }
        if (req.body.categoryPathNames) {
          const raw = typeof req.body.categoryPathNames === 'string' ? JSON.parse(req.body.categoryPathNames) : req.body.categoryPathNames
          if (Array.isArray(raw)) {
            parsedCategoryPathNames = raw.filter(Boolean)
          }
        }
      } catch (e) {
        console.warn('[PostProduct] Could not parse categoryPath/categoryPathNames:', e.message)
      }
      console.log('[PostProduct] categoryPath IDs:', parsedCategoryPath)
      console.log('[PostProduct] categoryPath names:', parsedCategoryPathNames)

      // Build location string
      const locationString = location || (area && city && country ? `${area}, ${city}, ${country}` : location)

      const productData = {
        title: title.trim(),
        description: description.trim(),
        price: priceNum,
        currency: currency || 'USD',
        category: validCategoryId,
        subcategory: validSubcategoryId,
        categoryPath: parsedCategoryPath.length ? parsedCategoryPath : [validCategoryId, validSubcategoryId].filter(Boolean),
        location: locationString,
        country: country || null,
        city: city || null,
        area: area || null,
        brand: brand || null,
        condition,
        material: material || null,
        color: color || null,
        seatingCapacity: seatingCapacity ? Number(seatingCapacity) : null,
        assemblyStatus: assemblyStatus || null,
        priceType: priceType || 'Fixed',
        adType: ['free', 'basic', 'premium'].includes(String(adType || 'free')) ? String(adType) : 'free',
        contactName: contactName || req.user.name,
        contactPhone: contactPhone || req.user.phone,
        seller: req.user._id,
        // AI listing extraction payload (stored verbatim/normalized by /api/listings/ai-extract)
        display_data: parseJSONField(display_data) || null,
        filter_data: parseJSONField(filter_data) || null,
        specifications: parseJSONField(specifications),
        vehicleSpecifications: parseJSONField(vehicleSpecifications) || null,
        missing_fields: Array.isArray(parseJSONField(missing_fields))
          ? parseJSONField(missing_fields)
          : [],
        ai_raw_response: parseJSONField(ai_raw_response) || null,
      }
      applyProductVehicleFields(productData, vehicleFieldValues)
      productData.adConfig = adTypes[productData.adType] || adTypes.free

      // Dimensions
      if (dimensions) {
        const dims = parseJSONField(dimensions)
        if (dims && (dims.length || dims.width || dims.height)) {
          productData.dimensions = {
            length: dims.length ? Number(dims.length) : null,
            width: dims.width ? Number(dims.width) : null,
            height: dims.height ? Number(dims.height) : null,
            unit: dims.unit || 'cm'
          }
        }
      }

      // Usage details
      if (purchaseYear) {
        productData.purchaseYear = Number(purchaseYear)
      }
      if (usageDuration) {
        const usage = parseJSONField(usageDuration)
        if (usage && (usage.value || usage.unit)) {
          productData.usageDuration = {
            value: usage.value ? Number(usage.value) : null,
            unit: usage.unit || null
          }
        }
      }
      if (reasonForSelling) {
        productData.reasonForSelling = reasonForSelling.trim()
      }

      // Delivery options
      if (deliveryOptions) {
        const delivery = parseJSONField(deliveryOptions)
        productData.deliveryOptions = {
          buyerPickup: delivery.buyerPickup !== false,
          sellerDelivery: delivery.sellerDelivery === true,
          deliveryCharges: delivery.deliveryCharges ? Number(delivery.deliveryCharges) : 0
        }
      } else {
        productData.deliveryOptions = {
          buyerPickup: true,
          sellerDelivery: false,
          deliveryCharges: 0
        }
      }

      // Contact options
      if (contactOptions) {
        const contact = parseJSONField(contactOptions)
        productData.contactOptions = {
          inAppChat: contact.inAppChat !== false,
          call: contact.call !== false,
          whatsapp: contact.whatsapp === true
        }
      } else {
        productData.contactOptions = {
          inAppChat: true,
          call: true,
          whatsapp: false
        }
      }

      // Video (after compression). Use compressed filename if available, otherwise fall back to original filename.
      if (req.files?.video?.[0]) {
        const vf = req.files.video[0]
        const videoFilename = vf.compressedFilename || vf.filename || vf.originalname
        productData.video = `/uploads/videos/${videoFilename}`
      }

      // Images
      const uploadedImageUrls = selectedUploadedImageFiles.map((file) => `/uploads/images/${file.filename}`)
      const autoScreenshotImageUrls = selectedAutoScreenshots.map((s) => s.url).filter(Boolean)

      productData.videoScreenshots = selectedAutoScreenshots.map((s) => ({
        image: s.url,
        timestamp: Number(s.timestamp),
        source: s.source || 'auto',
      }))

      // Combine user-uploaded images + auto screenshots (keep total <= 20 via earlier selection)
      productData.images = [...uploadedImageUrls, ...autoScreenshotImageUrls]

      // Add dynamic fields (any fields not explicitly handled above)
      Object.keys(dynamicFields).forEach(key => {
        if (!productData.hasOwnProperty(key)) {
          const fieldValue = dynamicFields[key]
          const storeValue = (() => {
            if (fieldValue === 'true') return true
            if (fieldValue === 'false') return false
            if (typeof fieldValue === 'string' && !isNaN(fieldValue) && fieldValue.trim() !== '') {
              const numValue = Number(fieldValue)
              if (!isNaN(numValue)) return numValue
            }
            return typeof fieldValue === 'string' ? fieldValue.trim() : fieldValue
          })()

          const isKnownSchemaPath = Boolean(Product.schema?.path(key))
          if (isKnownSchemaPath) {
            productData[key] = storeValue
          } else {
            if (!productData.additionalFields) productData.additionalFields = {}
            productData.additionalFields[key] = storeValue
          }
        }
      })

      // ---- APPLY FIELDS FROM CATEGORY PATH (authoritative) ----
      // For hierarchies like Motors > New Cars > Land Rover > Discovery > HSE Luxury:
      // Level 2 => brand/make, Level 3 => model, Level 4 => trim/variant.
      // We intentionally prefer selected hierarchy values over inferred transcript/title values.
      if (parsedCategoryPathNames.length >= 3) {
        productData.make = parsedCategoryPathNames[2]
        productData.brand = parsedCategoryPathNames[2]
        if (parsedCategoryPathNames.length >= 4) {
          productData.model = parsedCategoryPathNames[3]
        }
        if (parsedCategoryPathNames.length >= 5) {
          productData.trim = parsedCategoryPathNames[4]
          productData.variant = parsedCategoryPathNames[4]
        }
        console.log(`[PostProduct] Auto-populated from category path — make: ${productData.make}, model: ${productData.model}, trim: ${productData.trim}`)
      }

      // ---- FILTER DATA STORAGE ----
      // Collect all filter_* fields from the request body.
      // Frontend sends:
      //   filter_<slug>       = ObjectId (cascade deepest selected) or option string (explicit)
      //   filter_<slug>_name  = human-readable name (for cascade mode)
      //   filter_<slug>_lvlN  = intermediate cascade levels
      const bodyKeys = Object.keys(req.body || {})
      const filterBaseKeys = bodyKeys.filter((k) =>
        k.startsWith('filter_') && !k.includes('_lvl') && !k.endsWith('_name')
      )
      const allFilterIds = []
      const filterDataObj = {}

      console.log('[FilterStore] All filter_* keys in req.body:', bodyKeys.filter((k) => k.startsWith('filter_')))

      for (const key of filterBaseKeys) {
        const slug = key.replace('filter_', '')
        const nameKey = `${key}_name`
        const humanName = req.body[nameKey] ? String(req.body[nameKey]).trim() : ''
        const values = parseFilterValues(req.body[key])
        if (!values.length) continue

        const objectIds = values.filter((v) => mongoose.Types.ObjectId.isValid(v))
        const stringValues = values.filter((v) => !mongoose.Types.ObjectId.isValid(v))

        for (const id of objectIds) {
          allFilterIds.push(id)
        }

        if (objectIds.length) {
          filterDataObj[slug] = {
            values: objectIds,
            filterIds: objectIds,
            value: humanName || objectIds.join(', '),
          }
        } else if (stringValues.length) {
          filterDataObj[slug] = {
            values: stringValues,
            value: stringValues.join(', '),
          }
        }
      }

      // Also check level keys in case the base key is missing
      const filterLvlKeys = bodyKeys.filter((k) => k.startsWith('filter_') && k.includes('_lvl'))
      for (const lvlKey of filterLvlKeys) {
        const val = String(req.body[lvlKey] || '').trim()
        if (!val) continue
        if (mongoose.Types.ObjectId.isValid(val)) {
          allFilterIds.push(val)
        }
      }

      // Auto-resolve filters from product data when no filter fields were sent
      if (!filterBaseKeys.length && !filterLvlKeys.length && (productData.category || productData.subcategory)) {
        try {
          const { filterSelections, matchedFilterIds, matchDetails } = await resolveFiltersFromProductData({
            productData,
            categoryId: String(productData.category),
            subcategoryId: productData.subcategory ? String(productData.subcategory) : null,
            models: { Filter, Category, CategoryFilter },
          })
          if (Object.keys(filterSelections).length) {
            for (const detail of matchDetails) {
              const slug = detail.fieldKey.replace('filter_', '')
              filterDataObj[slug] = {
                filterId: detail.matchedId || null,
                value: detail.matchedValue,
                source: detail.matchSource,
              }
            }
            for (const fid of matchedFilterIds) {
              if (mongoose.Types.ObjectId.isValid(fid)) allFilterIds.push(fid)
            }
            console.log('[FilterStore] Auto-resolved filter selections:', filterSelections)
          }
        } catch (filterErr) {
          console.error('[FilterStore] Error auto-resolving filters:', filterErr)
        }
      }

      // Resolve parent filter IDs for each child (so both parent and child are in selectedFilters)
      const filterIdsToResolve = [...allFilterIds]
      for (const fid of filterIdsToResolve) {
        try {
          const filterDoc = await Filter.findById(fid).select('parentId name').lean()
          if (filterDoc?.parentId) {
            const parentIdStr = String(filterDoc.parentId)
            if (!allFilterIds.includes(parentIdStr)) allFilterIds.push(parentIdStr)
          }
          // Enrich filterDataObj with the filter name if we have it
          for (const [slug, data] of Object.entries(filterDataObj)) {
            if (data.filterId === fid && !data.value) {
              data.value = filterDoc?.name || fid
            }
          }
        } catch (e) { /* ignore lookup errors */ }
      }

      // Store selectedFilters (deduplicated ObjectId array)
      const uniqueFilterIds = [...new Set(allFilterIds)].filter((id) => mongoose.Types.ObjectId.isValid(id))
      if (uniqueFilterIds.length) {
        productData.selectedFilters = uniqueFilterIds.map((id) => new mongoose.Types.ObjectId(id))
      }

      // Store filterData (readable object for easy DB inspection)
      if (Object.keys(filterDataObj).length) {
        productData.filterData = filterDataObj

        // Copy key filter values into top-level product fields for legacy query compatibility.
        // This ensures products are findable by both filterData queries AND direct field queries.
        const filterFieldMap = {
          brand: ['make', 'brand'],
          make: ['make'],
          model: ['model'],
          trim: ['trim', 'variant'],
          variant: ['trim', 'variant'],
          condition: ['condition'],
          transmission: ['transmission'],
          'fuel-type': ['fuelType'],
          fueltype: ['fuelType'],
          color: ['color'],
        }
        for (const [slug, data] of Object.entries(filterDataObj)) {
          const val =
            Array.isArray(data.values) && data.values.length
              ? data.values[0]
              : data.value
          if (!val || typeof val !== 'string') continue
          const normalizedSlug = slug.toLowerCase().replace(/[\s_]+/g, '-')
          const targetFields = filterFieldMap[normalizedSlug]
          if (targetFields) {
            for (const field of targetFields) {
              if (!productData[field]) {
                productData[field] = val
              }
            }
          }
        }
      }

      // Also persist in additionalFields for backward compatibility
      for (const key of filterBaseKeys) {
        const values = parseFilterValues(req.body[key])
        if (!values.length) continue
        if (!productData.additionalFields) productData.additionalFields = {}
        productData.additionalFields[key] = values
      }

      console.log('[FilterStore] Final selectedFilters:', uniqueFilterIds)
      console.log('[FilterStore] Final filterData:', JSON.stringify(filterDataObj))

      // Set status to pending for moderation
      productData.status = 'pending'
      productData.moderationStatus = 'pending'
      productData.aiExtractedDetails = extractStructuredCarDetails({
        title: productData.title,
        brand: productData.brand,
        model: productData.model || productData.make || null,
        year: productData.year,
        price: productData.price,
        currency: productData.currency,
        condition: productData.condition,
        raw: dynamicFields,
      })

      const product = new Product(productData)
      await product.save()

      if (product.video) {
        enqueueProductVideoTranscode(product._id, product.video).catch((err) => {
          console.error('[products] adaptive transcode queue failed:', err.message)
        })
      }

      await product.populate('category', 'name icon emoji')
      await product.populate('seller', 'name avatar rating memberSince')

      const productWithSaved = withSaved(product, { userId: null, savedProductIds: new Set() })
      res.status(201).json(productWithSaved)
    } catch (error) {
      console.error('Error creating product:', error)
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: Object.values(error.errors)[0].message })
      }
      res.status(500).json({ message: 'Error creating product' })
    }
  }
)

// @route   PUT /api/products/:id/resubmit
// @desc    Resubmit a rejected listing for moderation
// @access  Private (owner only; admins can resubmit too)
router.put(
  '/:id/resubmit',
  authMiddleware,
  validateObjectId('id'),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id)
      if (!product) return res.status(404).json({ message: 'Product not found' })

      const isAdmin = req.user?.role === 'admin'
      const isOwner = String(product.seller?._id || product.seller) === String(req.user?._id)
      if (!isAdmin && !isOwner) return res.status(403).json({ message: 'Not authorized' })

      if (product.status !== 'rejected') {
        return res.status(400).json({ message: 'Only rejected products can be resubmitted.' })
      }

      product.status = 'pending'
      product.moderationStatus = 'pending'
      product.rejectionReason = null
      product.moderationNotes = null
      product.rejectionDetails = null

      await product.save()
      await product.populate('category', 'name icon emoji')
      await product.populate('seller', 'name avatar rating memberSince')

      res.json({ message: 'Product resubmitted successfully', product })
    } catch (error) {
      console.error('Error resubmitting product:', error)
      res.status(500).json({ message: 'Error resubmitting product' })
    }
  },
)


// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private (Owner only)
router.put(
  '/:id',
  authMiddleware,
  validateObjectId('id'),
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'images', maxCount: 20 },
  ]),
  compressVideo,
  updateProductRules,
  async (req, res) => {
    try {
      const validationErrors = validationResult(req)
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          message: validationErrors.array()[0]?.msg || 'Validation failed',
          errors: validationErrors.array(),
        })
      }

      const { values: vehicleFieldValues, errors: vehicleFieldErrors } =
        await parseAndResolveProductVehicleFields(req.body)
      if (vehicleFieldErrors.length) {
        return res.status(400).json({ message: vehicleFieldErrors[0], errors: vehicleFieldErrors })
      }

      const product = await Product.findById(req.params.id).lean()
      if (!product) {
        return res.status(404).json({ message: 'Product not found' })
      }

      const sellerId = product.seller?.toString()
      const userId = req.user._id.toString()
      const isOwner = sellerId === userId
      const isAdmin = req.user.role === 'admin'

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized' })
      }

      const productDoc = await Product.findById(req.params.id)

      const {
        title,
        description,
        price,
        currency,
        category,
        subcategory,
        location,
        country,
        city,
        area,
        brand,
        condition,
        material,
        color,
        seatingCapacity,
        assemblyStatus,
        make,
        model,
        year,
        mileage,
        transmission,
        fuelType,
        purchaseYear,
        usageDuration,
        reasonForSelling,
        priceType,
        deliveryOptions,
        contactName,
        contactPhone,
        contactOptions,
        dimensions,
        adType,
        status,
        isSold,
      } = req.body

      // Validation: Description length (if provided)
      if (description) {
        if (description.length < 30) {
          return res.status(400).json({ message: 'Description must be at least 30 characters' })
        }
        if (description.length > 2500) {
          return res.status(400).json({ message: 'Description cannot exceed 2500 characters' })
        }
      }

      // Validation: Either video OR at least 1 image required
      // Note: Image validation removed - handled on frontend only
      // Maximum 20 images check
      if (req.files?.images) {
        const existingImages = productDoc.images || []
        const totalImages = existingImages.length + req.files.images.length
        if (totalImages > 20) {
          return res.status(400).json({ message: 'Maximum 20 photos allowed' })
        }
      }

      // Update fields
      if (title) productDoc.title = title.trim()
      if (description) productDoc.description = description.trim()
      if (price) productDoc.price = Number(price)
      if (currency) productDoc.currency = currency
      // Category cannot be changed after posting (unless admin)
      if (category && isAdmin) {
        productDoc.category = category
      }
      if (subcategory !== undefined) productDoc.subcategory = subcategory || null
      
      // Location fields
      if (location) productDoc.location = location
      if (country) productDoc.country = country
      if (city) productDoc.city = city
      if (area) productDoc.area = area
      
      // Basic details
      if (brand !== undefined) productDoc.brand = brand || null
      if (condition) productDoc.condition = condition
      if (material !== undefined) productDoc.material = material || null
      if (color !== undefined) productDoc.color = color || null
      if (seatingCapacity !== undefined) productDoc.seatingCapacity = seatingCapacity ? Number(seatingCapacity) : null
      if (assemblyStatus !== undefined) productDoc.assemblyStatus = assemblyStatus || null
      if (priceType) productDoc.priceType = priceType
      if (adType) {
        const normalizedAdType = String(adType).toLowerCase()
        if (['free', 'basic', 'premium'].includes(normalizedAdType)) {
          productDoc.adType = normalizedAdType
          productDoc.adConfig = adTypes[normalizedAdType] || adTypes.free
        }
      }

      // Vehicle fields (aligned with filters and post-ad form)
      if (make !== undefined) productDoc.make = make ? String(make).trim() : null
      if (model !== undefined) productDoc.model = model ? String(model).trim() : null
      if (year !== undefined && year !== '' && year !== null) {
        const y = Number(year)
        productDoc.year = !isNaN(y) ? y : null
      }
      if (mileage !== undefined && mileage !== '' && mileage !== null) {
        const m = Number(mileage)
        productDoc.mileage = !isNaN(m) ? m : null
      }
      if (transmission !== undefined) productDoc.transmission = transmission ? String(transmission).trim() : null
      if (fuelType !== undefined) productDoc.fuelType = fuelType ? String(fuelType).trim() : null

      // Dimensions
      if (dimensions) {
        const dims = parseJSONField(dimensions)
        if (dims && (dims.length || dims.width || dims.height)) {
          productDoc.dimensions = {
            length: dims.length ? Number(dims.length) : null,
            width: dims.width ? Number(dims.width) : null,
            height: dims.height ? Number(dims.height) : null,
            unit: dims.unit || 'cm'
          }
        }
      }

      // Usage details
      if (purchaseYear !== undefined) {
        productDoc.purchaseYear = purchaseYear ? Number(purchaseYear) : null
      }
      if (usageDuration) {
        const usage = parseJSONField(usageDuration)
        if (usage) {
          productDoc.usageDuration = {
            value: usage.value ? Number(usage.value) : null,
            unit: usage.unit || null
          }
        }
      }
      if (reasonForSelling !== undefined) {
        productDoc.reasonForSelling = reasonForSelling ? reasonForSelling.trim() : null
      }

      // Delivery options
      if (deliveryOptions) {
        const delivery = parseJSONField(deliveryOptions)
        if (delivery) {
          productDoc.deliveryOptions = {
            buyerPickup: delivery.buyerPickup !== false,
            sellerDelivery: delivery.sellerDelivery === true,
            deliveryCharges: delivery.deliveryCharges ? Number(delivery.deliveryCharges) : 0
          }
        }
      }

      // Contact options
      if (contactName) productDoc.contactName = contactName
      if (contactPhone) productDoc.contactPhone = contactPhone
      if (contactOptions) {
        const contact = parseJSONField(contactOptions)
        if (contact) {
          productDoc.contactOptions = {
            inAppChat: contact.inAppChat !== false,
            call: contact.call !== false,
            whatsapp: contact.whatsapp === true
          }
        }
      }

      // Status / sold flag (owners can mark sold/inactive; admins can change any status)
      const isSoldValue = parseBooleanField(isSold)
      if (status) {
        if (isAdmin || ['sold', 'inactive'].includes(status.trim())) {
          productDoc.status = status.trim()
          productDoc.isSold = status.trim() === 'sold'
        }
      } else if (isSoldValue !== null) {
        productDoc.isSold = isSoldValue
        if (isSoldValue) productDoc.status = 'sold'
      }

      // ---- VIDEO UPDATE (compressed) ----
      if (req.files?.video?.[0]) {
        const vf = req.files.video[0]
        const videoFilename = vf.compressedFilename || vf.filename || vf.originalname
        productDoc.video = `/uploads/videos/${videoFilename}`

        const autoScreenshots = Array.isArray(req.videoScreenshots) ? req.videoScreenshots : []
        // Replace auto screenshots in the persisted product.
        const oldAutoUrls = (productDoc.videoScreenshots || []).map((s) => s.image).filter(Boolean)
        productDoc.images = (productDoc.images || []).filter((img) => !oldAutoUrls.includes(img))

        productDoc.videoScreenshots = autoScreenshots.map((s) => ({
          image: s.url,
          timestamp: Number(s.timestamp),
          source: s.source || 'auto',
        }))

        const autoImageUrls = autoScreenshots.map((s) => s.url).filter(Boolean)
        productDoc.images = [...(productDoc.images || []), ...autoImageUrls]
      }

      // ---- IMAGES UPDATE ----
      if (req.files?.images?.length > 0) {
        const newImages = req.files.images.map(
          (file) => `/uploads/images/${file.filename}`
        )
        const existingImages = productDoc.images || []
        productDoc.images = [...existingImages, ...newImages].slice(0, 20)
      }

      // ---- DYNAMIC FIELDS UPDATE (category filter fields, etc.) ----
      // Persist unknown keys into additionalFields (Product schema is strict).
      // Parse and store categoryPath if provided
      try {
        if (req.body.categoryPath) {
          const raw = typeof req.body.categoryPath === 'string' ? JSON.parse(req.body.categoryPath) : req.body.categoryPath
          if (Array.isArray(raw)) {
            const validPath = raw.filter(id => id && mongoose.Types.ObjectId.isValid(String(id)))
            if (validPath.length) {
              productDoc.categoryPath = validPath
            }
          }
        }
        if (req.body.categoryPathNames) {
          const raw = typeof req.body.categoryPathNames === 'string' ? JSON.parse(req.body.categoryPathNames) : req.body.categoryPathNames
          if (Array.isArray(raw) && raw.length >= 3) {
            // Keep product attributes aligned with user-selected hierarchy.
            productDoc.make = raw[2]
            productDoc.brand = raw[2]
            if (raw.length >= 4) {
              productDoc.model = raw[3]
            }
            if (raw.length >= 5) {
              productDoc.trim = raw[4]
              productDoc.variant = raw[4]
            }
          }
        }
      } catch (e) {
        console.warn('[UpdateProduct] Could not parse categoryPath:', e.message)
      }

      const handledFields = new Set([
        'title', 'description', 'price', 'currency', 'category', 'subcategory',
        'childCategory', 'categoryPath', 'categoryPathNames',
        'location', 'country', 'city', 'area', 'brand', 'condition', 'material',
        'color', 'seatingCapacity', 'assemblyStatus', 'make', 'model', 'trim', 'variant', 'year',
        'mileage', 'transmission', 'fuelType', 'purchaseYear', 'usageDuration',
        'reasonForSelling', 'priceType', 'deliveryOptions', 'contactName',
        'contactPhone', 'contactOptions', 'dimensions', 'adType', 'status',
        // media helper fields used by frontend sometimes
        'existingImages', 'existingVideo',
        ...HANDLED_REQUEST_KEYS,
      ])

      const updateFilterIds = []
      const updateFilterDataObj = {}

      Object.keys(req.body || {}).forEach((key) => {
        if (handledFields.has(key)) return
        const fieldValue = req.body[key]
        if (fieldValue === undefined || fieldValue === null || fieldValue === '') return

        // Collect filter data from filter_* fields
        if (key.startsWith('filter_') && !key.includes('_lvl') && !key.endsWith('_name')) {
          const slug = key.replace('filter_', '')
          const nameKey = `${key}_name`
          const humanName = req.body[nameKey] ? String(req.body[nameKey]).trim() : ''
          const values = parseFilterValues(fieldValue)
          if (!values.length) return

          const objectIds = values.filter((v) => mongoose.Types.ObjectId.isValid(v))
          const stringValues = values.filter((v) => !mongoose.Types.ObjectId.isValid(v))

          for (const id of objectIds) {
            updateFilterIds.push(id)
          }

          if (objectIds.length) {
            updateFilterDataObj[slug] = {
              values: objectIds,
              filterIds: objectIds,
              value: humanName || objectIds.join(', '),
            }
          } else if (stringValues.length) {
            updateFilterDataObj[slug] = {
              values: stringValues,
              value: stringValues.join(', '),
            }
          }
        }

        // Also collect IDs from level keys
        if (key.startsWith('filter_') && key.includes('_lvl')) {
          const val = String(fieldValue).trim()
          if (val && mongoose.Types.ObjectId.isValid(val)) {
            updateFilterIds.push(val)
          }
        }

        // Parse AI JSON payloads and other JSON-serialized fields.
        const jsonFields = new Set(['display_data', 'filter_data', 'specifications', 'missing_fields', 'ai_raw_response'])
        const storeValue = (() => {
          if (jsonFields.has(key)) {
            const parsed = parseJSONField(fieldValue)
            if (key === 'missing_fields') return Array.isArray(parsed) ? parsed : []
            return parsed
          }

          if (fieldValue === 'true') return true
          if (fieldValue === 'false') return false
          if (typeof fieldValue === 'string' && !isNaN(fieldValue) && fieldValue.trim() !== '') {
            const numValue = Number(fieldValue)
            if (!isNaN(numValue)) return numValue
          }
          return typeof fieldValue === 'string' ? fieldValue.trim() : fieldValue
        })()

        const isKnownSchemaPath = Boolean(Product.schema?.path(key))
        if (isKnownSchemaPath) {
          productDoc[key] = storeValue
        } else {
          if (!productDoc.additionalFields) productDoc.additionalFields = new Map()
          productDoc.additionalFields.set(key, storeValue)
        }
      })

      // Update selectedFilters and filterData if filter_* fields were sent
      if (updateFilterIds.length || Object.keys(updateFilterDataObj).length) {
        for (const fid of [...updateFilterIds]) {
          try {
            const filterDoc = await Filter.findById(fid).select('parentId name').lean()
            if (filterDoc?.parentId && !updateFilterIds.includes(String(filterDoc.parentId))) {
              updateFilterIds.push(String(filterDoc.parentId))
            }
          } catch (e) { /* ignore */ }
        }
        const uniqueIds = [...new Set(updateFilterIds)].filter((id) => mongoose.Types.ObjectId.isValid(id))
        if (uniqueIds.length) {
          productDoc.selectedFilters = uniqueIds.map((id) => new mongoose.Types.ObjectId(id))
        }
        if (Object.keys(updateFilterDataObj).length) {
          productDoc.filterData = updateFilterDataObj
          productDoc.markModified('filterData')

          // Copy key filter values into top-level fields for query compatibility
          const filterFieldMap = {
            brand: ['make', 'brand'],
            make: ['make'],
            model: ['model'],
            trim: ['trim', 'variant'],
            variant: ['trim', 'variant'],
            condition: ['condition'],
            transmission: ['transmission'],
            'fuel-type': ['fuelType'],
            fueltype: ['fuelType'],
            color: ['color'],
          }
          for (const [slug, data] of Object.entries(updateFilterDataObj)) {
            const val = data.value
            if (!val || typeof val !== 'string') continue
            const normalizedSlug = slug.toLowerCase().replace(/[\s_]+/g, '-')
            const targetFields = filterFieldMap[normalizedSlug]
            if (targetFields) {
              for (const field of targetFields) {
                if (!productDoc[field]) {
                  productDoc[field] = val
                }
              }
            }
          }
        }
        console.log('[FilterStore] Updated selectedFilters:', uniqueIds)
        console.log('[FilterStore] Updated filterData:', JSON.stringify(updateFilterDataObj))
      }

      applyProductVehicleFields(productDoc, vehicleFieldValues)

      await productDoc.save()

      if (req.files?.video?.[0] && productDoc.video) {
        enqueueProductVideoTranscode(productDoc._id, productDoc.video).catch((err) => {
          console.error('[products] adaptive transcode queue failed:', err.message)
        })
      }

      await productDoc.populate('category', 'name icon emoji')
      await productDoc.populate('seller', 'name avatar rating memberSince')

      const savedStorage = await readSavedStorageForRequest(req)
      const productWithSaved = withSaved(productDoc, savedStorage)
      res.json(productWithSaved)
    } catch (error) {
      console.error('Error updating product:', error)
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: Object.values(error.errors)[0].message })
      }
      res.status(500).json({ message: 'Error updating product' })
    }
  }
)


// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private (Owner only)
router.delete('/:id', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // Check if user is the owner
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this product' })
    }

    await Product.findByIdAndDelete(req.params.id)

    res.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' })
    }
    res.status(500).json({ message: 'Error deleting product' })
  }
})

module.exports = router

