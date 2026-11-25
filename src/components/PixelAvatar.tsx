import { useEffect, useRef } from 'react'
import { classDef } from '../lib/classes'
import { raceDef } from '../lib/races'
import { WEARABLES } from '../lib/wearables'
import type { EquippedLoadout, HeroClass, HeroRace, WearableId } from '../lib/types'

/**
 * Classic r/DnD “100 pixel characters” style:
 * continuous ~32×48 heroes, clean outline, limited palette.
 */
const W = 32
const H = 48

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

const OUTLINE = '#1c1410'
const GROUND = '#6b4a32'
const GROUND_EDGE = '#4a3220'

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
  if (hex === OUTLINE || hex === GROUND || hex === GROUND_EDGE) return hex
  const [r, g, b] = hexToRgb(hex)
  return `#${Math.min(255, Math.round(r * 0.7 + 40))
    .toString(16)
    .padStart(2, '0')}${Math.min(255, Math.round(g * 0.5))
    .toString(16)
    .padStart(2, '0')}${Math.min(255, Math.round(b * 0.5))
    .toString(16)
    .padStart(2, '0')}`
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
  stamp(x0: number, y0: number, rows: string[], pal: Record<string, string>, layer: Layer) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y]
      for (let x = 0; x < row.length; x++) {
        const ch = row[x]
        if (ch === '.' || ch === ' ') continue
        const c = pal[ch]
        if (c) this.put(x0 + x, y0 + y, c, layer)
      }
    }
  }
  outlinePass() {
    const filled = [...this.map.values()].filter((p) => p.z !== Z.outline && p.z !== Z.ground)
    for (const p of filled) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const key = `${p.x + dx},${p.y + dy}`
        if (!this.map.has(key)) this.put(p.x + dx, p.y + dy, OUTLINE, 'outline')
      }
    }
  }
  pixels() {
    return [...this.map.values()]
  }
}

/**
 * Continuous layout (human baseline, feet at y≈40):
 * hair/hat 2–5 · head 6–12 · neck 13 · torso 14–24 · legs 25–36 · boots 37–40 · ground 41–43
 * Dwarf shifts everything down + shortens legs. Elf slightly taller legs.
 */
function layout(race: HeroRace | null) {
  if (race === 'dwarf') {
    return { headY: 12, torsoY: 20, torsoH: 9, legY: 29, legH: 7, bootY: 36, stout: true }
  }
  if (race === 'elf') {
    return { headY: 4, torsoY: 13, torsoH: 11, legY: 24, legH: 12, bootY: 36, stout: false }
  }
  if (race === 'orc') {
    return { headY: 5, torsoY: 14, torsoH: 11, legY: 25, legH: 11, bootY: 36, stout: true }
  }
  return { headY: 6, torsoY: 14, torsoH: 11, legY: 25, legH: 11, bootY: 36, stout: false }
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
  const L = layout(heroRace)

  const S = race.skin.mid
  const S1 = race.skin.light
  const S2 = race.skin.shade
  let Hm = race.hair.mid
  let H1 = race.hair.light
  let H2 = race.hair.shade
  if (heroClass === 'mage' && heroRace !== 'elf') {
    Hm = '#2a2a4a'
    H1 = '#5a5a7a'
    H2 = '#12122a'
  } else if (heroClass === 'rogue') {
    Hm = shade(Hm, -25)
    H1 = shade(H1, -15)
    H2 = '#0a0806'
  }
  const T = cls?.palette.tunic ?? '#6b5a4a'
  const Acc = cls?.palette.accent ?? '#d4894a'
  const Pant = shade(T, -40)
  const Boot = '#2a2018'
  const Eye = race.eye
  const Lip = race.lip

  const chest = equipped.chest ? WEARABLES[equipped.chest] : null
  const cape = equipped.cape ? WEARABLES[equipped.cape] : null
  const weapon = equipped.weapon ? WEARABLES[equipped.weapon] : null
  const accessory = equipped.accessory ? WEARABLES[equipped.accessory] : null

  const tw = L.stout ? 10 : 8
  const tx = L.stout ? 11 : 12

  // Ground disk touching boots (sheet-style ellipse)
  buf.stamp(
    8,
    L.bootY + 3,
    ['...######...', '..########..', '.##########.', '..########..', '...######...'],
    { '#': GROUND },
    'ground',
  )
  buf.put(10, L.bootY + 4, GROUND_EDGE, 'ground')
  buf.put(21, L.bootY + 4, GROUND_EDGE, 'ground')

  // Cape behind torso
  if (cape) {
    const Cp = cape.colors.primary
    const Cs = cape.colors.secondary
    const Ch = cape.colors.highlight ?? shade(Cp, 28)
    buf.stamp(
      10,
      L.torsoY - 1,
      [
        '..hh..',
        '.hppp.',
        'hpppph',
        'hp..ph',
        'hp..ph',
        'sp..ps',
        'sp..ps',
        '.s..s.',
        '.s..s.',
        '..ss..',
      ],
      { h: Ch, p: Cp, s: Cs },
      'cape',
    )
    buf.stamp(tx - 3, L.torsoY + 1, ['p', 'p', 'p', 'p', 's', 's', 's'], { p: Cp, s: Cs }, 'cape')
    buf.stamp(tx + tw + 2, L.torsoY + 1, ['p', 'p', 'p', 'p', 's', 's', 's'], { p: Cp, s: Cs }, 'cape')
  }

  // Legs connected to torso bottom
  const legRows: string[] = []
  for (let i = 0; i < L.legH; i++) {
    legRows.push(L.stout ? '##..##' : '#....#')
  }
  buf.stamp(L.stout ? 13 : 13, L.legY, legRows, { '#': Pant }, 'body')

  // Boots
  const bootC = accessory?.id === 'verdant-boots' ? accessory.colors.primary : Boot
  const bootHi =
    accessory?.id === 'verdant-boots'
      ? (accessory.colors.highlight ?? shade(bootC, 25))
      : shade(Boot, 18)
  buf.stamp(
    L.stout ? 12 : 12,
    L.bootY,
    L.stout ? ['####..####', '####..####', '####..####'] : ['###..###', '###..###', '####.####'],
    { '#': bootC },
    accessory?.id === 'verdant-boots' ? 'accessory' : 'body',
  )
  buf.put(13, L.bootY, bootHi, accessory?.id === 'verdant-boots' ? 'accessory' : 'body')
  buf.put(18, L.bootY, bootHi, accessory?.id === 'verdant-boots' ? 'accessory' : 'body')

  // Arms
  buf.stamp(tx - 2, L.torsoY + 1, ['S', 'S', 'S', 'S', 'S', '1'], { S, '1': S1 }, 'body')
  buf.stamp(tx + tw + 1, L.torsoY + 1, ['S', 'S', 'S', 'S', 'S', '2'], { S, '2': S2 }, 'body')

  // Torso (undershirt) — contiguous block
  const torsoRows = Array.from({ length: L.torsoH }, () => '#'.repeat(tw))
  buf.stamp(tx, L.torsoY, torsoRows, { '#': T }, 'body')
  buf.put(tx, L.torsoY + 1, shade(T, -30), 'body')
  buf.put(tx + tw - 1, L.torsoY + 1, shade(T, -15), 'body')

  // Chest armor
  if (chest) drawChest(buf, chest.id, tx, L.torsoY, tw, L.torsoH, chest.colors, Acc)

  // Bracers
  if (accessory?.id === 'rune-bracers' || accessory?.id === 'copper-ring') {
    const ap = accessory.colors.primary
    const ah = accessory.colors.highlight ?? shade(ap, 30)
    buf.stamp(tx - 2, L.torsoY + 5, ['#', 'h'], { '#': ap, h: ah }, 'accessory')
    buf.stamp(tx + tw + 1, L.torsoY + 5, ['#', 'h'], { '#': ap, h: ah }, 'accessory')
  }

  // Neck joins head to torso
  buf.stamp(15, L.torsoY - 1, ['SS'], { S }, 'body')
  buf.put(15, L.headY + 6, S, 'body')
  buf.put(16, L.headY + 6, S1, 'body')

  // Head
  drawHead(buf, L.headY, heroRace, S, S1, S2, Hm, H1, H2, Eye, Lip, heroClass, T, Acc)

  // Crown
  if (accessory?.id === 'crown-of-dawn') {
    const cp = accessory.colors.primary
    const ch = accessory.colors.highlight ?? '#fff0a8'
    buf.stamp(13, L.headY - 2, ['.#.#.#.', '#######'], { '#': cp }, 'accessory')
    buf.put(14, L.headY - 3, ch, 'accessory')
    buf.put(16, L.headY - 4, ch, 'accessory')
    buf.put(18, L.headY - 3, ch, 'accessory')
  }

  // Weapon
  if (weapon) drawWeapon(buf, weapon.id, tx + tw + 3, L.torsoY - 2, weapon.colors)

  buf.outlinePass()
  const pixels = buf.pixels()
  if (!damaged) return pixels
  return pixels.map((p) => ({ ...p, c: damagedTint(p.c) }))
}

function drawHead(
  buf: Buf,
  headY: number,
  race: HeroRace | null,
  S: string,
  S1: string,
  S2: string,
  Hm: string,
  H1: string,
  H2: string,
  Eye: string,
  Lip: string,
  heroClass: HeroClass | null,
  tunic: string,
  accent: string,
) {
  // Head body (6 tall)
  const head =
    race === 'orc'
      ? ['.#####.', '#######', '#######', '#######', '#######', '.#####.']
      : ['.####.', '######', '######', '######', '######', '.####.']
  const hx = race === 'orc' ? 12 : 13
  buf.stamp(hx, headY, head, { '#': S }, 'head')
  buf.put(hx + 1, headY + 1, S1, 'head')
  buf.put(hx, headY + 2, S2, 'head')

  // Ears
  if (race === 'elf') {
    // Long pointed ears — clear silhouette like the sheet
    buf.stamp(10, headY - 1, ['..1', '.S.', 'S..', 'S..'], { '1': S1, S }, 'head')
    buf.stamp(19, headY - 1, ['1..', '.S.', '..S', '..S'], { '1': S1, S }, 'head')
  } else if (race === 'orc') {
    buf.put(11, headY + 2, S, 'head')
    buf.put(20, headY + 2, S2, 'head')
  } else if (race !== 'dwarf') {
    buf.put(hx - 1, headY + 2, S, 'head')
    buf.put(hx + 6, headY + 2, S, 'head')
  }

  // Eyes
  const eyeY = headY + 2
  buf.put(14, eyeY, Eye, 'head')
  buf.put(17, eyeY, Eye, 'head')
  if (race === 'orc') {
    buf.put(14, eyeY - 1, S2, 'head')
    buf.put(17, eyeY - 1, S2, 'head')
  }

  // Nose + mouth
  buf.put(15, eyeY + 1, S2, 'head')
  buf.put(16, eyeY + 1, S2, 'head')
  if (race === 'orc') {
    buf.put(14, eyeY + 3, Lip, 'head')
    buf.put(17, eyeY + 3, Lip, 'head')
    buf.put(13, eyeY + 4, '#efe6d4', 'head')
    buf.put(18, eyeY + 4, '#efe6d4', 'head')
  } else {
    buf.put(15, eyeY + 3, Lip, 'head')
    buf.put(16, eyeY + 3, Lip, 'head')
  }

  // Dwarf beard (hangs onto chest)
  if (race === 'dwarf') {
    buf.stamp(
      13,
      headY + 5,
      ['######', '.####.', '.####.', '..##..', '..##..'],
      { '#': Hm },
      'head',
    )
    buf.put(14, headY + 6, H1, 'head')
  }

  // Mage hat
  if (heroClass === 'mage') {
    buf.stamp(
      12,
      headY - 7,
      ['...a...', '..aaa..', '.aaaaa.', '..ttt..', '.tttttt.', 'tttttttt'],
      { a: accent, t: tunic },
      'head',
    )
    return
  }

  // Hair cap
  buf.stamp(13, headY - 1, ['.####.', '######'], { '#': Hm }, 'head')
  buf.put(14, headY - 1, H1, 'head')
  buf.put(13, headY, H2, 'head')
  buf.put(18, headY, H2, 'head')

  if (heroClass === 'rogue') {
    buf.stamp(12, headY, ['########', '##....##'], { '#': H2 }, 'head')
  }

  if (heroClass === 'ranger' || race === 'elf') {
    for (let i = 0; i < 6; i++) {
      buf.put(12, headY + 2 + i, i % 2 ? H1 : Hm, 'head')
      buf.put(19, headY + 2 + i, i % 2 ? Hm : H2, 'head')
    }
  }

  if (heroClass === 'warrior') {
    buf.stamp(14, headY - 1, ['####'], { '#': Hm }, 'head')
  }

  if (race === 'dwarf') {
    buf.stamp(12, headY - 2, ['.######.', '########'], { '#': Hm }, 'head')
  }
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
  const h = colors.highlight ?? shade(p, 32)

  // Fill torso area with armor, keep contiguous
  for (let y = 0; y < th - 1; y++) {
    for (let x = 0; x < tw; x++) {
      let c = p
      if (id === 'iron-mail' && (x + y) % 2 === 0) c = h
      if (id === 'leather-vest' && x >= tw / 2 - 1 && x <= tw / 2) c = s
      if (id === 'cloth-tunic' && y === 1 && x > 0 && x < tw - 1) c = h
      if (id === 'ember-plate') {
        if (y % 3 === 1) c = h
        if (y % 3 === 2) c = s
        if (y === 3 && x === Math.floor(tw / 2)) c = '#ffe0a0'
      }
      buf.put(tx + x, ty + y, c, 'chest')
    }
  }

  // Pauldrons for metal
  if (id === 'iron-mail' || id === 'ember-plate') {
    buf.stamp(tx - 2, ty, ['ss', 'sp', 'ss'], { s, p }, 'chest')
    buf.stamp(tx + tw, ty, ['ss', 'ps', 'ss'], { s, p }, 'chest')
    buf.put(tx - 1, ty, h, 'chest')
    buf.put(tx + tw, ty, h, 'chest')
  }

  if (id === 'leather-vest') {
    buf.stamp(tx, ty, ['ss', '..'], { s }, 'chest')
    buf.stamp(tx + tw - 2, ty, ['ss'], { s }, 'chest')
  }

  // Belt
  for (let x = -1; x <= tw; x++) buf.put(tx + x, ty + th - 2, s, 'chest')
  buf.put(tx + Math.floor(tw / 2) - 1, ty + th - 2, h, 'chest')
  buf.put(tx + Math.floor(tw / 2), ty + th - 2, accent, 'chest')
  buf.put(tx + Math.floor(tw / 2) + 1, ty + th - 2, h, 'chest')
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
    buf.stamp(x, y, ['.g.', 'ggg', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.'], { g: '#ffe6a0', s }, 'weapon')
  } else if (id === 'hunter-bow') {
    buf.stamp(
      x,
      y + 2,
      ['p..', '.p.', '..p', '..p', '.p.', 'p..', '.p.', '..p', '..p', '.p.', 'p..'],
      { p },
      'weapon',
    )
    for (let i = 0; i < 11; i++) buf.put(x, y + 2 + i, '#d8d0c0', 'weapon')
    buf.put(x + 1, y + 7, h, 'weapon')
  } else {
    buf.stamp(x, y, ['.h', '.h', '.h', '.h', '.h', '.p', 'sss', '.s.', '.s.', '.h.'], { h, p, s }, 'weapon')
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
  const scale = large ? 10 : 2.5
  const displayW = Math.round(W * scale)
  const displayH = Math.round(H * scale)

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
