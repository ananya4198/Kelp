import { getPreferences } from './preferences'

/**
 * Shows an OS desktop banner if the user turned on desktop notifications.
 * Works while the app window is hidden, which in-app toasts don't.
 */
export function notifyDesktop(title, body) {
  if (!getPreferences().desktopNotifications) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, silent: true })
  } catch (err) {
    console.error('Failed to show desktop notification', err)
  }
}

/** Asks the OS for notification permission. Resolves true if granted. */
export async function requestDesktopPermission() {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  return (await Notification.requestPermission()) === 'granted'
}
