const nodemailer = require('nodemailer')

const getTransporter = () => {
  const user = process.env.GOOGLE_SMTP_USER
  const pass = process.env.GOOGLE_SMTP_PASS
  const host = process.env.GOOGLE_SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.GOOGLE_SMTP_PORT || 465)
  const secure =
    process.env.GOOGLE_SMTP_SECURE != null
      ? String(process.env.GOOGLE_SMTP_SECURE).toLowerCase() === 'true'
      : port === 465

  if (!user || !pass) {
    throw new Error('Missing Google SMTP env vars: GOOGLE_SMTP_USER / GOOGLE_SMTP_PASS')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
}

const sendEmail = async ({ to, subject, text, html }) => {
  const fromEmail = process.env.GOOGLE_SMTP_FROM_EMAIL || process.env.GOOGLE_SMTP_USER
  const fromName = process.env.GOOGLE_SMTP_FROM_NAME || 'Preelly'

  const transporter = getTransporter()

  return await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text,
    html,
  })
}

module.exports = {
  sendEmail,
}

