/** Admin-facing DTOs for the Cart module. Reads the existing `carts` collection only. */

const CART_STATUS_LABELS = {
  ACTIVE: 'Pending',
  CHECKOUT: 'Pending',
  PURCHASED: 'Purchased',
  ABANDONED: 'Abandoned',
}

const CART_STATUS_BADGES = {
  ACTIVE: 'pending',
  CHECKOUT: 'pending',
  PURCHASED: 'success',
  ABANDONED: 'expired',
}

function toUserBrief(value) {
  if (!value) return null
  if (typeof value === 'object' && (value.name || value.email)) {
    return { id: String(value._id), name: value.name || null, email: value.email || null }
  }
  return { id: String(value._id || value), name: null, email: null }
}

function toProductBrief(value) {
  if (!value) return null
  if (typeof value === 'object' && value.title != null) {
    return {
      id: String(value._id),
      title: value.title || null,
      image: Array.isArray(value.images) ? value.images[0] || null : null,
      category: value.category?.name || null,
      subcategory: value.subcategory?.name || null,
    }
  }
  return { id: String(value._id || value), title: null, image: null, category: null, subcategory: null }
}

function toPackageBrief(value) {
  if (!value) return null
  if (typeof value === 'object' && value.packageName != null) {
    return { id: String(value._id), packageName: value.packageName, packageAmount: Number(value.packageAmount ?? 0) }
  }
  return null
}

function toFacilityBrief(value) {
  if (!value) return null
  if (typeof value === 'object' && value.facilityWeek != null) {
    return { id: String(value._id), facilityWeek: value.facilityWeek, facilityAmount: Number(value.facilityAmount ?? 0) }
  }
  return null
}

function toAdminCartListDto(cart) {
  if (!cart) return null
  const product = toProductBrief(cart.productId)
  const buyer = toUserBrief(cart.userId)
  const seller = toUserBrief(cart.sellerId)
  const cartStatus = cart.cartStatus || 'ACTIVE'

  return {
    id: String(cart._id),
    cartId: String(cart._id),
    product,
    productTitle: product?.title || null,
    productImage: product?.image || null,
    category: product?.category || product?.subcategory || null,
    buyerId: buyer?.id || null,
    buyerName: buyer?.name || null,
    buyerEmail: buyer?.email || null,
    sellerId: seller?.id || null,
    sellerName: seller?.name || null,
    sellerEmail: seller?.email || null,
    quantity: Number(cart.quantity ?? 1),
    unitPrice: Number(cart.unitPrice ?? 0),
    totalAmount: Number(cart.totalAmount ?? 0),
    currency: cart.currency || 'INR',
    cartStatus,
    cartStatusLabel: CART_STATUS_LABELS[cartStatus] || cartStatus,
    cartStatusBadge: CART_STATUS_BADGES[cartStatus] || 'inactive',
    createdAt: cart.createdAt || null,
    updatedAt: cart.updatedAt || null,
  }
}

function toAdminCartDetailDto(cart) {
  if (!cart) return null
  const list = toAdminCartListDto(cart)

  return {
    ...list,
    discount: Number(cart.discount ?? 0),
    couponCode: cart.couponCode || null,
    couponDiscount: Number(cart.couponDiscount ?? 0),
    tax: Number(cart.tax ?? 0),
    subtotal: Number(cart.subtotal ?? 0),
    isSelected: Boolean(cart.isSelected),
    notes: cart.notes || null,
    expiresAt: cart.expiresAt || null,
    purchaseDate: cart.cartStatus === 'PURCHASED' ? cart.updatedAt || null : null,
    // No order/transaction reference field exists on the cart document itself.
    orderReference: null,
    package: toPackageBrief(cart.packageId),
    storageFacility: toFacilityBrief(cart.storagefacilitiesId),
    preellyInspection: cart.preellyInspection
      ? {
          conditions: cart.preellyInspection.conditions || [],
          comment: cart.preellyInspection.comment || '',
          approved: Boolean(cart.preellyInspection.approved),
          approvedAt: cart.preellyInspection.approvedAt || null,
          notInterested: Boolean(cart.preellyInspection.notInterested),
          notInterestedAt: cart.preellyInspection.notInterestedAt || null,
        }
      : null,
  }
}

function toPaginatedAdminCartsResponse(result) {
  const { items, total, page, limit } = result
  return {
    cartItems: (items || []).map(toAdminCartListDto),
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / Math.max(limit, 1)), 1),
    hasMore: (page - 1) * limit + (items?.length || 0) < total,
  }
}

function formatExcelDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

/** Flat rows for Excel export — column order matches the admin list. */
function toAdminCartExcelRows(items = []) {
  return (items || []).map((cart) => {
    const row = toAdminCartListDto(cart)
    return {
      'Cart ID': row.cartId || '',
      'Product Name': row.productTitle || '',
      Category: row.category || '',
      'Buyer Name': row.buyerName || '',
      'Buyer Email': row.buyerEmail || '',
      'Seller Name': row.sellerName || '',
      'Seller Email': row.sellerEmail || '',
      Quantity: row.quantity,
      'Product Price': row.unitPrice,
      'Total Amount': row.totalAmount,
      Currency: row.currency || 'INR',
      'Cart Status': row.cartStatusLabel || '',
      'Added Date': formatExcelDate(row.createdAt),
      'Updated Date': formatExcelDate(row.updatedAt),
    }
  })
}

module.exports = {
  toAdminCartListDto,
  toAdminCartDetailDto,
  toPaginatedAdminCartsResponse,
  toAdminCartExcelRows,
}
