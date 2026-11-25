import { AvatarPortrait } from '../components/AvatarPortrait'
import { PixelAvatar } from '../components/PixelAvatar'
import { classDef } from '../lib/classes'
import { levelFromXp, progressInLevel } from '../lib/game'
import { raceDef } from '../lib/races'
import { BADGES, type BadgeId, type EquippedLoadout, type WearableId, type WearableSlot } from '../lib/types'
import { useStore } from '../lib/store'
import { SLOT_LABELS, SLOT_ORDER, unlockReason, WEARABLES, WEARABLE_IDS } from '../lib/wearables'

function armoryPreview(slot: WearableSlot, id: WearableId, base: EquippedLoadout): EquippedLoadout {
  return { ...base, [slot]: id }
}

export function HeroPage() {
  const { state, setEquipped } = useStore()
  const { player } = state
  const level = levelFromXp(player.xp)
  const prog = progressInLevel(player.xp)
  const cls = classDef(player.heroClass)
  const race = raceDef(player.heroRace)

  return (
    <>
      <section className="section" style={{ marginTop: 20 }}>
        <AvatarPortrait large />
        <div className="hero-meta">
          <h1>{player.title}</h1>
          <p>
            {race || cls ? (
              <>
                <span style={{ color: race?.skin.light ?? cls?.palette.accent }}>
                  {[race?.name, cls?.name].filter(Boolean).join(' ')}
                </span>
                {' · '}
              </>
            ) : null}
            Level {level} · {prog.into}/{prog.need} XP to next · HP {player.hp}/{player.maxHp}
          </p>
          <p style={{ marginTop: 6 }}>
            Day streak <strong style={{ color: 'var(--gold)' }}>{player.dayStreak}</strong> · Longest{' '}
            {player.longestStreak}
            {player.gearDamaged ? (
              <>
                {' · '}
                <span style={{ color: 'var(--blood)' }}>Gear scuffed</span>
              </>
            ) : null}
          </p>
          {cls ? (
            <p style={{ marginTop: 6, fontSize: '0.85rem' }}>Class bias: {cls.biasLabel}</p>
          ) : null}
        </div>
      </section>

      <section className="section">
        <h2>Armory</h2>
        <p className="lede">
          Layered wearables — tap to equip/unequip. Preview updates live on your hero.
        </p>
        {SLOT_ORDER.map((slot) => {
          const items = WEARABLE_IDS.map((id) => WEARABLES[id]).filter((w) => w.slot === slot)
          return (
            <div key={slot} className="armory-slot">
              <h3 className="armory-slot-title">{SLOT_LABELS[slot]}</h3>
              <div className="loot-grid">
                {items.map((item) => {
                  const owned = player.loot.includes(item.id)
                  const equipped = player.equipped[slot] === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`collectible ${owned ? '' : 'locked'} ${equipped ? 'equipped' : ''}`}
                      disabled={!owned}
                      onClick={() => setEquipped(equipped ? null : (item.id as WearableId), slot)}
                    >
                      <div className="armory-icon">
                        <PixelAvatar
                          heroRace={player.heroRace}
                          heroClass={player.heroClass}
                          equipped={armoryPreview(slot, item.id, player.equipped)}
                          size="icon"
                        />
                      </div>
                      <div className="name">{item.name}</div>
                      <p className="blurb">
                        {owned
                          ? `${item.blurb}${equipped ? ' · Equipped' : ' · Tap to equip'}`
                          : `Unlock: ${unlockReason(item)}`}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
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
    </>
  )
}
