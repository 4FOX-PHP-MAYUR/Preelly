function toActorDto(value) {
  if (!value) return null
  // Populated user document vs. bare ObjectId reference.
  if (typeof value === 'object' && (value.name || value.email)) {
    return { id: String(value._id), name: value.name || null, email: value.email || null }
  }
  return { id: String(value._id || value), name: null, email: null }
}

function toStorageFacilityDto(doc) {
  if (!doc) return null
  return {
    id: String(doc._id),
    facilityWeek: doc.facilityWeek,
    facilityAmount: Number(doc.facilityAmount ?? 0),
    imageIcon: doc.imageIcon || null,
    displayOrder: Number(doc.displayOrder ?? 0),
    status: Boolean(doc.status),
    createdBy: toActorDto(doc.createdBy),
    updatedBy: toActorDto(doc.updatedBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function toStorageFacilityListDto(items = []) {
  return items.map(toStorageFacilityDto)
}

function toPaginatedStorageFacilitiesResponse(result) {
  const { items, total, page, limit } = result
  return {
    storageFacilities: toStorageFacilityListDto(items),
    page,
    limit,
    total,
    hasMore: (page - 1) * limit + items.length < total,
  }
}

module.exports = {
  toStorageFacilityDto,
  toStorageFacilityListDto,
  toPaginatedStorageFacilitiesResponse,
}
