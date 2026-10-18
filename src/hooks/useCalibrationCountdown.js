import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

const COUNTDOWN_SECONDS = 3
// How long the "Baseline set!" confirmation stays up after calibrating.
const CONFIRM_MS = 1500

/**
 * 3-2-1 countdown before calibrating, so the user has time to sit up straight
 * after clicking the button. `calibrate` runs when it reaches zero, using the
 * last second of frames (when the user should be sitting their best).
 */
export function useCalibrationCountdown(calibrate) {
  const [secondsLeft, setSecondsLeft] = useState(null) // null when not counting down
  const [justCalibrated, setJustCalibrated] = useState(false)

  useEffect(() => {
    if (secondsLeft === null) return
    const timer = setTimeout(() => {
      if (secondsLeft > 1) {
        setSecondsLeft(secondsLeft - 1)
        return
      }
      setSecondsLeft(null)
      if (calibrate()) {
        setJustCalibrated(true)
        toast.success('Posture calibrated! This is now your "good posture".')
      } else {
        toast.error("Couldn't see your head and shoulders clearly. Try again.")
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft, calibrate])

  useEffect(() => {
    if (!justCalibrated) return
    const timer = setTimeout(() => setJustCalibrated(false), CONFIRM_MS)
    return () => clearTimeout(timer)
  }, [justCalibrated])

  const start = useCallback(() => setSecondsLeft(COUNTDOWN_SECONDS), [])
  const cancel = useCallback(() => {
    setSecondsLeft(null)
    setJustCalibrated(false)
  }, [])

  return { secondsLeft, isCountingDown: secondsLeft !== null, justCalibrated, start, cancel }
}
