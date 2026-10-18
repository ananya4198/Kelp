import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { notifyDesktop } from '../lib/desktopNotify';
import { startCamera, stopCamera } from '../lib/camera';
import { createDetectors, analyze } from '../lib/detectors';
import {
  startSession,
  endSession,
  getProfile,
  recordHabitEvent,
  recordStandupFollowed,
  recordExpectedStandup,
  recordPerformedStandup,
} from '../lib/db';
import { notifyStatsChanged } from '../lib/statsBus';
import { showStandAlert } from '../lib/standAlert';

// How long you can sit before the stand-up popup comes from the user's
// "Remind me to stand" setting (profile.stand_goal), read when a session
// starts, and repeats every goal interval if the user keeps sitting.
const DEMO = true;
const CFG = DEMO
  ? { biteWindow: 4, biteNeed: 3, biteCooldownMs: 10_000 }
  : { biteWindow: 8, biteNeed: 6, biteCooldownMs: 30_000 };
const DEFAULT_STAND_REMINDER_MINUTES = 45;
// A stand-up is detected purely from shoulder displacement: once the
// shoulders have risen this fraction of the frame height (0.5 = half the
// screen) above wherever they were when we started tracking, regardless of
// where that was, we count it as standing up.
const STAND_SHOULDER_DISPLACEMENT = 0.5;

const INITIAL_STATS = {
  present: false,
  sittingSec: 0,
  bites: 0,
  breaks: 0,
  expectedStandups: 0,
  performedStandups: 0,
};
const initialTracking = () => ({
  sittingStart: null,
  lastSeen: 0,
  handSince: null,
  lastBite: 0,
  remindersThisSit: 0,
  bites: 0,
  breaks: 0,
  expectedStandups: 0,
  performedStandups: 0,
  shoulderBaselineY: null,
  // Whether shoulders were visible as of the last tick, so disappearing
  // entirely (nobody in frame) can be detected as a one-time edge rather
  // than re-triggering every tick for as long as they're gone.
  personPresent: false,
});

export function useHabitMonitor() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorsRef = useRef(null);
  const timerRef = useRef(null);
  const sessionIdRef = useRef(null);
  const win = useRef([]);
  const pausedRef = useRef(false);
  const st = useRef(initialTracking());
  const sitLimitMsRef = useRef(DEFAULT_STAND_REMINDER_MINUTES * 60_000);

  const [sitLimitSec, setSitLimitSec] = useState(DEFAULT_STAND_REMINDER_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState(INITIAL_STATS);
  // Shared with other per-session recorders (e.g. posture logging in Monitor).
  const [sessionId, setSessionId] = useState(null);

  const tick = () => {
    const v = videoRef.current;
    if (!v || !detectorsRef.current || v.readyState < 2) return;
    const now = Date.now();
    const s = st.current;
    const { facePresent, handToMouth, shoulderY } = analyze(detectorsRef.current, v);

    // Sitting time: still driven by face presence, just to know whether
    // someone's at their desk for the stand-reminder timer below.
    if (facePresent) {
      s.lastSeen = now;
      if (s.sittingStart === null) s.sittingStart = now;
    }

    // Stand-up detection: triggered either by the shoulders rising half the
    // frame height from wherever they were first tracked (absolute position
    // doesn't matter, only displacement), or by nobody being detected at all
    // (they likely walked out of frame, e.g. standing up and leaving).
    const registerStandUp = () => {
      s.sittingStart = null;
      s.breaks += 1;
      s.performedStandups += 1;
      toast.success('Nice break! Timer reset 🌱');
      recordStandupFollowed()
        .then(notifyStatsChanged)
        .catch((err) => console.error('Failed to record standup', err));
      if (sessionIdRef.current) {
        recordPerformedStandup(sessionIdRef.current).catch((err) =>
          console.error('Failed to record performed standup', err),
        );
      }
    };

    if (shoulderY === null) {
      s.shoulderBaselineY = null; // lost tracking; re-lock once shoulders reappear
      if (s.personPresent) {
        // Edge: someone was there last tick and now nobody is detected at all.
        s.personPresent = false;
        registerStandUp();
      }
    } else {
      s.personPresent = true;
      // Track the lowest point in frame seen since the last trigger (bigger
      // y = lower = more "sitting"), not just whatever the first sample was.
      // Otherwise, right after a trigger the next sample is often still the
      // standing position itself, which would permanently pin the baseline
      // there and make a second stand-up mathematically impossible to detect.
      s.shoulderBaselineY = s.shoulderBaselineY === null ? shoulderY : Math.max(s.shoulderBaselineY, shoulderY);
      const displacement = s.shoulderBaselineY - shoulderY; // positive = moved up
      if (displacement >= STAND_SHOULDER_DISPLACEMENT) {
        s.shoulderBaselineY = shoulderY; // restart tracking from here; will ratchet down once they resettle
        registerStandUp();
      }
    }
    const sittingMs = s.sittingStart ? now - s.sittingStart : 0;
    // Remind at every multiple of the user's goal while they keep sitting
    // (e.g. a 2 min goal reminds at 2:00, 4:00, 6:00). A break resets the
    // sitting timer, so the next reminder is a full goal after they return.
    const nextReminderMs = (s.remindersThisSit + 1) * sitLimitMsRef.current;
    if (s.sittingStart === null) {
      s.remindersThisSit = 0;
    } else if (sittingMs >= nextReminderMs) {
      s.remindersThisSit += 1;
      s.expectedStandups += 1;
      showStandAlert();
      if (sessionIdRef.current) {
        recordExpectedStandup(sessionIdRef.current).catch((err) =>
          console.error('Failed to record expected standup', err),
        );
      }
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
      notifyDesktop('Hands down 💅', 'Looks like you were biting your nails. Try a fidget instead!');
      if (sessionIdRef.current) {
        recordHabitEvent({ sessionId: sessionIdRef.current, habitType: 'nail_biting' })
          .then(notifyStatsChanged)
          .catch((err) => console.error('Failed to record habit event', err));
      }
    }

    setStats({
      present: facePresent,
      sittingSec: Math.floor(sittingMs / 1000),
      bites: s.bites,
      breaks: s.breaks,
      expectedStandups: s.expectedStandups,
      performedStandups: s.performedStandups,
      nextReminderSec: ((s.remindersThisSit + 1) * sitLimitMsRef.current) / 1000,
    });
  };

  const start = async () => {
    try {
      setError(null);
      setLoading(true);
      streamRef.current = await startCamera(videoRef.current);
      if (!detectorsRef.current) detectorsRef.current = await createDetectors();
      const profile = await getProfile();
      const minutes = profile?.stand_goal || DEFAULT_STAND_REMINDER_MINUTES;
      sitLimitMsRef.current = minutes * 60_000;
      setSitLimitSec(minutes * 60);
      const session = await startSession();
      sessionIdRef.current = session.id;
      setSessionId(session.id);
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
    setSessionId(null);
    // Each session starts fresh: reset the sitting timer, breaks and alerts.
    st.current = initialTracking();
    setStats(INITIAL_STATS);
    win.current = [];
    pausedRef.current = false;
    setPaused(false);
    setRunning(false);
  };
  const togglePause = () => {
  pausedRef.current = !pausedRef.current;
  setPaused(pausedRef.current);
};
  useEffect(() => stop, []); // clean up on unmount

  return { videoRef, running, loading, error, stats, sitLimitSec, start, stop, paused, togglePause, sessionId };
}