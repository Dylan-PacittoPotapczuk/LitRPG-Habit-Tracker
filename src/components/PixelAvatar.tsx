import { useEffect, useRef } from 'react'
import { buildSprite, SPRITE_H, SPRITE_W } from '../lib/pixelSprite'
import type { EquippedLoadout, HeroClass, HeroRace } from '../lib/types'

export type AvatarSize = 'large' | 'card' | 'icon' | 'compact'

/** Display scales — always from the same SPRITE_W×SPRITE_H dense buffer (never a tiny stamp). */
const SIZE_SCALE: Record<AvatarSize, number> = {
  // Native 320×500 — middle of the 320–640px tall band
  large: 1,
  // Class / race cards — still readable eyes & rivets
  card: 0.42,
  // Armory slot icons
  icon: 0.28,
  // Today nav chip
  compact: 0.22,
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

    // Prove native buffer is dense (not a 32×48 stamp upscaled).
    // eslint-disable-next-line no-console
    console.info(`[PixelAvatar] native buffer ${SPRITE_W}×${SPRITE_H} → display ${displayW}×${displayH} (${resolved})`)

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
