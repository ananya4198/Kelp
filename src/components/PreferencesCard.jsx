import { toast } from 'sonner'
import { requestDesktopPermission } from '../lib/desktopNotify'
import { setPreference, usePreferences } from '../lib/preferences'

const TOLERANCES = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'strict', label: 'Strict' },
]

function SlidersIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  )
}

function BellIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors ${
        checked ? 'border-teal-300 bg-teal-400/80' : 'border-white/20 bg-white/10'
      }`}
    >
      <span
        className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : ''
        }`}
      />
    </button>
  )
}

/** Dashboard card for desktop notifications and posture tolerance. */
export default function PreferencesCard() {
  const { desktopNotifications, postureTolerance } = usePreferences()

  async function handleNotificationsChange(on) {
    if (!on) {
      setPreference('desktopNotifications', false)
      return
    }
    if (await requestDesktopPermission()) {
      setPreference('desktopNotifications', true)
      new Notification('Notifications are on 🔔', {
        body: "We'll let you know about nail biting and slouching.",
        silent: true,
      })
    } else {
      toast.error('Desktop notifications are blocked. Allow them for this app in your system settings.')
    }
  }

  return (
    <div className="glass w-full max-w-xl p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-3 text-lg font-semibold text-white">
          <SlidersIcon className="h-5 w-5 text-teal-300" />
          Motion Sensor &amp; Notification Preferences
        </h2>
      </div>

      <div className="flex items-center justify-between gap-6">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <BellIcon className="h-4 w-4 text-teal-300" />
            Desktop Notifications
          </h3>
          <p className="mt-1 text-sm text-cyan-100/70">
            Receive subtle desktop banners when nail biting is detected or when slouching persists over 30
            seconds.
          </p>
        </div>
        <Toggle
          checked={desktopNotifications}
          onChange={handleNotificationsChange}
          label="Desktop notifications"
        />
      </div>

      <div className="my-5 border-t border-white/10" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <SlidersIcon className="h-4 w-4 text-teal-300" />
            Posture Tolerance Calibration
          </h3>
          <p className="mt-1 text-sm text-cyan-100/70">
            Adjusts tilt tolerance and forward head angle threshold. Set to Gentle if you frequently glance at
            desk notes.
          </p>
        </div>
        <div className="flex shrink-0 rounded-xl border border-white/15 bg-white/5 p-1" role="radiogroup" aria-label="Posture tolerance">
          {TOLERANCES.map((t) => {
            const selected = postureTolerance === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPreference('postureTolerance', t.id)}
                className={`rounded-lg px-4 py-1.5 font-medium transition-colors ${
                  selected ? 'bg-white/10 text-teal-300' : 'text-cyan-100/70 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
