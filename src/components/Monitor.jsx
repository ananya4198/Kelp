import { useHabitMonitor } from '../hooks/useHabitMonitor';

const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export default function Monitor() {
  const { videoRef, running, loading, error, stats, start, stop } = useHabitMonitor();

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-bold">Desk Habits</h1>
      <p className="text-sm text-gray-500">Detection runs on your device. Photos are never saved or uploaded.</p>

      <video ref={videoRef} playsInline muted className="w-full rounded-xl bg-black" />

      <button
        onClick={running ? stop : start}
        disabled={loading}
        className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {loading ? 'Loading models...' : running ? 'Stop' : 'Start'}
      </button>
      {error && <p className="text-red-600">{error}</p>}

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-gray-100 p-3">
          <div className="text-xl font-bold">{fmt(stats.sittingSec)}</div>
          <div className="text-xs">Sitting</div>
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