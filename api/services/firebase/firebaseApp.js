/**
 * Firebase Admin SDK bootstrap — credential loading and one-time app init.
 *
 * Deliberately contains NO notification business logic: every module that needs
 * to talk to Firebase gets its handle from here, so the SDK is initialised
 * exactly once per process and credentials are read from exactly one place.
 * Notification/business behaviour lives in ./preellyNotifications.js.
 *
 * Credentials are supplied by environment only (never hardcoded), matching the
 * APPLE_PRIVATE_KEY[_PATH] convention already used elsewhere in the API:
 *   FIREBASE_SERVICE_ACCOUNT       — the service-account JSON inline
 *   FIREBASE_SERVICE_ACCOUNT_PATH  — path to the service-account JSON file,
 *                                    absolute or relative to the api/ root
 */
const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin')

// services/firebase/ -> services/ -> api/
const API_ROOT = path.resolve(__dirname, '..', '..')

/**
 * Parses one credential candidate. Returns null instead of throwing so a bad
 * source can be skipped, and names the source in the log — a bare JSON syntax
 * error cannot be attributed to a variable or a file, which makes a mispasted
 * credential very hard to track down on a remote host.
 * Logs only a short prefix of the offending value, never the secret itself.
 */
function parseServiceAccount (raw, source) {
  try {
    return JSON.parse(raw)
  } catch (error) {
    console.error(
      `[firebaseApp] ${source} is not valid service-account JSON: ${error.message}. ` +
      `Value starts with ${JSON.stringify(String(raw).slice(0, 12))} — a service account must start with "{". ` +
      'A web-push (VAPID) key or any other credential pasted here fails exactly this way.'
    )
    return null
  }
}

/** Reads the Firebase service account from env. Returns null (never throws) when unusable. */
function readServiceAccount () {
  // Each source is tried in turn: a malformed inline value must not shadow a
  // working key file, which is what turned one mispasted variable into a total
  // push outage rather than a fallback.
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const fromEnv = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT, 'FIREBASE_SERVICE_ACCOUNT')
    if (fromEnv) return fromEnv
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // path.resolve leaves an absolute configured path untouched and anchors a
    // relative one at api/, so the same value works from server.js, a cron job
    // or a test regardless of the process working directory.
    const keyPath = path.resolve(API_ROOT, process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    let raw
    try {
      raw = fs.readFileSync(keyPath, 'utf8')
    } catch (error) {
      console.error(
        `[firebaseApp] Cannot read FIREBASE_SERVICE_ACCOUNT_PATH (${keyPath}): ${error.message}. ` +
        'Push notifications are disabled until this file is readable.'
      )
      return null
    }
    const fromFile = parseServiceAccount(raw, `FIREBASE_SERVICE_ACCOUNT_PATH (${keyPath})`)
    if (fromFile) return fromFile
  }

  return null
}

let app = null
let warnedUnconfigured = false

/**
 * Returns the initialised Firebase Admin app, or null when no usable credential
 * is configured. Null is a supported state, not an exception: a dev environment
 * without secrets must still boot and serve every non-push route.
 */
function getFirebaseApp () {
  if (app) return app

  const serviceAccount = readServiceAccount()
  if (!serviceAccount) {
    if (!warnedUnconfigured) {
      // Once per process — a per-send warning would flood the logs on a busy API.
      console.warn(
        '[firebaseApp] Firebase Admin is not configured (set FIREBASE_SERVICE_ACCOUNT_PATH ' +
        'or FIREBASE_SERVICE_ACCOUNT). Push notifications will be skipped.'
      )
      warnedUnconfigured = true
    }
    return null
  }

  try {
    app = admin.apps.length
      ? admin.app()
      : admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  } catch (error) {
    // Structurally-valid JSON that is not a usable credential (missing
    // private_key, wrong shape) throws here rather than at parse time.
    console.error('[firebaseApp] Failed to initialise Firebase Admin:', error.message)
    return null
  }

  return app
}

/** Returns the messaging instance for the initialised app, or null when unconfigured. */
function getMessaging () {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  return admin.messaging(firebaseApp)
}

/** True when a usable service account is configured — cheap enough for a health check. */
function isFirebaseConfigured () {
  return getFirebaseApp() !== null
}

module.exports = { getFirebaseApp, getMessaging, isFirebaseConfigured }
