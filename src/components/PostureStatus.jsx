const STATUS_STYLES = {
  good: { label: 'Good posture', className: 'bg-emerald-500' },
  slouching: { label: 'Slouching', className: 'bg-red-500' },
  leaning: { label: 'Leaning', className: 'bg-amber-500' },
  unknown: { label: 'No one detected', className: 'bg-slate-500' },
}

/** Posture badge, calibrate button and live numbers. Takes usePostureDetection's result. */
export default function PostureStatus({ posture }) {
  const { state, error, status, metrics, isCalibrated, calibrate } = posture

  if (state === 'idle') return null
  if (state === 'error') {
    return <p className="text-red-600">Posture detection failed: {error?.message ?? String(error)}</p>
  }
  if (state === 'loading') {
    return <p className="text-sm text-gray-500">Loading posture model…</p>
  }

  const badge = STATUS_STYLES[status]

  return (
    <div className="space-y-3 rounded-xl bg-gray-100 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-4 py-1 font-medium text-white ${badge.className}`}>
          {badge.label}
        </span>
        <button
          type="button"
          onClick={calibrate}
          disabled={status === 'unknown'}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1 disabled:opacity-50"
        >
          {isCalibrated ? 'Recalibrate' : 'Calibrate'}
        </button>
      </div>
      {!isCalibrated && <p className="text-sm text-gray-500">Sit up straight, then click Calibrate.</p>}

      {metrics && (
        <dl className="grid grid-cols-3 gap-2 text-xs text-gray-600">
          <div>
            <dt>Neck ratio</dt>
            <dd className="font-mono">{metrics.neckRatio.toFixed(2)}</dd>
          </div>
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
