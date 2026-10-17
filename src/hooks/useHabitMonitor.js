import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { startCamera, stopCamera } from '../lib/camera';
import { createDetectors, analyze } from '../lib/detectors';

const DEMO = true;
const CFG = DEMO
  ? { sitLimitMs: 20_000, sitRepeatMs: 30_000, breakAfterMs: 8_000, biteMs: 2_000, biteCooldownMs: 10_000 }
  : { sitLimitMs: 45 * 60_000, sitRepeatMs: 10 * 60_000, breakAfterMs: 3 * 60_000, biteMs: 2_500, biteCooldownMs: 30_000 };

export function useHabitMonitor() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorsRef = useRef(null);
  const timerRef = useRef(null);
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
    }
    const sittingMs = s.sittingStart ? now - s.sittingStart : 0;
    if (sittingMs > CFG.sitLimitMs && now - s.lastSit > CFG.sitRepeatMs) {
      s.lastSit = now;
      toast('You have been sitting a while. Stand up and stretch! 🧘');
    }

    // Nail biting (hand near mouth for a few seconds in a row)
    if (facePresent && handToMouth) {
      if (s.handSince === null) s.handSince = now;
      else if (now - s.handSince >= CFG.biteMs && now - s.lastBite > CFG.biteCooldownMs) {
        s.lastBite = now;
        s.bites += 1;
        toast('Hands away from your mouth 💅');
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
    setRunning(false);
  };

  useEffect(() => stop, []); // clean up on unmount

  return { videoRef, running, loading, error, stats, start, stop };
}