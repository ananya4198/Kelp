const STATUS_STYLES = {
  good: { label: 'Good posture', className: 'bg-teal-300 text-teal-950' },
  slouching: { label: 'Slouching', className: 'bg-rose-400 text-rose-950' },
  leaning: { label: 'Leaning', className: 'bg-amber-300 text-amber-950' },
  unknown: { label: 'No one detected', className: 'bg-white/15 text-cyan-100' },
}

/** One slouch signal as "% worse than calibrated", red once it passes its limit. */
function Signal({ label, value, limit }) {
  if (value === null || value === undefined) {
    return (
      <div>
        <dt>{label}</dt>
        <dd className="font-mono text-cyan-100/40">—</dd>
      </div>
    )
  }
  const over = value > limit
  return (
    <div>
      <dt>{label}</dt>
      <dd className={`font-mono ${over ? 'font-bold text-rose-300' : 'text-white'}`}>
        {Math.round(value * 100)}% <span className="text-cyan-100/40">/ {Math.round(limit * 100)}%</span>
      </dd>
    </div>
  )
}

/**
 * Posture badge, calibrate button and live numbers. Takes usePostureDetection's
 * result and useCalibrationCountdown's result.
 */
export default function PostureStatus({ posture, countdown }) {
  const { state, error, status, metrics, signals, thresholds, isCalibrated } = posture

  if (state === 'idle') return null
  if (state === 'error') {
    return <p className="text-rose-300">Posture detection failed: {error?.message ?? String(error)}</p>
  }
  if (state === 'loading') {
    return <p className="text-sm text-cyan-100/70">Loading posture model…</p>
  }

  const badge = STATUS_STYLES[status]

  let buttonLabel = isCalibrated ? 'Recalibrate' : 'Calibrate'
  if (countdown.isCountingDown) buttonLabel = `Sit up straight… Calibrating in ${countdown.secondsLeft}s`
  else if (countdown.justCalibrated) buttonLabel = '✓ Calibrated!'

  return (
    <div className="glass space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-4 py-1.5 font-medium ${badge.className}`}>{badge.label}</span>
        <button
          type="button"
          onClick={countdown.start}
          disabled={status === 'unknown' || countdown.isCountingDown || countdown.justCalibrated}
          className={`btn-primary px-5 py-2 active:scale-95 ${
            countdown.isCountingDown || countdown.justCalibrated ? 'disabled:opacity-100' : ''
          } ${countdown.isCountingDown ? 'animate-pulse' : ''}`}
        >
          {buttonLabel}
        </button>
      </div>

      {!isCalibrated && !countdown.isCountingDown && (
        <p className="rounded-xl border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-100">
          Click <b>Calibrate</b>, then sit up straight during the countdown. Slouch detection is much more
          accurate once it knows your good posture.
        </p>
      )}

      {metrics && signals && (
        <dl className="grid grid-cols-3 gap-3 text-xs text-cyan-100/70">
          <Signal label="Head sinking" value={signals.neckDrop} limit={thresholds.neckDrop} />
          <Signal label="Leaning in" value={signals.leanIn} limit={thresholds.leanIn} />
          <Signal label="Head forward" value={signals.headForward} limit={thresholds.headForward} />
          <div>
            <dt>Shoulder tilt</dt>
            <dd className="font-mono text-white">{metrics.shoulderTiltDeg.toFixed(1)}°</dd>
          </div>
          <div>
            <dt>Head offset</dt>
            <dd className="font-mono text-white">{metrics.headOffset.toFixed(2)}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}
