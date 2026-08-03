/**
 * Downloadable dashboard reports (Excel / CSV / PDF).
 *
 * Each report declares its columns and a range-scoped fetcher; the three
 * renderers are generic, so adding a report is one entry in REPORTS.
 * Row counts are capped (MAX_ROWS) to keep memory and response size bounded,
 * exactly like the existing products/transactions exports.
 */

const XLSX = require('xlsx')
const PDFDocument = require('pdfkit')

const Product = require('../models/Product')
const User = require('../models/User')
const PaymentTransaction = require('../models/PaymentTransaction')
const { buildDateFilter } = require('../utils/dashboardDateRange')
const {
  paymentStatusLabel,
  normalizePaymentMethod,
  paymentFromToPlatform,
  platformLabel,
} = require('../utils/paymentLabels')

const MAX_ROWS = 10000
const CURRENCY = 'AED'

const FORMATS = Object.freeze(['excel', 'csv', 'pdf'])

const CONTENT_TYPES = Object.freeze({
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
})

const EXTENSIONS = Object.freeze({ excel: 'xlsx', csv: 'csv', pdf: 'pdf' })

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function dateScoped(ctx, field = 'createdAt') {
  const filter = buildDateFilter(ctx.range.start, ctx.range.end)
  return filter ? { [field]: filter } : {}
}

// ---------------------------------------------------------------------------
// Report definitions
// ---------------------------------------------------------------------------

const REPORTS = {
  users: {
    title: 'User Report',
    sheet: 'Users',
    columns: [
      { key: 'name', label: 'Name', width: 24 },
      { key: 'email', label: 'Email', width: 30 },
      { key: 'mobile', label: 'Mobile', width: 18 },
      { key: 'status', label: 'Status', width: 12 },
      { key: 'verified', label: 'Verified', width: 10 },
      { key: 'identity', label: 'Identity', width: 12 },
      { key: 'registeredAt', label: 'Registered At', width: 20 },
    ],
    async fetch(ctx) {
      const rows = await User.find(dateScoped(ctx))
        .select('name email phone phoneCountryCode status isVerified identityVerificationStatus memberSince createdAt')
        .sort({ createdAt: -1 })
        .limit(MAX_ROWS)
        .lean()

      return rows.map((row) => ({
        name: row.name || '',
        email: row.email || '',
        mobile: [row.phoneCountryCode, row.phone].filter(Boolean).join(' '),
        status: row.status || '',
        verified: row.isVerified ? 'Yes' : 'No',
        identity: row.identityVerificationStatus || 'none',
        registeredAt: formatDate(row.memberSince || row.createdAt),
      }))
    },
  },

  products: {
    title: 'Product Report',
    sheet: 'Products',
    columns: [
      { key: 'title', label: 'Product', width: 34 },
      { key: 'category', label: 'Category', width: 20 },
      { key: 'seller', label: 'Seller', width: 22 },
      { key: 'price', label: 'Price', width: 12 },
      { key: 'status', label: 'Status', width: 12 },
      { key: 'views', label: 'Views', width: 10 },
      { key: 'city', label: 'City', width: 16 },
      { key: 'postedAt', label: 'Posted At', width: 20 },
    ],
    async fetch(ctx) {
      const rows = await Product.find(dateScoped(ctx))
        .select('title price status views city createdAt category seller')
        .populate('category', 'name')
        .populate('seller', 'name')
        .sort({ createdAt: -1 })
        .limit(MAX_ROWS)
        .lean()

      return rows.map((row) => ({
        title: row.title || '',
        category: row.category?.name || '',
        seller: row.seller?.name || '',
        price: row.price ?? '',
        status: row.status || '',
        views: row.views || 0,
        city: row.city || '',
        postedAt: formatDate(row.createdAt),
      }))
    },
  },

  transactions: {
    title: 'Transaction Report',
    sheet: 'Transactions',
    columns: [
      { key: 'orderId', label: 'Order ID', width: 22 },
      { key: 'transactionId', label: 'Transaction ID', width: 26 },
      { key: 'customer', label: 'Customer', width: 22 },
      { key: 'amount', label: 'Amount', width: 12 },
      { key: 'currency', label: 'Currency', width: 10 },
      { key: 'status', label: 'Status', width: 12 },
      { key: 'method', label: 'Method', width: 14 },
      { key: 'gateway', label: 'Gateway', width: 14 },
      { key: 'platform', label: 'Platform', width: 10 },
      { key: 'type', label: 'Type', width: 18 },
      { key: 'date', label: 'Date', width: 20 },
    ],
    async fetch(ctx) {
      const rows = await PaymentTransaction.find({ deletedAt: null, ...dateScoped(ctx) })
        .select('orderId amount currency orderStatus paymentMode gatewayName paymentType paymentFrom createdAt paymentDate userId billingName')
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(MAX_ROWS)
        .lean()

      return rows.map((row) => ({
        orderId: row.orderId || '',
        transactionId: String(row._id),
        customer: row.userId?.name || row.billingName || '',
        amount: round2(row.amount),
        currency: row.currency || CURRENCY,
        status: paymentStatusLabel(row.orderStatus),
        method: normalizePaymentMethod(row.paymentMode) || '',
        gateway: row.gatewayName || '',
        platform: platformLabel(paymentFromToPlatform(row.paymentFrom)),
        type: row.paymentType === 2 ? 'Product Checkout' : 'Ads Payment',
        date: formatDate(row.paymentDate || row.createdAt),
      }))
    },
  },

  revenue: {
    title: 'Revenue Report',
    sheet: 'Revenue',
    columns: [
      { key: 'day', label: 'Date', width: 14 },
      { key: 'transactions', label: 'Successful Transactions', width: 24 },
      { key: 'revenue', label: 'Revenue', width: 16 },
      { key: 'averageValue', label: 'Average Value', width: 16 },
      { key: 'currency', label: 'Currency', width: 10 },
    ],
    async fetch(ctx) {
      const rows = await PaymentTransaction.aggregate([
        { $match: { deletedAt: null, orderStatus: 'SUCCESS', ...dateScoped(ctx) } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: ctx.range.timezone },
            },
            transactions: { $sum: 1 },
            revenue: {
              // Coerced: a stray string amount would otherwise be skipped by $sum.
              $sum: { $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } },
            },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: MAX_ROWS },
      ])

      return rows.map((row) => ({
        day: row._id,
        transactions: row.transactions,
        revenue: round2(row.revenue),
        averageValue: row.transactions ? round2(row.revenue / row.transactions) : 0,
        currency: CURRENCY,
      }))
    },
  },

  packages: {
    title: 'Package Report',
    sheet: 'Packages',
    columns: [
      { key: 'package', label: 'Package', width: 26 },
      { key: 'user', label: 'User', width: 24 },
      { key: 'email', label: 'Email', width: 30 },
      { key: 'amount', label: 'Amount', width: 12 },
      { key: 'purchasedAt', label: 'Purchased At', width: 20 },
      { key: 'expiresAt', label: 'Expires At', width: 20 },
      { key: 'status', label: 'Status', width: 12 },
    ],
    async fetch(ctx) {
      const service = require('../core/services/adminDashboardService')
      const { items } = await service.getPackagePurchaseHistory(ctx, { page: 1, limit: 100 })
      // The paginated helper caps at 100; page through for the full export.
      const all = [...items]
      let page = 2
      while (all.length < MAX_ROWS) {
        const next = await service.getPackagePurchaseHistory(ctx, { page, limit: 100 })
        if (!next.items.length) break
        all.push(...next.items)
        if (page * 100 >= next.total) break
        page += 1
      }

      return all.slice(0, MAX_ROWS).map((row) => ({
        package: row.package,
        user: row.user,
        email: row.userEmail,
        amount: row.amount,
        purchasedAt: formatDate(row.purchasedAt),
        expiresAt: formatDate(row.expiresAt),
        status: row.status,
      }))
    },
  },

  storage: {
    title: 'Storage Facility Report',
    sheet: 'Storage',
    columns: [
      { key: 'orderId', label: 'Order ID', width: 22 },
      { key: 'facility', label: 'Facility (weeks)', width: 18 },
      { key: 'customer', label: 'Customer', width: 24 },
      { key: 'amount', label: 'Amount', width: 12 },
      { key: 'status', label: 'Status', width: 12 },
      { key: 'bookedAt', label: 'Booked At', width: 20 },
    ],
    async fetch(ctx) {
      const rows = await PaymentTransaction.find({
        deletedAt: null,
        orderStatus: 'SUCCESS',
        storagefacilitiesId: { $ne: null },
        ...dateScoped(ctx),
      })
        .select('orderId amount orderStatus createdAt paymentDate userId storagefacilitiesId billingName')
        .populate('userId', 'name')
        .populate('storagefacilitiesId', 'facilityWeek')
        .sort({ createdAt: -1 })
        .limit(MAX_ROWS)
        .lean()

      return rows.map((row) => ({
        orderId: row.orderId || '',
        facility: row.storagefacilitiesId?.facilityWeek ?? '',
        customer: row.userId?.name || row.billingName || '',
        amount: round2(row.amount),
        status: paymentStatusLabel(row.orderStatus),
        bookedAt: formatDate(row.paymentDate || row.createdAt),
      }))
    },
  },
}

const REPORT_TYPES = Object.freeze(Object.keys(REPORTS))

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderExcel(report, rows) {
  const data = rows.length
    ? rows.map((row) =>
        report.columns.reduce((acc, col) => ({ ...acc, [col.label]: row[col.key] ?? '' }), {}),
      )
    : [report.columns.reduce((acc, col) => ({ ...acc, [col.label]: '' }), {})]

  const worksheet = XLSX.utils.json_to_sheet(data)
  worksheet['!cols'] = report.columns.map((col) => ({ wch: col.width || 18 }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, report.sheet)
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

function escapeCsv(value) {
  const str = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function renderCsv(report, rows) {
  const header = report.columns.map((col) => escapeCsv(col.label)).join(',')
  const body = rows.map((row) => report.columns.map((col) => escapeCsv(row[col.key])).join(','))
  // BOM so Excel opens UTF-8 accented names correctly.
  return Buffer.from(`﻿${[header, ...body].join('\r\n')}\r\n`, 'utf8')
}

function renderPdf(report, rows, ctx) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32 })
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const totalWidth = report.columns.reduce((sum, col) => sum + (col.width || 18), 0)
    const widths = report.columns.map((col) => ((col.width || 18) / totalWidth) * pageWidth)

    const drawHeader = () => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
      let x = doc.page.margins.left
      const y = doc.y
      report.columns.forEach((col, index) => {
        doc.text(String(col.label), x + 3, y + 4, { width: widths[index] - 6, ellipsis: true })
        x += widths[index]
      })
      doc
        .moveTo(doc.page.margins.left, y + 16)
        .lineTo(doc.page.margins.left + pageWidth, y + 16)
        .strokeColor('#cbd5e1')
        .stroke()
      doc.y = y + 20
    }

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text(report.title)
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(
        `${ctx.range.label}${ctx.range.fromDate ? ` · ${ctx.range.fromDate} → ${ctx.range.toDate}` : ''} · ${rows.length} row${rows.length === 1 ? '' : 's'} · generated ${formatDate(ctx.now)}`,
      )
    doc.moveDown(0.8)

    drawHeader()

    if (!rows.length) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#94a3b8').text('No data for the selected range.', {
        align: 'center',
      })
    }

    doc.font('Helvetica').fontSize(8).fillColor('#334155')
    rows.forEach((row, rowIndex) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 24) {
        doc.addPage()
        drawHeader()
        doc.font('Helvetica').fontSize(8).fillColor('#334155')
      }

      const y = doc.y
      if (rowIndex % 2 === 1) {
        doc
          .rect(doc.page.margins.left, y - 2, pageWidth, 14)
          .fillColor('#f8fafc')
          .fill()
        doc.fillColor('#334155')
      }

      let x = doc.page.margins.left
      report.columns.forEach((col, index) => {
        const value = row[col.key]
        doc.text(value === null || value === undefined ? '' : String(value), x + 3, y + 1, {
          width: widths[index] - 6,
          ellipsis: true,
          lineBreak: false,
        })
        x += widths[index]
      })
      doc.y = y + 14
    })

    doc.end()
  })
}

/**
 * Build a report buffer plus the headers the route should send.
 * @param {string} type   one of REPORT_TYPES
 * @param {string} format one of FORMATS
 * @param {object} ctx    dashboard context (see adminDashboardService.buildContext)
 */
async function generateReport(type, format, ctx) {
  const report = REPORTS[String(type)]
  if (!report) {
    const error = new Error(`Unknown report type "${type}"`)
    error.statusCode = 400
    throw error
  }

  const normalizedFormat = FORMATS.includes(String(format)) ? String(format) : 'excel'
  const rows = await report.fetch(ctx)

  let buffer
  if (normalizedFormat === 'csv') buffer = renderCsv(report, rows)
  else if (normalizedFormat === 'pdf') buffer = await renderPdf(report, rows, ctx)
  else buffer = renderExcel(report, rows)

  const stamp = ctx.range.fromDate
    ? `${ctx.range.fromDate}_${ctx.range.toDate}`
    : ctx.range.key
  const filename = `${type}-report-${stamp}.${EXTENSIONS[normalizedFormat]}`

  return {
    buffer,
    filename,
    contentType: CONTENT_TYPES[normalizedFormat],
    rowCount: rows.length,
    truncated: rows.length >= MAX_ROWS,
  }
}

function listReports() {
  return REPORT_TYPES.map((type) => ({
    type,
    title: REPORTS[type].title,
    formats: FORMATS,
  }))
}

module.exports = {
  FORMATS,
  REPORT_TYPES,
  MAX_ROWS,
  generateReport,
  listReports,
}
