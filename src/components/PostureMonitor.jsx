import { usePostureDetection } from '../hooks/usePostureDetection'

const STATUS_STYLES = {
  good: { label: 'Good posture', className: 'bg-emerald-500' },
  slouching: { label: 'Slouching', className: 'bg-red-500' },
  leaning: { label: 'Leaning', className: 'bg-amber-500' },
  unknown: { label: 'No one detected', className: 'bg-slate-500' },
}

export default function PostureMonitor() {
  const { videoRef, canvasRef, state, error, status, metrics, isCalibrated, calibrate } =
    usePostureDetection()
  const badge = STATUS_STYLES[status]

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Posture Monitor</h1>

      <div className="relative overflow-hidden rounded-xl bg-black">
        {/* Mirrored so it feels like a mirror; landmarks are mirrored with it. */}
        <video ref={videoRef} className="block w-full -scale-x-100" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100" />
        {state === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            Loading pose model…
          </div>
        )}
      </div>

      {state === 'error' && (
        <p className="text-red-600">Couldn't start detection: {error?.message ?? String(error)}</p>
      )}

      <div className="flex items-center gap-3">
        <span className={`rounded-full px-4 py-1 font-medium text-white ${badge.className}`}>
          {badge.label}
        </span>
        <button
          type="button"
          onClick={calibrate}
          disabled={state !== 'running' || status === 'unknown'}
          className="rounded-lg border px-3 py-1 disabled:opacity-50"
        >
          {isCalibrated ? 'Recalibrate' : 'Calibrate'}
        </button>
        {!isCalibrated && (
          <span className="text-sm text-slate-500">Sit up straight, then click Calibrate.</span>
        )}
      </div>

      {metrics && (
        <dl className="grid grid-cols-3 gap-2 text-sm text-slate-600">
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
