const { buildProductCategoryScopeQuery } = require('./productCategoryScope')

/**
 * Build the Mongo filter for the admin products list/export endpoints.
 * Shared by GET /admin/products and GET /admin/products/export so both
 * stay in sync as filters are added.
 */
async function buildAdminProductListQuery(params = {}) {
  const { status, search, productAddType, isFeature, category, subcategory, fromDate, toDate } = params
  const query = {}

  if (status) query.status = status

  const addType = String(productAddType || '').trim().toLowerCase()
  if (addType === 'web' || addType === 'ios' || addType === 'android') {
    query.productAddType = addType
  }

  if (typeof isFeature !== 'undefined') {
    const isFeatureParam = String(isFeature).trim().toLowerCase()
    if (['true', '1'].includes(isFeatureParam)) query.isFeature = true
    else if (['false', '0'].includes(isFeatureParam)) query.isFeature = false
  }

  if (search) {
    query.$text = { $search: search }
  }

  const createdAt = {}
  if (fromDate) {
    const start = new Date(fromDate)
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0)
      createdAt.$gte = start
    }
  }
  if (toDate) {
    const end = new Date(toDate)
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999)
      createdAt.$lte = end
    }
  }
  if (Object.keys(createdAt).length) query.createdAt = createdAt

  const categoryScope = await buildProductCategoryScopeQuery({ category, subcategory })
  if (categoryScope) {
    if (categoryScope.$and) query.$and = categoryScope.$and
    else if (categoryScope.$or) query.$or = categoryScope.$or
    else Object.assign(query, categoryScope)
  }

  return query
}

module.exports = { buildAdminProductListQuery }
