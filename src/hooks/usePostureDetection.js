import { useCallback, useEffect, useRef, useState } from 'react'
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision'
import { getPoseLandmarker } from '../lib/poseLandmarker'
import {
  averageMetrics,
  classifyPosture,
  computeMetrics,
  DEFAULT_BASELINE,
  slouchSignals,
} from '../lib/posture'

// setTimeout instead of requestAnimationFrame so detection keeps running while
// the Electron window is hidden (rAF pauses for hidden windows).
const FRAME_INTERVAL_MS = 100
// ~1s of frames averaged together before classifying.
const SMOOTHING_WINDOW = 10
// A new status must hold for this many frames (~0.8s) before it's shown, so
// the badge doesn't flicker when you're right on a threshold.
const HOLD_FRAMES = 8
// v2 baselines also store shoulderWidth/headSize; older ones are ignored so the
// user is prompted to recalibrate.
const BASELINE_KEY = 'postureBaseline.v2'

function loadBaseline() {
  try {
    const saved = JSON.parse(localStorage.getItem(BASELINE_KEY))
    if (saved?.neckRatio > 0 && saved?.shoulderWidth > 0) return saved
  } catch {
    // ignore corrupt / unavailable storage
  }
  return null
}

/**
 * Runs MediaPipe pose detection on an already-playing <video> and classifies
 * posture. The camera itself is owned by the caller (see useHabitMonitor), so
 * several detectors can share one webcam. Attach `canvasRef` to an overlay
 * <canvas> to see the skeleton.
 */
export function usePostureDetection({ videoRef, enabled }) {
  const canvasRef = useRef(null)
  const recentMetrics = useRef([])
  const baselineRef = useRef(loadBaseline())

  // loading | running | error; reported as 'idle' while disabled.
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('unknown')
  const [metrics, setMetrics] = useState(null)
  const [signals, setSignals] = useState(null)
  const [isCalibrated, setIsCalibrated] = useState(() => loadBaseline() !== null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer = null
    const canvas = canvasRef.current
    let shownStatus = 'unknown'
    let candidate = 'unknown'
    let candidateFrames = 0

    async function start() {
      try {
        const landmarker = await getPoseLandmarker()
        if (cancelled) return
        setState('running')

        const ctx = canvas?.getContext('2d')
        const drawer = ctx ? new DrawingUtils(ctx) : null
        let lastTime = -1

        const tick = () => {
          if (cancelled) return
          const video = videoRef.current
          if (video && video.readyState >= 2) {
            const now = performance.now()
            // detectForVideo requires strictly increasing timestamps.
            if (now > lastTime) {
              lastTime = now
              const result = landmarker.detectForVideo(video, now)
              const landmarks = result.landmarks[0]
              handleFrame(landmarks)
              if (drawer) drawPose(canvas, ctx, drawer, video, landmarks)
            }
          }
          timer = setTimeout(tick, FRAME_INTERVAL_MS)
        }
        tick()
      } catch (err) {
        if (cancelled) return
        console.error('Posture detection failed to start', err)
        setError(err)
        setState('error')
      }
    }

    function handleFrame(landmarks) {
      const frameMetrics = computeMetrics(landmarks)
      const history = recentMetrics.current
      if (frameMetrics) {
        history.push(frameMetrics)
        if (history.length > SMOOTHING_WINDOW) history.shift()
      } else {
        // Nobody in frame: drop history so we report 'unknown' quickly.
        history.length = 0
      }
      const smoothed = averageMetrics(history)
      const baseline = baselineRef.current ?? DEFAULT_BASELINE
      setMetrics(smoothed)
      setSignals(smoothed ? slouchSignals(smoothed, baseline) : null)

      const next = classifyPosture(smoothed, baseline)
      candidateFrames = next === candidate ? candidateFrames + 1 : 1
      candidate = next
      // 'unknown' (nobody in frame) shows right away; other changes must hold.
      if (next !== shownStatus && (next === 'unknown' || candidateFrames >= HOLD_FRAMES)) {
        shownStatus = next
        setStatus(next)
      }
    }

    start()

    return () => {
      cancelled = true
      clearTimeout(timer)
      recentMetrics.current = []
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      setState('loading')
      setError(null)
      setStatus('unknown')
      setMetrics(null)
      setSignals(null)
    }
  }, [enabled, videoRef])

  /** Call while sitting up straight to record the user's "good" posture. */
  const calibrate = useCallback(() => {
    // Need ~half a second of clear frames so one glitchy frame can't become the baseline.
    if (recentMetrics.current.length < 5) return false
    const current = averageMetrics(recentMetrics.current)
    const baseline = {
      neckRatio: current.neckRatio,
      shoulderWidth: current.shoulderWidth,
      headSize: current.headSize,
    }
    baselineRef.current = baseline
    try {
      localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline))
    } catch {
      // storage unavailable; baseline still applies for this session
    }
    setIsCalibrated(true)
    return true
  }, [])

  return {
    canvasRef,
    state: enabled ? state : 'idle',
    error,
    status,
    metrics,
    signals,
    isCalibrated,
    calibrate,
  }
}

function drawPose(canvas, ctx, drawer, video, landmarks) {
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!landmarks) return
  // Skip the face points (eyes, nose, mouth, ears) and only draw the body.
  drawer.drawConnectors(landmarks, BODY_CONNECTIONS, { color: '#22d3ee', lineWidth: 3 })
  drawer.drawLandmarks(landmarks.slice(FIRST_BODY_LANDMARK), { color: '#f97316', radius: 3 })
}

// Pose landmarks 0-10 are the face; 11+ are shoulders, arms, hips and legs.
const FIRST_BODY_LANDMARK = 11
const BODY_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS.filter(
  ({ start, end }) => start >= FIRST_BODY_LANDMARK && end >= FIRST_BODY_LANDMARK,
)
