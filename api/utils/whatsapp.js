const axios = require('axios')

let warnedAboutFallback = false

const isProduction = process.env.NODE_ENV === 'production'

const hasWhatsAppConfig = () =>
  Boolean(process.env.WABA_API_BASE_URL && process.env.WABA_API_TOKEN)

const normalizePhoneForWhatsApp = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) {
    throw new Error('Invalid phone number')
  }
  return digits
}

const sendWhatsAppOtp = async ({ to, code }) => {
  const phone_number = normalizePhoneForWhatsApp(to)
  const template_name = process.env.WABA_OTP_TEMPLATE_NAME || 'otp'
  const template_language = process.env.WABA_OTP_TEMPLATE_LANGUAGE || 'en_US'
  const otpCode = String(code)

  if (!hasWhatsAppConfig()) {
    if (isProduction) {
      throw new Error('WABA_API_BASE_URL and WABA_API_TOKEN are required')
    }

    if (!warnedAboutFallback) {
      console.warn(
        '[WhatsApp] WABA env vars are missing. Falling back to development mock WhatsApp delivery.'
      )
      warnedAboutFallback = true
    }

    console.log(`[WhatsApp MOCK] To: ${phone_number}`)
    console.log(`[WhatsApp MOCK] Your Preelly login code is ${otpCode}`)

    return {
      mock: true,
      to: phone_number,
      code: otpCode,
      status: 'queued',
    }
  }

  const baseUrl = String(process.env.WABA_API_BASE_URL).replace(/\/$/, '')
  const token = process.env.WABA_API_TOKEN
  const url = `${baseUrl}/contact/send-template-message?token=${encodeURIComponent(token)}`

  const response = await axios.post(
    url,
    {
      phone_number,
      template_name,
      template_language,
      field_1: otpCode,
      button_0: otpCode,
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    }
  )

  return response.data
}

module.exports = { sendWhatsAppOtp, normalizePhoneForWhatsApp }
