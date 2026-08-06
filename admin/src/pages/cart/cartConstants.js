export const CART_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PURCHASED', label: 'Purchased' },
  { value: 'ABANDONED', label: 'Abandoned' },
]

export function formatAmount(amount, currency = 'INR') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${currency || 'INR'} ${n.toFixed(2)}`
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
