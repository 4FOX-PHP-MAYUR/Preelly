/**
 * Response shapers for the Admin Dashboard.
 *
 * Every payload carries the same `meta` block so the client can echo the
 * resolved window back into card deep-links and chart captions without
 * re-deriving date maths that already happened server-side.
 */

const { RANGE_LABELS } = require('../utils/dashboardDateRange')

function toDashboardMeta(ctx) {
  const { range } = ctx
  return {
    range: range.key,
    rangeLabel: range.label || RANGE_LABELS[range.key],
    timezone: range.timezone,
    granularity: range.granularity,
    /** ISO day strings — the exact values listing pages expect as filters. */
    fromDate: range.fromDate,
    toDate: range.toDate,
    start: range.start,
    end: range.end,
    previous: range.previous.start
      ? { start: range.previous.start, end: range.previous.end }
      : null,
    generatedAt: ctx.now,
    filters: {
      category: ctx.filters.category ? String(ctx.filters.category) : null,
      packageId: ctx.filters.packageId ? String(ctx.filters.packageId) : null,
      paymentStatus: ctx.filters.paymentStatus,
      productStatus: ctx.filters.productStatus,
      userType: ctx.filters.userType,
      platform: ctx.filters.platform,
    },
  }
}

function toSummaryResponse(ctx, summary) {
  return { meta: toDashboardMeta(ctx), ...summary }
}

function toChartsResponse(ctx, charts) {
  return { meta: toDashboardMeta(ctx), charts }
}

function toInsightsResponse(ctx, insights) {
  return { meta: toDashboardMeta(ctx), insights }
}

function toTableResponse(ctx, table, result) {
  const { items = [], total = 0, page = 1, limit = 10, sort = null } = result || {}
  return {
    meta: toDashboardMeta(ctx),
    table,
    sort,
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  }
}

function toFilterOptionsResponse(options) {
  return { options }
}

function toPerformanceResponse(metrics) {
  return { performance: metrics }
}

module.exports = {
  toDashboardMeta,
  toSummaryResponse,
  toChartsResponse,
  toInsightsResponse,
  toTableResponse,
  toFilterOptionsResponse,
  toPerformanceResponse,
}
