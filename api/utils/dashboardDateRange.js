/**
 * Timezone-aware date-range helpers for the Admin Dashboard.
 *
 * Every dashboard endpoint accepts the same `range` vocabulary so cards, charts
 * and tables always describe the same window. Boundaries are resolved in the
 * dashboard timezone (UAE by default) rather than the server's local zone, so
 * "Today" means today in Dubai regardless of where the API runs.
 *
 * Kept free of Express/Mongoose so services, DTOs and tests can all use it.
 */

const DEFAULT_TIMEZONE = process.env.DASHBOARD_TIMEZONE || 'Asia/Dubai'

const RANGE_KEYS = Object.freeze([
  'today',
  'yesterday',
  'this_week',
  'last_7_days',
  'this_month',
  'last_month',
  'this_year',
  'custom',
  'all_time',
])

const RANGE_LABELS = Object.freeze({
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  last_7_days: 'Last 7 Days',
  this_month: 'This Month',
  last_month: 'Last Month',
  this_year: 'This Year',
  custom: 'Custom Range',
  all_time: 'All Time',
})

const GRANULARITIES = Object.freeze(['hour', 'day', 'week', 'month', 'year'])

/** Bucket size each preset reads best at; `custom`/`all_time` stay automatic. */
const PREFERRED_GRANULARITY = Object.freeze({
  today: 'hour',
  yesterday: 'hour',
  this_week: 'day',
  last_7_days: 'day',
  this_month: 'day',
  last_month: 'day',
  this_year: 'month',
})

/** Mongo `$dateToString` formats per bucket size. %G/%V give ISO week-years. */
const BUCKET_FORMATS = Object.freeze({
  hour: '%Y-%m-%dT%H',
  day: '%Y-%m-%d',
  week: '%G-W%V',
  month: '%Y-%m',
  year: '%Y',
})

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Offset (ms) between UTC and `timeZone` at the given instant. DST-safe. */
function timezoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value
      return acc
    }, {})

  // formatToParts has no millisecond field; carry the source ms across so the
  // offset stays exact (an end-of-day boundary is …:59.999, not …:59.000).
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
    date.getUTCMilliseconds(),
  )
  return asUtc - date.getTime()
}

/** Wall-clock fields of `date` as seen in `timeZone`. */
function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value
      return acc
    }, {})

  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayIndex < 0 ? 0 : weekdayIndex,
  }
}

/** Build the UTC instant for a wall-clock time in `timeZone`. */
function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0, ms = 0 }, timeZone) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  // Two passes so a boundary that lands inside a DST shift still resolves.
  let offset = timezoneOffsetMs(new Date(naive), timeZone)
  offset = timezoneOffsetMs(new Date(naive - offset), timeZone)
  return new Date(naive - offset)
}

function startOfZonedDay(date, timeZone) {
  const { year, month, day } = zonedParts(date, timeZone)
  return zonedTimeToUtc({ year, month, day }, timeZone)
}

function endOfZonedDay(date, timeZone) {
  const { year, month, day } = zonedParts(date, timeZone)
  return zonedTimeToUtc({ year, month, day, hour: 23, minute: 59, second: 59, ms: 999 }, timeZone)
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

/** Parse a `YYYY-MM-DD` (or ISO) string into a zoned day boundary. */
function parseBoundary(value, timeZone, edge) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim())
  if (match) {
    const [, year, month, day] = match
    return edge === 'end'
      ? zonedTimeToUtc(
          { year: Number(year), month: Number(month), day: Number(day), hour: 23, minute: 59, second: 59, ms: 999 },
          timeZone,
        )
      : zonedTimeToUtc({ year: Number(year), month: Number(month), day: Number(day) }, timeZone)
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return edge === 'end' ? endOfZonedDay(parsed, timeZone) : startOfZonedDay(parsed, timeZone)
}

/**
 * Choose a bucket size that keeps a series readable (roughly 6–60 points).
 * Callers may force one with `?granularity=`.
 */
function resolveGranularity(start, end, override) {
  const requested = String(override || '').toLowerCase()
  if (GRANULARITIES.includes(requested)) return requested
  if (!start || !end) return 'month'

  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY))
  if (days <= 2) return 'hour'
  if (days <= 62) return 'day'
  if (days <= 210) return 'week'
  if (days <= 366 * 3) return 'month'
  return 'year'
}

/**
 * Resolve a dashboard range request into absolute boundaries plus the
 * immediately-preceding window of equal length (used for growth deltas).
 *
 * @param {object} query
 * @param {string} [query.range]     one of RANGE_KEYS (default `this_month`)
 * @param {string} [query.fromDate]  YYYY-MM-DD, required when range=custom
 * @param {string} [query.toDate]    YYYY-MM-DD, required when range=custom
 * @param {string} [query.granularity] force a bucket size
 * @param {string} [query.timezone]  IANA zone, defaults to DASHBOARD_TIMEZONE
 * @param {Date}   [now]             injectable clock (tests)
 */
function resolveDateRange(query = {}, now = new Date()) {
  const timezone = query.timezone || DEFAULT_TIMEZONE
  const requested = String(query.range || '').toLowerCase().replace(/[\s-]+/g, '_')
  const key = RANGE_KEYS.includes(requested) ? requested : 'this_month'
  const today = zonedParts(now, timezone)

  let start = null
  let end = null

  switch (key) {
    case 'today':
      start = startOfZonedDay(now, timezone)
      end = endOfZonedDay(now, timezone)
      break

    case 'yesterday': {
      const ref = addDays(startOfZonedDay(now, timezone), -1)
      start = startOfZonedDay(ref, timezone)
      end = endOfZonedDay(ref, timezone)
      break
    }

    case 'this_week': {
      // Week starts Monday, matching how UAE marketplace reporting is read.
      const offsetToMonday = (today.weekday + 6) % 7
      start = addDays(startOfZonedDay(now, timezone), -offsetToMonday)
      end = endOfZonedDay(now, timezone)
      break
    }

    case 'last_7_days':
      start = addDays(startOfZonedDay(now, timezone), -6)
      end = endOfZonedDay(now, timezone)
      break

    case 'this_month':
      start = zonedTimeToUtc({ year: today.year, month: today.month, day: 1 }, timezone)
      end = endOfZonedDay(now, timezone)
      break

    case 'last_month': {
      const year = today.month === 1 ? today.year - 1 : today.year
      const month = today.month === 1 ? 12 : today.month - 1
      start = zonedTimeToUtc({ year, month, day: 1 }, timezone)
      end = new Date(zonedTimeToUtc({ year: today.year, month: today.month, day: 1 }, timezone).getTime() - 1)
      break
    }

    case 'this_year':
      start = zonedTimeToUtc({ year: today.year, month: 1, day: 1 }, timezone)
      end = endOfZonedDay(now, timezone)
      break

    case 'all_time':
      start = null
      end = null
      break

    case 'custom':
    default: {
      start = parseBoundary(query.fromDate, timezone, 'start')
      end = parseBoundary(query.toDate, timezone, 'end')
      // A half-open custom range still works: missing side stays unbounded.
      if (start && end && start.getTime() > end.getTime()) {
        const swap = start
        start = end
        end = swap
      }
      break
    }
  }

  // Previous window of identical length, for period-over-period growth.
  let previous = { start: null, end: null }
  if (start && end) {
    const span = end.getTime() - start.getTime()
    previous = {
      start: new Date(start.getTime() - span - 1),
      end: new Date(start.getTime() - 1),
    }
  }

  // Presets read best at a fixed bucket size ("This Week" as days, not hours);
  // custom/all-time fall back to the span-based heuristic.
  const granularity = resolveGranularity(
    start || new Date(now.getTime() - 365 * MS_PER_DAY),
    end || now,
    query.granularity || PREFERRED_GRANULARITY[key],
  )

  return {
    key,
    label: RANGE_LABELS[key] || RANGE_LABELS.custom,
    timezone,
    start,
    end,
    previous,
    granularity,
    bucketFormat: BUCKET_FORMATS[granularity],
    /** ISO day strings, handy for building listing-page deep links. */
    fromDate: start ? formatZonedDay(start, timezone) : null,
    toDate: end ? formatZonedDay(end, timezone) : null,
  }
}

/** `YYYY-MM-DD` for an instant as seen in `timeZone`. */
function formatZonedDay(date, timeZone = DEFAULT_TIMEZONE) {
  const { year, month, day } = zonedParts(date, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * `{ $gte, $lte }` for a date field, or `undefined` when the range is unbounded
 * so callers can spread it without emitting an empty object.
 */
function buildDateFilter(start, end) {
  if (!start && !end) return undefined
  const filter = {}
  if (start) filter.$gte = start
  if (end) filter.$lte = end
  return filter
}

/** Merge a date filter into a Mongo match object (no-op when unbounded). */
function withDateRange(match, field, start, end) {
  const filter = buildDateFilter(start, end)
  if (!filter) return match
  return { ...match, [field]: filter }
}

/**
 * Every bucket label between start and end, so a series can be zero-filled and
 * charts never show gaps for days with no activity.
 */
function enumerateBuckets(start, end, granularity, timeZone = DEFAULT_TIMEZONE) {
  if (!start || !end) return []
  const labels = []
  const limit = 2000 // guard against a pathological custom range
  let cursor = new Date(start.getTime())

  while (cursor.getTime() <= end.getTime() && labels.length < limit) {
    labels.push(bucketLabel(cursor, granularity, timeZone))
    cursor = advance(cursor, granularity, timeZone)
  }

  // De-duplicate: week/month/year advance can repeat a label at DST edges.
  return labels.filter((label, index) => labels.indexOf(label) === index)
}

function bucketLabel(date, granularity, timeZone) {
  const { year, month, day, hour } = zonedParts(date, timeZone)
  const pad = (n) => String(n).padStart(2, '0')

  switch (granularity) {
    case 'hour':
      return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}`
    case 'week': {
      const { isoYear, isoWeek } = isoWeekParts(date, timeZone)
      return `${isoYear}-W${pad(isoWeek)}`
    }
    case 'month':
      return `${year}-${pad(month)}`
    case 'year':
      return `${year}`
    case 'day':
    default:
      return `${year}-${pad(month)}-${pad(day)}`
  }
}

/** ISO-8601 week number/year, matching Mongo's %V/%G. */
function isoWeekParts(date, timeZone) {
  const { year, month, day } = zonedParts(date, timeZone)
  const utc = new Date(Date.UTC(year, month - 1, day))
  const dayOfWeek = (utc.getUTCDay() + 6) % 7 // Mon = 0
  utc.setUTCDate(utc.getUTCDate() - dayOfWeek + 3) // Thursday of this ISO week
  const isoYear = utc.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstDayOfWeek = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayOfWeek + 3)
  const isoWeek = 1 + Math.round((utc.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY))
  return { isoYear, isoWeek }
}

function advance(date, granularity, timeZone) {
  const { year, month } = zonedParts(date, timeZone)
  switch (granularity) {
    case 'hour':
      return new Date(date.getTime() + 60 * 60 * 1000)
    case 'week':
      return addDays(date, 7)
    case 'month':
      return zonedTimeToUtc(
        { year: month === 12 ? year + 1 : year, month: month === 12 ? 1 : month + 1, day: 1 },
        timeZone,
      )
    case 'year':
      return zonedTimeToUtc({ year: year + 1, month: 1, day: 1 }, timeZone)
    case 'day':
    default:
      return addDays(date, 1)
  }
}

/**
 * Human-friendly axis label for a bucket key (`2026-08-04` → `4 Aug`).
 * Done server-side so every chart in the dashboard labels identically.
 */
function humanizeBucket(bucket, granularity) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (!bucket) return ''

  switch (granularity) {
    case 'hour': {
      const [, hour] = bucket.split('T')
      return `${hour}:00`
    }
    case 'week':
      return bucket.replace('-W', ' W')
    case 'month': {
      const [year, month] = bucket.split('-')
      return `${MONTHS[Number(month) - 1] || month} ${String(year).slice(2)}`
    }
    case 'year':
      return bucket
    case 'day':
    default: {
      const [, month, day] = bucket.split('-')
      return `${Number(day)} ${MONTHS[Number(month) - 1] || month}`
    }
  }
}

module.exports = {
  DEFAULT_TIMEZONE,
  RANGE_KEYS,
  RANGE_LABELS,
  GRANULARITIES,
  BUCKET_FORMATS,
  resolveDateRange,
  resolveGranularity,
  buildDateFilter,
  withDateRange,
  enumerateBuckets,
  humanizeBucket,
  formatZonedDay,
  zonedTimeToUtc,
  zonedParts,
  startOfZonedDay,
  endOfZonedDay,
}
