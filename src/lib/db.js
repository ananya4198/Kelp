function requireDb() {
  if (!window.electron?.db) {
    throw new Error(
      'window.electron.db is unavailable. The app must run inside Electron (npm run electron:dev), not a plain browser tab.',
    )
  }
  return window.electron.db
}

export function startSession() {
  return requireDb().startSession()
}

export function endSession(sessionId) {
  return requireDb().endSession(sessionId)
}

/** Records one per-minute posture/eye-tracking sample. */
export function recordPostureSnapshot({ sessionId, postureStatus, eyeStatus = 'unknown', sittingSeconds = 60 }) {
  return requireDb().recordPostureSnapshot({ sessionId, postureStatus, eyeStatus, sittingSeconds })
}

/** Records a discrete bad-habit detection (e.g. nail biting). */
export function recordHabitEvent({ sessionId, habitType }) {
  return requireDb().recordHabitEvent({ sessionId, habitType })
}

/** Current gamification state: streaks, points, creature growth stage. */
export function getProfile() {
  return requireDb().getProfile()
}

/**
 * Per-day aggregates for the history screen, most recent first.
 * `from`/`to` are 'YYYY-MM-DD' strings; both default to the trailing 30 days.
 */
export function getDailySummaries({ from, to } = {}) {
  return requireDb().getDailySummaries({ from, to })
}
