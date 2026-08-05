function toActorDto(value) {
  if (!value) return null
  // Populated user document vs. bare ObjectId reference.
  if (typeof value === 'object' && (value.name || value.email)) {
    return { id: String(value._id), name: value.name || null, email: value.email || null }
  }
  return { id: String(value._id || value), name: null, email: null }
}

function toPageDto(doc) {
  if (!doc) return null
  return {
    id: String(doc._id),
    pageTitle: doc.pageTitle,
    pageSlug: doc.pageSlug,
    heading: doc.heading,
    description: doc.description,
    pageBannerImage: doc.pageBannerImage || null,
    metaTitle: doc.metaTitle || '',
    metaDescription: doc.metaDescription || '',
    metaKeywords: doc.metaKeywords || '',
    displayOrder: Number(doc.displayOrder ?? 0),
    status: Boolean(doc.status),
    createdBy: toActorDto(doc.createdBy),
    updatedBy: toActorDto(doc.updatedBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function toPageListDto(items = []) {
  return items.map(toPageDto)
}

function toPaginatedPagesResponse(result) {
  const { items, total, page, limit } = result
  return {
    pages: toPageListDto(items),
    page,
    limit,
    total,
    hasMore: (page - 1) * limit + items.length < total,
  }
}

/** Public-facing shape for the dynamic `/pages/:slug` frontend route — SEO-relevant fields only. */
function toPublicPageDto(doc) {
  if (!doc) return null
  return {
    id: String(doc._id),
    pageTitle: doc.pageTitle,
    pageSlug: doc.pageSlug,
    heading: doc.heading,
    description: doc.description,
    pageBannerImage: doc.pageBannerImage || null,
    metaTitle: doc.metaTitle || doc.pageTitle,
    metaDescription: doc.metaDescription || '',
    metaKeywords: doc.metaKeywords || '',
    updatedAt: doc.updatedAt,
  }
}

module.exports = {
  toPageDto,
  toPageListDto,
  toPaginatedPagesResponse,
  toPublicPageDto,
}
