function toActorDto(value) {
  if (!value) return null
  if (typeof value === 'object' && (value.name || value.email)) {
    return { id: String(value._id), name: value.name || null, email: value.email || null }
  }
  return { id: String(value._id || value), name: null, email: null }
}

function toCouponDto(doc) {
  if (!doc) return null
  const endDate = doc.endDate ? new Date(doc.endDate) : null
  const usageLimit = doc.usageLimit ?? null
  const usedCount = Number(doc.usedCount ?? 0)

  return {
    id: String(doc._id),
    couponName: doc.couponName,
    couponCode: doc.couponCode,
    description: doc.description || null,

    discountType: doc.discountType,
    discountValue: Number(doc.discountValue ?? 0),
    maximumDiscount: doc.maximumDiscount ?? null,
    minimumOrderAmount: doc.minimumOrderAmount ?? null,

    startDate: doc.startDate,
    endDate: doc.endDate,
    // Derived so the UI doesn't have to recompute it per row.
    isExpired: Boolean(endDate && endDate.getTime() < Date.now()),

    usageLimit,
    usagePerUser: doc.usagePerUser ?? null,
    usedCount,
    remainingUses: usageLimit == null ? null : Math.max(usageLimit - usedCount, 0),

    applicableType: doc.applicableType,
    applicableIds: (doc.applicableIds || []).map(String),

    userEligibility: doc.userEligibility,
    couponType: doc.couponType,
    assignedUsers: (doc.assignedUsers || []).map((u) =>
      u && typeof u === 'object' && u.name
        ? { id: String(u._id), name: u.name, email: u.email || null }
        : { id: String(u), name: null, email: null }
    ),

    stackable: Boolean(doc.stackable),
    terms: doc.terms || null,
    status: Boolean(doc.status),

    createdBy: toActorDto(doc.createdBy),
    updatedBy: toActorDto(doc.updatedBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function toCouponListDto(items = []) {
  return items.map(toCouponDto)
}

function toPaginatedCouponsResponse(result) {
  const { items, total, page, limit } = result
  return {
    coupons: toCouponListDto(items),
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1),
    hasMore: (page - 1) * limit + items.length < total,
  }
}

module.exports = {
  toCouponDto,
  toCouponListDto,
  toPaginatedCouponsResponse,
}
