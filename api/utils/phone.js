const { normalizePhoneForWhatsApp } = require('./whatsapp')

const MIN_PHONE_MATCH_LENGTH = 7

const phoneDigitsOnly = (value) => {
  try {
    return normalizePhoneForWhatsApp(value)
  } catch {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) {
      throw new Error('Invalid phone number')
    }
    return digits
  }
}

const phonesMatch = (inputDigits, storedPhone) => {
  const storedDigits = phoneDigitsOnly(storedPhone)
  if (!inputDigits || !storedDigits) return false
  if (inputDigits === storedDigits) return true

  const shorter = inputDigits.length <= storedDigits.length ? inputDigits : storedDigits
  const longer = inputDigits.length > storedDigits.length ? inputDigits : storedDigits

  return shorter.length >= MIN_PHONE_MATCH_LENGTH && longer.endsWith(shorter)
}

const parsePhoneInput = ({ phone, phoneCountryCode, phoneCountryIso }) => {
  const phoneDigits = phoneDigitsOnly(phone)

  return {
    phoneDigits,
    phoneCountryCode: phoneCountryCode ? String(phoneCountryCode).trim() : null,
    phoneCountryIso: phoneCountryIso ? String(phoneCountryIso).trim().toUpperCase() : null,
  }
}

const applyPhoneFieldsToUser = (user, { phoneDigits, phoneCountryCode, phoneCountryIso }) => {
  if (phoneDigits) {
    user.phone = phoneDigits
  }
  if (phoneCountryCode) {
    user.phoneCountryCode = phoneCountryCode
  }
  if (phoneCountryIso) {
    user.phoneCountryIso = phoneCountryIso
  }
}

const maybeUpgradeUserPhone = async (user, { phoneDigits, phoneCountryCode, phoneCountryIso }) => {
  if (!user || !phoneDigits) return user

  let changed = false
  const storedDigits = user.phone ? phoneDigitsOnly(user.phone) : ''

  if (phoneDigits && phonesMatch(phoneDigits, storedDigits) && storedDigits !== phoneDigits) {
    user.phone = phoneDigits
    changed = true
  }

  if (phoneCountryCode && user.phoneCountryCode !== phoneCountryCode) {
    user.phoneCountryCode = phoneCountryCode
    changed = true
  }

  if (phoneCountryIso && user.phoneCountryIso !== phoneCountryIso) {
    user.phoneCountryIso = phoneCountryIso
    changed = true
  }

  if (changed) {
    await user.save()
  }

  return user
}

module.exports = {
  phoneDigitsOnly,
  phonesMatch,
  parsePhoneInput,
  applyPhoneFieldsToUser,
  maybeUpgradeUserPhone,
}
