import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import Monitor from './components/Monitor'
import { getProfile, getTodaySummary, updateProfile } from './lib/db'
import { onStatsChanged } from './lib/statsBus'
import healthyPet from '../pet_imgs/healthy.png'
import sadPet from '../pet_imgs/sad.png'
import verySadPet from '../pet_imgs/verysad.png'

/** Sea lion's mood worsens as bad habits pile up or standup alerts go unanswered. */
function petImageFor({ badHabits, standupGap }) {
  if (badHabits > 5 || standupGap > 5) return verySadPet
  if (badHabits > 2 || standupGap > 3) return sadPet
  return healthyPet
}

function StandAlert() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-amber-50 p-6 text-center">
      <div className="text-5xl">🧘</div>
      <h1 className="text-xl font-bold text-gray-800">Time to stand up!</h1>
      <p className="text-gray-600">You've been sitting a while — stretch your legs for a minute.</p>
      <button
        onClick={() => window.close()}
        className="rounded-full bg-blue-400 px-6 py-2 font-medium text-white hover:bg-blue-500"
      >
        Got it
      </button>
    </div>
  )
}

const ROW_STYLES = {
  green: { label: 'bg-green-400 text-green-950', fill: 'bg-green-500' },
  red: { label: 'bg-red-400 text-red-950', fill: 'bg-red-500' },
  yellow: { label: 'bg-yellow-200 text-yellow-900', fill: 'bg-yellow-300' },
}

function clampPercent(value, goal) {
  if (!goal) return 0
  return Math.max(0, Math.min(100, (value / goal) * 100))
}

function ProgressRow({ color, label, percent }) {
  const styles = ROW_STYLES[color]
  return (
    <div className="flex items-center gap-4">
      <span className={`shrink-0 rounded-full px-5 py-2 font-medium ${styles.label}`}>{label}</span>
      <div className="h-10 flex-1 overflow-hidden rounded-full border border-black/10 bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${styles.fill}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function GoalsModal({ profile, onClose, onSaved }) {
  const [name, setName] = useState(profile.name)
  const [standGoal, setStandGoal] = useState(profile.stand_goal)
  const [badHabitLimit, setBadHabitLimit] = useState(profile.bad_habit_limit)
  const [streakGoal, setStreakGoal] = useState(profile.streak_goal)
  const [standReminderMinutes, setStandReminderMinutes] = useState(profile.stand_reminder_minutes ?? 45)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    const updated = await updateProfile({
      name,
      standGoal: Number(standGoal),
      badHabitLimit: Number(badHabitLimit),
      streakGoal: Number(streakGoal),
      standReminderMinutes: Number(standReminderMinutes),
    })
    setSaving(false)
    onSaved(updated)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Set Goals</h2>

        <label className="mb-3 block text-sm font-medium text-gray-700">
          Name
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="mb-3 block text-sm font-medium text-gray-700">
          Daily standup goal
          <input
            type="number"
            min="1"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={standGoal}
            onChange={(e) => setStandGoal(e.target.value)}
          />
        </label>

        <label className="mb-3 block text-sm font-medium text-gray-700">
          Remind me to stand after sitting for (minutes)
          <input
            type="number"
            min="1"
            max="240"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={standReminderMinutes}
            onChange={(e) => setStandReminderMinutes(e.target.value)}
          />
        </label>

        <label className="mb-3 block text-sm font-medium text-gray-700">
          Bad habit limit (per day)
          <input
            type="number"
            min="1"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={badHabitLimit}
            onChange={(e) => setBadHabitLimit(e.target.value)}
          />
        </label>

        <label className="mb-5 block text-sm font-medium text-gray-700">
          Streak goal (days)
          <input
            type="number"
            min="1"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={streakGoal}
            onChange={(e) => setStreakGoal(e.target.value)}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-blue-400 px-6 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [today, setToday] = useState(null)
  const [error, setError] = useState(null)
  const [goalsOpen, setGoalsOpen] = useState(false)

  useEffect(() => {
    const refresh = () => {
      Promise.all([getProfile(), getTodaySummary()])
        .then(([profileResult, todayResult]) => {
          setProfile(profileResult)
          setToday(todayResult)
        })
        .catch((err) => setError(err.message))
    }

    refresh()
    return onStatsChanged(refresh)
  }, [])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-gray-600">{error}</div>
    )
  }

  if (!profile || !today) {
    return <div className="flex h-full items-center justify-center text-gray-500">Loading…</div>
  }

  const standPercent = clampPercent(today.stand_count, profile.stand_goal)
  const badHabitPercent = clampPercent(today.habit_event_count, profile.bad_habit_limit)
  const streakPercent = clampPercent(profile.current_streak, profile.streak_goal)
  const standupGap = today.expected_standups - today.performed_standups
  const petImage = petImageFor({ badHabits: today.habit_event_count, standupGap })

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-xl rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-gray-800">Hi, {profile.name}</h1>

        <div className="mb-6 flex justify-center">
          <img src={petImage} alt="Your sea lion" className="h-40 w-40 object-contain" />
        </div>

        <div className="flex flex-col gap-6">
          <ProgressRow color="green" label="Stand Progress" percent={standPercent} />
          <ProgressRow color="red" label="Bad Habits Today" percent={badHabitPercent} />
          <ProgressRow color="yellow" label={`Streak 🔥 ${profile.current_streak}`} percent={streakPercent} />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-gray-100 p-3">
            <div className="text-lg font-bold text-gray-800">{profile.stand_goal}/day</div>
            <div className="text-xs text-gray-500">Stand goal</div>
          </div>
          <div className="rounded-xl bg-gray-100 p-3">
            <div className="text-lg font-bold text-gray-800">{profile.bad_habit_limit}/day</div>
            <div className="text-xs text-gray-500">Bad habit limit</div>
          </div>
          <div className="rounded-xl bg-gray-100 p-3">
            <div className="text-lg font-bold text-gray-800">{profile.streak_goal} days</div>
            <div className="text-xs text-gray-500">Streak goal</div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setGoalsOpen(true)}
            className="rounded-full bg-blue-400 px-6 py-2 font-medium text-white hover:bg-blue-500"
          >
            Set Goals
          </button>
        </div>
      </div>

      {goalsOpen && (
        <GoalsModal
          profile={profile}
          onClose={() => setGoalsOpen(false)}
          onSaved={(updated) => {
            setProfile(updated)
            setGoalsOpen(false)
          }}
        />
      )}
    </div>
  )
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'session', label: 'Live Session' },
]

function App() {
  const [tab, setTab] = useState('dashboard')

  if (window.location.hash === '#stand-alert') {
    return <StandAlert />
  }

  return (
    <div className="flex h-screen flex-col">
      <Toaster position="top-right" />

      <nav className="flex justify-center gap-2 border-b border-black/10 bg-white p-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-5 py-2 font-medium transition-colors ${
              tab === t.id ? 'bg-blue-400 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="relative flex-1 overflow-auto">
        {tab === 'dashboard' && <Dashboard />}

        {/* Monitor stays mounted across tab switches (moved off-screen rather than
            unmounted) so the camera stream, detection loop, and session keep running
            in the background instead of stopping every time you leave this tab. */}
        <div className={tab === 'session' ? 'h-full' : 'fixed -top-[200vh] left-0 h-full w-full'}>
          <Monitor />
        </div>
      </main>
    </div>
  )
}

export default App
