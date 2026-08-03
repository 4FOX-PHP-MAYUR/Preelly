/**
 * Admin Dashboard API — mounted at /api/admin/dashboard.
 *
 * Every endpoint takes the same filter query so cards, charts and tables always
 * describe one window:
 *
 *   range        today | yesterday | this_week | last_7_days | this_month |
 *                last_month | this_year | custom | all_time   (default this_month)
 *   fromDate     YYYY-MM-DD (required with range=custom)
 *   toDate       YYYY-MM-DD (required with range=custom)
 *   granularity  hour | day | week | month | year  (charts only; auto by default)
 *   category / packageId / paymentStatus / productStatus / userType / platform
 *
 * Endpoints are split so the client can lazy-load the heavy sections and render
 * the KPI cards immediately.
 */

const express = require('express')

const router = express.Router()

const adminMiddleware = require('../middleware/admin')
const { checkPermission } = require('../middleware/permission')
const { registerDashboardIndexes } = require('../core/dashboardIndexes')
const dashboardService = require('../core/services/adminDashboardService')
const reportService = require('../services/dashboardReportService')
const { getMetrics } = require('../middleware/apiMetrics')
const {
  toSummaryResponse,
  toChartsResponse,
  toInsightsResponse,
  toTableResponse,
  toFilterOptionsResponse,
  toPerformanceResponse,
} = require('../dto/adminDashboard.dto')

// Declare the dashboard's indexes on the shared schemas before server.js runs
// its boot-time syncIndexes — otherwise that sync would drop them.
registerDashboardIndexes()

/** All dashboard reads require the "Dashboard" module's view permission. */
const guard = [adminMiddleware, checkPermission('Dashboard', 'view')]

/** Wrap an async handler so a rejected promise becomes a clean 500. */
function handle(name, fn) {
  return async (req, res) => {
    try {
      await fn(req, res)
    } catch (error) {
      console.error(`Error in admin dashboard ${name}:`, error)
      res
        .status(error.statusCode || 500)
        .json({ message: error.message || `Error loading dashboard ${name}` })
    }
  }
}

// GET /api/admin/dashboard/summary — every KPI card
router.get(
  '/summary',
  guard,
  handle('summary', async (req, res) => {
    const ctx = dashboardService.buildContext(req.query)
    const summary = await dashboardService.getSummary(ctx)
    res.json(toSummaryResponse(ctx, summary))
  }),
)

// GET /api/admin/dashboard/charts — trends + distributions
router.get(
  '/charts',
  guard,
  handle('charts', async (req, res) => {
    const ctx = dashboardService.buildContext(req.query)
    const charts = await dashboardService.getCharts(ctx)
    res.json(toChartsResponse(ctx, charts))
  }),
)

// GET /api/admin/dashboard/insights — business insight panels
router.get(
  '/insights',
  guard,
  handle('insights', async (req, res) => {
    const ctx = dashboardService.buildContext(req.query)
    const insights = await dashboardService.getInsights(ctx)
    res.json(toInsightsResponse(ctx, insights))
  }),
)

// GET /api/admin/dashboard/filters — dropdown options for the filter bar
router.get(
  '/filters',
  guard,
  handle('filters', async (req, res) => {
    const options = await dashboardService.getFilterOptions()
    res.json(toFilterOptionsResponse(options))
  }),
)

// GET /api/admin/dashboard/performance — API + process health
router.get(
  '/performance',
  guard,
  handle('performance', async (req, res) => {
    res.json(toPerformanceResponse(getMetrics()))
  }),
)

// GET /api/admin/dashboard/reports — the report catalogue
router.get(
  '/reports',
  guard,
  handle('reports', async (req, res) => {
    res.json({ reports: reportService.listReports(), formats: reportService.FORMATS })
  }),
)

// GET /api/admin/dashboard/reports/:type/download?format=excel|csv|pdf
router.get(
  '/reports/:type/download',
  guard,
  handle('report download', async (req, res) => {
    const ctx = dashboardService.buildContext(req.query)
    const { buffer, filename, contentType, rowCount, truncated } = await reportService.generateReport(
      req.params.type,
      req.query.format,
      ctx,
    )

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('X-Export-Total', String(rowCount))
    res.setHeader('X-Export-Truncated', truncated ? '1' : '0')
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Export-Total, X-Export-Truncated, Content-Disposition',
    )
    res.send(buffer)
  }),
)

// GET /api/admin/dashboard/tables/:table — paginated dashboard tables
// table: trending-products | recent-transactions | recent-users | recent-products
//        | package-purchases | top-sellers | top-buyers | notifications
router.get(
  '/tables/:table',
  guard,
  handle('table', async (req, res) => {
    const resolver = dashboardService.getTableResolver(req.params.table)
    if (!resolver) {
      return res.status(400).json({ message: `Unknown dashboard table "${req.params.table}"` })
    }
    const ctx = dashboardService.buildContext(req.query)
    const result = await resolver(ctx, req.query)
    res.json(toTableResponse(ctx, req.params.table, result))
  }),
)

module.exports = router
