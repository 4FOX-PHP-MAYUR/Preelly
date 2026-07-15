const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const PDFDocument = require('pdfkit')

// Invoices live OUTSIDE the public /uploads mount — they are downloadable only
// through the authenticated, ownership-checked route.
const INVOICE_DIR = path.join(__dirname, '..', '..', 'private', 'invoices')
// Company logo (blue on white) shipped with the frontend.
const LOGO_PATH = path.join(__dirname, '..', '..', '..', 'front', 'public', 'images', 'preelly-logo-blue.png')

function ensureDir() {
  if (!fs.existsSync(INVOICE_DIR)) fs.mkdirSync(INVOICE_DIR, { recursive: true })
}

function money(value, currency = 'AED') {
  return `${currency} ${Number(value ?? 0).toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function companyDetails() {
  return {
    name: process.env.COMPANY_NAME || 'Preelly',
    address: process.env.COMPANY_ADDRESS || 'Dubai, United Arab Emirates',
    email: process.env.COMPANY_EMAIL || 'support@preelly.com',
    phone: process.env.COMPANY_PHONE || '',
    gst: process.env.COMPANY_GST || '',
  }
}

/** Unique, human-scannable invoice number: INV-YYYYMM-XXXXXX. */
function buildInvoiceNumber() {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `INV-${ym}-${rand}`
}

function fileNameFor(invoiceNumber) {
  return `${invoiceNumber}.pdf`
}

function absolutePathFor(invoiceNumber) {
  return path.join(INVOICE_DIR, fileNameFor(invoiceNumber))
}

/** Resolves a stored filename (what lives in invoicePath) to an absolute path. */
function resolvePath(fileName) {
  if (!fileName) return null
  // Tolerate a legacy absolute path too, so old rows keep working.
  return path.isAbsolute(fileName) ? fileName : path.join(INVOICE_DIR, path.basename(fileName))
}

/**
 * Renders the invoice PDF to disk. Pure: data in → file out.
 * @param {object} data  normalized invoice data (see paymentService)
 * @returns {Promise<{ invoiceNumber, invoicePath }>}
 */
function generateInvoicePdf(data) {
  ensureDir()
  const invoiceNumber = data.invoiceNumber || buildInvoiceNumber()
  const filePath = absolutePathFor(invoiceNumber)
  const co = companyDetails()

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const stream = fs.createWriteStream(filePath)
      doc.pipe(stream)

      const BRAND = '#1414e6'
      const MUTED = '#64748b'
      const left = doc.page.margins.left
      const right = doc.page.width - doc.page.margins.right

      // ── Header: logo + company ────────────────────────────────────────────
      try {
        if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, left, 45, { width: 120 })
        else throw new Error('no logo')
      } catch {
        doc.fontSize(22).fillColor(BRAND).text(co.name, left, 50)
      }
      doc.fontSize(9).fillColor(MUTED)
      doc.text(co.name, right - 200, 48, { width: 200, align: 'right' })
      doc.text(co.address, right - 200, doc.y, { width: 200, align: 'right' })
      doc.text(co.email, right - 200, doc.y, { width: 200, align: 'right' })
      if (co.phone) doc.text(co.phone, right - 200, doc.y, { width: 200, align: 'right' })
      if (co.gst) doc.text(`GST: ${co.gst}`, right - 200, doc.y, { width: 200, align: 'right' })

      doc.moveTo(left, 120).lineTo(right, 120).strokeColor('#e2e8f0').stroke()

      // ── Title ─────────────────────────────────────────────────────────────
      doc.fontSize(24).fillColor('#0f172a').text('INVOICE', left, 135)

      // ── Invoice + customer meta (two columns) ─────────────────────────────
      const metaTop = 175
      doc.fontSize(9).fillColor(MUTED).text('INVOICE DETAILS', left, metaTop)
      doc.fillColor('#0f172a').fontSize(10)
      doc.text(`Invoice Number: ${invoiceNumber}`, left, metaTop + 16)
      doc.text(`Invoice Date: ${data.invoiceDate}`, left, doc.y)
      doc.text(`Order ID: ${data.orderId}`, left, doc.y)
      doc.text(`Transaction ID: ${data.trackingId || '—'}`, left, doc.y)

      doc.fontSize(9).fillColor(MUTED).text('BILL TO', right - 220, metaTop, { width: 220, align: 'right' })
      doc.fillColor('#0f172a').fontSize(10)
      doc.text(data.customerName || '—', right - 220, metaTop + 16, { width: 220, align: 'right' })
      if (data.customerEmail) doc.text(data.customerEmail, right - 220, doc.y, { width: 220, align: 'right' })
      if (data.customerMobile) doc.text(data.customerMobile, right - 220, doc.y, { width: 220, align: 'right' })

      // ── Line items table ──────────────────────────────────────────────────
      const tableTop = 280
      doc.rect(left, tableTop, right - left, 24).fill('#f1f5f9')
      doc.fillColor(MUTED).fontSize(9)
      doc.text('DESCRIPTION', left + 12, tableTop + 8)
      doc.text('AMOUNT', right - 132, tableTop + 8, { width: 120, align: 'right' })

      let y = tableTop + 34
      const rows = [
        ['Package', data.packageName],
        data.storageFacilityName ? ['Storage Facility', data.storageFacilityName] : null,
        data.productTitle ? ['Listing', data.productTitle] : null,
      ].filter(Boolean)

      doc.fillColor('#0f172a').fontSize(10)
      rows.forEach(([label, value]) => {
        doc.fillColor(MUTED).text(label, left + 12, y)
        doc.fillColor('#0f172a').text(value, left + 140, y, { width: 250 })
        y += 22
      })

      // ── Payment details ───────────────────────────────────────────────────
      y += 8
      doc.moveTo(left, y).lineTo(right, y).strokeColor('#e2e8f0').stroke()
      y += 14
      doc.fontSize(9).fillColor(MUTED).text('PAYMENT DETAILS', left, y)
      y += 16
      doc.fontSize(10).fillColor('#0f172a')
      const pd = [
        ['Payment Method', data.paymentMethod || '—'],
        ['Payment Status', data.paymentStatus || '—'],
        ['Payment Date', data.paymentDate || '—'],
        ['Currency', data.currency || 'AED'],
      ]
      pd.forEach(([k, v]) => {
        doc.fillColor(MUTED).text(k, left, y)
        doc.fillColor('#0f172a').text(v, left + 140, y)
        y += 18
      })

      // ── Totals box ────────────────────────────────────────────────────────
      const boxTop = y + 10
      doc.rect(right - 240, boxTop, 240, data.discountAmount > 0 ? 90 : 66).fill('#f8fafc')
      let ty = boxTop + 12
      doc.fontSize(10).fillColor(MUTED).text('Total Amount', right - 228, ty)
      doc.fillColor('#0f172a').text(money(data.subtotal, data.currency), right - 140, ty, { width: 128, align: 'right' })
      ty += 20
      if (data.discountAmount > 0) {
        doc.fillColor(MUTED).text(`Discount${data.couponCode ? ` (${data.couponCode})` : ''}`, right - 228, ty)
        doc.fillColor('#16a34a').text(`- ${money(data.discountAmount, data.currency)}`, right - 140, ty, { width: 128, align: 'right' })
        ty += 20
      }
      doc.moveTo(right - 228, ty).lineTo(right - 12, ty).strokeColor('#e2e8f0').stroke()
      ty += 8
      doc.fontSize(12).fillColor(BRAND).text('Grand Total', right - 228, ty)
      doc.text(money(data.grandTotal, data.currency), right - 140, ty, { width: 128, align: 'right' })

      // ── Footer ────────────────────────────────────────────────────────────
      doc.fontSize(10).fillColor('#0f172a').text('Thank you for your purchase.', left, 720, { align: 'center', width: right - left })
      doc.fontSize(8).fillColor(MUTED).text(
        'This is a system-generated invoice and does not require a signature.',
        left, 736, { align: 'center', width: right - left }
      )

      doc.end()
      // Return both the on-disk path (for streaming) and the bare filename (for storage).
      stream.on('finish', () => resolve({ invoiceNumber, invoicePath: filePath, fileName: fileNameFor(invoiceNumber) }))
      stream.on('error', reject)
    } catch (err) {
      reject(err)
    }
  })
}

/** Accepts a stored filename or an absolute path. */
function invoiceExists(fileNameOrPath) {
  const abs = resolvePath(fileNameOrPath)
  return Boolean(abs) && fs.existsSync(abs)
}

module.exports = {
  INVOICE_DIR,
  buildInvoiceNumber,
  fileNameFor,
  absolutePathFor,
  resolvePath,
  generateInvoicePdf,
  invoiceExists,
}
