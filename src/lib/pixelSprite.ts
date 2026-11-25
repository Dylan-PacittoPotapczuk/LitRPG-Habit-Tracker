import { classDef } from './classes'
import { raceDef } from './races'
import { WEARABLES } from './wearables'
import type { EquippedLoadout, HeroClass, HeroRace, WearableId } from './types'

/**
 * Classic DnD pixel-sheet style (~48×64 native).
 * Organic fantasy silhouettes via hand stamps — not cylinders/rects/wooden dolls.
 * Display nearest-neighbor upscales for crisp big presentation.
 */
export const SPRITE_W = 48
export const SPRITE_H = 64

type Layer = 'ground' | 'cape' | 'body' | 'chest' | 'head' | 'hair' | 'accessory' | 'weapon' | 'outline'

const Z: Record<Layer, number> = {
  ground: 0,
  cape: 1,
  body: 2,
  chest: 3,
  head: 4,
  hair: 5,
  accessory: 6,
  weapon: 7,
  outline: 8,
}

const OUTLINE = '#1a100c'

function parseHex(hex: string): [number, number, number] {
  const n = hex.replace('#', '')
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

function shade(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex)
  const t = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)))
  return `#${t(r).toString(16).padStart(2, '0')}${t(g).toString(16).padStart(2, '0')}${t(b).toString(16).padStart(2, '0')}`
}

class Pix {
  rgba: Uint8ClampedArray
  zbuf: Int8Array
  constructor() {
    this.rgba = new Uint8ClampedArray(SPRITE_W * SPRITE_H * 4)
    this.zbuf = new Int8Array(SPRITE_W * SPRITE_H).fill(-1)
  }
  put(x: number, y: number, hex: string, layer: Layer) {
    const xi = x | 0
    const yi = y | 0
    if (xi < 0 || yi < 0 || xi >= SPRITE_W || yi >= SPRITE_H) return
    const zi = Z[layer]
    const i = yi * SPRITE_W + xi
    if (this.zbuf[i] > zi) return
    this.zbuf[i] = zi
    const [r, g, b] = parseHex(hex)
    const o = i * 4
    this.rgba[o] = r
    this.rgba[o + 1] = g
    this.rgba[o + 2] = b
    this.rgba[o + 3] = 255
  }
  /** Stamp: `.` empty. Palette maps chars → colors. */
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
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const
    const filled: number[] = []
    for (let i = 0; i < this.zbuf.length; i++) {
      if (this.zbuf[i] >= 0 && this.zbuf[i] !== Z.outline && this.zbuf[i] !== Z.ground) filled.push(i)
    }
    for (const i of filled) {
      const x = i % SPRITE_W
      const y = (i / SPRITE_W) | 0
      for (const [dx, dy] of dirs) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= SPRITE_W || ny >= SPRITE_H) continue
        const ni = ny * SPRITE_W + nx
        if (this.zbuf[ni] < 0) this.put(nx, ny, OUTLINE, 'outline')
      }
    }
  }
  applyDamage() {
    for (let i = 0; i < this.zbuf.length; i++) {
      if (this.zbuf[i] < 0 || this.zbuf[i] === Z.ground) continue
      const o = i * 4
      this.rgba[o] = Math.min(255, Math.round(this.rgba[o] * 0.7 + 40))
      this.rgba[o + 1] = Math.round(this.rgba[o + 1] * 0.5)
      this.rgba[o + 2] = Math.round(this.rgba[o + 2] * 0.5)
    }
  }
}

/** Build classic sheet-style sprite. */
export function buildSprite(
  heroRace: HeroRace | null,
  heroClass: HeroClass | null,
  equipped: EquippedLoadout,
  damaged: boolean,
): Uint8ClampedArray {
  const pix = new Pix()
  const race = raceDef(heroRace) ?? raceDef('human')!
  const cls = classDef(heroClass)
  const skin = race.skin
  const hair = race.hair
  const tunic = cls?.palette.tunic ?? '#6b5a4a'
  const accent = cls?.palette.accent ?? '#d4894a'
  const pant = shade(tunic, -40)

  const chest = equipped.chest ? WEARABLES[equipped.chest] : null
  const cape = equipped.cape ? WEARABLES[equipped.cape] : null
  const weapon = equipped.weapon ? WEARABLES[equipped.weapon] : null
  const accessory = equipped.accessory ? WEARABLES[equipped.accessory] : null

  if (cape) drawCape(pix, cape.colors.primary, cape.colors.secondary)

  // Race body stamp (organic silhouette)
  drawRaceBody(pix, heroRace ?? 'human', skin, pant, tunic, hair, race.eye, race.lip, heroClass, accent)

  // Chest gear: dwarf torso sits lower; tall races need belt higher on waist
  const gearY = heroRace === 'dwarf' ? 8 : 0
  const beltY = heroRace === 'dwarf' ? 31 : 22
  if (chest) drawChestGear(pix, chest.id, chest.colors, accent, gearY, beltY)

  if (accessory?.id === 'crown-of-dawn') drawCrown(pix, accessory.colors)
  if (accessory?.id === 'rune-bracers' || accessory?.id === 'copper-ring') {
    drawBracers(pix, accessory.colors, gearY)
  }
  if (accessory?.id === 'verdant-boots') {
    for (let y = 50; y < 56; y++) {
      for (let x = 14; x < 34; x++) {
        const i = y * SPRITE_W + x
        if (pix.zbuf[i] === Z.body) {
          pix.put(x, y, accessory.colors.primary, 'accessory')
        }
      }
    }
  }

  if (weapon) drawWeapon(pix, weapon.id, weapon.colors, heroRace === 'dwarf' ? 6 : 0)

  // Ground disk tucked under the lowest body/boot pixel
  let footY = 0
  for (let i = 0; i < pix.zbuf.length; i++) {
    if (pix.zbuf[i] === Z.body) {
      const y = (i / SPRITE_W) | 0
      if (y > footY) footY = y
    }
  }
  const gy = Math.min(SPRITE_H - 4, footY + 1)
  pix.stamp(
    12,
    gy,
    ['..######..', '.########.', '##########', '.########.'],
    { '#': '#6b4a32', '.': '' },
    'ground',
  )
  for (let x = 14; x < 34; x++) {
    for (let y = gy + 1; y < gy + 4 && y < SPRITE_H; y++) {
      if ((x + y) % 2 === 0) pix.put(x, y, '#5a3a28', 'ground')
      else pix.put(x, y, '#7a5a40', 'ground')
    }
  }

  // Slide figure down so the ground disk sits on the canvas floor (no empty gap below)
  let maxY = 0
  for (let i = 0; i < pix.zbuf.length; i++) {
    if (pix.zbuf[i] >= 0) {
      const y = (i / SPRITE_W) | 0
      if (y > maxY) maxY = y
    }
  }
  const shift = SPRITE_H - 1 - maxY
  if (shift > 0) {
    const nextRgba = new Uint8ClampedArray(pix.rgba.length)
    const nextZ = new Int8Array(pix.zbuf.length).fill(-1)
    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x < SPRITE_W; x++) {
        const si = y * SPRITE_W + x
        if (pix.zbuf[si] < 0) continue
        const di = (y + shift) * SPRITE_W + x
        nextZ[di] = pix.zbuf[si]
        const so = si * 4
        const dout = di * 4
        nextRgba[dout] = pix.rgba[so]
        nextRgba[dout + 1] = pix.rgba[so + 1]
        nextRgba[dout + 2] = pix.rgba[so + 2]
        nextRgba[dout + 3] = pix.rgba[so + 3]
      }
    }
    pix.rgba = nextRgba
    pix.zbuf = nextZ
  }

  pix.outlinePass()
  if (damaged) pix.applyDamage()
  return pix.rgba
}

function drawRaceBody(
  pix: Pix,
  race: HeroRace,
  skin: { light: string; mid: string; shade: string; deep: string },
  pant: string,
  tunic: string,
  hair: { light: string; mid: string; shade: string },
  eye: string,
  lip: string,
  heroClass: HeroClass | null,
  accent: string,
) {
  const S = skin.mid
  const L = skin.light
  const D = skin.shade
  const X = skin.deep
  const P = pant
  const T = tunic
  const U = shade(tunic, -30)
  const V = shade(tunic, 20)
  const H = hair.mid
  const A = hair.light
  const B = hair.shade
  const E = eye
  const M = lip
  const W = '#f5f0e6'
  const K = '#0a0806'
  const boot = '#2a2018'
  const bootHi = '#4a3830'
  const ivory = '#f0e8d0'
  const mouth = '#3a1810'

  // All figures plant boots on the ground disk (~y54–57). Dense filled stamps — no stick limbs.

  if (race === 'elf') {
    // TALL · SLENDER · LONG POINTED EARS · FLOWING SILVER HAIR
    pix.stamp(
      4,
      0,
      [
        // 28-wide · hair crown with irregular spikes (not a bowl)
        '........A.A.H.A.A...........',
        '......AAHAAHAAHAAHAA........',
        '....AAHHHHHHHHHHHHHAA.......',
        '...AHHH..HHHHHH..HHHA.......',
        '..AHH..LLLLLLLLLL..HHA......',
        // ears jut far past skull
        'eeAH.LLSSSSSSSSSSLL.HAee....',
        'eee.LSSSSSSSSSSSSSSL.eee....',
        '.ee.SSSSSSSSSSSSSSSS.ee.....',
        '..e.SSW.EE..EE.WSSSS.e......',
        '....SS..KK..KK..SSSS........',
        '....SSS..SSSS..SSSSS........',
        '....SSSS..DD..SSSSSS........',
        '....SSSSS.MM.SSSSSSS........',
        '....SSSSSSSSSSSSSSSS........',
        '.....LSSSSSSSSSSSSL.........',
        // slender torso + thin arms glued on
        '....LL.TTVVVVVTT.LL.........',
        '...LLL.TTVUUUVTT.LLL........',
        '..LLLL.TTVUUUVTT.LLLL.......',
        '..LLL..TTVVVVVTT..LLL.......',
        '..LL...TTTTTTTT...LL........',
        '..L.....TTTTTT.....L........',
        // long slender legs with knee breaks (not pipe-dolls)
        '......PPPP..PPPP............',
        '.....PPPPP..PPPPP...........',
        '.....PPPP....PPPP...........',
        '.....PPPP....PPPP...........',
        '.....PPPP....PPPP...........',
        '.....PPpP....PPpP...........',
        '.....PPpP....PPpP...........',
        '.....PPPP....PPPP...........',
        '.....PPPP....PPPP...........',
        '.....PPPP....PPPP...........',
        '.....PPPP....PPPP...........',
        '.....PPPP....PPPP...........',
        '.....PPPP....PPPP...........',
        '.....PPpP....PPpP...........',
        '.....PPpP....PPpP...........',
        '.....PPPP....PPPP...........',
        '.....PPPP....PPPP...........',
        '.....PPPP....PPPP...........',
        '.....PPPPP..PPPPP...........',
        '.....PPPPP..PPPPP...........',
        '.....bbbbb..bbbbb...........',
        '....bbbbBb..bBbbbb..........',
        '....bbbbb....bbbbb..........',
      ],
      {
        A,
        H,
        L,
        S,
        W,
        E,
        K,
        D,
        M,
        T,
        U,
        V,
        P,
        p: shade(pant, -25),
        b: boot,
        B: bootHi,
        e: L,
        '.': '',
      },
      'body',
    )
    // Extra ear tips (must read at a glance)
    pix.stamp(0, 5, ['..e', '.ee', 'eee', 'ee.', 'e..', 'e..'], { e: L, '.': '' }, 'head')
    pix.stamp(40, 5, ['e..', 'ee.', 'eee', '.ee', '..e', '..e'], { e: L, '.': '' }, 'head')
    // Cascading shoulder locks (connected to skull hair)
    for (let i = 0; i < 28; i++) {
      const sway = Math.round(Math.sin(i * 0.4) * 1.2)
      pix.put(8 + sway, 15 + i, i % 2 ? A : H, 'hair')
      pix.put(9 + sway, 15 + i, B, 'hair')
      pix.put(10 + sway, 15 + i, H, 'hair')
      pix.put(37 - sway, 15 + i, i % 2 ? A : H, 'hair')
      pix.put(38 - sway, 15 + i, B, 'hair')
      pix.put(39 - sway, 15 + i, H, 'hair')
    }
    if (heroClass === 'mage') drawMageHat(pix, tunic, accent)
    if (heroClass === 'rogue') drawHood(pix, hair.shade)
    return
  }

  if (race === 'dwarf') {
    // SHORT · WIDE · HUGE BRAIDED BEARD · stubby legs · sits low
    pix.stamp(
      4,
      14,
      [
        // 28-wide · mop + heavy brows
        '......AAAAAAAAAAAA..........',
        '....AAHHHHHHHHHHHHAA........',
        '...AHHHLLLLLLLLLLHHHA.......',
        '..AHHLLSSSSSSSSSSLLHHA......',
        '..HH.LSSRRSSSSRSSL.HH.......',
        '..H..SSWEKK..KKWESS.H.......',
        '.....SS..SSSSSS..SS.........',
        '.....SSS.DDDD.SSSS..........',
        // BEARD blankets the chest
        '....AAAAAAAAAAAAAAAA........',
        '...AAHHHHHHHHHHHHHHAA.......',
        '..AAHHAAAAAAAAAAAAHHAA......',
        '.AAHH..TTTTTTTTTT..HHAA.....',
        '.AHH..TTVVVVVVVVTT..HHA.....',
        '.HH...TTVUUUUUUVTT...HH.....',
        '.HH...TTVVVVVVVVTT...HH.....',
        '.HH....TTTTTTTTTT....HH.....',
        '..H.....TTTTTTTT.....H......',
        // stubby wide legs — shortest race
        '.....PPPPPP..PPPPPP.........',
        '....PPPPPPP..PPPPPPP........',
        '....PPPPPp....pPPPPP........',
        '....PPPPPP....PPPPPP........',
        '....PPPPPP....PPPPPP........',
        '....bbbbbb....bbbbbb........',
        '...bbbbbBb....bBbbbbb.......',
        '...bbbbbb......bbbbbb.......',
      ],
      {
        A,
        H: hair.mid,
        L,
        S,
        W,
        E,
        K,
        D,
        M,
        T,
        U,
        V,
        P,
        p: shade(pant, -25),
        R: B, // bushy brows
        b: boot,
        B: bootHi,
        '.': '',
      },
      'body',
    )
    // Gold braid rings on beard
    pix.put(14, 30, accent, 'hair')
    pix.put(15, 30, shade(accent, 40), 'hair')
    pix.put(32, 30, accent, 'hair')
    pix.put(33, 30, shade(accent, 40), 'hair')
    pix.put(14, 34, accent, 'hair')
    pix.put(32, 34, accent, 'hair')
    pix.put(15, 37, accent, 'hair')
    pix.put(33, 37, accent, 'hair')
    if (heroClass === 'mage') drawMageHat(pix, tunic, accent)
    if (heroClass === 'rogue') drawHood(pix, hair.shade)
    return
  }

  if (race === 'orc') {
    // GREEN · BROAD · TUSKS · SCAR · SNARL · TOPKNOT
    pix.stamp(
      4,
      2,
      [
        // 28-wide · topknot spike (not a hat)
        '...........AA...............',
        '..........AAAA..............',
        '.........AAAAAA.............',
        '........AHHHHHHA............',
        '.......AHHHHHHHHA...........',
        // wide green skull
        '.....LLLSSSSSSSSSLLL........',
        '....LLSSSSSSSSSSSSSLL.......',
        '...LSSSXSSSSSSSSXSSSSL......',
        '...SS.WESKK..KKSEW.SSS......',
        '...SS..SSSSSSSS..SSSS.......',
        '...SSS..DDDDDD..SSSSS.......',
        // snarl cavity + upward tusks
        '...SSSS.mmmmmm.SSSSSS.......',
        '...SSSi........iSSSSS.......',
        '...SSS.iMMMMMMi.SSSSS.......',
        '...SSSS.iiiiii.SSSSSS.......',
        '....SSSSSSSSSSSSSSSS........',
        // bulky torso + thick arms
        '...LL.TTTVVVVVTTT.LL........',
        '..LLL.TTTVUUUVTTT.LLL.......',
        '.LLLL.TTTVUUUVTTT.LLLL......',
        '.LLL..TTTVVVVVTTT..LLL......',
        '.LL...TTTTTTTTTT...LL.......',
        '.L.....TTTTTTTT.....L.......',
        // powerful thick legs with knee shade
        '.....PPPPPP..PPPPPP.........',
        '....PPPPPPP..PPPPPPP........',
        '....PPPPPP....PPPPPP........',
        '....PPPPPP....PPPPPP........',
        '....PPPPpP....PpPPPP........',
        '....PPPPpP....PpPPPP........',
        '....PPPPPP....PPPPPP........',
        '....PPPPPP....PPPPPP........',
        '....PPPPPP....PPPPPP........',
        '....PPPPPP....PPPPPP........',
        '....PPPPpP....PpPPPP........',
        '....PPPPPP....PPPPPP........',
        '....PPPPPP....PPPPPP........',
        '....PPPPPPP..PPPPPPP........',
        '....PPPPPPP..PPPPPPP........',
        '....bbbbbbb..bbbbbbb........',
        '...bbbbbBbb..bbBbbbbb.......',
        '...bbbbbbb....bbbbbbb.......',
      ],
      {
        A,
        H: B,
        L,
        S,
        X,
        W,
        E,
        K,
        D,
        M,
        m: mouth,
        i: ivory,
        T,
        U,
        V,
        P,
        p: shade(pant, -25),
        b: boot,
        B: bootHi,
        '.': '',
      },
      'body',
    )
    // Diagonal battle scar across cheek
    for (let i = 0; i < 10; i++) {
      pix.put(14 + Math.floor(i / 2), 10 + i, X, 'head')
      pix.put(15 + Math.floor(i / 2), 10 + i, D, 'head')
    }
    if (heroClass === 'mage') drawMageHat(pix, tunic, accent)
    if (heroClass === 'rogue') drawHood(pix, hair.shade)
    return
  }

  // HUMAN — heroic adventurer: windblown hair, clear face, cocky smirk, contrapposto
  pix.stamp(
    6,
    2,
    [
      // 28-wide · messy windblown hair (spikes, not a bucket)
      '.......A..AA.A.A............',
      '.....AAHAAHAAHAAA...........',
      '....AHHHHHHHHHHHHA..........',
      '...AHHH..HHHH..HHHA.........',
      '..AHH..LLLLLLLL..HHA........',
      '..HH.LLSSSSSSSSLL.HH........',
      '..H.LSSSSSSSSSSSSL.H........',
      // clear eyes + soft smirk (no V-mouth)
      '....SSWE.SS.EWSSSS..........',
      '....SS..KKKK..SSSS..........',
      '....SSS..DD..SSSSS..........',
      '....SSSS.....SSSSS..........',
      '....SSSSS.M.SSSSSS..........',
      '....SSSSSSMMSSSSSS..........',
      '.....SSSSSSSSSSSS...........',
      // heroic torso — weight shifts right
      '....LL.TTVVVVTT.LL..........',
      '...LLL.TTVUUUVTT.LLL........',
      '..LLLL.TTVUUUVTT..LL........',
      '..LLL..TTVVVVVTT...L........',
      '..LL...TTTTTTTT.............',
      '..L.....TTTTTT..............',
      // contrapposto: weight on right — thicker legs + knees
      '......PPPP...PPPPP..........',
      '.....PPPPP...PPPPPP.........',
      '.....PPPP.....PPPPP.........',
      '.....PPPP.....PPPPP.........',
      '.....PPpP.....PPpPP.........',
      '.....PPpP.....PPpPP.........',
      '.....PPPP.....PPPPP.........',
      '.....PPPP.....PPPPP.........',
      '.....PPPP.....PPPPP.........',
      '.....PPPP.....PPPPPP........',
      '.....PPPP.....PPPPPP........',
      '.....PPpP.....PPpPPP........',
      '.....PPPP.....PPPPPP........',
      '.....PPPP.....PPPPPP........',
      '.....PPPP.....PPPPPP........',
      '.....PPPPP...PPPPPPP........',
      '.....PPPPP...PPPPPPP........',
      '.....bbbbb...bbbbbbb........',
      '....bbbBbB...bBbbbbb........',
      '....bbbbb.....bbbbbb........',
    ],
    {
      A,
      H: B,
      L,
      S,
      W,
      E,
      K,
      D,
      M,
      T,
      U,
      V,
      P,
      p: shade(pant, -25),
      b: boot,
      B: bootHi,
      '.': '',
    },
    'body',
  )
  // Cocky side-smirk (subtle, not a V)
  pix.put(26, 14, M, 'head')
  pix.put(27, 14, shade(M, 25), 'head')
  // Hand resting on hip — attached to right arm
  pix.stamp(32, 22, ['LL.', 'LLS', 'LSS', '.SS', '..S'], { L, S, '.': '' }, 'body')
  // Wind fringe spikes on hairline
  for (let i = 0; i < 8; i++) {
    pix.put(14 + i, 3 + (i % 3), A, 'hair')
    pix.put(15 + i, 4 + (i % 2), H, 'hair')
  }
  if (heroClass === 'mage') drawMageHat(pix, tunic, accent)
  if (heroClass === 'warrior') {
    // short sideburns
    pix.stamp(10, 10, ['HH', 'HH'], { H: B, '.': '' }, 'hair')
    pix.stamp(34, 10, ['HH', 'HH'], { H: B, '.': '' }, 'hair')
  }
  if (heroClass === 'rogue') drawHood(pix, hair.shade)
  if (heroClass === 'ranger') {
    for (let i = 0; i < 14; i++) pix.put(12 + Math.floor(i / 5), 20 + i, shade(tunic, -50), 'chest')
  }
}

function drawMageHat(pix: Pix, tunic: string, accent: string) {
  const t = tunic
  const a = accent
  pix.stamp(
    14,
    0,
    [
      '......aa......',
      '.....att......',
      '....attt......',
      '...atttt......',
      '..atttttt.....',
      '.TTTTTTTTTT...',
      'TTTTTTTTTTTT..',
    ],
    { a, t, T: shade(tunic, -20), '.': '' },
    'hair',
  )
}

function drawHood(pix: Pix, shadeCol: string) {
  pix.stamp(
    12,
    4,
    [
      '..HHHHHHHHHH..',
      '.HHHHHHHHHHHH.',
      'HHHH......HHHH',
      'HHH........HHH',
      'HH..........HH',
    ],
    { H: shadeCol, '.': '' },
    'hair',
  )
}

function drawCape(pix: Pix, primary: string, secondary: string) {
  const p = primary
  const s = secondary
  pix.stamp(
    8,
    16,
    [
      'pp..........pp',
      'ppp........ppp',
      'pppp......pppp',
      '.ppp......ppp.',
      '.pppp....pppp.',
      '..ppp....ppp..',
      '..pppp..pppp..',
      '...ppp..ppp...',
      '...ppsssspp...',
      '....ppsspp....',
      '....ppsspp....',
      '.....pssp.....',
    ],
    { p, s, '.': '' },
    'cape',
  )
}

function drawChestGear(
  pix: Pix,
  id: WearableId,
  colors: { primary: string; secondary: string; highlight?: string },
  accent: string,
  yOff = 0,
  beltY = 22,
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 30)
  if (id === 'cloth-tunic') {
    for (let x = 18; x < 30; x += 2) pix.put(x, 20 + yOff, s, 'chest')
  } else if (id === 'leather-vest') {
    pix.stamp(
      16,
      18 + yOff,
      [
        'pp........pp',
        'pps......spp',
        'pp.s....s.pp',
        'pp..shhs..pp',
        'pp..ssss..pp',
        'pp.ssssss.pp',
        '.ppsssssspp.',
        '..ss....ss..',
      ],
      { p, s, h, '.': '' },
      'chest',
    )
  } else if (id === 'iron-mail') {
    pix.stamp(
      15,
      16 + yOff,
      [
        '.phphphphph.',
        'phspspspsphp',
        'psphphphphsp',
        'phspspspsphp',
        'psphphphphsp',
        'phspspspsphp',
        '.pppppppppp.',
        '..sshhhhss..',
      ],
      { p, s, h, '.': '' },
      'chest',
    )
    pix.stamp(12, 16 + yOff, ['ppp', 'php', 'psp'], { p, h, s, '.': '' }, 'chest')
    pix.stamp(33, 16 + yOff, ['ppp', 'php', 'psp'], { p, h, s, '.': '' }, 'chest')
  } else if (id === 'ember-plate') {
    pix.stamp(
      15,
      15 + yOff,
      [
        '.pppppppppp.',
        'pphhhhhhhhpp',
        'ppsssssssspp',
        'pp..hhhh..pp',
        'pp.hhhhhh.pp',
        'pp..hhhh..pp',
        'ppsssssssspp',
        '.pppppppppp.',
        '..ss.aa.ss..',
      ],
      { p, s, h, a: accent, '.': '' },
      'chest',
    )
    pix.stamp(11, 15 + yOff, ['ppp', 'php', 'hph'], { p, h, '.': '' }, 'chest')
    pix.stamp(34, 15 + yOff, ['ppp', 'php', 'hph'], { p, h, '.': '' }, 'chest')
  }
  pix.put(22, beltY, accent, 'chest')
  pix.put(23, beltY, shade(accent, 40), 'chest')
  pix.put(24, beltY, accent, 'chest')
}

function drawCrown(pix: Pix, colors: { primary: string; secondary: string; highlight?: string }) {
  const p = colors.primary
  const h = colors.highlight ?? '#fff0a8'
  pix.stamp(
    14,
    2,
    ['h.h.h.h.h.', 'pppppppppp', 'pssssssssp'],
    { p, h, s: colors.secondary, '.': '' },
    'accessory',
  )
}

function drawBracers(
  pix: Pix,
  colors: { primary: string; secondary: string; highlight?: string },
  yOff = 0,
) {
  const p = colors.primary
  const h = colors.highlight ?? shade(p, 30)
  pix.stamp(12, 28 + yOff, ['ppp', 'php', 'ppp'], { p, h, '.': '' }, 'accessory')
  pix.stamp(33, 28 + yOff, ['ppp', 'php', 'ppp'], { p, h, '.': '' }, 'accessory')
}

function drawWeapon(
  pix: Pix,
  id: WearableId,
  colors: { primary: string; secondary: string; highlight?: string },
  yOff = 0,
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 40)
  if (id === 'lantern-staff') {
    pix.stamp(
      38,
      6 + yOff,
      ['..ss..', '.shhs.', 'sshhss', '.shhs.', '..ss..', '..ss..', '..ss..', '..ss..', '..ss..', '..ss..', '..ss..', '..ss..', '..ss..'],
      { s, h, '.': '' },
      'weapon',
    )
  } else if (id === 'hunter-bow') {
    pix.stamp(
      38,
      16 + yOff,
      [
        '...p..',
        '..p.w.',
        '.p..w.',
        'p...w.',
        'p...w.',
        'p...w.',
        'p...w.',
        '.p..w.',
        '..p.w.',
        '...p..',
      ],
      { p, w: '#d8d0c0', '.': '' },
      'weapon',
    )
  } else {
    // blade held at right hip/hand
    pix.stamp(
      38,
      14 + yOff,
      ['..h.', '.hh.', 'hhh.', '.hh.', '.hh.', '.hh.', '.hh.', '.hh.', '.ss.', 'ssss', '.ss.', '.ss.', '..h.'],
      { h, s, '.': '' },
      'weapon',
    )
  }
}
