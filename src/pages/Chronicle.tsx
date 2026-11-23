import { formatPretty, lastNDays, weekKeys } from '../lib/date'
import { completionPct } from '../lib/game'
import { VIBES, type VibeId } from '../lib/types'
import { useStore } from '../lib/store'

const VIBE_SCORE: Record<VibeId, number> = {
  weary: 1,
  'meh-dragon': 2,
  chaotic: 3,
  radiant: 4,
  fire: 5,
}

function LineChart({
  values,
  labels,
  color,
  max,
}: {
  values: number[]
  labels: string[]
  color: string
  max: number
}) {
  const w = 320
  const h = 140
  const pad = 12
  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1)
    const y = h - pad - ((v / Math.max(max, 1)) * (h - pad * 2))
    return `${x},${y}`
  })
  const poly = pts.join(' ')

  return (
    <div className="chart">
      <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Chart">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={poly}
        />
        {values.map((_, i) => {
          const [x, y] = pts[i].split(',').map(Number)
          return <circle key={i} cx={x} cy={y} r="3.5" fill={color} />
        })}
      </svg>
      <div className="chart-legend">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  )
}

export function ChroniclePage() {
  const { state, today, seedDemoHistory } = useStore()
  const days = lastNDays(today, 14)
  const week = weekKeys(today)

  const completion = days.map((d) => completionPct(state.days[d]))
  const mood = days.map((d) => {
    const v = state.days[d]?.vibe
    return v ? VIBE_SCORE[v] : 0
  })
  const xp = days.map((d) => state.days[d]?.xpEarned ?? 0)

  const weekDone = week.reduce((acc, d) => acc + completionPct(state.days[d]), 0)
  const weekAvg = Math.round(weekDone / week.length)
  const weekXp = week.reduce((acc, d) => acc + (state.days[d]?.xpEarned ?? 0), 0)
  const vibesLogged = week.filter((d) => state.days[d]?.vibe).length
  const fullClears = week.filter((d) => state.days[d]?.fullClear).length
  const topVibe = (() => {
    const counts: Partial<Record<VibeId, number>> = {}
    week.forEach((d) => {
      const v = state.days[d]?.vibe
      if (v) counts[v] = (counts[v] ?? 0) + 1
    })
    const sorted = (Object.entries(counts) as [VibeId, number][]).sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0]
  })()

  const hasHistory = Object.keys(state.days).length > 1

  return (
    <>
      <section className="section" style={{ marginTop: 20 }}>
        <h2>Chronicle</h2>
        <p className="lede">Charts of the last fortnight — no heatmaps, just the tale.</p>
        {!hasHistory ? (
          <button type="button" className="btn btn-ghost" onClick={seedDemoHistory}>
            Seed sample history
          </button>
        ) : null}
      </section>

      <section className="section">
        <h2>Completion %</h2>
        <p className="lede">Share of the ten habits cleared each day.</p>
        <LineChart
          values={completion}
          labels={[formatPretty(days[0]), formatPretty(days[days.length - 1])]}
          color="var(--moss-bright)"
          max={100}
        />
      </section>

      <section className="section">
        <h2>Mood over time</h2>
        <p className="lede">Vibe intensity (weary → fire). Empty days sit at zero.</p>
        <LineChart
          values={mood}
          labels={[formatPretty(days[0]), formatPretty(days[days.length - 1])]}
          color="var(--copper-bright)"
          max={5}
        />
      </section>

      <section className="section">
        <h2>XP earned</h2>
        <p className="lede">Daily XP collected from quests (penalties not shown).</p>
        <LineChart
          values={xp}
          labels={[formatPretty(days[0]), formatPretty(days[days.length - 1])]}
          color="var(--gold)"
          max={Math.max(40, ...xp)}
        />
      </section>

      <section className="section">
        <h2>Weekly summary</h2>
        <p className="lede">
          {formatPretty(week[0])} → {formatPretty(week[6])}
        </p>
        <div className="summary-block">
          <p>
            Average completion <strong>{weekAvg}%</strong> across the week.
          </p>
          <p>
            XP gathered <strong>{weekXp}</strong>
            {fullClears ? (
              <>
                {' '}
                · Full clears <strong>{fullClears}</strong>
              </>
            ) : null}
          </p>
          <p>
            Vibes logged <strong>{vibesLogged}/7</strong>
            {topVibe ? (
              <>
                {' '}
                · Dominant mood{' '}
                <strong>
                  {VIBES.find((v) => v.id === topVibe)?.emoji}{' '}
                  {VIBES.find((v) => v.id === topVibe)?.label}
                </strong>
              </>
            ) : null}
          </p>
          <p>
            {weekAvg >= 70
              ? 'The path is bright — keep the ember alive.'
              : weekAvg >= 40
                ? 'A mixed chapter. Tomorrow’s quests still wait.'
                : 'A quiet week in the woods. One habit is enough to restart the streak.'}
          </p>
        </div>
      </section>
    </>
  )
}
