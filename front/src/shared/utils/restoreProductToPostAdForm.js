import { toFilterArray } from './filterValueUtils'
import { FIELD_CONFIGS } from './categoryFields'

const MARKETPLACE_CURRENCY = 'AED'

const MULTI_SELECT_FIELDS = new Set(['condition', 'color', 'transmission', 'fuelType'])

const DEFAULT_DELIVERY_OPTIONS = {
  buyerPickup: true,
  sellerDelivery: false,
  deliveryCharges: 0,
}

const DEFAULT_CONTACT_OPTIONS = {
  inAppChat: true,
  call: true,
  whatsapp: false,
}

function normalizeAdditionalFields(extras) {
  if (!extras) return {}
  if (typeof extras.entries === 'function') {
    return Object.fromEntries(extras.entries())
  }
  if (typeof extras === 'object') return extras
  return {}
}

/** Restore filter_* react-hook-form fields from persisted product.filterData. */
export function restoreProductFilterSelections(product, setValue) {
  const filterData = product?.filterData
  if (!filterData || typeof filterData !== 'object') return

  Object.entries(filterData).forEach(([slug, data]) => {
    if (!data || typeof data !== 'object') return
    const fieldKey = `filter_${slug}`

    const ids = []
    if (Array.isArray(data.values)) ids.push(...data.values)
    else if (Array.isArray(data.filterIds)) ids.push(...data.filterIds)
    else if (data.filterId) ids.push(data.filterId)

    const objectIds = ids.map(String).filter(Boolean)
    if (objectIds.length) {
      setValue(fieldKey, objectIds, { shouldDirty: false, shouldTouch: false })
      return
    }

    if (data.value != null && data.value !== '') {
      const vals = String(data.value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (vals.length) {
        setValue(fieldKey, vals, { shouldDirty: false, shouldTouch: false })
      }
    }
  })
}

/** Build react-hook-form values from an existing product (edit mode). */
export function buildPostAdFormValuesFromProduct(product, user) {
  const formValues = {
    title: product.title || '',
    description: product.description || '',
    price: product.price ?? 0,
    currency: product.currency || MARKETPLACE_CURRENCY,
    category: product.category?._id || product.category || '',
    subcategory: product.subcategory?._id || product.subcategory || '',
    childCategory: '',
    country: product.country || '',
    city: product.city || '',
    area: product.area || product.location || '',
    brand: product.brand || '',
    condition: product.condition ? toFilterArray(product.condition) : [],
    material: product.material || '',
    color: product.color ? toFilterArray(product.color) : [],
    priceType: product.priceType || 'Fixed',
    adType: product.adType || 'free',
    contactName: product.contactName || user?.name || '',
    contactPhone: product.contactPhone || user?.phone || '',
    make: product.make || '',
    model: product.model || '',
    year: product.year ?? '',
    mileage: product.mileage ?? '',
    transmission: product.transmission ? toFilterArray(product.transmission) : [],
    fuelType: product.fuelType ? toFilterArray(product.fuelType) : [],
    purchaseYear: product.purchaseYear ?? '',
    reasonForSelling: product.reasonForSelling || '',
    seatingCapacity: product.seatingCapacity ?? '',
    assemblyStatus: product.assemblyStatus || '',
    acceptRules: true,
    dimensions: product.dimensions || { unit: 'cm' },
    usageDuration: product.usageDuration || { value: '', unit: '' },
    deliveryOptions: { ...DEFAULT_DELIVERY_OPTIONS, ...(product.deliveryOptions || {}) },
    contactOptions: { ...DEFAULT_CONTACT_OPTIONS, ...(product.contactOptions || {}) },
  }

  Object.keys(FIELD_CONFIGS).forEach((key) => {
    const existing = formValues[key]
    const hasValue =
      existing !== undefined &&
      existing !== '' &&
      existing !== null &&
      !(Array.isArray(existing) && existing.length === 0)
    if (hasValue) return

    const val = product[key]
    if (val === undefined || val === null || val === '') return
    formValues[key] = MULTI_SELECT_FIELDS.has(key) ? toFilterArray(val) : val
  })

  const extras = normalizeAdditionalFields(product.additionalFields)
  Object.entries(extras).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    formValues[k] = v
  })

  return formValues
}
