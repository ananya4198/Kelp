import { useHabitMonitor } from '../hooks/useHabitMonitor';
import { usePostureDetection } from '../hooks/usePostureDetection';
import PostureStatus from './PostureStatus';

const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export default function Monitor() {
  const { videoRef, running, loading, error, stats, sitLimitSec, start, stop } = useHabitMonitor();
  // Posture detection reuses the habit monitor's camera instead of opening its own.
  const posture = usePostureDetection({ videoRef, enabled: running });
  const { canvasRef: postureCanvasRef } = posture;

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Desk Habits</h1>
      <p className="text-sm text-gray-500">Detection runs on your device. Photos are never saved or uploaded.</p>

      <div className="relative">
        <video ref={videoRef} playsInline muted className="block w-full rounded-xl bg-black" />
        <canvas ref={postureCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>

      <button
        onClick={running ? stop : start}
        disabled={loading}
        className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {loading ? 'Loading models...' : running ? 'End Session' : 'Start Session'}
      </button>
      {error && <p className="text-red-600">{error}</p>}

      <PostureStatus posture={posture} />

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-gray-100 p-3">
          <div className="text-xl font-bold">{fmt(stats.sittingSec)}</div>
          <div className="text-xs">Sitting</div>
          {running && <div className="text-xs text-gray-500">Stand reminder at {fmt(sitLimitSec)}</div>}
        </div>
        <div className="rounded-xl bg-gray-100 p-3">
          <div className="text-xl font-bold">{stats.breaks}</div>
          <div className="text-xs">Breaks</div>
        </div>
        <div className="rounded-xl bg-gray-100 p-3">
          <div className="text-xl font-bold">{stats.bites}</div>
          <div className="text-xs">Nail-biting alerts</div>
        </div>
      </div>
    </div>
  );
}