/**
 * Mobile-optimized product payloads — minimal fields, reel-friendly thumbnails.
 */
const { pickVehicleListingFields } = require('../../utils/productVehicleFields')

function pickThumbnail(product) {
  if (product.videoThumbnail) return product.videoThumbnail
  if (Array.isArray(product.images) && product.images.length) return product.images[0]
  if (product.video) return product.video
  return null
}

function listItem(product) {
  return {
    id: product._id,
    title: product.title,
    price: product.price,
    currency: product.currency || 'AED',
    thumbnail: pickThumbnail(product),
    location: product.location || product.city || null,
    category: product.category?.name || null,
    seller: product.user
      ? {
          id: product.user._id,
          name: product.user.name,
          avatar: product.user.avatar || null,
          verified: Boolean(product.user.isVerified),
        }
      : null,
    saved: Boolean(product.saved),
    postedAt: product.createdAt,
    adType: product.adType || 'free',
  }
}

function detail(product) {
  return {
    ...listItem(product),
    description: product.description,
    images: product.images || [],
    video: product.video || null,
    videoThumbnail: product.videoThumbnail || null,
    filters: product.filters || {},
    views: product.views || 0,
    likes: product.likes || 0,
    condition: product.condition || null,
    negotiable: Boolean(product.negotiable),
    coordinates: product.coordinates || null,
    ...pickVehicleListingFields(product),
  }
}

module.exports = { listItem, detail, pickThumbnail }
