function toActorDto(value) {
  if (!value) return null
  if (typeof value === 'object' && (value.name || value.email)) {
    return { id: String(value._id), name: value.name || null, email: value.email || null }
  }
  return { id: String(value._id || value), name: null, email: null }
}

function toHighlightDto(doc) {
  if (!doc) return null
  return {
    id: String(doc._id),
    highlight: doc.highlight,
    displayOrder: Number(doc.displayOrder ?? 0),
  }
}

function toCheckoutServiceDto(doc) {
  if (!doc) return null
  return {
    id: String(doc._id),
    serviceName: doc.serviceName,
    description: doc.description || '',
    priceType: doc.priceType || 'FIXED',
    price: Number(doc.price ?? 0),
    learnMoreUrl: doc.learnMoreUrl || '',
    buttonText: doc.buttonText || 'Learn More',
    displayOrder: Number(doc.displayOrder ?? 0),
    isDefault: Boolean(doc.isDefault),
    status: Boolean(doc.status),
    highlights: Array.isArray(doc.highlights) ? doc.highlights.map(toHighlightDto) : [],
    createdBy: toActorDto(doc.createdBy),
    updatedBy: toActorDto(doc.updatedBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function toCheckoutServiceListDto(items = []) {
  return items.map(toCheckoutServiceDto)
}

function toPaginatedCheckoutServicesResponse(result) {
  const { items, total, page, limit } = result
  return {
    checkoutServices: toCheckoutServiceListDto(items),
    page,
    limit,
    total,
    hasMore: (page - 1) * limit + items.length < total,
  }
}

module.exports = {
  toCheckoutServiceDto,
  toCheckoutServiceListDto,
  toPaginatedCheckoutServicesResponse,
}
