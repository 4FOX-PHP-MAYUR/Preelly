#!/usr/bin/env node
'use strict'

/**
 * Reports which Firebase credential is ACTUALLY in effect, and for which project.
 *
 * Exists because the resolution order in services/firebase/firebaseApp.js is
 * FIREBASE_SERVICE_ACCOUNT (inline) → FIREBASE_SERVICE_ACCOUNT_PATH (file). An
 * inline variable left over from an earlier setup therefore shadows the key file
 * completely: you replace the JSON on disk, restart, and nothing changes — which
 * is indistinguishable from "the fix did not work" unless you can see which
 * source won.
 *
 * Also compares the resolved project against the device tokens in the database,
 * which is what messaging/mismatched-credential is really complaining about.
 *
 * Prints project identifiers only. Never prints private_key or any secret.
 * Run: node scripts/diagnose-fcm-credential.js
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')

const API_ROOT = path.resolve(__dirname, '..')

function summarise (raw, source) {
  try {
    const j = JSON.parse(raw)
    return {
      source,
      ok: true,
      project_id: j.project_id,
      client_email: j.client_email,
      type: j.type,
      has_private_key: Boolean(j.private_key),
    }
  } catch (error) {
    return { source, ok: false, error: error.message }
  }
}

const candidates = []

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  candidates.push(summarise(process.env.FIREBASE_SERVICE_ACCOUNT, 'FIREBASE_SERVICE_ACCOUNT (inline env var)'))
} else {
  candidates.push({ source: 'FIREBASE_SERVICE_ACCOUNT (inline env var)', absent: true })
}

if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  const keyPath = path.resolve(API_ROOT, process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  let entry
  try {
    entry = summarise(fs.readFileSync(keyPath, 'utf8'), `FIREBASE_SERVICE_ACCOUNT_PATH (${keyPath})`)
    const stat = fs.statSync(keyPath)
    entry.file_mtime = stat.mtime.toISOString()
    entry.file_mode = (stat.mode & 0o777).toString(8)
  } catch (error) {
    entry = { source: `FIREBASE_SERVICE_ACCOUNT_PATH (${keyPath})`, ok: false, error: error.message }
  }
  candidates.push(entry)
} else {
  candidates.push({ source: 'FIREBASE_SERVICE_ACCOUNT_PATH', absent: true })
}

console.log('\n=== Credential sources, in the order firebaseApp.js tries them ===\n')
candidates.forEach((c, i) => {
  console.log(`${i + 1}. ${c.source}`)
  if (c.absent) { console.log('   not set\n'); return }
  if (!c.ok) { console.log(`   UNPARSEABLE: ${c.error}\n`); return }
  console.log(`   project_id      : ${c.project_id}`)
  console.log(`   client_email    : ${c.client_email}`)
  console.log(`   type            : ${c.type}`)
  console.log(`   has private_key : ${c.has_private_key}`)
  if (c.file_mtime) console.log(`   file modified   : ${c.file_mtime}  (mode ${c.file_mode})`)
  console.log()
})

const winner = candidates.find((c) => !c.absent && c.ok)
console.log('=== EFFECTIVE CREDENTIAL ===\n')
if (!winner) {
  console.log('None usable — Firebase Admin will be unconfigured and pushes skipped.\n')
  process.exit(1)
}
console.log(`  source     : ${winner.source}`)
console.log(`  project_id : ${winner.project_id}\n`)

const shadowed = candidates.filter((c) => !c.absent && c.ok && c !== winner)
if (shadowed.length) {
  console.log('  ⚠ SHADOWED (ignored at runtime):')
  shadowed.forEach((c) => console.log(`      ${c.source} → project ${c.project_id}`))
  if (shadowed.some((c) => c.project_id !== winner.project_id)) {
    console.log('\n  ⚠ The shadowed source names a DIFFERENT project. If you edited that')
    console.log('    one expecting it to take effect, unset the winning source instead.')
  }
  console.log()
}

console.log(`Every device token in the database must have been minted by project`)
console.log(`"${winner.project_id}", or FCM answers messaging/mismatched-credential.`)
console.log(`Compare against the app's GoogleService-Info.plist PROJECT_ID`)
console.log(`(iOS) / google-services.json project_info.project_id (Android).\n`)
