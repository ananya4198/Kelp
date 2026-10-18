import { useEffect, useRef } from 'react'
import { notifyDesktop } from '../lib/desktopNotify'

const BAD_STATUSES = new Set(['slouching', 'leaning'])
// Bad posture must last this long before the first banner...
const PERSIST_MS = 30_000
// ...and if it keeps going, remind again this often.
const REPEAT_MS = 2 * 60_000

/**
 * Sends a desktop banner when slouching or leaning lasts over 30 seconds (only
 * if desktop notifications are on). Sitting up straight resets the clock.
 */
export function useBadPostureNotifier({ status, active }) {
  const statusRef = useRef(status)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (!active) return
    let badSince = null
    let lastNotified = 0

    const timer = setInterval(() => {
      const now = Date.now()
      if (!BAD_STATUSES.has(statusRef.current)) {
        badSince = null
        lastNotified = 0
        return
      }
      if (badSince === null) badSince = now
      const dueFirst = lastNotified === 0 && now - badSince >= PERSIST_MS
      const dueRepeat = lastNotified !== 0 && now - lastNotified >= REPEAT_MS
      if (dueFirst || dueRepeat) {
        lastNotified = now
        const what = statusRef.current === 'leaning' ? 'leaning to one side' : 'slouching'
        notifyDesktop('Posture check 🪸', `You've been ${what} for a while. Sit up straight and relax your shoulders.`)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [active])
}
