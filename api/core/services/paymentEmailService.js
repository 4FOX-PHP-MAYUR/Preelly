const { sendEmail } = require('../../utils/mailer')

function money(value, currency = 'AED') {
  return `${currency} ${Number(value ?? 0).toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function row(label, value) {
  if (value == null || value === '') return ''
  return `<tr>
    <td style="padding:6px 0;color:#64748b;font-size:13px">${label}</td>
    <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right">${value}</td>
  </tr>`
}

/**
 * Sends the payment confirmation email, with the invoice PDF attached.
 * @param {object} data  normalized invoice/payment data
 * @param {string|null} invoicePath  absolute path to the PDF, or null to skip the attachment
 */
async function sendPaymentConfirmation(data, invoicePath) {
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.COMPANY_EMAIL || 'support@preelly.com'
  const supportPhone = process.env.SUPPORT_PHONE || process.env.COMPANY_PHONE || ''
  const company = process.env.COMPANY_NAME || 'Preelly'

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff">
    <div style="background:#1414e6;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">Payment Successful</h1>
    </div>
    <div style="padding:24px">
      <p style="color:#0f172a;font-size:14px">Hi ${data.customerName || 'there'},</p>
      <p style="color:#475569;font-size:14px;line-height:1.6">
        Thank you for your purchase. Your payment has been received and your package is now active.
        Your invoice is attached to this email.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        ${row('Invoice Number', data.invoiceNumber)}
        ${row('Order ID', data.orderId)}
        ${row('Transaction ID', data.trackingId)}
        ${row('Product', data.productTitle)}
        ${row('Package', data.packageName)}
        ${row('Storage Facility', data.storageFacilityName)}
        ${row('Amount Paid', money(data.grandTotal, data.currency))}
        ${row('Payment Date', data.paymentDate)}
        ${row('Payment Method', data.paymentMethod)}
        ${row('Payment Status', data.paymentStatus)}
      </table>
      <p style="color:#475569;font-size:13px;line-height:1.6;margin-top:20px">
        Need help? Contact us at <a href="mailto:${supportEmail}" style="color:#1414e6">${supportEmail}</a>${supportPhone ? ` or ${supportPhone}` : ''}.
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:16px">Thank you for choosing ${company}.</p>
    </div>
  </div>`

  const text = [
    `Payment Successful`,
    ``,
    `Hi ${data.customerName || 'there'}, thank you for your purchase. Your package is now active.`,
    ``,
    `Invoice Number: ${data.invoiceNumber || '-'}`,
    `Order ID: ${data.orderId}`,
    `Transaction ID: ${data.trackingId || '-'}`,
    `Product: ${data.productTitle || '-'}`,
    `Package: ${data.packageName || '-'}`,
    data.storageFacilityName ? `Storage Facility: ${data.storageFacilityName}` : null,
    `Amount Paid: ${money(data.grandTotal, data.currency)}`,
    `Payment Date: ${data.paymentDate || '-'}`,
    `Payment Method: ${data.paymentMethod || '-'}`,
    `Payment Status: ${data.paymentStatus || '-'}`,
    ``,
    `Support: ${supportEmail}${supportPhone ? ` / ${supportPhone}` : ''}`,
  ].filter(Boolean).join('\n')

  const attachments = invoicePath
    ? [{ filename: `${data.invoiceNumber || 'invoice'}.pdf`, path: invoicePath, contentType: 'application/pdf' }]
    : []

  return sendEmail({
    to: data.customerEmail,
    subject: `Payment Confirmation — ${data.invoiceNumber || data.orderId}`,
    text,
    html,
    attachments,
  })
}

module.exports = { sendPaymentConfirmation }
