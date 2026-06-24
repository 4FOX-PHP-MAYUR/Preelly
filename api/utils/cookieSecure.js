function isCookieSecure () {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true'
  }
  return process.env.NODE_ENV === 'production'
}

module.exports = { isCookieSecure }
