export const PAYMENT_STATUS_OPTIONS = [
  { value: 'Success', label: 'Success' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Pending', label: 'Pending' },
]

export const ORDER_PLATFORM_OPTIONS = [
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'web', label: 'Web' },
]

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'UPI', label: 'UPI' },
  { value: 'Credit Card', label: 'Credit Card' },
  { value: 'Debit Card', label: 'Debit Card' },
  { value: 'Net Banking', label: 'Net Banking' },
  { value: 'Wallet', label: 'Wallet' },
  { value: 'COD', label: 'COD' },
  { value: 'Other', label: 'Other' },
]

export const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest_amount', label: 'Highest Amount' },
  { value: 'lowest_amount', label: 'Lowest Amount' },
]

export function formatAmount(amount, currency = 'AED') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency || 'AED',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${currency || 'AED'} ${n.toFixed(2)}`
  }
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function truncateId(id, head = 8, tail = 4) {
  const s = String(id || '')
  if (s.length <= head + tail + 1) return s || '—'
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}
