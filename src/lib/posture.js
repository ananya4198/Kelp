// Posture classification from MediaPipe pose landmarks, assuming a front-facing
// webcam (laptop/monitor). Statuses match the posture_status column in the db:
// 'good' | 'slouching' | 'leaning' | 'unknown'.

// MediaPipe pose landmark indices.
const NOSE = 0
const LEFT_EAR = 7
const RIGHT_EAR = 8
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12

const MIN_VISIBILITY = 0.5

// Used until the user calibrates. Tuned for a typical laptop-camera setup.
export const DEFAULT_BASELINE = { neckRatio: 0.55 }

export const THRESHOLDS = {
  // Head has dropped toward the shoulders by this fraction of the baseline.
  slouchDrop: 0.18,
  // Shoulder line tilted more than this many degrees.
  shoulderTiltDeg: 8,
  // Head offset sideways from shoulder midpoint, as a fraction of shoulder width.
  headOffset: 0.25,
}

const visible = (lm) => lm && (lm.visibility ?? 1) >= MIN_VISIBILITY

/**
 * Scale-invariant measurements of the upper body, or null if the shoulders /
 * head aren't clearly visible.
 */
export function computeMetrics(landmarks) {
  if (!landmarks) return null
  const ls = landmarks[LEFT_SHOULDER]
  const rs = landmarks[RIGHT_SHOULDER]
  const nose = landmarks[NOSE]
  if (!visible(ls) || !visible(rs) || !visible(nose)) return null

  const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y)
  if (shoulderWidth < 0.05) return null

  const midX = (ls.x + rs.x) / 2
  const midY = (ls.y + rs.y) / 2

  // Use the ears when visible (more stable than the nose when looking down).
  const le = landmarks[LEFT_EAR]
  const re = landmarks[RIGHT_EAR]
  const headY = visible(le) && visible(re) ? (le.y + re.y) / 2 : nose.y

  return {
    // Vertical head-to-shoulder distance relative to shoulder width. Shrinks
    // when you slouch or crane your neck forward.
    neckRatio: (midY - headY) / shoulderWidth,
    // Degrees the shoulder line deviates from horizontal.
    shoulderTiltDeg: (Math.atan2(Math.abs(ls.y - rs.y), Math.abs(ls.x - rs.x)) * 180) / Math.PI,
    // Sideways head offset from the shoulder midpoint.
    headOffset: (nose.x - midX) / shoulderWidth,
  }
}

export function classifyPosture(metrics, baseline = DEFAULT_BASELINE) {
  if (!metrics) return 'unknown'

  const drop = (baseline.neckRatio - metrics.neckRatio) / baseline.neckRatio
  if (drop > THRESHOLDS.slouchDrop) return 'slouching'

  if (
    metrics.shoulderTiltDeg > THRESHOLDS.shoulderTiltDeg ||
    Math.abs(metrics.headOffset) > THRESHOLDS.headOffset
  ) {
    return 'leaning'
  }

  return 'good'
}

/** Averages a list of metric objects to smooth out per-frame jitter. */
export function averageMetrics(list) {
  if (list.length === 0) return null
  const sum = { neckRatio: 0, shoulderTiltDeg: 0, headOffset: 0 }
  for (const m of list) {
    sum.neckRatio += m.neckRatio
    sum.shoulderTiltDeg += m.shoulderTiltDeg
    sum.headOffset += m.headOffset
  }
  return {
    neckRatio: sum.neckRatio / list.length,
    shoulderTiltDeg: sum.shoulderTiltDeg / list.length,
    headOffset: sum.headOffset / list.length,
  }
}
