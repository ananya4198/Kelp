import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import Monitor from './components/Monitor'
import Bubbles from './components/Bubbles'
import StreakRow from './components/StreakRow'
import PreferencesCard from './components/PreferencesCard'
import GoodPostureChart from './components/GoodPostureChart'
import { getProfile, getTodaySummary, updateProfile } from './lib/db'
import { onStatsChanged } from './lib/statsBus'
import healthyPet from '../pet_imgs/healthy.png'
import sadPet from '../pet_imgs/sad.png'
import verySadPet from '../pet_imgs/verysad.png'
import KelpLogo from './components/KelpLogo'
/** Sea lion's mood worsens as bad habits pile up or standup alerts go unanswered. */
function petImageFor({ badHabits, standupGap }) {
  if (badHabits > 5 || standupGap > 5) return verySadPet
  if (badHabits > 2 || standupGap > 3) return sadPet
  return healthyPet
}

function StandAlert() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-cyan-800 to-slate-950 p-6 text-center text-white">
      <div className="text-5xl">🧘</div>
      <h1 className="text-xl font-bold">Time to stand up!</h1>
      <p className="text-cyan-100/80">You've been sitting a while — stretch your legs for a minute.</p>
      <button onClick={() => window.close()} className="btn-primary px-6 py-2">
        Got it
      </button>
    </div>
  )
}

const ROW_STYLES = {
  green: { label: 'bg-teal-300 text-teal-950', fill: 'bg-gradient-to-r from-teal-300 to-cyan-400' },
  red: { label: 'bg-rose-300 text-rose-950', fill: 'bg-gradient-to-r from-rose-400 to-orange-400' },
  yellow: { label: 'bg-amber-200 text-amber-950', fill: 'bg-gradient-to-r from-amber-200 to-yellow-400' },
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
      <div className="h-10 flex-1 overflow-hidden rounded-full border border-white/20 bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${styles.fill}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300'

function GoalsModal({ profile, onClose, onSaved }) {
  const [name, setName] = useState(profile.name)
  const [standGoal, setStandGoal] = useState(profile.stand_goal)
  const [badHabitLimit, setBadHabitLimit] = useState(profile.bad_habit_limit)
  const [streakGoal, setStreakGoal] = useState(profile.streak_goal)
  const [standReminderMinutes, setStandReminderMinutes] = useState(profile.stand_reminder_minutes ?? 100)
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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-900/90 p-6 shadow-2xl"
      >
        <h2 className="mb-4 text-lg font-semibold text-white">Set Goals</h2>

        <label className="mb-3 block text-sm font-medium text-cyan-100">
          Name
          <input className={INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="mb-3 block text-sm font-medium text-cyan-100">
          Remind me to stand after sitting for (minutes)
          <input
            type="number"
            min="1"
            max="240"
            className={INPUT_CLASS}
            value={standGoal}
            onChange={(e) => setStandGoal(e.target.value)}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost px-4 py-2">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary px-6 py-2">
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
    return <div className="flex h-full items-center justify-center p-6 text-center text-cyan-100">{error}</div>
  }

  if (!profile || !today) {
    return <div className="flex h-full items-center justify-center text-cyan-100/70">Loading…</div>
  }

  const standPercent = clampPercent(today.stand_count, profile.stand_goal)
  const badHabitPercent = clampPercent(today.habit_event_count, 20)
  const standupGap = today.expected_standups - today.performed_standups
  const petImage = petImageFor({ badHabits: today.habit_event_count, standupGap })

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 p-6">
      <div className="glass w-full max-w-xl p-8">
        <h1 className="mb-6 text-2xl font-semibold text-white">Hi, {profile.name}</h1>

        <div className="mb-6 flex justify-center">
          <img src={petImage} alt="Your sea lion" className="float h-96 w-96 object-contain" />
        </div>

        <div className="flex flex-col gap-6">
          <ProgressRow color="green" label="Good Habits Today" percent={standPercent} />
          <ProgressRow color="red" label="Bad Habits Today" percent={badHabitPercent} />
          <StreakRow streak={profile.current_streak} />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-lg font-bold text-white">
              Every {profile.stand_goal} {profile.stand_goal === 1 ? 'minute' : 'minutes'}
            </div>
            <div className="text-xs text-cyan-100/70">Standing Goal</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-lg font-bold text-white">{today.stand_count} today</div>
            <div className="text-xs text-cyan-100/70">Good Habits </div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-lg font-bold text-white">{today.habit_event_count} today</div>
            <div className="text-xs text-cyan-100/70">Bad Habit Alerts</div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button onClick={() => setGoalsOpen(true)} className="btn-primary px-6 py-2">
            Set Goals
          </button>
        </div>
      </div>

      <GoodPostureChart />

      <PreferencesCard />

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
    <div className="relative flex h-screen flex-col">
      <Bubbles />
      <Toaster position="top-right" theme="dark" richColors />

      <nav className="relative z-10 flex justify-center gap-2 border-b border-white/10 bg-slate-950/40 p-3 backdrop-blur">
        <KelpLogo className="absolute left-5 top-1/2 hidden -translate-y-1/2 sm:flex" />
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-5 py-2 font-medium transition-colors ${
              tab === t.id ? 'bg-cyan-300 text-slate-950' : 'text-cyan-100/80 hover:bg-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="relative z-10 flex-1 overflow-auto">
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