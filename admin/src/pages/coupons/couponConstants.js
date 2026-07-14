// Mirrors the enums in api/models/Coupon.js — keep in sync.

export const DISCOUNT_TYPE_OPTIONS = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed Amount' },
]

export const APPLICABLE_TYPE_OPTIONS = [
  { value: 'all_packages', label: 'All Packages' },
  { value: 'selected_packages', label: 'Selected Packages' },
  { value: 'all_storage_facilities', label: 'All Storage Facilities' },
  { value: 'selected_storage_facilities', label: 'Selected Storage Facilities' },
  { value: 'all_categories', label: 'All Categories' },
  { value: 'selected_categories', label: 'Selected Categories' },
]

export const USER_ELIGIBILITY_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'new_users', label: 'New Users Only' },
  { value: 'existing_users', label: 'Existing Users Only' },
]

export const COUPON_TYPE_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
]

/** "selected_*" types need a multi-select of ids; "all_*" types don't. */
export const needsApplicableIds = (applicableType) =>
  String(applicableType || '').startsWith('selected_')

/** Which collection the multi-select should be populated from. */
export const applicableSource = (applicableType) => {
  if (applicableType === 'selected_packages') return 'packages'
  if (applicableType === 'selected_storage_facilities') return 'storageFacilities'
  if (applicableType === 'selected_categories') return 'categories'
  return null
}

export const labelFor = (options, value) =>
  options.find((o) => o.value === value)?.label || value || '—'

export const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** `<input type="datetime-local">` needs `YYYY-MM-DDTHH:mm` in local time. */
export const toDateTimeLocal = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const formatDiscount = (coupon) => {
  if (!coupon) return '—'
  if (coupon.discountType === 'percentage') {
    const cap = coupon.maximumDiscount ? ` up to ${coupon.maximumDiscount}` : ''
    return `${coupon.discountValue}%${cap}`
  }
  return `AED ${Number(coupon.discountValue ?? 0).toLocaleString()}`
}
