import { useCallback, useEffect, useRef, useState } from 'react'
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision'
import { getPoseLandmarker } from '../lib/poseLandmarker'
import { averageMetrics, classifyPosture, computeMetrics, DEFAULT_BASELINE } from '../lib/posture'

// setTimeout instead of requestAnimationFrame so detection keeps running while
// the Electron window is hidden (rAF pauses for hidden windows).
const FRAME_INTERVAL_MS = 100
// ~1.5s of frames averaged together before classifying.
const SMOOTHING_WINDOW = 15
const BASELINE_KEY = 'postureBaseline'

function loadBaseline() {
  try {
    const saved = JSON.parse(localStorage.getItem(BASELINE_KEY))
    if (saved?.neckRatio > 0) return saved
  } catch {
    // ignore corrupt / unavailable storage
  }
  return null
}

/**
 * Runs MediaPipe pose detection on the webcam and classifies posture.
 * Attach `videoRef` to a <video> and (optionally) `canvasRef` to an overlay
 * <canvas> to see the skeleton.
 */
export function usePostureDetection({ enabled = true } = {}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const recentMetrics = useRef([])
  const baselineRef = useRef(loadBaseline())

  const [state, setState] = useState('loading') // loading | running | error
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('unknown')
  const [metrics, setMetrics] = useState(null)
  const [isCalibrated, setIsCalibrated] = useState(() => loadBaseline() !== null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let stream = null
    let timer = null

    async function start() {
      try {
        setState('loading')
        const [landmarker, mediaStream] = await Promise.all([
          getPoseLandmarker(),
          navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false }),
        ])
        stream = mediaStream
        if (cancelled) return

        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        setState('running')

        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        const drawer = ctx ? new DrawingUtils(ctx) : null
        let lastTime = -1

        const tick = () => {
          if (cancelled) return
          if (video.readyState >= 2) {
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
      setMetrics(smoothed)
      setStatus(classifyPosture(smoothed, baselineRef.current ?? DEFAULT_BASELINE))
    }

    start()

    return () => {
      cancelled = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      recentMetrics.current = []
    }
  }, [enabled])

  /** Call while sitting up straight to record the user's "good" posture. */
  const calibrate = useCallback(() => {
    const current = averageMetrics(recentMetrics.current)
    if (!current) return false
    const baseline = { neckRatio: current.neckRatio }
    baselineRef.current = baseline
    try {
      localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline))
    } catch {
      // storage unavailable; baseline still applies for this session
    }
    setIsCalibrated(true)
    return true
  }, [])

  return { videoRef, canvasRef, state, error, status, metrics, isCalibrated, calibrate }
}

function drawPose(canvas, ctx, drawer, video, landmarks) {
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!landmarks) return
  drawer.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#22d3ee', lineWidth: 3 })
  drawer.drawLandmarks(landmarks, { color: '#f97316', radius: 3 })
}
