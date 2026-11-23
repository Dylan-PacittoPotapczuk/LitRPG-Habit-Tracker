import { AvatarPortrait } from '../components/AvatarPortrait'
import { levelFromXp, progressInLevel } from '../lib/game'
import { BADGES, LOOT, type BadgeId, type LootId } from '../lib/types'
import { useStore } from '../lib/store'

export function HeroPage() {
  const { state, setEquipped } = useStore()
  const { player } = state
  const level = levelFromXp(player.xp)
  const prog = progressInLevel(player.xp)

  return (
    <>
      <section className="section" style={{ marginTop: 20 }}>
        <AvatarPortrait large />
        <div className="hero-meta">
          <h1>{player.title}</h1>
          <p>
            Level {level} · {prog.into}/{prog.need} XP to next · HP {player.hp}/{player.maxHp}
          </p>
          <p style={{ marginTop: 6 }}>
            Day streak <strong style={{ color: 'var(--gold)' }}>{player.dayStreak}</strong> · Longest{' '}
            {player.longestStreak}
          </p>
        </div>
      </section>

      <section className="section">
        <h2>Badges</h2>
        <p className="lede">Marks of steadfast adventuring.</p>
        <div className="badge-grid">
          {(Object.keys(BADGES) as BadgeId[]).map((id) => {
            const owned = player.badges.includes(id)
            const b = BADGES[id]
            return (
              <div key={id} className={`collectible ${owned ? '' : 'locked'}`}>
                <div className="glyph">{b.glyph}</div>
                <div className="name">{b.name}</div>
                <p className="blurb">{owned ? b.blurb : 'Locked'}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="section">
        <h2>Loot</h2>
        <p className="lede">Unlocks as you level. Tap to equip.</p>
        <div className="loot-grid">
          {(Object.keys(LOOT) as LootId[]).map((id) => {
            const owned = player.loot.includes(id)
            const item = LOOT[id]
            const equipped = player.equippedLoot === id
            return (
              <button
                key={id}
                type="button"
                className={`collectible ${owned ? '' : 'locked'} ${equipped ? 'equipped' : ''}`}
                disabled={!owned}
                onClick={() => setEquipped(equipped ? null : id)}
              >
                <div className="glyph">{item.glyph}</div>
                <div className="name">{item.name}</div>
                <p className="blurb">
                  {owned
                    ? `${item.blurb}${equipped ? ' · Equipped' : ' · Tap to equip'}`
                    : `Unlocks at level ${item.level}`}
                </p>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}
