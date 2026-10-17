const { DatabaseSync } = require('node:sqlite')
const { app } = require('electron')
const path = require('node:path')

const dbPath = path.join(app.getPath('userData'), 'posture-monitor.db')
const db = new DatabaseSync(dbPath)

db.exec(`
  create table if not exists profile (
    id integer primary key check (id = 1),
    creature_stage integer not null default 0,
    points integer not null default 0,
    current_streak integer not null default 0,
    longest_streak integer not null default 0,
    last_active_date text
  );

  insert into profile (id) values (1)
    on conflict (id) do nothing;

  create table if not exists sessions (
    id integer primary key autoincrement,
    started_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ended_at text
  );

  create table if not exists posture_snapshots (
    id integer primary key autoincrement,
    session_id integer not null references sessions (id),
    captured_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    posture_status text not null check (posture_status in ('good', 'slouching', 'leaning', 'unknown')),
    eye_status text not null default 'unknown' check (eye_status in ('focused', 'distracted', 'away', 'unknown')),
    sitting_seconds integer not null default 60
  );

  create table if not exists habit_events (
    id integer primary key autoincrement,
    session_id integer not null references sessions (id),
    habit_type text not null check (habit_type in ('nail_biting', 'hair_pulling', 'other')),
    detected_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  create table if not exists daily_summaries (
    day text primary key,
    total_sitting_seconds integer not null default 0,
    good_posture_seconds integer not null default 0,
    bad_posture_seconds integer not null default 0,
    habit_event_count integer not null default 0,
    streak_maintained integer not null default 0
  );
`)

function todayLocal() {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}

// A day counts toward the streak once at least 10 minutes were monitored
// and at least 60% of that time was good posture. Tune this threshold as
// the gamification design settles.
function recomputeStreak(day) {
  const summary = db
    .prepare('select total_sitting_seconds, good_posture_seconds from daily_summaries where day = ?')
    .get(day)
  if (!summary) return

  const maintained =
    summary.total_sitting_seconds >= 600 &&
    summary.good_posture_seconds / summary.total_sitting_seconds >= 0.6

  db.prepare('update daily_summaries set streak_maintained = ? where day = ?').run(
    maintained ? 1 : 0,
    day,
  )

  const profile = db.prepare('select * from profile where id = 1').get()

  // Credit a day exactly once: last_active_date only moves to `day` the
  // first time it's maintained, so later snapshots on the same day are a
  // no-op here instead of re-awarding points.
  if (maintained && profile.last_active_date !== day) {
    const nextStreak = profile.last_active_date === yesterday(day) ? profile.current_streak + 1 : 1

    db.prepare(
      `update profile set
         current_streak = ?,
         longest_streak = max(longest_streak, ?),
         last_active_date = ?,
         points = points + 10
       where id = 1`,
    ).run(nextStreak, nextStreak, day)
  } else if (!maintained && profile.last_active_date && profile.last_active_date < day) {
    db.prepare('update profile set current_streak = 0 where id = 1').run()
  }
}

function shiftDay(day, delta) {
  const d = new Date(`${day}T00:00:00`)
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

function yesterday(day) {
  return shiftDay(day, -1)
}

function startSession() {
  const { lastInsertRowid } = db.prepare('insert into sessions default values').run()
  return db.prepare('select * from sessions where id = ?').get(lastInsertRowid)
}

function endSession(sessionId) {
  db.prepare("update sessions set ended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?").run(
    sessionId,
  )
}

function recordPostureSnapshot({ sessionId, postureStatus, eyeStatus = 'unknown', sittingSeconds = 60 }) {
  db.prepare(
    'insert into posture_snapshots (session_id, posture_status, eye_status, sitting_seconds) values (?, ?, ?, ?)',
  ).run(sessionId, postureStatus, eyeStatus, sittingSeconds)

  const day = todayLocal()
  const goodSeconds = postureStatus === 'good' ? sittingSeconds : 0
  const badSeconds = postureStatus === 'good' ? 0 : sittingSeconds

  db.prepare(
    `insert into daily_summaries (day, total_sitting_seconds, good_posture_seconds, bad_posture_seconds)
     values (?, ?, ?, ?)
     on conflict (day) do update set
       total_sitting_seconds = total_sitting_seconds + excluded.total_sitting_seconds,
       good_posture_seconds = good_posture_seconds + excluded.good_posture_seconds,
       bad_posture_seconds = bad_posture_seconds + excluded.bad_posture_seconds`,
  ).run(day, sittingSeconds, goodSeconds, badSeconds)

  recomputeStreak(day)
}

function recordHabitEvent({ sessionId, habitType }) {
  db.prepare('insert into habit_events (session_id, habit_type) values (?, ?)').run(sessionId, habitType)

  const day = todayLocal()
  db.prepare(
    `insert into daily_summaries (day, habit_event_count)
     values (?, 1)
     on conflict (day) do update set habit_event_count = habit_event_count + 1`,
  ).run(day)
}

function getProfile() {
  return db.prepare('select * from profile where id = 1').get()
}

function getDailySummaries({ from, to } = {}) {
  const toDate = to ?? todayLocal()
  const fromDate = from ?? shiftDay(toDate, -30)
  return db
    .prepare('select * from daily_summaries where day >= ? and day <= ? order by day desc')
    .all(fromDate, toDate)
}

module.exports = {
  startSession,
  endSession,
  recordPostureSnapshot,
  recordHabitEvent,
  getProfile,
  getDailySummaries,
}
