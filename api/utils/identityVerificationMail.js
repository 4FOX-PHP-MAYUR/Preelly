const { sendEmail } = require('./mailer')

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const sendIdentityApprovedEmail = async (user) => {
  if (!user?.email) return

  const name = user.name || 'there'
  const subject = 'Your Emirates ID verification is approved'
  const text = `Hi ${name},

Good news! Your Emirates ID verification has been approved.

You now have the verified badge on your Preelly profile.

Thanks,
Preelly Team`

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Good news! Your <strong>Emirates ID verification</strong> has been approved.</p>
    <p>You now have the verified badge on your Preelly profile.</p>
    <p>Thanks,<br/>Preelly Team</p>
  `

  await sendEmail({ to: user.email, subject, text, html })
}

const sendIdentityRejectedEmail = async (user, reason) => {
  if (!user?.email) return

  const name = user.name || 'there'
  const safeReason = String(reason || '').trim() || 'Verification rejected by admin'
  const subject = 'Your Emirates ID verification was rejected'
  const text = `Hi ${name},

We reviewed your Emirates ID verification and could not approve it at this time.

Reason:
${safeReason}

Please upload clearer photos of your Emirates ID (front and back) and submit again from your profile settings.

Thanks,
Preelly Team`

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>We reviewed your <strong>Emirates ID verification</strong> and could not approve it at this time.</p>
    <p><strong>Reason:</strong></p>
    <p style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;color:#b91c1c;">${escapeHtml(safeReason)}</p>
    <p>Please upload clearer photos of your Emirates ID (front and back) and submit again from your profile settings.</p>
    <p>Thanks,<br/>Preelly Team</p>
  `

  await sendEmail({ to: user.email, subject, text, html })
}

module.exports = {
  sendIdentityApprovedEmail,
  sendIdentityRejectedEmail,
}
