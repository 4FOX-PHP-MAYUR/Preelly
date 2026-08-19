/**
 * Firebase Admin facade.
 *
 * The implementation now lives in ./firebase/:
 *   firebase/firebaseApp.js          — SDK bootstrap / credential loading
 *   firebase/preellyNotifications.js — notification business logic
 *
 * This module is kept as the stable import path used across the API
 * (chats, interactions, products, admin, payments, user routes) so the split
 * did not require touching every call site.
 *
 * New code should call sendPreellyNotificationToUser().
 */
const {
  sendPreellyNotificationToUser,
  sendPushToUser,
  resolveActiveTokens,
  maskToken,
} = require('./firebase/preellyNotifications')
const { getFirebaseApp, getMessaging, isFirebaseConfigured } = require('./firebase/firebaseApp')

module.exports = {
  sendPreellyNotificationToUser,
  sendPushToUser,
  resolveActiveTokens,
  maskToken,
  getFirebaseApp,
  getMessaging,
  isFirebaseConfigured,
}
