function toActorDto(value) {
  if (!value) return null
  // Populated user document vs. bare ObjectId reference.
  if (typeof value === 'object' && (value.name || value.email)) {
    return { id: String(value._id), name: value.name || null, email: value.email || null }
  }
  return { id: String(value._id || value), name: null, email: null }
}

function toTestimonialDto(doc) {
  if (!doc) return null
  return {
    id: String(doc._id),
    testimonialName: doc.testimonialName,
    customerType: doc.customerType,
    testimonial: doc.testimonial,
    profileImage: doc.profileImage || null,
    rating: Number(doc.rating ?? 0),
    displayOrder: Number(doc.displayOrder ?? 0),
    status: Boolean(doc.status),
    createdBy: toActorDto(doc.createdBy),
    updatedBy: toActorDto(doc.updatedBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function toTestimonialListDto(items = []) {
  return items.map(toTestimonialDto)
}

function toPaginatedTestimonialsResponse(result) {
  const { items, total, page, limit } = result
  return {
    testimonials: toTestimonialListDto(items),
    page,
    limit,
    total,
    hasMore: (page - 1) * limit + items.length < total,
  }
}

module.exports = {
  toTestimonialDto,
  toTestimonialListDto,
  toPaginatedTestimonialsResponse,
}
