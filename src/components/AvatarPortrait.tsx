import { useStore } from '../lib/store'
import { PixelAvatar } from './PixelAvatar'

export function AvatarPortrait({ large = false }: { large?: boolean }) {
  const { state } = useStore()
  const { player } = state

  return (
    <div className={`avatar-stage ${large ? '' : 'compact'}`}>
      <div className="avatar-ring" aria-hidden />
      <PixelAvatar
        heroRace={player.heroRace}
        heroClass={player.heroClass}
        equipped={player.equipped}
        damaged={player.gearDamaged}
        size={large ? 'large' : 'compact'}
      />
      {player.gearDamaged ? (
        <span className="avatar-damage-tag" title="Heal to full HP to mend gear">
          Scuffed
        </span>
      ) : null}
    </div>
  )
}
