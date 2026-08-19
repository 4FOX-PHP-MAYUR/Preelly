/**
 * Preelly push-notification service.
 *
 * The single place where a push is built, addressed and dispatched. Firebase
 * initialisation lives in ./firebaseApp.js; this module only holds business
 * logic, so controllers, services, cron jobs and chat handlers can all share
 * one implementation instead of re-wiring the SDK.
 *
 * Public entry point:
 *   sendPreellyNotificationToUser(userId, title, body, data)
 *
 * sendPushToUser(userId, payload) is the original signature, kept so the
 * existing call sites keep working unchanged.
 */
const { getMessaging } = require('./firebaseApp')
const DeviceToken = require('../../models/DeviceToken')

/** FCM codes that mean "this token is dead" — the only ones safe to delete on. */
const STALE_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

/** FCM rejects a multicast with more than 500 tokens; batch anything larger. */
const MULTICAST_BATCH_SIZE = 500

/**
 * APNs options applied to every push sent through sendPreellyNotificationToUser.
 *
 * Without these an iOS notification arrives silently: FCM maps title/body onto
 * `aps.alert` but sets no sound, so the handset shows the banner with no alert
 * tone — the single most common "push isn't working on iOS" report.
 *
 * - sound 'default'      → the standard alert tone
 * - mutable-content      → lets a notification-service extension enrich the
 *                          payload later (e.g. attach a listing image) without
 *                          a server change
 * - apns-priority 10     → deliver immediately; APNs may otherwise hold a
 *                          low-priority alert back to save battery
 *
 * FCM ignores an `apns` block for non-Apple tokens, so this is inert for the
 * android tokens that share a multicast batch.
 */
const DEFAULT_APNS_CONFIG = {
  headers: { 'apns-priority': '10' },
  payload: { aps: { sound: 'default', 'mutable-content': 1 } },
}

/** Masks a device token for logging (device identifiers must never appear in full at info level). */
function maskToken (token) {
  const str = String(token || '')
  if (str.length <= 8) return '***'
  return `${str.slice(0, 4)}...${str.slice(-4)}`
}

/**
 * Collects every device token that should receive a push for this user.
 *
 * Preelly stores tokens in two places for historical reasons:
 *   1. the DeviceToken collection — one document per device, the primary store
 *      written by POST /api/user/device-tokens;
 *   2. User.deviceToken — the single most recent token captured during OTP
 *      login (routes/auth.js), which predates the collection.
 *
 * Reading both means a handset that only ever registered at login still gets
 * notified. Tokens are de-duplicated, so a device present in both stores is
 * sent to once. `includeLegacyUserToken` is opt-in so the original
 * sendPushToUser() keeps its exact previous behaviour.
 */
async function resolveActiveTokens (userId, { includeLegacyUserToken = true } = {}) {
  const entries = []
  const seen = new Set()

  const deviceTokens = await DeviceToken.find({ userId }).lean()
  for (const doc of deviceTokens) {
    if (!doc?.token || seen.has(doc.token)) continue
    seen.add(doc.token)
    entries.push({ token: doc.token, source: 'deviceTokenCollection', platform: doc.platform || null })
  }

  if (includeLegacyUserToken) {
    // Required lazily: the legacy store is an optional source, and loading the
    // User model eagerly would drag the whole user schema into every module
    // (and every test) that only needs the DeviceToken path.
    try {
      const User = require('../../models/User')
      const user = await User.findById(userId).select('deviceToken').lean()
      const legacyToken = typeof user?.deviceToken === 'string' ? user.deviceToken.trim() : ''
      if (legacyToken && !seen.has(legacyToken)) {
        seen.add(legacyToken)
        entries.push({ token: legacyToken, source: 'userDocument', platform: null })
      }
    } catch (error) {
      // A failure to read the legacy store must not suppress the primary one.
      console.error('[preellyNotifications] Could not read legacy User.deviceToken:', error.message)
    }
  }

  return entries
}

/**
 * Removes tokens Firebase has reported as permanently dead, from whichever
 * store each one came from. Never throws — cleanup is best-effort housekeeping
 * and must not turn a partially-delivered push into a failed one.
 */
async function purgeStaleTokens (userId, staleEntries) {
  if (!staleEntries.length) return 0

  const fromCollection = staleEntries.filter((e) => e.source === 'deviceTokenCollection').map((e) => e.token)
  const fromUserDoc = staleEntries.filter((e) => e.source === 'userDocument').map((e) => e.token)

  try {
    if (fromCollection.length) {
      await DeviceToken.deleteMany({ token: { $in: fromCollection } })
    }
    if (fromUserDoc.length) {
      const User = require('../../models/User')
      // Scoped to this user and this exact token so a token already reassigned
      // to another account by a later login is not cleared out from under it.
      await User.updateOne(
        { _id: userId, deviceToken: { $in: fromUserDoc } },
        { $set: { deviceToken: null } }
      )
    }
    console.log(`[preellyNotifications] Removed ${staleEntries.length} stale device token(s) for user ${userId}`)
  } catch (error) {
    console.error('[preellyNotifications] Stale token cleanup failed:', error.message)
    return 0
  }

  return staleEntries.length
}

/** FCM only accepts string values in `data`; undefined/null keys are dropped rather than stringified. */
function normaliseData (data) {
  const out = {}
  for (const [key, value] of Object.entries(data || {})) {
    if (value !== undefined && value !== null) out[key] = String(value)
  }
  return out
}

/**
 * Sends one built message to a resolved token list and reports per-token
 * outcomes. Shared by both public entry points so there is exactly one copy of
 * the multicast/stale-token logic.
 */
async function dispatch (messaging, userId, entries, { title, body, data, android, apns }) {
  const notification = { title: title || '', body: body || '' }
  const stringData = normaliseData(data)

  const staleEntries = []
  const errors = []
  let successCount = 0
  let failureCount = 0

  for (let offset = 0; offset < entries.length; offset += MULTICAST_BATCH_SIZE) {
    const batch = entries.slice(offset, offset + MULTICAST_BATCH_SIZE)
    const message = {
      notification,
      data: stringData,
      tokens: batch.map((e) => e.token),
    }
    // Only forwarded when a caller explicitly asks, so default delivery
    // behaviour is identical for every existing call site.
    if (android) message.android = android
    if (apns) message.apns = apns

    const response = await messaging.sendEachForMulticast(message)

    response.responses.forEach((result, index) => {
      if (result.success) {
        successCount += 1
        return
      }
      failureCount += 1
      const code = result.error?.code || null
      errors.push({ token: maskToken(batch[index].token), code })
      if (STALE_TOKEN_ERROR_CODES.has(code)) staleEntries.push(batch[index])
    })
  }

  const staleTokensRemoved = await purgeStaleTokens(userId, staleEntries)

  if (failureCount) {
    console.warn(
      `[preellyNotifications] ${failureCount}/${entries.length} push send(s) failed for user ${userId}` +
      ` (codes: ${[...new Set(errors.map((e) => e.code))].join(', ')})`
    )
  }

  return { successCount, failureCount, staleTokensRemoved, errors }
}

/**
 * Sends a push notification to every active device registered for a user.
 *
 * This is the common entry point for the whole API — controllers, services,
 * cron jobs and chat handlers should all call this rather than touching the
 * Firebase SDK directly.
 *
 * @param {string|ObjectId} userId  recipient
 * @param {string} title            notification title
 * @param {string} body             notification body
 * @param {Object} [data]           optional data payload; values are cast to strings by FCM's contract
 * @param {Object} [options]        optional { android, apns } platform overrides
 * @returns {Promise<Object>} summary — never throws, so a failed push cannot
 *          break the action that triggered it. Callers that do not care about
 *          the outcome can safely fire-and-forget.
 *
 * @example
 *   await sendPreellyNotificationToUser(userId, 'New Notification', 'You have a new message', {
 *     type: 'chat', chatId: '123',
 *   })
 */
async function sendPreellyNotificationToUser (userId, title, body, data = {}, options = {}) {
  const summary = {
    success: false,
    configured: true,
    userId: userId ? String(userId) : null,
    attempted: 0,
    successCount: 0,
    failureCount: 0,
    staleTokensRemoved: 0,
    errors: [],
    reason: null,
  }

  try {
    const messaging = getMessaging()
    if (!messaging) {
      // Not an error state: an environment without Firebase secrets should keep
      // serving normally, it just cannot deliver pushes.
      return { ...summary, configured: false, reason: 'firebase-not-configured' }
    }

    if (!userId) {
      console.warn('[preellyNotifications] sendPreellyNotificationToUser called without a userId')
      return { ...summary, reason: 'missing-user-id' }
    }

    if (!title && !body) {
      console.warn(`[preellyNotifications] Refusing to send an empty notification to user ${userId}`)
      return { ...summary, reason: 'empty-notification' }
    }

    const entries = await resolveActiveTokens(userId, { includeLegacyUserToken: true })
    if (!entries.length) {
      // Common and benign: the user has simply never opened the mobile app.
      return { ...summary, success: true, reason: 'no-device-tokens' }
    }

    const result = await dispatch(messaging, userId, entries, {
      title,
      body,
      data,
      android: options.android,
      // A caller passing its own apns block replaces the defaults outright,
      // rather than being silently merged into something it did not ask for.
      apns: options.apns || DEFAULT_APNS_CONFIG,
    })

    return {
      ...summary,
      success: result.successCount > 0,
      attempted: entries.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      staleTokensRemoved: result.staleTokensRemoved,
      errors: result.errors,
      reason: result.successCount > 0 ? null : 'all-sends-failed',
    }
  } catch (error) {
    // Swallowed deliberately: a push is always a side effect of some other
    // action, and that action must still succeed.
    console.error(
      `[preellyNotifications] sendPreellyNotificationToUser failed for user ${userId}:`,
      error.message
    )
    return { ...summary, reason: 'exception', error: error.message }
  }
}

/**
 * Original push helper, preserved verbatim in behaviour and response shape for
 * the call sites that already use it (chats, interactions, products, admin,
 * payments). New code should prefer sendPreellyNotificationToUser.
 *
 * Unlike the new function this reads only the DeviceToken collection, so its
 * recipient set is exactly what it was before this module existed.
 */
async function sendPushToUser (userId, payload = {}) {
  const empty = { configured: true, attempted: 0, successCount: 0, failureCount: 0, staleTokensRemoved: 0 }

  try {
    const messaging = getMessaging()
    // Checked before any DB work: an unconfigured environment should not pay
    // for a device-token lookup it can never use.
    if (!messaging) {
      console.warn('[preellyNotifications] Skipping push send: Firebase Admin not configured')
      return { ...empty, configured: false }
    }
    if (!userId) return { ...empty }

    const entries = await resolveActiveTokens(userId, { includeLegacyUserToken: false })
    if (!entries.length) return { ...empty }

    const result = await dispatch(messaging, userId, entries, {
      title: payload.notification?.title,
      body: payload.notification?.body,
      data: payload.data,
    })

    return {
      configured: true,
      attempted: entries.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      staleTokensRemoved: result.staleTokensRemoved,
      errors: result.errors,
    }
  } catch (error) {
    console.error('[preellyNotifications] sendPushToUser failed:', error.message)
    return { ...empty, error: error.message }
  }
}

module.exports = {
  sendPreellyNotificationToUser,
  sendPushToUser,
  resolveActiveTokens,
  maskToken,
}
