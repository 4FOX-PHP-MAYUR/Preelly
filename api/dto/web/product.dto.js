/**
 * Web-optimized product payloads — full metadata, SEO fields, breadcrumbs.
 */
const {
  pickVehicleListingFields,
} = require('../../utils/productVehicleFields')

function buildBreadcrumbs(product) {
  if (!product.category) return []
  const cat = product.category
  return [{ id: cat._id, name: cat.name, slug: cat.slug }]
}

function listItem(product) {
  return {
    _id: product._id,
    title: product.title,
    slug: product.slug || null,
    price: product.price,
    currency: product.currency || 'AED',
    description: product.description
      ? product.description.slice(0, 200) + (product.description.length > 200 ? '…' : '')
      : '',
    images: product.images || [],
    video: product.video || null,
    videoThumbnail: product.videoThumbnail || null,
    location: product.location || product.city || null,
    category: product.category || null,
    breadcrumbs: buildBreadcrumbs(product),
    user: product.user || null,
    saved: Boolean(product.saved),
    status: product.status,
    isSold: product.isSold === true || product.status === 'sold',
    adType: product.adType || 'free',
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    views: product.views || 0,
    likes: product.likes || 0,
    ...pickVehicleListingFields(product),
  }
}

function detail(product) {
  return {
    ...listItem(product),
    description: product.description,
    filters: product.filters || {},
    filterValues: product.filterValues || {},
    coordinates: product.coordinates || null,
    negotiable: Boolean(product.negotiable),
    condition: product.condition || null,
    rejectionReason: product.rejectionReason || null,
    streaming: product.streaming || null,
    warranty: product.warranty || null,
    fuelType: product.fuelType || null,
    transmission: product.transmission || null,
    bodyType: product.bodyType || null,
    interiorColor: product.interiorColor || null,
    trim: product.trim || null,
    model: product.model || null,
    city: product.city || null,
    kilometers: product.kilometers ?? null,
    ...(product.vehicleListingFields || pickVehicleListingFields(product)),
    ...(product.carOverview ? { carOverview: product.carOverview } : {}),
    ...(product.vehicleFeatures ? { vehicleFeatures: product.vehicleFeatures } : {}),
    productAttributes: product.productAttributes || [],
    productMultiAttributes: product.productMultiAttributes || [],
  }
}

async function detailEnriched(product) {
  if (product.carOverview && product.vehicleFeatures) {
    return detail(product)
  }
  const { buildVehicleDetailPresentation } = require('../../utils/productVehicleFields')
  const presentation = await buildVehicleDetailPresentation(product)
  return detail({
    ...product,
    ...presentation.legacyFields,
    vehicleListingFields: presentation.vehicleListingFields,
    carOverview: presentation.carOverview,
    vehicleFeatures: presentation.vehicleFeatures,
  })
}

module.exports = { listItem, detail, detailEnriched, buildBreadcrumbs }
