import { useEffect, useRef } from 'react'
import { classDef } from '../lib/classes'
import { raceDef } from '../lib/races'
import { WEARABLES } from '../lib/wearables'
import type { EquippedLoadout, HeroClass, HeroRace, WearableId } from '../lib/types'

/**
 * Classic r/DnD “100 pixel characters” style:
 * ~32–48px tall heroes in a 32×48 canvas, nearest-neighbor upscaled.
 * Clean outlines, limited palette, readable silhouettes — not muddy blobs.
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
  /** Stamp rows: `.` empty. Palette keys = chars. */
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

/** Vertical offset so dwarf sits lower / shorter; elf taller. */
function yOffset(race: HeroRace | null): number {
  if (race === 'dwarf') return 8
  if (race === 'elf') return 0
  if (race === 'orc') return 1
  return 2
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
  const yo = yOffset(heroRace)

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
    Hm = shade(Hm, -30)
    H1 = shade(H1, -20)
    H2 = '#0a0806'
  }
  const T = cls?.palette.tunic ?? '#6b5a4a'
  const A = cls?.palette.accent ?? '#d4894a'
  const P = shade(T, -45)
  const B = '#2a2018'
  const E = race.eye
  const L = race.lip

  const chest = equipped.chest ? WEARABLES[equipped.chest] : null
  const cape = equipped.cape ? WEARABLES[equipped.cape] : null
  const weapon = equipped.weapon ? WEARABLES[equipped.weapon] : null
  const accessory = equipped.accessory ? WEARABLES[equipped.accessory] : null

  // Ground disk
  buf.stamp(8, 44, ['..######..', '.########.', '..######..'], { '#': GROUND }, 'ground')
  buf.put(12, 45, GROUND_EDGE, 'ground')
  buf.put(19, 45, GROUND_EDGE, 'ground')

  // Cape behind
  if (cape) {
    const Cp = cape.colors.primary
    const Cs = cape.colors.secondary
    const Ch = cape.colors.highlight ?? shade(Cp, 28)
    buf.stamp(
      9,
      yo + 12,
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
    // Wider side panels
    buf.stamp(
      7,
      yo + 14,
      ['p.', 'p.', 'p.', 's.', 's.', 's.', '.s'],
      { p: Cp, s: Cs },
      'cape',
    )
    buf.stamp(
      23,
      yo + 14,
      ['.p', '.p', '.p', '.s', '.s', '.s', 's.'],
      { p: Cp, s: Cs },
      'cape',
    )
  }

  // Legs + boots (race width)
  const stout = heroRace === 'dwarf' || heroRace === 'orc'
  const legRows = stout
    ? ['##..##', '##..##', '##..##', '##..##', '##..##', 'bb..bb', 'bb..bb']
    : ['#...#.', '#...#.', '#...#.', '#...#.', '#...#.', 'b...b.', 'bb.bb.']
  const bootC =
    accessory?.id === 'verdant-boots' ? accessory.colors.primary : B
  const bootH =
    accessory?.id === 'verdant-boots'
      ? (accessory.colors.highlight ?? shade(bootC, 25))
      : shade(B, 20)
  buf.stamp(13, yo + 30, legRows, { '#': P, b: bootC }, 'body')
  if (accessory?.id === 'verdant-boots') {
    buf.put(13, yo + 35, bootH, 'accessory')
    buf.put(18, yo + 35, bootH, 'accessory')
  }

  // Arms (skin)
  buf.stamp(
    10,
    yo + 14,
    ['S', 'S', 'S', 'S', 'S', '1'],
    { S, '1': S1 },
    'body',
  )
  buf.stamp(
    21,
    yo + 14,
    ['S', 'S', 'S', 'S', 'S', '2'],
    { S, '2': S2 },
    'body',
  )

  // Torso undershirt
  const torsoW = stout ? 10 : 8
  const tx = stout ? 11 : 12
  buf.stamp(
    tx,
    yo + 14,
    stout
      ? ['TTTTTTTTTT', 'TTTTTTTTTT', 'TTTTTTTTTT', 'TTTTTTTTTT', 'TTTTTTTTTT', 'TTTTTTTTTT', 'TTTTTTTTTT']
      : ['TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT', 'TTTTTTTT'],
    { T },
    'body',
  )
  buf.put(tx, yo + 15, shade(T, -30), 'body')
  buf.put(tx + torsoW - 1, yo + 15, shade(T, -15), 'body')

  // Chest armor overlay
  if (chest) drawChest(buf, chest.id, tx, yo + 14, torsoW, chest.colors, A)

  // Bracers
  if (accessory?.id === 'rune-bracers' || accessory?.id === 'copper-ring') {
    const ap = accessory.colors.primary
    const ah = accessory.colors.highlight ?? shade(ap, 30)
    buf.stamp(10, yo + 18, ['#', 'h'], { '#': ap, h: ah }, 'accessory')
    buf.stamp(21, yo + 18, ['#', 'h'], { '#': ap, h: ah }, 'accessory')
  }

  // Neck
  buf.stamp(15, yo + 12, ['.SS.', 'SSSS'], { S, '.': '' }, 'body')
  // fix empty key — redraw neck cleanly
  buf.put(15, yo + 13, S, 'body')
  buf.put(16, yo + 12, S, 'body')
  buf.put(17, yo + 12, S, 'body')
  buf.put(16, yo + 13, S, 'body')
  buf.put(17, yo + 13, S1, 'body')

  // Head by race
  drawHead(buf, yo, heroRace, S, S1, S2, Hm, H1, H2, E, L, heroClass, T, A)

  // Crown
  if (accessory?.id === 'crown-of-dawn') {
    const cp = accessory.colors.primary
    const ch = accessory.colors.highlight ?? '#fff0a8'
    buf.stamp(13, yo + 2, ['.#.#.#.', '#######'], { '#': cp }, 'accessory')
    buf.put(14, yo + 1, ch, 'accessory')
    buf.put(16, yo + 0, ch, 'accessory')
    buf.put(18, yo + 1, ch, 'accessory')
  }

  // Weapon (right side)
  if (weapon) drawWeapon(buf, weapon.id, 23, yo + 10, weapon.colors)

  buf.outlinePass()
  const pixels = buf.pixels()
  if (!damaged) return pixels
  return pixels.map((p) => ({ ...p, c: damagedTint(p.c) }))
}

function drawHead(
  buf: Buf,
  yo: number,
  race: HeroRace | null,
  S: string,
  S1: string,
  S2: string,
  Hm: string,
  H1: string,
  H2: string,
  E: string,
  Lip: string,
  heroClass: HeroClass | null,
  tunic: string,
  accent: string,
) {
  const hy = yo + 4
  // Base head oval-ish
  if (race === 'dwarf') {
    buf.stamp(
      13,
      hy,
      [
        '.####.',
        '######',
        '######',
        '######',
        '######',
        '.####.',
      ],
      { '#': S },
      'head',
    )
  } else if (race === 'orc') {
    buf.stamp(
      12,
      hy,
      [
        '.#####.',
        '#######',
        '#######',
        '#######',
        '#######',
        '.#####.',
      ],
      { '#': S },
      'head',
    )
  } else {
    buf.stamp(
      13,
      hy,
      [
        '.####.',
        '######',
        '######',
        '######',
        '######',
        '.####.',
      ],
      { '#': S },
      'head',
    )
  }
  buf.put(14, hy + 1, S1, 'head')
  buf.put(13, hy + 2, S2, 'head')

  // Ears
  if (race === 'elf') {
    buf.stamp(12, hy + 1, ['1', 'S', 'S'], { '1': S1, S }, 'head')
    buf.stamp(19, hy + 1, ['1', 'S', 'S'], { '1': S1, S }, 'head')
    buf.put(12, hy, S1, 'head')
    buf.put(19, hy, S, 'head')
  } else if (race === 'orc') {
    buf.put(12, hy + 2, S, 'head')
    buf.put(20, hy + 2, S2, 'head')
  } else if (race === 'human') {
    buf.put(12, hy + 2, S, 'head')
    buf.put(19, hy + 2, S, 'head')
  }

  // Eyes
  const eyeY = hy + 2
  buf.put(14, eyeY, '#f4efe6', 'head')
  buf.put(17, eyeY, '#f4efe6', 'head')
  buf.put(14, eyeY, E, 'head')
  buf.put(17, eyeY, E, 'head')
  if (race === 'orc') {
    buf.put(14, eyeY - 1, S2, 'head')
    buf.put(17, eyeY - 1, S2, 'head')
  }

  // Nose
  buf.put(15, eyeY + 1, S2, 'head')
  buf.put(16, eyeY + 1, S2, 'head')

  // Mouth / tusks
  if (race === 'orc') {
    buf.put(14, eyeY + 3, Lip, 'head')
    buf.put(17, eyeY + 3, Lip, 'head')
    buf.put(13, eyeY + 4, '#efe6d4', 'head')
    buf.put(18, eyeY + 4, '#efe6d4', 'head')
  } else {
    buf.put(15, eyeY + 3, Lip, 'head')
    buf.put(16, eyeY + 3, Lip, 'head')
  }

  // Beard (dwarf)
  if (race === 'dwarf') {
    buf.stamp(
      13,
      hy + 5,
      [
        '######',
        '.####.',
        '.####.',
        '..##..',
        '..##..',
        '...#..',
      ],
      { '#': Hm },
      'head',
    )
    buf.put(14, hy + 6, H1, 'head')
    buf.put(17, hy + 6, H2, 'head')
  }

  // Hair / class hats
  if (heroClass === 'mage') {
    buf.stamp(
      12,
      hy - 6,
      [
        '...a...',
        '..aaa..',
        '.aaaaa.',
        '..ttt..',
        '.tttttt.',
        'tttttttt',
      ],
      { a: accent, t: tunic },
      'head',
    )
    return
  }

  // Hair cap
  buf.stamp(
    13,
    hy - 1,
    [
      '.####.',
      '######',
      '#....#',
    ],
    { '#': Hm },
    'head',
  )
  buf.put(14, hy - 1, H1, 'head')
  buf.put(13, hy, H2, 'head')

  if (heroClass === 'rogue') {
    buf.stamp(
      12,
      hy,
      [
        '########',
        '########',
        '##....##',
      ],
      { '#': H2 },
      'head',
    )
    // eye slits already eyes underneath
  }

  if (heroClass === 'ranger' || race === 'elf') {
    for (let i = 0; i < 7; i++) {
      buf.put(12, hy + 2 + i, i % 2 ? H1 : Hm, 'head')
      buf.put(19, hy + 2 + i, i % 2 ? Hm : H2, 'head')
    }
  }

  if (heroClass === 'warrior') {
    buf.stamp(14, hy - 1, ['####'], { '#': Hm }, 'head')
  }

  if (race === 'dwarf') {
    buf.stamp(12, hy - 2, ['.######.', '########'], { '#': Hm }, 'head')
  }
}

function drawChest(
  buf: Buf,
  id: WearableId,
  tx: number,
  ty: number,
  tw: number,
  colors: { primary: string; secondary: string; highlight?: string },
  accent: string,
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 32)

  if (id === 'cloth-tunic') {
    buf.stamp(
      tx,
      ty,
      tw >= 10
        ? ['pppppppppp', 'phhhhhhhpp', 'pppppppppp', 'pppppppppp', 'pppppppppp', 'ssssssssss']
        : ['pppppppp', 'phhhhhpp', 'pppppppp', 'pppppppp', 'pppppppp', 'ssssssss'],
      { p, h, s },
      'chest',
    )
  } else if (id === 'leather-vest') {
    buf.stamp(
      tx,
      ty,
      tw >= 10
        ? ['ssppppppss', 'spphhhppps', 'spppssppps', 'spppssppps', 'spppppppps', 'ssssssssss']
        : ['ssppppss', 'spphhpps', 'sppsspps', 'sppsspps', 'spppppps', 'ssssssss'],
      { p, h, s },
      'chest',
    )
  } else if (id === 'iron-mail') {
    buf.stamp(
      tx - 1,
      ty,
      [
        'ss........ss',
        'ssppppppppss',
        '.phphphphp.',
        '.pphphphpp.',
        '.phphphphp.',
        '.ppppppppp.',
        '.ssssssssss.',
      ],
      { p, h, s },
      'chest',
    )
  } else if (id === 'ember-plate') {
    buf.stamp(
      tx - 1,
      ty,
      [
        'ss........ss',
        'ssppppppppss',
        '.pphhhhhhpp.',
        '.ppsssssspp.',
        '.pphhhahhpp.',
        '.pppppppppp.',
        '.ssssssssss.',
      ],
      { p, h, s, a: '#ffe0a0' },
      'chest',
    )
  }

  // Belt buckle
  const bx = tx + Math.floor(tw / 2) - 1
  buf.put(bx, ty + 5, h, 'chest')
  buf.put(bx + 1, ty + 5, accent, 'chest')
  buf.put(bx + 2, ty + 5, h, 'chest')
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
    buf.stamp(
      x,
      y - 2,
      [
        '.h.',
        'hhh',
        '.s.',
        '.s.',
        '.s.',
        '.s.',
        '.s.',
        '.s.',
        '.s.',
        '.s.',
      ],
      { h: '#ffe6a0', s },
      'weapon',
    )
  } else if (id === 'hunter-bow') {
    buf.stamp(
      x,
      y,
      [
        'p..',
        '.p.',
        '..p',
        '..p',
        '.p.',
        'p..',
        '.p.',
        '..p',
        '..p',
        '.p.',
        'p..',
      ],
      { p },
      'weapon',
    )
    // string
    for (let i = 0; i < 11; i++) buf.put(x, y + i, '#d8d0c0', 'weapon')
    buf.put(x + 1, y + 5, h, 'weapon')
  } else {
    buf.stamp(
      x,
      y - 2,
      [
        '.h',
        '.h',
        '.h',
        '.h',
        '.h',
        '.p',
        'sss',
        '.s.',
        '.s.',
        '.h.',
      ],
      { h, p, s },
      'weapon',
    )
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
