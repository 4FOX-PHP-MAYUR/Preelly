const fs = require('fs')
const path = require('path')

/**
 * Structured payment logging. Everything goes to the console (picked up by pm2)
 * and is appended to logs/payments.log for reconciliation. Sensitive values
 * (encRequest/encResponse, card data) are never logged in full.
 */
const LOG_DIR = path.join(__dirname, '..', 'logs')
const LOG_FILE = path.join(LOG_DIR, 'payments.log')

function ensureDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
  } catch {
    /* logging must never throw into the payment path */
  }
}

function redact(value) {
  if (typeof value !== 'string') return value
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function write(level, event, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(`💳 ${line}`)
  else console.log(`💳 ${line}`)

  ensureDir()
  try {
    fs.appendFile(LOG_FILE, `${line}\n`, () => {})
  } catch {
    /* ignore */
  }
}

module.exports = {
  info: (event, meta) => write('info', event, meta),
  error: (event, meta) => write('error', event, meta),
  redact,
}
