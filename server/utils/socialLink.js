const User = require('../models/User')

const PROVIDER_FIELDS = {
  google: 'googleProviderId',
  apple: 'appleProviderId',
  facebook: 'facebookProviderId',
  instagram: 'instagramProviderId',
}

const PROVIDER_USERNAME_FIELDS = {
  instagram: 'instagramUsername',
}

/**
 * Link a social provider account to an existing user (settings flow).
 */
async function linkSocialAccount(userId, provider, { providerId, username, avatar } = {}) {
  const field = PROVIDER_FIELDS[provider]
  if (!field) throw new Error('Invalid provider')
  if (!providerId) throw new Error(`${provider} did not return an account id`)

  const existing = await User.findOne({ [field]: String(providerId), _id: { $ne: userId } }).exec()
  if (existing) throw new Error('This account is already linked to another user')

  const user = await User.findById(userId).exec()
  if (!user) throw new Error('User not found')

  user[field] = String(providerId)

  const usernameField = PROVIDER_USERNAME_FIELDS[provider]
  if (usernameField && username) {
    user[usernameField] = String(username).trim()
  }

  if (avatar && !user.avatar) {
    user.avatar = avatar
  }

  await user.save()
  return user
}

function getProviderField(provider) {
  return PROVIDER_FIELDS[provider] || null
}

module.exports = {
  linkSocialAccount,
  getProviderField,
  PROVIDER_FIELDS,
}
