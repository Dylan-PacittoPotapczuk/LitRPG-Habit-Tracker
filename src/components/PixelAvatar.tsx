import { useEffect, useRef } from 'react'
import { buildSprite, SPRITE_H, SPRITE_W } from '../lib/pixelSprite'
import type { EquippedLoadout, HeroClass, HeroRace } from '../lib/types'

export type AvatarSize = 'large' | 'card' | 'icon' | 'compact'

/** Crisp nearest-neighbor upscale from classic sheet buffer (48×64). */
const SIZE_SCALE: Record<AvatarSize, number> = {
  // ~384×512 presentation (sheet spirit, big on screen)
  large: 8,
  card: 3,
  icon: 2,
  compact: 1.5,
}

export function PixelAvatar({
  heroRace,
  heroClass,
  equipped,
  damaged = false,
  large = false,
  size,
  className,
}: {
  heroRace?: HeroRace | null
  heroClass: HeroClass | null
  equipped: EquippedLoadout
  damaged?: boolean
  /** @deprecated prefer size="large" */
  large?: boolean
  size?: AvatarSize
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resolved: AvatarSize = size ?? (large ? 'large' : 'compact')
  const scale = SIZE_SCALE[resolved]
  const displayW = Math.round(SPRITE_W * scale)
  const displayH = Math.round(SPRITE_H * scale)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // eslint-disable-next-line no-console
    console.info(
      `[PixelAvatar] sheet buffer ${SPRITE_W}×${SPRITE_H} → display ${displayW}×${displayH} (${resolved})`,
    )

    const rgba = buildSprite(heroRace ?? null, heroClass, equipped, damaged)
    const img = ctx.createImageData(SPRITE_W, SPRITE_H)
    img.data.set(rgba)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, SPRITE_W, SPRITE_H)
    ctx.putImageData(img, 0, 0)
  }, [heroRace, heroClass, equipped, damaged, displayW, displayH, resolved])

  const label = [heroRace, heroClass].filter(Boolean).join(' ') || 'Adventurer'

  return (
    <div
      className={`pixel-avatar ${resolved} ${damaged ? 'damaged' : ''} ${className ?? ''}`}
      style={{ width: displayW, height: displayH }}
      role="img"
      aria-label={`${label} avatar`}
      data-sprite-w={SPRITE_W}
      data-sprite-h={SPRITE_H}
    >
      <div className="pixel-avatar-bob">
        <canvas
          ref={canvasRef}
          width={SPRITE_W}
          height={SPRITE_H}
          style={{
            width: displayW,
            height: displayH,
            imageRendering: 'pixelated',
          }}
          aria-hidden
        />
      </div>
    </div>
  )
}

export { SPRITE_W, SPRITE_H }
