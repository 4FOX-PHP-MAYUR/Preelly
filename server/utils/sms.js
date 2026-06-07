const twilio = require('twilio')

let client = null
let warnedAboutFallback = false

const isProduction = process.env.NODE_ENV === 'production'

const hasTwilioCredentials = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)

const hasSenderConfig = () =>
  Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_PHONE)

const canUseTwilio = () => hasTwilioCredentials() && hasSenderConfig()

const getTwilioClient = () => {
  if (client) return client

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required')
  }

  client = twilio(accountSid, authToken)
  return client
}

const getSenderConfig = () => {
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    return { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }
  }

  if (process.env.TWILIO_FROM_PHONE) {
    return { from: process.env.TWILIO_FROM_PHONE }
  }

  throw new Error('TWILIO_FROM_PHONE or TWILIO_MESSAGING_SERVICE_SID is required')
}

const sendSms = async ({ to, body }) => {
  if (!canUseTwilio()) {
    if (isProduction) {
      if (!hasTwilioCredentials()) {
        throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required')
      }
      throw new Error('TWILIO_FROM_PHONE or TWILIO_MESSAGING_SERVICE_SID is required')
    }

    if (!warnedAboutFallback) {
      console.warn(
        '[SMS] Twilio env vars are missing. Falling back to development mock SMS delivery.'
      )
      warnedAboutFallback = true
    }

    console.log(`[SMS MOCK] To: ${to}`)
    console.log(`[SMS MOCK] Body: ${body}`)

    return {
      sid: 'mock-sms-dev',
      status: 'queued',
      to,
      body,
      mock: true,
    }
  }

  const twilioClient = getTwilioClient()
  return twilioClient.messages.create({
    to,
    body,
    ...getSenderConfig(),
  })
}

module.exports = { sendSms }
