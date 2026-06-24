function toEmirateDto(doc) {
  if (!doc) return null
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    status: Boolean(doc.status),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function toEmirateListDto(items = []) {
  return items.map(toEmirateDto)
}

function toPaginatedEmiratesResponse(result) {
  const { items, total, page, limit } = result
  return {
    emirates: toEmirateListDto(items),
    page,
    limit,
    total,
    hasMore: (page - 1) * limit + items.length < total,
  }
}

module.exports = {
  toEmirateDto,
  toEmirateListDto,
  toPaginatedEmiratesResponse,
}
