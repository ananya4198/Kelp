import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getDailySummaries, getHourlyGoodPosture } from '../lib/db'
import { onStatsChanged } from '../lib/statsBus'

const RANGES = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]

// Bar fill tuned for the dark card (checked for contrast); brighter teal on hover.
const BAR_COLOR = '#11a596'
const BAR_HOVER_COLOR = '#2dd4bf'
const TICK_STYLE = { fill: 'rgba(207, 250, 254, 0.6)', fontSize: 12 }
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** 'YYYY-MM-DD' in local time, matching how the database stores days. */
function localDay(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10)
}

function hourLabel(hour) {
  const suffix = hour < 12 ? 'a' : 'p'
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`
}

function formatMinutes(minutes) {
  const total = Math.round(minutes)
  if (total < 60) return `${total}m`
  return `${Math.floor(total / 60)}h ${total % 60}m`
}

/** The last `count` days, oldest first, ending with today. */
function lastDays(count) {
  const days = []
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    days.push(date)
  }
  return days
}

/** Loads the bars for a range as [{ label, tooltipLabel, minutes }]. */
async function loadBars(range) {
  if (range === 'day') {
    const rows = await getHourlyGoodPosture({ day: localDay(new Date()) })
    const byHour = new Map(rows.map((r) => [r.hour, r.good_posture_seconds]))
    return Array.from({ length: 24 }, (_, hour) => ({
      label: hourLabel(hour),
      tooltipLabel: `${hourLabel(hour)} – ${hourLabel((hour + 1) % 24)}`,
      minutes: (byHour.get(hour) ?? 0) / 60,
    }))
  }

  const dates = lastDays(range === 'week' ? 7 : 30)
  const rows = await getDailySummaries({ from: localDay(dates[0]), to: localDay(dates[dates.length - 1]) })
  const byDay = new Map(rows.map((r) => [r.day, r.good_posture_seconds]))
  return dates.map((date, i) => {
    const isToday = i === dates.length - 1
    const shortDate = `${MONTHS[date.getMonth()]} ${date.getDate()}`
    let label = shortDate
    if (isToday) label = 'Today'
    else if (range === 'week') label = WEEKDAYS[date.getDay()]
    return {
      label,
      tooltipLabel: isToday ? `Today, ${shortDate}` : `${WEEKDAYS[date.getDay()]}, ${shortDate}`,
      minutes: (byDay.get(localDay(date)) ?? 0) / 60,
    }
  })
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { tooltipLabel, minutes } = payload[0].payload
  return (
    <div className="rounded-xl border border-white/15 bg-slate-900/95 px-3 py-2 text-sm shadow-xl">
      <div className="text-cyan-100/70">{tooltipLabel}</div>
      <div className="font-semibold text-white">{formatMinutes(minutes)} good posture</div>
    </div>
  )
}

/** Dashboard card: minutes of good posture as bars, by hour / day. */
export default function GoodPostureChart() {
  const [range, setRange] = useState('week')
  const [bars, setBars] = useState([])
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      loadBars(range)
        .then((next) => {
          if (!cancelled) setBars(next)
        })
        .catch((err) => console.error('Failed to load posture history', err))
    }
    refresh()
    const unsubscribe = onStatsChanged(refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [range])

  const total = bars.reduce((sum, b) => sum + b.minutes, 0)
  const hasData = total > 0
  // Fewer x labels when there are many bars so they don't collide.
  const tickInterval = range === 'day' ? 2 : range === 'month' ? 4 : 0

  return (
    <div className="glass w-full max-w-xl p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white">Good Posture Minutes</h2>
          <p className="mt-1 text-sm text-cyan-100/70">
            {range === 'day' ? 'Minutes of good posture each hour today.' : 'Minutes of good posture each day.'}{' '}
            Total: <span className="font-semibold text-white">{formatMinutes(total)}</span>
          </p>
        </div>
        <div className="flex shrink-0 rounded-lg border border-white/15 bg-white/5 p-0.5" role="tablist" aria-label="Time range">
          {RANGES.map((r) => {
            const selected = range === r.id
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setRange(r.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selected ? 'bg-white/10 text-teal-300' : 'text-cyan-100/70 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative h-64" role="img" aria-label={`Good posture minutes by ${range === 'day' ? 'hour' : 'day'}, total ${formatMinutes(total)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap={range === 'week' ? '30%' : 2}>
            <CartesianGrid vertical={false} stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="4 4" />
            <XAxis
              dataKey="label"
              tick={TICK_STYLE}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
              interval={tickInterval}
            />
            <YAxis
              tick={TICK_STYLE}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tickFormatter={(v) => `${v}m`}
              width={44}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.06)' }} />
            <Bar
              dataKey="minutes"
              radius={[4, 4, 0, 0]}
              maxBarSize={44}
              isAnimationActive={false}
              onMouseEnter={(_, index) => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            >
              {bars.map((bar, index) => (
                <Cell key={bar.label + index} fill={index === hovered ? BAR_HOVER_COLOR : BAR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {!hasData && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-xl bg-slate-950/60 px-4 py-2 text-sm text-cyan-100/70">
              No good-posture minutes yet. Start a Live Session to fill this in!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
