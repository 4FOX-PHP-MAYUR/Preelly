function toActorDto(value) {
  if (!value) return null
  // Populated user document vs. bare ObjectId reference.
  if (typeof value === 'object' && (value.name || value.email)) {
    return { id: String(value._id), name: value.name || null, email: value.email || null }
  }
  return { id: String(value._id || value), name: null, email: null }
}

/** Rounds to 2 decimals — VAT is a percentage, so totals rarely divide evenly. */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function toPackageDto(doc) {
  if (!doc) return null
  const packageAmount = Number(doc.packageAmount ?? 0)
  const vatPercentage = Number(doc.vatAmount ?? 0)
  const vatValue = doc.isVatApplicable ? round2((packageAmount * vatPercentage) / 100) : 0

  return {
    id: String(doc._id),
    packageName: doc.packageName,
    displayOrder: Number(doc.displayOrder ?? 0),
    packageAmount,
    isVatApplicable: Boolean(doc.isVatApplicable),
    // Percentage rate as configured by the admin.
    vatAmount: vatPercentage,
    // Currency value that rate works out to, plus the resulting gross price.
    vatValue,
    totalAmount: round2(packageAmount + vatValue),
    validityDays: doc.validityDays ?? null,
    isRecomended: Boolean(doc.isRecomended),
    packageFeatures: Array.isArray(doc.packageFeatures) ? doc.packageFeatures : [],
    status: Boolean(doc.status),
    createdBy: toActorDto(doc.createdBy),
    updatedBy: toActorDto(doc.updatedBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function toPackageListDto(items = []) {
  return items.map(toPackageDto)
}

function toPaginatedPackagesResponse(result) {
  const { items, total, page, limit } = result
  return {
    packages: toPackageListDto(items),
    page,
    limit,
    total,
    hasMore: (page - 1) * limit + items.length < total,
  }
}

module.exports = {
  toPackageDto,
  toPackageListDto,
  toPaginatedPackagesResponse,
}
