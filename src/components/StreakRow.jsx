import { useEffect, useState } from 'react'
import { getDailySummaries } from '../lib/db'
import { onStatsChanged } from '../lib/statsBus'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 'YYYY-MM-DD' in local time, matching how the database stores days. */
function localDay(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10)
}

/** The last 7 days, oldest first, ending with today. */
function lastSevenDays() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    days.push({ day: localDay(date), label: i === 0 ? 'Today' : WEEKDAYS[date.getDay()], isToday: i === 0 })
  }
  return days
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="m6 12.5 4 4 8-9" />
    </svg>
  )
}

/** Same layout as a ProgressRow, but the bar is replaced by one circle per day of the last week. */
export default function StreakRow({ streak }) {
  const [keptDays, setKeptDays] = useState(new Set())

  useEffect(() => {
    const refresh = () => {
      const days = lastSevenDays()
      getDailySummaries({ from: days[0].day, to: days[6].day })
        .then((rows) => setKeptDays(new Set(rows.filter((r) => r.streak_maintained).map((r) => r.day))))
        .catch((err) => console.error('Failed to load streak days', err))
    }
    refresh()
    return onStatsChanged(refresh)
  }, [])

  return (
    <div className="flex items-center gap-4">
      <span className="shrink-0 rounded-full bg-amber-200 px-5 py-2 font-medium text-amber-950">
        Streak {streak} 🔥
      </span>
      <div className="flex flex-1 justify-between gap-1">
        {lastSevenDays().map(({ day, label, isToday }) => {
          const kept = keptDays.has(day)
          let circle
          if (kept) circle = 'bg-gradient-to-br from-amber-200 to-yellow-400 text-amber-950'
          else if (isToday) circle = 'border-2 border-dashed border-amber-200/60'
          else circle = 'border border-white/20 bg-white/10'
          return (
            <div key={day} className="flex flex-col items-center gap-1">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${circle}`}>
                {kept && <CheckIcon />}
              </div>
              <span className={`text-xs ${isToday ? 'font-semibold text-white' : 'text-cyan-100/60'}`}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
