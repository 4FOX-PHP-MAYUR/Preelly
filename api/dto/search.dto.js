/**
 * Platform-agnostic search result shaping.
 */
const webProductDto = require('./web/product.dto')
const mobileProductDto = require('./mobile/product.dto')

function categoryItem(category) {
  return {
    _id: category._id,
    name: category.name,
    slug: category.slug,
    icon: category.icon || null,
    emoji: category.emoji || null,
    level: category.level,
    parentId: category.parentId || null,
  }
}

function agentItem(user) {
  return {
    _id: user._id,
    name: user.displayName || user.name,
    avatar: user.avatar || null,
    isVerified: Boolean(user.isVerified),
    memberSince: user.createdAt || null,
  }
}

function agencyItem(dealer) {
  return {
    _id: dealer._id,
    name: dealer.dealer_name,
    email: dealer.dealer_email || null,
    image: dealer.dealer_image || null,
    synopsis: dealer.synopsis || null,
  }
}

function withSellerAsUser(product) {
  return {
    ...product,
    user: product.user || product.seller || null,
  }
}

function mapProductItems(items, platform) {
  const mapper = platform === 'mobile' ? mobileProductDto.listItem : webProductDto.listItem
  return (items || []).map((item) => mapper(withSellerAsUser(item)))
}

function globalSearchResponse(results, platform) {
  const mapped = {}

  if (results.products) {
    mapped.products = mapProductItems(results.products, platform)
  }
  if (results.properties) {
    mapped.properties = mapProductItems(results.properties, platform)
  }
  if (results.categories) {
    mapped.categories = (results.categories || []).map(categoryItem)
  }
  if (results.agents) {
    mapped.agents = (results.agents || []).map(agentItem)
  }
  if (results.agencies) {
    mapped.agencies = (results.agencies || []).map(agencyItem)
  }
  if (results.projects) {
    mapped.projects = results.projects
  }
  if (results.blogs) {
    mapped.blogs = results.blogs
  }

  return mapped
}

module.exports = {
  categoryItem,
  agentItem,
  agencyItem,
  globalSearchResponse,
}
