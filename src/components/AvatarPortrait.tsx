import { avatarStage, levelFromXp } from '../lib/game'
import { LOOT } from '../lib/types'
import { useStore } from '../lib/store'

const STAGES = ['🌱', '🗡️', '🛡️', '🏹', '👑'] as const

export function AvatarPortrait({ large = false }: { large?: boolean }) {
  const { state } = useStore()
  const stage = avatarStage(levelFromXp(state.player.xp))
  const glyph = STAGES[stage - 1]
  const loot = state.player.equippedLoot ? LOOT[state.player.equippedLoot] : null

  return (
    <div className="avatar-stage" style={large ? undefined : { width: 120, margin: 0 }}>
      <div className="avatar-ring" aria-hidden />
      <div className="avatar-figure" aria-hidden>
        {glyph}
      </div>
      {loot ? (
        <div
          style={{
            position: 'absolute',
            bottom: 18,
            fontSize: large ? '1.6rem' : '1.1rem',
          }}
          title={loot.name}
        >
          {loot.glyph}
        </div>
      ) : null}
    </div>
  )
}
