export const REPORT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
]

export const REPORT_COUNT_OPTIONS = [
  { value: 'all', label: 'Any count' },
  { value: '1', label: '1+' },
  { value: '3', label: '3+' },
  { value: '5', label: '5+' },
  { value: '10', label: '10+' },
]

export const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest reports' },
  { value: 'highest_count', label: 'Highest report count' },
  { value: 'oldest', label: 'Oldest reports' },
]

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function truncateId(id, head = 6, tail = 4) {
  const s = String(id || '')
  if (!s) return '—'
  if (s.length <= head + tail + 1) return s
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}

export function displayName(user) {
  if (!user) return 'Unknown user'
  return user.name || user.displayName || user.email || 'Unknown user'
}
