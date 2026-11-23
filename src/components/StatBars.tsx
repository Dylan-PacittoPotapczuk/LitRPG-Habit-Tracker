import { progressInLevel } from '../lib/game'
import { useStore } from '../lib/store'

export function StatBars() {
  const { state } = useStore()
  const { player } = state
  const prog = progressInLevel(player.xp)

  return (
    <div className="stat-bars">
      <div className="bar-row">
        <div className="bar-label">
          <span>
            XP · Lv {prog.level}
          </span>
          <span>
            {prog.into}/{prog.need}
          </span>
        </div>
        <div className="bar-track" aria-hidden>
          <div className="bar-fill xp" style={{ width: `${prog.pct}%` }} />
        </div>
      </div>
      <div className="bar-row">
        <div className="bar-label">
          <span>HP</span>
          <span>
            {player.hp}/{player.maxHp}
          </span>
        </div>
        <div className="bar-track" aria-hidden>
          <div
            className="bar-fill hp"
            style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
          />
        </div>
      </div>
      <div className="pill-stat" style={{ width: 'fit-content' }}>
        Streak <strong>{player.dayStreak}d</strong>
        <span aria-hidden>·</span>
        Best <strong>{player.longestStreak}d</strong>
      </div>
    </div>
  )
}
