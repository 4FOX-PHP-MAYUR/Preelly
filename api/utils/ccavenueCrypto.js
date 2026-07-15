const crypto = require('crypto')

/**
 * CCAvenue-compatible AES-128-CBC encryption.
 *
 * The key is the MD5 digest of the working key; the IV is a fixed 0x00..0x0f block
 * — this exact scheme is what CCAvenue's gateway expects (matches their reference kit).
 * Credentials are never passed in here; callers read the working key from process.env.
 */
const IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
])

function keyBuffer(workingKey) {
  if (!workingKey) throw new Error('CCAvenue working key is not configured')
  return crypto.createHash('md5').update(workingKey).digest()
}

function encrypt(plainText, workingKey) {
  const cipher = crypto.createCipheriv('aes-128-cbc', keyBuffer(workingKey), IV)
  let encrypted = cipher.update(String(plainText), 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

function decrypt(encryptedHex, workingKey) {
  const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer(workingKey), IV)
  let decrypted = decipher.update(String(encryptedHex), 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/** Serializes a flat object into CCAvenue's `k=v&k=v` request string. */
function buildRequestString(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
}

/** Parses CCAvenue's `k=v&k=v` response string back into an object. */
function parseResponseString(text) {
  const out = {}
  String(text || '')
    .split('&')
    .forEach((pair) => {
      const idx = pair.indexOf('=')
      if (idx === -1) return
      const key = pair.slice(0, idx)
      const value = pair.slice(idx + 1)
      out[key] = decodeURIComponent(value || '')
    })
  return out
}

module.exports = { encrypt, decrypt, buildRequestString, parseResponseString }
