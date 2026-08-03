/**
 * Lightweight in-process API metrics for the admin dashboard's
 * "Performance Metrics" panel.
 *
 * Deliberately dependency-free and bounded: a few counters plus a 24-hour ring
 * of hourly buckets and a capped per-route table. Nothing is written to disk or
 * to the database, so the overhead per request is a timestamp and a few adds.
 *
 * Counters reset on restart — the panel reports `since` so that reads correctly.
 */

const HOURS_TRACKED = 24
const MAX_TRACKED_ROUTES = 200

const state = {
  since: new Date(),
  total: 0,
  failed: 0,
  serverErrors: 0,
  totalDurationMs: 0,
  maxDurationMs: 0,
  /** hourEpoch -> { requests, failed, durationMs } */
  hourly: new Map(),
  /** "GET /api/products" -> { count, failed, durationMs, maxMs } */
  routes: new Map(),
}

function hourKey(date) {
  return Math.floor(date.getTime() / (60 * 60 * 1000))
}

/** Collapse ids out of a path so `/api/products/64f…` buckets with its siblings. */
function normalizeRoute(req) {
  const base = req.baseUrl || ''
  const routePath = req.route?.path
  if (routePath && typeof routePath === 'string') {
    return `${req.method} ${base}${routePath === '/' ? '' : routePath}`
  }

  const path = (req.originalUrl || req.url || '').split('?')[0]
  const generic = path
    .split('/')
    .map((segment) => {
      if (/^[0-9a-fA-F]{24}$/.test(segment)) return ':id'
      if (/^\d+$/.test(segment)) return ':n'
      return segment
    })
    .join('/')
  return `${req.method} ${generic}`
}

function prune() {
  const cutoff = hourKey(new Date()) - HOURS_TRACKED
  state.hourly.forEach((_, key) => {
    if (key < cutoff) state.hourly.delete(key)
  })

  if (state.routes.size > MAX_TRACKED_ROUTES) {
    // Drop the least-used routes so the table stays bounded under fuzzing.
    const sorted = [...state.routes.entries()].sort((a, b) => a[1].count - b[1].count)
    sorted.slice(0, state.routes.size - MAX_TRACKED_ROUTES).forEach(([key]) => {
      state.routes.delete(key)
    })
  }
}

function record(req, res, durationMs) {
  const failed = res.statusCode >= 400

  state.total += 1
  state.totalDurationMs += durationMs
  if (durationMs > state.maxDurationMs) state.maxDurationMs = durationMs
  if (failed) state.failed += 1
  if (res.statusCode >= 500) state.serverErrors += 1

  const key = hourKey(new Date())
  const bucket = state.hourly.get(key) || { requests: 0, failed: 0, durationMs: 0 }
  bucket.requests += 1
  bucket.durationMs += durationMs
  if (failed) bucket.failed += 1
  state.hourly.set(key, bucket)

  const routeKey = normalizeRoute(req)
  const route = state.routes.get(routeKey) || { count: 0, failed: 0, durationMs: 0, maxMs: 0 }
  route.count += 1
  route.durationMs += durationMs
  if (durationMs > route.maxMs) route.maxMs = durationMs
  if (failed) route.failed += 1
  state.routes.set(routeKey, route)

  if (state.total % 500 === 0) prune()
}

/** Express middleware — mount once, as early as possible. */
function apiMetrics(req, res, next) {
  const startedAt = process.hrtime.bigint()
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    try {
      record(req, res, durationMs)
    } catch {
      // Metrics must never break a request.
    }
  })
  next()
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

/** Snapshot for the dashboard's performance panel. */
function getMetrics() {
  const currentHour = hourKey(new Date())
  const hourly = []
  for (let offset = HOURS_TRACKED - 1; offset >= 0; offset -= 1) {
    const key = currentHour - offset
    const bucket = state.hourly.get(key) || { requests: 0, failed: 0, durationMs: 0 }
    const at = new Date(key * 60 * 60 * 1000)
    hourly.push({
      bucket: at.toISOString(),
      label: `${String(at.getHours()).padStart(2, '0')}:00`,
      requests: bucket.requests,
      failed: bucket.failed,
      averageResponseMs: bucket.requests ? round2(bucket.durationMs / bucket.requests) : 0,
    })
  }

  const slowestRoutes = [...state.routes.entries()]
    .map(([route, stats]) => ({
      route,
      requests: stats.count,
      failed: stats.failed,
      averageResponseMs: round2(stats.durationMs / stats.count),
      maxResponseMs: round2(stats.maxMs),
    }))
    .sort((a, b) => b.averageResponseMs - a.averageResponseMs)
    .slice(0, 10)

  const memory = process.memoryUsage()

  return {
    since: state.since,
    uptimeSeconds: Math.round(process.uptime()),
    totalRequests: state.total,
    failedRequests: state.failed,
    serverErrors: state.serverErrors,
    errorRate: state.total ? round2((state.failed / state.total) * 100) : 0,
    averageResponseMs: state.total ? round2(state.totalDurationMs / state.total) : 0,
    maxResponseMs: round2(state.maxDurationMs),
    hourly,
    slowestRoutes,
    memory: {
      heapUsedMb: round2(memory.heapUsed / 1024 / 1024),
      rssMb: round2(memory.rss / 1024 / 1024),
    },
  }
}

function resetMetrics() {
  state.since = new Date()
  state.total = 0
  state.failed = 0
  state.serverErrors = 0
  state.totalDurationMs = 0
  state.maxDurationMs = 0
  state.hourly.clear()
  state.routes.clear()
}

module.exports = { apiMetrics, getMetrics, resetMetrics }
