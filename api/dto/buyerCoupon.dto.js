function toActorDto(value) {
  if (!value) return null
  if (typeof value === 'object' && (value.name || value.email)) {
    return { id: String(value._id), name: value.name || null, email: value.email || null }
  }
  return { id: String(value._id || value), name: null, email: null }
}

function toBuyerCouponDto(doc) {
  if (!doc) return null
  return {
    id: String(doc._id),
    couponName: doc.couponName,
    couponCode: doc.couponCode,
    description: doc.description || '',
    discountType: doc.discountType,
    discountValue: Number(doc.discountValue ?? 0),
    minimumOrderAmount: doc.minimumOrderAmount != null ? Number(doc.minimumOrderAmount) : null,
    maximumDiscountAmount: doc.maximumDiscountAmount != null ? Number(doc.maximumDiscountAmount) : null,
    usageLimit: doc.usageLimit != null ? Number(doc.usageLimit) : null,
    usageLimitPerBuyer: doc.usageLimitPerBuyer != null ? Number(doc.usageLimitPerBuyer) : 1,
    validFrom: doc.validFrom,
    validTill: doc.validTill,
    status: Boolean(doc.status),
    checkoutServiceIds: Array.isArray(doc.checkoutServiceIds) ? doc.checkoutServiceIds.map(String) : [],
    createdBy: toActorDto(doc.createdBy),
    updatedBy: toActorDto(doc.updatedBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function toBuyerCouponListDto(items = []) {
  return items.map(toBuyerCouponDto)
}

function toPaginatedBuyerCouponsResponse(result) {
  const { items, total, page, limit } = result
  return {
    buyerCoupons: toBuyerCouponListDto(items),
    page,
    limit,
    total,
    hasMore: (page - 1) * limit + items.length < total,
  }
}

module.exports = {
  toBuyerCouponDto,
  toBuyerCouponListDto,
  toPaginatedBuyerCouponsResponse,
}
