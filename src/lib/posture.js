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

// Used until the user calibrates. Only neckRatio has a sensible generic value;
// the other slouch signals need the user's own baseline.
export const DEFAULT_BASELINE = { neckRatio: 0.5 }

export const THRESHOLDS = {
  // Head sank toward the shoulders by this fraction of the baseline.
  neckDrop: 0.10,
  // Smaller head drop that counts as slouching when combined with leaning in.
  neckDropWithLeanIn: 0.06,
  // Shoulders appear this much wider than baseline (you moved toward the screen).
  leanIn: 0.12,
  // Head appears this much bigger relative to shoulders (head pushed forward).
  headForward: 0.15,
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
  const earsVisible = visible(le) && visible(re)
  const headY = earsVisible ? (le.y + re.y) / 2 : nose.y

  return {
    // Vertical head-to-shoulder distance relative to shoulder width. Shrinks
    // when you sink into your chair or hunch your shoulders up.
    neckRatio: (midY - headY) / shoulderWidth,
    // Raw shoulder width in the frame. Grows when you lean in toward the screen.
    shoulderWidth,
    // Ear-to-ear width relative to shoulders. Grows when your head juts forward
    // (it gets closer to the camera than your shoulders do).
    headSize: earsVisible ? Math.hypot(le.x - re.x, le.y - re.y) / shoulderWidth : null,
    // Degrees the shoulder line deviates from horizontal.
    shoulderTiltDeg: (Math.atan2(Math.abs(ls.y - rs.y), Math.abs(ls.x - rs.x)) * 180) / Math.PI,
    // Sideways head offset from the shoulder midpoint.
    headOffset: (nose.x - midX) / shoulderWidth,
  }
}

/**
 * How far each slouch signal has moved from the baseline, as fractions
 * (0.1 = 10% worse). Signals the baseline doesn't cover are null.
 */
export function slouchSignals(metrics, baseline = DEFAULT_BASELINE) {
  return {
    neckDrop: (baseline.neckRatio - metrics.neckRatio) / baseline.neckRatio,
    leanIn: baseline.shoulderWidth ? metrics.shoulderWidth / baseline.shoulderWidth - 1 : null,
    headForward:
      baseline.headSize && metrics.headSize ? metrics.headSize / baseline.headSize - 1 : null,
  }
}

export function classifyPosture(metrics, baseline = DEFAULT_BASELINE) {
  if (!metrics) return 'unknown'

  const { neckDrop, leanIn, headForward } = slouchSignals(metrics, baseline)
  if (
    neckDrop > THRESHOLDS.neckDrop ||
    (neckDrop > THRESHOLDS.neckDropWithLeanIn && leanIn > THRESHOLDS.leanIn) ||
    headForward > THRESHOLDS.headForward
  ) {
    return 'slouching'
  }

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
  const avg = (key) => {
    const values = list.map((m) => m[key]).filter((v) => v !== null)
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  }
  return {
    neckRatio: avg('neckRatio'),
    shoulderWidth: avg('shoulderWidth'),
    headSize: avg('headSize'),
    shoulderTiltDeg: avg('shoulderTiltDeg'),
    headOffset: avg('headOffset'),
  }
}
