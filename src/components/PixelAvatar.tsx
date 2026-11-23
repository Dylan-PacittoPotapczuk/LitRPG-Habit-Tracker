import { classDef } from '../lib/classes'
import { WEARABLES } from '../lib/wearables'
import type { EquippedLoadout, HeroClass } from '../lib/types'

const W = 16
const H = 24
const SCALE = 8

type Layer = 'cape' | 'body' | 'chest' | 'weapon' | 'accessory' | 'head'

interface Pix {
  x: number
  y: number
  c: string
  layer: Layer
}

function px(list: Pix[], x: number, y: number, c: string, layer: Layer) {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  list.push({ x, y, c, layer })
}

function fillRect(
  list: Pix[],
  x0: number,
  y0: number,
  w: number,
  h: number,
  c: string,
  layer: Layer,
) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) px(list, x, y, c, layer)
  }
}

function buildPixels(
  heroClass: HeroClass | null,
  equipped: EquippedLoadout,
  damaged: boolean,
): Pix[] {
  const pixels: Pix[] = []
  const cls = classDef(heroClass)
  const skin = cls?.palette.skin ?? '#c68642'
  const hair = cls?.palette.hair ?? '#3a2415'
  const tunic = cls?.palette.tunic ?? '#6b5a4a'
  const accent = cls?.palette.accent ?? '#d4894a'

  const chest = equipped.chest ? WEARABLES[equipped.chest] : null
  const cape = equipped.cape ? WEARABLES[equipped.cape] : null
  const weapon = equipped.weapon ? WEARABLES[equipped.weapon] : null
  const accessory = equipped.accessory ? WEARABLES[equipped.accessory] : null

  // Cape (behind)
  if (cape) {
    fillRect(pixels, 3, 10, 2, 10, cape.colors.primary, 'cape')
    fillRect(pixels, 11, 10, 2, 10, cape.colors.primary, 'cape')
    fillRect(pixels, 2, 12, 1, 8, cape.colors.secondary, 'cape')
    fillRect(pixels, 13, 12, 1, 8, cape.colors.secondary, 'cape')
    if (cape.colors.highlight) {
      px(pixels, 4, 11, cape.colors.highlight, 'cape')
      px(pixels, 11, 11, cape.colors.highlight, 'cape')
    }
  }

  // Legs / boots base
  fillRect(pixels, 5, 18, 2, 5, '#2a2218', 'body')
  fillRect(pixels, 9, 18, 2, 5, '#2a2218', 'body')
  if (accessory?.id === 'verdant-boots') {
    fillRect(pixels, 5, 20, 2, 3, accessory.colors.primary, 'accessory')
    fillRect(pixels, 9, 20, 2, 3, accessory.colors.primary, 'accessory')
    px(pixels, 5, 20, accessory.colors.highlight ?? accessory.colors.secondary, 'accessory')
    px(pixels, 9, 20, accessory.colors.highlight ?? accessory.colors.secondary, 'accessory')
  } else {
    fillRect(pixels, 5, 21, 2, 2, '#1a1410', 'body')
    fillRect(pixels, 9, 21, 2, 2, '#1a1410', 'body')
  }

  // Torso base (class tunic under armor)
  fillRect(pixels, 5, 10, 6, 8, tunic, 'body')
  fillRect(pixels, 4, 11, 1, 5, tunic, 'body')
  fillRect(pixels, 11, 11, 1, 5, tunic, 'body')

  // Chest armor overlay
  const chestPrimary = chest?.colors.primary ?? tunic
  const chestSecondary = chest?.colors.secondary ?? accent
  if (chest) {
    fillRect(pixels, 5, 10, 6, 7, chestPrimary, 'chest')
    fillRect(pixels, 6, 11, 4, 1, chest.colors.highlight ?? chestSecondary, 'chest')
    // Belt
    fillRect(pixels, 5, 16, 6, 1, chestSecondary, 'chest')
    px(pixels, 7, 16, chest.colors.highlight ?? accent, 'chest')
    px(pixels, 8, 16, chest.colors.highlight ?? accent, 'chest')
    if (chest.id === 'iron-mail' || chest.id === 'ember-plate') {
      // Shoulder pads
      fillRect(pixels, 4, 10, 2, 2, chestSecondary, 'chest')
      fillRect(pixels, 10, 10, 2, 2, chestSecondary, 'chest')
    }
  }

  // Arms
  fillRect(pixels, 3, 11, 2, 5, skin, 'body')
  fillRect(pixels, 11, 11, 2, 5, skin, 'body')
  if (accessory?.id === 'rune-bracers' || accessory?.id === 'copper-ring') {
    const c = accessory.colors.primary
    fillRect(pixels, 3, 14, 2, 2, c, 'accessory')
    fillRect(pixels, 11, 14, 2, 2, c, 'accessory')
    if (accessory.colors.highlight) {
      px(pixels, 3, 14, accessory.colors.highlight, 'accessory')
      px(pixels, 12, 14, accessory.colors.highlight, 'accessory')
    }
  }

  // Head
  fillRect(pixels, 5, 3, 6, 6, skin, 'head')
  // Hair by class silhouette
  fillRect(pixels, 5, 2, 6, 2, hair, 'head')
  if (heroClass === 'mage') {
    // Pointy hood hint
    fillRect(pixels, 6, 0, 4, 2, cls?.palette.tunic ?? '#3d4a8b', 'head')
    px(pixels, 7, 0, accent, 'head')
    px(pixels, 8, 0, accent, 'head')
  } else if (heroClass === 'rogue') {
    fillRect(pixels, 4, 3, 2, 2, hair, 'head')
    fillRect(pixels, 10, 3, 2, 2, hair, 'head')
    // Mask band
    fillRect(pixels, 5, 5, 6, 1, '#1a1218', 'head')
  } else if (heroClass === 'ranger') {
    fillRect(pixels, 4, 2, 1, 3, hair, 'head')
    fillRect(pixels, 11, 2, 1, 3, hair, 'head')
  } else {
    // warrior short crop
    fillRect(pixels, 4, 3, 1, 2, hair, 'head')
    fillRect(pixels, 11, 3, 1, 2, hair, 'head')
  }

  // Eyes
  px(pixels, 6, 5, '#1a1210', 'head')
  px(pixels, 9, 5, '#1a1210', 'head')

  // Mouth
  px(pixels, 7, 7, '#8b5a3a', 'head')
  px(pixels, 8, 7, '#8b5a3a', 'head')

  // Crown accessory
  if (accessory?.id === 'crown-of-dawn') {
    fillRect(pixels, 5, 1, 6, 1, accessory.colors.primary, 'accessory')
    px(pixels, 5, 0, accessory.colors.highlight ?? accessory.colors.primary, 'accessory')
    px(pixels, 7, 0, accessory.colors.highlight ?? accessory.colors.primary, 'accessory')
    px(pixels, 8, 0, accessory.colors.highlight ?? accessory.colors.primary, 'accessory')
    px(pixels, 10, 0, accessory.colors.highlight ?? accessory.colors.primary, 'accessory')
  }

  // Weapon
  if (weapon) {
    if (weapon.id === 'lantern-staff') {
      fillRect(pixels, 13, 6, 1, 12, weapon.colors.primary, 'weapon')
      fillRect(pixels, 12, 5, 3, 2, weapon.colors.secondary, 'weapon')
      px(pixels, 13, 5, weapon.colors.highlight ?? '#ffe6a0', 'weapon')
    } else if (weapon.id === 'hunter-bow') {
      for (let i = 0; i < 8; i++) {
        px(pixels, 13, 6 + i, weapon.colors.primary, 'weapon')
        px(pixels, 14, 7 + i, weapon.colors.secondary, 'weapon')
      }
      px(pixels, 12, 9, weapon.colors.highlight ?? '#8b6a3a', 'weapon')
      px(pixels, 12, 10, weapon.colors.highlight ?? '#8b6a3a', 'weapon')
    } else {
      // blade
      fillRect(pixels, 13, 4, 1, 8, weapon.colors.primary, 'weapon')
      fillRect(pixels, 12, 11, 3, 1, weapon.colors.secondary, 'weapon')
      fillRect(pixels, 13, 12, 1, 3, weapon.colors.secondary, 'weapon')
      if (weapon.colors.highlight) {
        px(pixels, 13, 5, weapon.colors.highlight, 'weapon')
        px(pixels, 13, 6, weapon.colors.highlight, 'weapon')
      }
    }
  }

  if (damaged) {
    return pixels.map((p) => ({
      ...p,
      c: tintDamaged(p.c),
    }))
  }
  return pixels
}

function tintDamaged(hex: string): string {
  // Pull toward dusty maroon without losing silhouette
  const n = hex.replace('#', '')
  if (n.length !== 6) return hex
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  const nr = Math.min(255, Math.round(r * 0.75 + 40))
  const ng = Math.min(255, Math.round(g * 0.55))
  const nb = Math.min(255, Math.round(b * 0.55))
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
}

const LAYER_Z: Record<Layer, number> = {
  cape: 0,
  body: 1,
  chest: 2,
  head: 3,
  accessory: 4,
  weapon: 5,
}

export function PixelAvatar({
  heroClass,
  equipped,
  damaged = false,
  large = false,
  className,
}: {
  heroClass: HeroClass | null
  equipped: EquippedLoadout
  damaged?: boolean
  large?: boolean
  className?: string
}) {
  const pixels = buildPixels(heroClass, equipped, damaged)
  // Later layers overwrite earlier at same coords by sort order
  const sorted = [...pixels].sort((a, b) => LAYER_Z[a.layer] - LAYER_Z[b.layer])
  const map = new Map<string, string>()
  for (const p of sorted) map.set(`${p.x},${p.y}`, p.c)

  const size = large ? W * SCALE : W * 4
  const height = large ? H * SCALE : H * 4
  const cell = large ? SCALE : 4

  return (
    <div
      className={`pixel-avatar ${large ? 'large' : 'compact'} ${damaged ? 'damaged' : ''} ${className ?? ''}`}
      style={{ width: size, height }}
      role="img"
      aria-label={heroClass ? `${heroClass} avatar` : 'Adventurer avatar'}
    >
      <div className="pixel-avatar-bob">
        <svg
          width={size}
          height={height}
          viewBox={`0 0 ${W * cell} ${H * cell}`}
          shapeRendering="crispEdges"
          aria-hidden
        >
          {[...map.entries()].map(([key, color]) => {
            const [x, y] = key.split(',').map(Number)
            return (
              <rect
                key={key}
                x={x * cell}
                y={y * cell}
                width={cell}
                height={cell}
                fill={color}
              />
            )
          })}
        </svg>
      </div>
    </div>
  )
}
