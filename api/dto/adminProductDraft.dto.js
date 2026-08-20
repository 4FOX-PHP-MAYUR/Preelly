/**
 * Admin Panel DTOs for the `productDraft` collection.
 *
 * `formValues` / `dynamicFormValues` are free-form maps written by the Post Your
 * Ad wizard, so instead of handing the UI a raw blob these DTOs flatten them into
 * labelled entries, split the wizard's internal `__`-prefixed keys out of the way,
 * and attach resolved category names wherever a value is a category id.
 */

/** Wizard-internal keys (AI transcripts, extraction payloads) — shown separately. */
function isInternalKey(key) {
  return String(key).startsWith('_')
}

function isObjectIdLike(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
}

/** `exteriorColor` → "Exterior Color", `filter_body-type` → "Body Type". */
function labelize(key) {
  let label = String(key || '').replace(/^_+/, '').replace(/^filter[_-]/i, '')
  label = label.replace(/[_-]+/g, ' ')
  label = label.replace(/([a-z\d])([A-Z])/g, '$1 $2')
  label = label.trim().replace(/\s+/g, ' ')
  if (!label) return String(key)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function valueType(value) {
  if (value === null || value === undefined || value === '') return 'empty'
  if (Array.isArray(value)) return 'array'
  if (isPlainObject(value)) return 'object'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'string'
}

/** Recursively attach `{ id, name }` for values that are known category ids. */
function withResolvedIds(value, categoryMap = {}, depth = 0) {
  if (depth > 6) return null
  if (isObjectIdLike(value) && categoryMap[value]) {
    return { __ref: 'category', id: value, name: categoryMap[value].name }
  }
  if (Array.isArray(value)) {
    return value.map((item) => withResolvedIds(item, categoryMap, depth + 1))
  }
  if (isPlainObject(value)) {
    const out = {}
    Object.entries(value).forEach(([k, v]) => {
      out[k] = withResolvedIds(v, categoryMap, depth + 1)
    })
    return out
  }
  return value === undefined ? null : value
}

/**
 * Flatten a Mixed map into ordered, labelled entries the UI can render as a
 * definition list without knowing any of the keys up front.
 */
function toFieldEntries(map, categoryMap = {}) {
  if (!isPlainObject(map)) return { fields: [], internalFields: [] }

  const fields = []
  const internalFields = []

  Object.keys(map)
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      const raw = map[key]
      const entry = {
        key,
        label: labelize(key),
        type: valueType(raw),
        value: withResolvedIds(raw, categoryMap),
      }
      if (isInternalKey(key)) internalFields.push(entry)
      else fields.push(entry)
    })

  return { fields, internalFields }
}

function toUserDto(value) {
  if (!value) return null
  if (typeof value === 'object' && (value.name || value.email)) {
    return {
      id: String(value._id),
      name: value.name || null,
      email: value.email || null,
      phone: value.phone || null,
      avatar: value.avatar || null,
    }
  }
  return { id: String(value._id || value), name: null, email: null, phone: null, avatar: null }
}

function toProductDto(value) {
  if (!value) return null
  if (typeof value === 'object' && (value.title || value.status)) {
    return {
      id: String(value._id),
      title: value.title || null,
      status: value.status || null,
      price: value.productPrice ?? null,
    }
  }
  return { id: String(value._id || value), title: null, status: null, price: null }
}

function toCategoryRefs(ids, categoryMap = {}) {
  const list = Array.isArray(ids) ? ids : ids ? [ids] : []
  return list
    .map((entry) => {
      const id = isPlainObject(entry) ? String(entry._id || entry.id || '') : String(entry ?? '')
      if (!id) return null
      const resolved = categoryMap[id]
      return { id, name: resolved?.name || null, level: resolved?.level ?? null }
    })
    .filter(Boolean)
}

function readString(map, key) {
  if (!isPlainObject(map)) return null
  const value = map[key]
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

/** Row shape for the admin listing table. */
function toAdminProductDraftListItemDto(doc, categoryMap = {}) {
  if (!doc) return null

  const pathRefs = toCategoryRefs(doc.selectedPath, categoryMap)
  const selectedRef = toCategoryRefs(doc.selectedCategory, categoryMap)[0] || null
  const leaf = selectedRef || pathRefs[pathRefs.length - 1] || null

  return {
    id: String(doc._id),
    user: toUserDto(doc.userId),
    title: readString(doc.formValues, 'title'),
    status: doc.status,
    currentStep: Number(doc.currentStep ?? 1),
    lastSavedStep: doc.lastSavedStep ?? null,
    categoryLevel: Number(doc.categoryLevel ?? 0),
    category: leaf,
    categoryPath: pathRefs,
    hasVideo: Boolean(doc.hasVideo),
    imageCount: Number(doc.imageCount ?? 0),
    product: toProductDto(doc.productId),
    publishedAt: doc.publishedAt || null,
    lastSavedAt: doc.lastSavedAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function toAdminProductDraftListDto(items = [], categoryMap = {}) {
  return items.map((item) => toAdminProductDraftListItemDto(item, categoryMap))
}

/** Full record for the details / edit pages. */
function toAdminProductDraftDto(doc, categoryMap = {}) {
  if (!doc) return null

  const base = toAdminProductDraftListItemDto(doc, categoryMap)
  const form = toFieldEntries(doc.formValues, categoryMap)
  const dynamic = toFieldEntries(doc.dynamicFormValues, categoryMap)

  return {
    ...base,
    description: readString(doc.formValues, 'description'),
    // Raw maps are kept alongside the labelled entries so the edit form can post
    // back exactly what it read without reconstructing the wizard's shape.
    formValues: doc.formValues || {},
    dynamicFormValues: doc.dynamicFormValues || {},
    formFields: form.fields,
    formInternalFields: form.internalFields,
    dynamicFields: dynamic.fields,
    dynamicInternalFields: dynamic.internalFields,
    media: {
      hasVideo: Boolean(doc.hasVideo),
      video: doc.videoMeta
        ? {
            name: doc.videoMeta.name || null,
            size: doc.videoMeta.size ?? null,
            type: doc.videoMeta.type || null,
          }
        : null,
      imageCount: Number(doc.imageCount ?? 0),
      images: Array.isArray(doc.imageMeta)
        ? doc.imageMeta.map((img) => ({
            name: img?.name || null,
            size: img?.size ?? null,
            type: img?.type || null,
            isScreenshot: Boolean(img?.isScreenshot),
          }))
        : [],
    },
  }
}

function toPaginatedAdminProductDraftsResponse(result) {
  const { items, total, page, limit, categoryMap = {} } = result
  return {
    drafts: toAdminProductDraftListDto(items, categoryMap),
    page,
    limit,
    total,
    hasMore: (page - 1) * limit + items.length < total,
  }
}

module.exports = {
  labelize,
  toFieldEntries,
  toAdminProductDraftListItemDto,
  toAdminProductDraftListDto,
  toAdminProductDraftDto,
  toPaginatedAdminProductDraftsResponse,
}
