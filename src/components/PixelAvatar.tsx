import { useEffect, useRef } from 'react'
import { classDef } from '../lib/classes'
import { raceDef } from '../lib/races'
import { WEARABLES } from '../lib/wearables'
import type { EquippedLoadout, HeroClass, HeroRace, WearableId } from '../lib/types'

/**
 * Classic r/DnD “100 pixel characters” density:
 * ~32×48 body in a 40×56 canvas, nearest-neighbor upscaled.
 */
const W = 40
const H = 56

type Layer = 'ground' | 'cape' | 'body' | 'chest' | 'head' | 'accessory' | 'weapon' | 'outline'

const Z: Record<Layer, number> = {
  ground: 0,
  cape: 1,
  body: 2,
  chest: 3,
  head: 4,
  accessory: 5,
  weapon: 6,
  outline: 7,
}

const OUTLINE = '#1a1210'
const GROUND = '#5a4030'
const GROUND_HI = '#7a5a40'

interface Pix {
  x: number
  y: number
  c: string
  z: number
}

function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace('#', '')
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  const t = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)))
  return `#${t(r).toString(16).padStart(2, '0')}${t(g).toString(16).padStart(2, '0')}${t(b).toString(16).padStart(2, '0')}`
}

function damagedTint(hex: string): string {
  if (hex === OUTLINE) return hex
  const [r, g, b] = hexToRgb(hex)
  const nr = Math.min(255, Math.round(r * 0.72 + 35))
  const ng = Math.min(255, Math.round(g * 0.55))
  const nb = Math.min(255, Math.round(b * 0.55))
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
}

class Buf {
  map = new Map<string, Pix>()
  put(x: number, y: number, c: string, layer: Layer) {
    if (x < 0 || y < 0 || x >= W || y >= H || !c) return
    const key = `${x},${y}`
    const prev = this.map.get(key)
    const z = Z[layer]
    if (prev && prev.z > z) return
    this.map.set(key, { x, y, c, z })
  }
  rect(x0: number, y0: number, w: number, h: number, c: string, layer: Layer) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.put(x, y, c, layer)
  }
  /** Stamp a row-string sprite (`.` = empty). */
  stamp(x0: number, y0: number, rows: string[], palette: Record<string, string>, layer: Layer) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y]
      for (let x = 0; x < row.length; x++) {
        const ch = row[x]
        if (ch === '.' || ch === ' ') continue
        const c = palette[ch]
        if (c) this.put(x0 + x, y0 + y, c, layer)
      }
    }
  }
  /** 1px dark outline around any filled pixels (sheet-style). */
  outlinePass() {
    const filled = [...this.map.values()].filter((p) => p.z !== Z.outline && p.z !== Z.ground)
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    for (const p of filled) {
      for (const [dx, dy] of dirs) {
        const nx = p.x + dx
        const ny = p.y + dy
        const key = `${nx},${ny}`
        if (!this.map.has(key)) this.put(nx, ny, OUTLINE, 'outline')
      }
    }
  }
  pixels(): Pix[] {
    return [...this.map.values()]
  }
}

/** Race layout offsets inside the 40×56 canvas. */
function raceLayout(race: HeroRace | null) {
  // Foot baseline near bottom; dwarf shorter; elf taller/slimmer; orc broader
  switch (race) {
    case 'dwarf':
      return { cx: 20, headY: 14, headW: 8, headH: 7, torsoW: 12, torsoH: 12, legH: 10, armW: 3, build: 1.15 }
    case 'elf':
      return { cx: 20, headY: 6, headW: 7, headH: 8, torsoW: 8, torsoH: 14, legH: 16, armW: 2, build: 0.9 }
    case 'orc':
      return { cx: 20, headY: 7, headW: 9, headH: 8, torsoW: 12, torsoH: 14, legH: 14, armW: 3, build: 1.12 }
    default:
      return { cx: 20, headY: 8, headW: 8, headH: 8, torsoW: 10, torsoH: 13, legH: 14, armW: 3, build: 1 }
  }
}

function buildSprite(
  heroRace: HeroRace | null,
  heroClass: HeroClass | null,
  equipped: EquippedLoadout,
  damaged: boolean,
): Pix[] {
  const buf = new Buf()
  const race = raceDef(heroRace) ?? raceDef('human')!
  const cls = classDef(heroClass)
  const L = raceLayout(heroRace)
  const skin = race.skin.mid
  const skinHi = race.skin.light
  const skinSh = race.skin.shade
  const hair = heroClass === 'mage' && heroRace !== 'elf' ? '#2a2a4a' : race.hair.mid
  const hairHi = heroClass === 'mage' && heroRace !== 'elf' ? '#5a5a7a' : race.hair.light
  const hairSh = race.hair.shade
  const tunic = cls?.palette.tunic ?? '#6b5a4a'
  const accent = cls?.palette.accent ?? '#d4894a'
  const pant = shade(tunic, -40)
  const boot = '#2a2218'

  const chest = equipped.chest ? WEARABLES[equipped.chest] : null
  const cape = equipped.cape ? WEARABLES[equipped.cape] : null
  const weapon = equipped.weapon ? WEARABLES[equipped.weapon] : null
  const accessory = equipped.accessory ? WEARABLES[equipped.accessory] : null

  const hx = L.cx - Math.floor(L.headW / 2)
  const hy = L.headY
  const tx = L.cx - Math.floor(L.torsoW / 2)
  const ty = hy + L.headH + 1
  const hipY = ty + L.torsoH
  const footY = hipY + L.legH
  const legW = Math.max(3, Math.round(L.torsoW / 2) - 1)
  const leftLeg = L.cx - legW - 1
  const rightLeg = L.cx + 1

  // Ground disk (sheet-style)
  buf.rect(L.cx - 7, footY + 1, 14, 2, GROUND, 'ground')
  buf.rect(L.cx - 5, footY + 3, 10, 1, GROUND_HI, 'ground')

  // ——— CAPE ———
  if (cape) {
    const p = cape.colors.primary
    const s = cape.colors.secondary
    const h = cape.colors.highlight ?? shade(p, 30)
    // Sheet-style panels behind shoulders
    buf.rect(tx - 3, ty + 1, 3, L.torsoH + 6, p, 'cape')
    buf.rect(tx + L.torsoW, ty + 1, 3, L.torsoH + 6, p, 'cape')
    buf.rect(tx - 4, ty + 4, 1, L.torsoH + 2, s, 'cape')
    buf.rect(tx + L.torsoW + 3, ty + 4, 1, L.torsoH + 2, s, 'cape')
    buf.put(tx - 2, ty + 2, h, 'cape')
    buf.put(tx + L.torsoW + 1, ty + 2, h, 'cape')
    // Collar
    buf.rect(tx - 1, ty, L.torsoW + 2, 2, p, 'cape')
  }

  // ——— LEGS ———
  buf.rect(leftLeg, hipY - 1, legW, L.legH, pant, 'body')
  buf.rect(rightLeg, hipY - 1, legW, L.legH, pant, 'body')
  buf.rect(leftLeg, hipY - 1, 1, L.legH, shade(pant, -25), 'body')
  buf.rect(rightLeg + legW - 1, hipY - 1, 1, L.legH, shade(pant, -25), 'body')

  // Boots / verdant
  const bootH = 4
  if (accessory?.id === 'verdant-boots') {
    const bp = accessory.colors.primary
    const bh = accessory.colors.highlight ?? shade(bp, 25)
    buf.rect(leftLeg - 1, footY - bootH, legW + 1, bootH, bp, 'accessory')
    buf.rect(rightLeg, footY - bootH, legW + 1, bootH, bp, 'accessory')
    buf.put(leftLeg, footY - bootH + 1, bh, 'accessory')
    buf.put(rightLeg + 1, footY - bootH + 1, bh, 'accessory')
  } else {
    buf.rect(leftLeg - 1, footY - bootH, legW + 1, bootH, boot, 'body')
    buf.rect(rightLeg, footY - bootH, legW + 1, bootH, boot, 'body')
    buf.rect(leftLeg - 1, footY - 1, legW + 2, 1, shade(boot, -20), 'body')
    buf.rect(rightLeg, footY - 1, legW + 2, 1, shade(boot, -20), 'body')
  }

  // ——— TORSO undershirt ———
  buf.rect(tx, ty, L.torsoW, L.torsoH, tunic, 'body')
  buf.rect(tx, ty, 1, L.torsoH, shade(tunic, -35), 'body')
  buf.rect(tx + L.torsoW - 1, ty, 1, L.torsoH, shade(tunic, -20), 'body')
  buf.put(tx + 2, ty + 2, shade(tunic, 25), 'body')

  // ——— CHEST ARMOR ———
  if (chest) drawChest(buf, chest.id, tx, ty, L.torsoW, L.torsoH, chest.colors, accent)

  // ——— ARMS ———
  const armX0 = tx - L.armW - 1
  const armX1 = tx + L.torsoW + 1
  const armLen = Math.max(8, L.torsoH - 1)
  buf.rect(armX0, ty + 1, L.armW, armLen, skin, 'body')
  buf.rect(armX1, ty + 1, L.armW, armLen, skin, 'body')
  buf.put(armX0, ty + 1, skinHi, 'body')
  buf.put(armX1 + L.armW - 1, ty + 1, skinSh, 'body')
  // Hands
  buf.rect(armX0, ty + 1 + armLen, L.armW + 1, 2, skinHi, 'body')
  buf.rect(armX1 - 1, ty + 1 + armLen, L.armW + 1, 2, skin, 'body')

  if (accessory?.id === 'rune-bracers' || accessory?.id === 'copper-ring') {
    const ap = accessory.colors.primary
    const ah = accessory.colors.highlight ?? shade(ap, 30)
    const by = ty + Math.floor(armLen * 0.65)
    buf.rect(armX0 - 1, by, L.armW + 1, 3, ap, 'accessory')
    buf.rect(armX1, by, L.armW + 1, 3, ap, 'accessory')
    buf.put(armX0, by, ah, 'accessory')
    buf.put(armX1 + 1, by, ah, 'accessory')
  }

  // ——— NECK ———
  buf.rect(L.cx - 1, hy + L.headH, 3, 2, skin, 'body')

  // ——— HEAD ———
  buf.rect(hx, hy, L.headW, L.headH, skin, 'head')
  buf.rect(hx, hy, 1, L.headH, skinSh, 'head')
  buf.rect(hx + 1, hy, L.headW - 2, 1, skinHi, 'head')

  // Ears
  if (race.traits.ears === 'pointed') {
    const earH = heroRace === 'elf' ? 5 : 3
    for (let i = 0; i < earH; i++) {
      buf.put(hx - 1, hy + 2 - i, skin, 'head')
      buf.put(hx + L.headW, hy + 2 - i, skin, 'head')
      if (i > 0) {
        buf.put(hx - 1, hy + 2 - i, skinHi, 'head')
      }
    }
    // tip
    buf.put(hx - 1, hy + 2 - earH, skinHi, 'head')
    buf.put(hx + L.headW, hy + 2 - earH, skin, 'head')
  } else if (race.traits.ears === 'round') {
    buf.put(hx - 1, hy + 3, skin, 'head')
    buf.put(hx + L.headW, hy + 3, skin, 'head')
  }

  // Eyes
  const eyeY = hy + Math.floor(L.headH / 2) - 1
  buf.put(hx + 2, eyeY, '#f4efe6', 'head')
  buf.put(hx + L.headW - 3, eyeY, '#f4efe6', 'head')
  buf.put(hx + 2, eyeY, race.eye, 'head')
  buf.put(hx + L.headW - 3, eyeY, race.eye, 'head')
  buf.put(hx + 2, eyeY - 1, hairSh, 'head')
  buf.put(hx + L.headW - 3, eyeY - 1, hairSh, 'head')

  // Nose / mouth
  buf.put(L.cx, eyeY + 2, skinSh, 'head')
  const mouthY = hy + L.headH - 2
  if (race.traits.tusks) {
    buf.put(L.cx - 1, mouthY, race.lip, 'head')
    buf.put(L.cx + 1, mouthY, race.lip, 'head')
    buf.put(L.cx - 2, mouthY + 1, '#f0e8d8', 'head')
    buf.put(L.cx + 2, mouthY + 1, '#f0e8d8', 'head')
  } else {
    buf.put(L.cx - 1, mouthY, race.lip, 'head')
    buf.put(L.cx, mouthY, race.lip, 'head')
  }

  // Brow
  if (race.traits.brow === 'heavy') {
    buf.rect(hx + 1, eyeY - 1, L.headW - 2, 1, skinSh, 'head')
  }

  // Beard
  if (race.traits.beard === 'full') {
    for (let i = 0; i < 8; i++) {
      const w = 4 + Math.min(4, Math.floor(i / 2))
      buf.rect(L.cx - Math.floor(w / 2), mouthY + i, w, 1, i % 2 ? hairHi : hair, 'head')
    }
  } else if (race.traits.beard === 'stubble' && heroClass === 'warrior') {
    buf.put(L.cx - 2, mouthY + 1, hair, 'head')
    buf.put(L.cx + 1, mouthY + 1, hair, 'head')
    buf.put(L.cx - 1, mouthY + 2, hairSh, 'head')
  }

  // Hair / class headgear
  drawHair(buf, hx, hy, L.headW, L.headH, hair, hairHi, hairSh, heroRace, heroClass, tunic, accent)

  // Crown
  if (accessory?.id === 'crown-of-dawn') {
    const cp = accessory.colors.primary
    const ch = accessory.colors.highlight ?? '#fff0a8'
    buf.rect(hx - 1, hy - 2, L.headW + 2, 2, cp, 'accessory')
    buf.put(hx, hy - 3, ch, 'accessory')
    buf.put(L.cx, hy - 4, ch, 'accessory')
    buf.put(hx + L.headW - 1, hy - 3, ch, 'accessory')
  }

  // ——— WEAPON ———
  if (weapon) drawWeapon(buf, weapon.id, armX1 + L.armW, ty, weapon.colors)

  buf.outlinePass()

  const pixels = buf.pixels()
  if (!damaged) return pixels
  return pixels.map((p) => ({ ...p, c: damagedTint(p.c) }))
}

function drawChest(
  buf: Buf,
  id: WearableId,
  tx: number,
  ty: number,
  tw: number,
  th: number,
  colors: { primary: string; secondary: string; highlight?: string },
  accent: string,
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 35)

  if (id === 'cloth-tunic') {
    buf.rect(tx, ty, tw, th - 1, p, 'chest')
    buf.rect(tx + 1, ty + 1, tw - 2, 1, h, 'chest')
    // neckline
    buf.rect(tx + Math.floor(tw / 2) - 1, ty, 3, 2, s, 'chest')
  } else if (id === 'leather-vest') {
    buf.rect(tx, ty, tw, th - 1, p, 'chest')
    buf.rect(tx + Math.floor(tw / 2) - 1, ty + 2, 2, th - 5, s, 'chest')
    for (let i = 0; i < 3; i++) buf.put(tx + Math.floor(tw / 2), ty + 3 + i * 3, h, 'chest')
    buf.rect(tx, ty, 2, 3, s, 'chest')
    buf.rect(tx + tw - 2, ty, 2, 3, s, 'chest')
  } else if (id === 'iron-mail') {
    buf.rect(tx - 1, ty, tw + 2, th - 1, p, 'chest')
    // mail dots
    for (let y = ty + 2; y < ty + th - 3; y += 2) {
      for (let x = tx + 1; x < tx + tw - 1; x += 2) buf.put(x, y, h, 'chest')
    }
    // pauldrons
    buf.rect(tx - 2, ty, 3, 4, s, 'chest')
    buf.rect(tx + tw - 1, ty, 3, 4, s, 'chest')
    buf.put(tx - 1, ty, h, 'chest')
    buf.put(tx + tw, ty, h, 'chest')
  } else if (id === 'ember-plate') {
    buf.rect(tx - 1, ty, tw + 2, th - 1, p, 'chest')
    for (let y = ty + 2; y < ty + th - 3; y += 3) {
      buf.rect(tx + 1, y, tw - 2, 1, h, 'chest')
      buf.rect(tx + 1, y + 1, tw - 2, 1, s, 'chest')
    }
    buf.rect(tx - 2, ty, 4, 5, s, 'chest')
    buf.rect(tx + tw - 2, ty, 4, 5, s, 'chest')
    buf.put(tx + Math.floor(tw / 2), ty + 4, h, 'chest')
    buf.put(tx + Math.floor(tw / 2), ty + 5, '#ffe0a0', 'chest')
  }

  // Belt
  buf.rect(tx - 1, ty + th - 3, tw + 2, 2, s, 'chest')
  buf.rect(tx + Math.floor(tw / 2) - 1, ty + th - 4, 3, 3, h, 'chest')
  buf.put(tx + Math.floor(tw / 2), ty + th - 3, accent, 'chest')
}

function drawHair(
  buf: Buf,
  hx: number,
  hy: number,
  hw: number,
  _hh: number,
  hair: string,
  hairHi: string,
  hairSh: string,
  race: HeroRace | null,
  heroClass: HeroClass | null,
  tunic: string,
  accent: string,
) {
  if (heroClass === 'mage') {
    // Pointed hat
    for (let i = 0; i < 10; i++) {
      const w = Math.max(2, hw + 2 - Math.floor(i * 0.7))
      buf.rect(hx + Math.floor((hw - w) / 2), hy - 2 - i, w, 1, i > 6 ? accent : tunic, 'head')
    }
    buf.rect(hx - 2, hy - 1, hw + 4, 2, shade(tunic, -30), 'head')
    buf.put(hx + Math.floor(hw / 2), hy - 12, accent, 'head')
    return
  }

  // Crown hair
  buf.rect(hx, hy - 1, hw, 3, hair, 'head')
  buf.rect(hx + 1, hy - 2, hw - 2, 1, hairHi, 'head')
  buf.rect(hx, hy - 1, 1, 3, hairSh, 'head')

  // Sideburns / fringe
  buf.rect(hx, hy + 1, 1, 3, hair, 'head')
  buf.rect(hx + hw - 1, hy + 1, 1, 3, hair, 'head')

  if (heroClass === 'rogue') {
    // Hood + eye mask
    buf.rect(hx - 1, hy - 1, hw + 2, 4, hairSh, 'head')
    buf.rect(hx, hy + 2, hw, 3, '#1a1218', 'head')
    buf.put(hx + 2, hy + 3, '#0a0806', 'head')
    buf.put(hx + hw - 3, hy + 3, '#0a0806', 'head')
  }

  if (heroClass === 'ranger') {
    // Longer side locks
    for (let i = 0; i < 6; i++) {
      buf.put(hx, hy + 3 + i, hair, 'head')
      buf.put(hx + hw - 1, hy + 3 + i, hairHi, 'head')
    }
  }

  if (heroClass === 'warrior') {
    // Short crop
    buf.rect(hx + 1, hy - 1, hw - 2, 2, hair, 'head')
  }

  if (race === 'elf') {
    for (let i = 0; i < 10; i++) {
      buf.put(hx - 1, hy + 2 + i, i % 2 ? hairHi : hair, 'head')
      buf.put(hx + hw, hy + 2 + i, i % 2 ? hair : hairSh, 'head')
    }
  }

  if (race === 'dwarf') {
    // Thick top
    buf.rect(hx - 1, hy - 2, hw + 2, 3, hair, 'head')
  }
}

function drawWeapon(
  buf: Buf,
  id: WearableId,
  x: number,
  y: number,
  colors: { primary: string; secondary: string; highlight?: string },
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 40)

  if (id === 'lantern-staff') {
    buf.rect(x + 1, y - 2, 1, 22, s, 'weapon')
    buf.rect(x, y - 4, 3, 3, h, 'weapon')
    buf.put(x + 1, y - 3, '#ffe6a0', 'weapon')
  } else if (id === 'hunter-bow') {
    for (let i = 0; i < 14; i++) {
      const curve = i < 7 ? Math.floor(i / 2) : Math.floor((13 - i) / 2)
      buf.put(x + curve, y + i, p, 'weapon')
      buf.put(x, y + i, '#d8d0c0', 'weapon')
    }
    buf.rect(x, y + 5, 2, 3, h, 'weapon')
  } else {
    // training blade
    buf.rect(x + 1, y - 4, 1, 12, h, 'weapon')
    buf.rect(x + 1, y - 4, 1, 1, '#ffffff', 'weapon')
    buf.rect(x, y + 8, 3, 1, s, 'weapon')
    buf.rect(x + 1, y + 9, 1, 4, s, 'weapon')
    buf.put(x + 1, y + 13, h, 'weapon')
  }
}

function flatten(pixels: Pix[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4)
  const sorted = [...pixels].sort((a, b) => a.z - b.z)
  for (const p of sorted) {
    const [r, g, b] = hexToRgb(p.c)
    if (Number.isNaN(r)) continue
    const i = (p.y * W + p.x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = 255
  }
  return data
}

export function PixelAvatar({
  heroRace,
  heroClass,
  equipped,
  damaged = false,
  large = false,
  className,
}: {
  heroRace?: HeroRace | null
  heroClass: HeroClass | null
  equipped: EquippedLoadout
  damaged?: boolean
  large?: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Sheet-style: small native pixels, big crisp upscale
  const scale = large ? 8 : 2
  const displayW = W * scale
  const displayH = H * scale

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pixels = buildSprite(heroRace ?? null, heroClass, equipped, damaged)
    const raw = flatten(pixels)
    const img = ctx.createImageData(W, H)
    img.data.set(raw)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, W, H)
    ctx.putImageData(img, 0, 0)
  }, [heroRace, heroClass, equipped, damaged])

  const label = [heroRace, heroClass].filter(Boolean).join(' ') || 'Adventurer'

  return (
    <div
      className={`pixel-avatar ${large ? 'large' : 'compact'} ${damaged ? 'damaged' : ''} ${className ?? ''}`}
      style={{ width: displayW, height: displayH }}
      role="img"
      aria-label={`${label} avatar`}
    >
      <div className="pixel-avatar-bob">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
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
