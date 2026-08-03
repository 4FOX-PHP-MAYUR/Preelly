/**
 * Shared vocabulary for the admin dashboard.
 *
 * The range keys mirror `api/utils/dashboardDateRange.js` exactly — they are the
 * contract between the filter bar and every dashboard endpoint.
 */

export const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
]

export const DEFAULT_RANGE = 'this_month'

export const EMPTY_FILTERS = {
  range: DEFAULT_RANGE,
  fromDate: '',
  toDate: '',
  category: '',
  packageId: '',
  paymentStatus: 'all',
  productStatus: 'all',
  userType: 'all',
  platform: 'all',
}

/** Filter state → query params for the dashboard API. */
export function toQueryParams(filters) {
  const params = { range: filters.range || DEFAULT_RANGE }
  if (filters.range === 'custom') {
    if (filters.fromDate) params.fromDate = filters.fromDate
    if (filters.toDate) params.toDate = filters.toDate
  }
  if (filters.category) params.category = filters.category
  if (filters.packageId) params.packageId = filters.packageId
  if (filters.paymentStatus && filters.paymentStatus !== 'all') params.paymentStatus = filters.paymentStatus
  if (filters.productStatus && filters.productStatus !== 'all') params.productStatus = filters.productStatus
  if (filters.userType && filters.userType !== 'all') params.userType = filters.userType
  if (filters.platform && filters.platform !== 'all') params.platform = filters.platform
  return params
}

/** A custom range is only actionable once both ends are picked. */
export function isRangeReady(filters) {
  if (filters.range !== 'custom') return true
  return Boolean(filters.fromDate && filters.toDate)
}

/**
 * Deep-link builder for KPI cards.
 *
 * Cards navigate to the matching listing page carrying the dashboard's window
 * (`fromDate`/`toDate` from the API's resolved meta, so client and server always
 * agree on what "This Month" meant) plus that card's own filter.
 */
export function buildListingLink(path, meta, extra = {}) {
  const params = new URLSearchParams()
  if (meta?.fromDate) params.set('fromDate', meta.fromDate)
  if (meta?.toDate) params.set('toDate', meta.toDate)
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export const TRENDING_SORT_OPTIONS = [
  { value: 'views', label: 'Most Viewed' },
  { value: 'favorites', label: 'Most Favorited' },
  { value: 'chats', label: 'Most Contacted' },
  { value: 'sales', label: 'Best Selling' },
  { value: 'revenue', label: 'Highest Revenue' },
]

export const REPORT_FORMATS = [
  { value: 'excel', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
]

/** Severity → badge styling for the activity feed. */
export const ACTIVITY_TONE = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  info: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

export function formatDate(value, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
