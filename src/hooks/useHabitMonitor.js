import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { startCamera, stopCamera } from '../lib/camera';
import { createDetectors, analyze } from '../lib/detectors';
import { startSession, endSession, recordHabitEvent, recordStandupFollowed } from '../lib/db';
import { notifyStatsChanged } from '../lib/statsBus';
import { showStandAlert } from '../lib/standAlert';

const DEMO = true;
const CFG = DEMO
  ? { sitLimitMs: 20_000, sitRepeatMs: 30_000, breakAfterMs: 8_000, biteWindow: 4, biteNeed: 3, biteCooldownMs: 10_000 }
  : { sitLimitMs: 45 * 60_000, sitRepeatMs: 10 * 60_000, breakAfterMs: 3 * 60_000, biteWindow: 8, biteNeed: 6, biteCooldownMs: 30_000 };
export function useHabitMonitor() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorsRef = useRef(null);
  const timerRef = useRef(null);
  const sessionIdRef = useRef(null);
  const st = useRef({ sittingStart: null, lastSeen: 0, handSince: null, lastBite: 0, lastSit: 0, bites: 0, breaks: 0 });
  const win = useRef([]);
  const pausedRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ present: false, sittingSec: 0, bites: 0, breaks: 0 });
  const [paused, setPaused] = useState(false);

  const tick = () => {
    const v = videoRef.current;
    if (!v || !detectorsRef.current || v.readyState < 2) return;
    const now = Date.now();
    const s = st.current;
    const { facePresent, handToMouth } = analyze(detectorsRef.current, v);

    // Sitting time
    if (facePresent) {
      s.lastSeen = now;
      if (s.sittingStart === null) s.sittingStart = now;
    } else if (s.sittingStart !== null && now - s.lastSeen > CFG.breakAfterMs) {
      s.sittingStart = null;
      s.breaks += 1;
      toast.success('Nice break! Timer reset 🌱');
      recordStandupFollowed()
        .then(notifyStatsChanged)
        .catch((err) => console.error('Failed to record standup', err));
    }
    const sittingMs = s.sittingStart ? now - s.sittingStart : 0;
    if (sittingMs > CFG.sitLimitMs && now - s.lastSit > CFG.sitRepeatMs) {
      s.lastSit = now;
      showStandAlert();
    }

    // Nail biting: most of the last few checks must look like biting
    win.current.push(facePresent && handToMouth);
    if (win.current.length > CFG.biteWindow) win.current.shift();
    const hits = win.current.filter(Boolean).length;
    if (
      !pausedRef.current &&
      win.current.length === CFG.biteWindow &&
      hits >= CFG.biteNeed &&
      now - s.lastBite > CFG.biteCooldownMs
    ) {
      s.lastBite = now;
      s.bites += 1;
      win.current = [];
      toast('Stop biting your nails!');
      if (sessionIdRef.current) {
        recordHabitEvent({ sessionId: sessionIdRef.current, habitType: 'nail_biting' })
          .then(notifyStatsChanged)
          .catch((err) => console.error('Failed to record habit event', err));
      }
    }

    setStats({ present: facePresent, sittingSec: Math.floor(sittingMs / 1000), bites: s.bites, breaks: s.breaks });
  };

  const start = async () => {
    try {
      setError(null);
      setLoading(true);
      streamRef.current = await startCamera(videoRef.current);
      if (!detectorsRef.current) detectorsRef.current = await createDetectors();
      const session = await startSession();
      sessionIdRef.current = session.id;
      timerRef.current = setInterval(tick, 1000);
      setRunning(true);
    } catch (e) {
      setError(e.message || 'Could not start the camera');
    } finally {
      setLoading(false);
    }
  };

  const stop = () => {
    clearInterval(timerRef.current);
    stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    if (sessionIdRef.current) {
      endSession(sessionIdRef.current).catch((err) => console.error('Failed to end session', err));
      sessionIdRef.current = null;
    }
    setRunning(false);
  };
  const togglePause = () => {
  pausedRef.current = !pausedRef.current;
  setPaused(pausedRef.current);
};
  useEffect(() => stop, []); // clean up on unmount

  return { videoRef, running, loading, error, stats, start, stop, paused, togglePause };
}