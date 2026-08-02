/**
 * The unread-notification badge lives in the top bar while the notifications
 * page owns the read/unread state. This tiny window-event channel lets the page
 * tell the badge to refresh without either side importing the other.
 */
export const NOTIFICATION_UNREAD_EVENT = 'preelly:notifications-unread-changed'

export function emitNotificationUnreadChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(NOTIFICATION_UNREAD_EVENT))
}
