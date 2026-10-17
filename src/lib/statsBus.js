// Tiny in-renderer pub/sub so the Dashboard can refresh the moment the Live
// Session hook records a nail-biting alert or a break, instead of only
// picking up changes when it remounts.
const target = new EventTarget()
const EVENT = 'stats-changed'

export function notifyStatsChanged() {
  target.dispatchEvent(new Event(EVENT))
}

export function onStatsChanged(callback) {
  target.addEventListener(EVENT, callback)
  return () => target.removeEventListener(EVENT, callback)
}
