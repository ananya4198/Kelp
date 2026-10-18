import { useEffect, useRef } from 'react'
import { recordPostureSnapshot } from '../lib/db'
import { notifyStatsChanged } from '../lib/statsBus'

const SAMPLE_MS = 1000
const FLUSH_EVERY_SAMPLES = 60 // save once a minute

/**
 * Saves posture to the database while a session runs, which is what feeds the
 * daily summaries and the streak. Each second the current status is tallied;
 * once a minute the tally is written as up to two snapshots (good seconds and
 * bad seconds) so the day's good-posture percentage stays accurate. Seconds
 * where nobody is in frame ('unknown') aren't counted as sitting.
 */
export function usePostureLogger({ sessionId, status }) {
  const statusRef = useRef(status)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (!sessionId) return
    let counts = { good: 0, slouching: 0, leaning: 0 }
    let samples = 0

    function flush() {
      const { good, slouching, leaning } = counts
      counts = { good: 0, slouching: 0, leaning: 0 }
      samples = 0

      const writes = []
      if (good > 0) {
        writes.push(recordPostureSnapshot({ sessionId, postureStatus: 'good', sittingSeconds: good }))
      }
      const bad = slouching + leaning
      if (bad > 0) {
        writes.push(
          recordPostureSnapshot({
            sessionId,
            postureStatus: slouching >= leaning ? 'slouching' : 'leaning',
            sittingSeconds: bad,
          }),
        )
      }
      if (writes.length > 0) {
        Promise.all(writes)
          .then(notifyStatsChanged)
          .catch((err) => console.error('Failed to record posture', err))
      }
    }

    const timer = setInterval(() => {
      const current = statusRef.current
      if (current in counts) counts[current] += 1
      samples += 1
      if (samples >= FLUSH_EVERY_SAMPLES) flush()
    }, SAMPLE_MS)

    return () => {
      clearInterval(timer)
      flush() // save the partial last minute when the session ends
    }
  }, [sessionId])
}
