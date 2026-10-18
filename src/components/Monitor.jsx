import { useHabitMonitor } from '../hooks/useHabitMonitor';
import { usePostureDetection } from '../hooks/usePostureDetection';
import { usePostureLogger } from '../hooks/usePostureLogger';
import PostureStatus from './PostureStatus';

const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

function Stat({ value, label, note }) {
  return (
    <div className="glass p-4">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-cyan-100/80">{label}</div>
      {note && <div className="mt-1 text-xs text-cyan-100/60">{note}</div>}
    </div>
  );
}

export default function Monitor() {
  const { videoRef, running, loading, error, stats, sitLimitSec, start, stop, paused, togglePause, sessionId } =
    useHabitMonitor();
  // Posture detection reuses the habit monitor's camera instead of opening its own.
  const posture = usePostureDetection({ videoRef, enabled: running });
  usePostureLogger({ sessionId, status: posture.status });
  const { canvasRef: postureCanvasRef } = posture;

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-white">Desk Habits</h1>
      <p className="text-sm text-cyan-100/70">Detection runs on your device. Photos are never saved or uploaded.</p>

      <div className="relative overflow-hidden rounded-2xl bg-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.2)] ring-1 ring-white/20">
        <video ref={videoRef} playsInline muted className="block w-full" />
        <canvas ref={postureCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>

      <button
        onClick={running ? stop : start}
        disabled={loading}
        className="btn-primary w-full px-4 py-3"
      >
        {loading ? 'Loading models...' : running ? 'End Session' : 'Start Session'}
      </button>
      {error && <p className="text-rose-300">{error}</p>}

      <button onClick={togglePause} disabled={!running} className="btn-ghost w-full px-4 py-2">
        {paused ? 'Resume nail-biting alerts' : 'Pause nail-biting alerts'}
      </button>

      <PostureStatus posture={posture} />

      <div className="grid grid-cols-2 gap-3 text-center">
        <Stat
          value={fmt(stats.sittingSec)}
          label="Sitting"
          note={running ? `Stand reminder at ${fmt(sitLimitSec)}` : null}
        />
        <Stat value={stats.bites} label="Nail-biting alerts" />
        <Stat value={stats.expectedStandups} label="Stand alerts sent" />
        <Stat value={`${stats.performedStandups}/${stats.expectedStandups}`} label="Standups performed" />
      </div>
    </div>
  );
}