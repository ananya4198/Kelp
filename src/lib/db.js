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

export function getSession(sessionId) {
  return requireDb().getSession(sessionId)
}

/** Records one per-minute posture/eye-tracking sample. */
export function recordPostureSnapshot({ sessionId, postureStatus, eyeStatus = 'unknown', sittingSeconds = 60 }) {
  return requireDb().recordPostureSnapshot({ sessionId, postureStatus, eyeStatus, sittingSeconds })
}

/** Records a discrete bad-habit detection (e.g. nail biting). */
export function recordHabitEvent({ sessionId, habitType }) {
  return requireDb().recordHabitEvent({ sessionId, habitType })
}

/** Records one "stood up when notified" event for today. */
export function recordStandupFollowed() {
  return requireDb().recordStandupFollowed()
}

/** Called each time a stand alert popup is shown: how many standups the user should have performed. */
export function recordExpectedStandup(sessionId) {
  return requireDb().recordExpectedStandup(sessionId)
}

/** Called each time the vision model detects the user actually stood up/stepped away. */
export function recordPerformedStandup(sessionId) {
  return requireDb().recordPerformedStandup(sessionId)
}

/** Name, streak, points, creature growth stage, and goal targets. */
export function getProfile() {
  return requireDb().getProfile()
}

/** Partial update of name/goals; omitted fields are left unchanged. */
export function updateProfile({ name, standGoal, badHabitLimit, streakGoal } = {}) {
  return requireDb().updateProfile({ name, standGoal, badHabitLimit, streakGoal })
}

/**
 * Per-day aggregates for the history screen, most recent first.
 * `from`/`to` are 'YYYY-MM-DD' strings; both default to the trailing 30 days.
 */
export function getDailySummaries({ from, to } = {}) {
  return requireDb().getDailySummaries({ from, to })
}

/** Today's counters (stand count, bad habit count, etc.), zeroed if no events yet. */
export function getTodaySummary() {
  return requireDb().getTodaySummary()
}
