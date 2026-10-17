import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { startCamera, stopCamera } from '../lib/camera';
import { createDetectors, analyze } from '../lib/detectors';
import { startSession, endSession, recordHabitEvent, recordStandupFollowed } from '../lib/db';
import { notifyStatsChanged } from '../lib/statsBus';
import { showStandAlert } from '../lib/standAlert';

const DEMO = true;
const CFG = DEMO
  ? { sitLimitMs: 20_000, sitRepeatMs: 30_000, breakAfterMs: 8_000, biteMs: 2_000, biteCooldownMs: 10_000 }
  : { sitLimitMs: 45 * 60_000, sitRepeatMs: 10 * 60_000, breakAfterMs: 3 * 60_000, biteMs: 2_500, biteCooldownMs: 30_000 };

export function useHabitMonitor() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorsRef = useRef(null);
  const timerRef = useRef(null);
  const sessionIdRef = useRef(null);
  const st = useRef({ sittingStart: null, lastSeen: 0, handSince: null, lastBite: 0, lastSit: 0, bites: 0, breaks: 0 });

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ present: false, sittingSec: 0, bites: 0, breaks: 0 });

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

    // Nail biting (hand near mouth for a few seconds in a row)
    if (facePresent && handToMouth) {
      if (s.handSince === null) s.handSince = now;
      else if (now - s.handSince >= CFG.biteMs && now - s.lastBite > CFG.biteCooldownMs) {
        s.lastBite = now;
        s.bites += 1;
        toast('Hands away from your mouth 💅');
        if (sessionIdRef.current) {
          recordHabitEvent({ sessionId: sessionIdRef.current, habitType: 'nail_biting' })
            .then(notifyStatsChanged)
            .catch((err) => console.error('Failed to record habit event', err));
        }
      }
    } else {
      s.handSince = null;
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

  useEffect(() => stop, []); // clean up on unmount

  return { videoRef, running, loading, error, stats, start, stop };
}