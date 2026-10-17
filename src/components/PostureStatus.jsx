import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { THRESHOLDS } from '../lib/posture'

const STATUS_STYLES = {
  good: { label: 'Good posture', className: 'bg-emerald-500' },
  slouching: { label: 'Slouching', className: 'bg-red-500' },
  leaning: { label: 'Leaning', className: 'bg-amber-500' },
  unknown: { label: 'No one detected', className: 'bg-slate-500' },
}

// How long the button stays in its green "Calibrated!" state after a click.
const CONFIRM_MS = 1500

/** One slouch signal as "% worse than calibrated", red once it passes its limit. */
function Signal({ label, value, limit }) {
  if (value === null || value === undefined) {
    return (
      <div>
        <dt>{label}</dt>
        <dd className="font-mono text-gray-400">—</dd>
      </div>
    )
  }
  const over = value > limit
  return (
    <div>
      <dt>{label}</dt>
      <dd className={`font-mono ${over ? 'font-bold text-red-600' : ''}`}>
        {Math.round(value * 100)}% <span className="text-gray-400">/ {Math.round(limit * 100)}%</span>
      </dd>
    </div>
  )
}

/** Posture badge, calibrate button and live numbers. Takes usePostureDetection's result. */
export default function PostureStatus({ posture }) {
  const { state, error, status, metrics, signals, isCalibrated, calibrate } = posture
  const [justCalibrated, setJustCalibrated] = useState(false)

  useEffect(() => {
    if (!justCalibrated) return
    const timer = setTimeout(() => setJustCalibrated(false), CONFIRM_MS)
    return () => clearTimeout(timer)
  }, [justCalibrated])

  if (state === 'idle') return null
  if (state === 'error') {
    return <p className="text-red-600">Posture detection failed: {error?.message ?? String(error)}</p>
  }
  if (state === 'loading') {
    return <p className="text-sm text-gray-500">Loading posture model…</p>
  }

  const badge = STATUS_STYLES[status]

  function handleCalibrate() {
    if (calibrate()) {
      setJustCalibrated(true)
      toast.success('Posture calibrated! This is now your "good posture".')
    } else {
      toast.error("Couldn't see your head and shoulders clearly. Try again.")
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-gray-100 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-4 py-1 font-medium text-white ${badge.className}`}>
          {badge.label}
        </span>
        <button
          type="button"
          onClick={handleCalibrate}
          disabled={status === 'unknown' || justCalibrated}
          className={`rounded-lg border px-4 py-1.5 font-medium shadow-sm transition-all duration-150 active:translate-y-0.5 active:scale-95 active:shadow-none disabled:cursor-not-allowed ${
            justCalibrated
              ? 'scale-105 border-emerald-600 bg-emerald-500 text-white disabled:opacity-100'
              : 'border-gray-300 bg-sky-700 hover:bg-sky-600 disabled:opacity-50'
          }`}
        >
          {justCalibrated ? '✓ Calibrated!' : isCalibrated ? 'Recalibrate' : 'Calibrate'}
        </button>
      </div>

      {!isCalibrated && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
          Sit up straight, then click <b>Calibrate</b>. Slouch detection is much more accurate once it
          knows your good posture.
        </p>
      )}

      {metrics && signals && (
        <dl className="grid grid-cols-3 gap-2 text-xs text-gray-600">
          <Signal label="Head sinking" value={signals.neckDrop} limit={THRESHOLDS.neckDrop} />
          <Signal label="Leaning in" value={signals.leanIn} limit={THRESHOLDS.leanIn} />
          <Signal label="Head forward" value={signals.headForward} limit={THRESHOLDS.headForward} />
          <div>
            <dt>Shoulder tilt</dt>
            <dd className="font-mono">{metrics.shoulderTiltDeg.toFixed(1)}°</dd>
          </div>
          <div>
            <dt>Head offset</dt>
            <dd className="font-mono">{metrics.headOffset.toFixed(2)}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}
