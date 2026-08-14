const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin')
const DeviceToken = require('../models/DeviceToken')

const STALE_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

/** Masks a device token for logging (device identifiers should never appear in full at info level). */
function maskToken (token) {
  const str = String(token || '')
  if (str.length <= 8) return '***'
  return `${str.slice(0, 4)}...${str.slice(-4)}`
}

/** Reads the Firebase service account from env, matching the APPLE_PRIVATE_KEY[_PATH] convention. */
function readServiceAccount () {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const keyPath = path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    return JSON.parse(fs.readFileSync(keyPath, 'utf8'))
  }
  return null
}

let app = null

function getApp () {
  if (app) return app
  const serviceAccount = readServiceAccount()
  if (!serviceAccount) return null
  app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  return app
}

/**
 * Sends a push notification to every registered device of a user.
 * Never throws — a failed push must never break the action that triggered it.
 * Resolves to a summary object; fire-and-forget callers can safely ignore it,
 * but it lets diagnostic/test callers report what actually happened.
 */
async function sendPushToUser (userId, payload) {
  try {
    const firebaseApp = getApp()
    if (!firebaseApp) {
      console.warn('[firebaseAdmin] Skipping push send: Firebase Admin not configured')
      return { configured: false, attempted: 0, successCount: 0, failureCount: 0, staleTokensRemoved: 0 }
    }
    if (!userId) {
      return { configured: true, attempted: 0, successCount: 0, failureCount: 0, staleTokensRemoved: 0 }
    }

    const deviceTokens = await DeviceToken.find({ userId }).lean()
    if (!deviceTokens.length) {
      return { configured: true, attempted: 0, successCount: 0, failureCount: 0, staleTokensRemoved: 0 }
    }

    const stringData = {}
    for (const [key, value] of Object.entries(payload.data || {})) {
      if (value !== undefined && value !== null) stringData[key] = String(value)
    }

    const message = {
      notification: {
        title: payload.notification?.title || '',
        body: payload.notification?.body || '',
      },
      data: stringData,
      tokens: deviceTokens.map((dt) => dt.token),
    }

    const response = await admin.messaging(firebaseApp).sendEachForMulticast(message)

    const staleTokens = []
    const errors = []
    response.responses.forEach((result, index) => {
      if (!result.success) {
        errors.push({ token: maskToken(deviceTokens[index].token), code: result.error?.code || null })
        if (STALE_TOKEN_ERROR_CODES.has(result.error?.code)) {
          staleTokens.push(deviceTokens[index].token)
        }
      }
    })

    if (staleTokens.length) {
      await DeviceToken.deleteMany({ token: { $in: staleTokens } })
      console.log(`[firebaseAdmin] Removed ${staleTokens.length} stale device token(s)`)
    }

    const failureCount = response.responses.filter((r) => !r.success).length
    if (failureCount) {
      console.warn(`[firebaseAdmin] ${failureCount}/${deviceTokens.length} push send(s) failed for user ${userId}`)
    }

    return {
      configured: true,
      attempted: deviceTokens.length,
      successCount: deviceTokens.length - failureCount,
      failureCount,
      staleTokensRemoved: staleTokens.length,
      errors,
    }
  } catch (error) {
    console.error('[firebaseAdmin] sendPushToUser failed:', error.message)
    return { configured: true, attempted: 0, successCount: 0, failureCount: 0, staleTokensRemoved: 0, error: error.message }
  }
}

module.exports = { sendPushToUser, maskToken }
