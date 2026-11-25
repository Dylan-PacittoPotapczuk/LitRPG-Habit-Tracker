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

  // Ground disk
  pix.stamp(
    12,
    58,
    ['..######..', '.########.', '##########', '.########.'],
    { '#': '#6b4a32', '.': '' },
    'ground',
  )
  // fill with shade
  for (let x = 14; x < 34; x++) {
    for (let y = 59; y < 62; y++) {
      if ((x + y) % 2 === 0) pix.put(x, y, '#5a3a28', 'ground')
      else pix.put(x, y, '#7a5a40', 'ground')
    }
  }

  if (cape) drawCape(pix, cape.colors.primary, cape.colors.secondary)

  // Race body stamp (organic silhouette)
  drawRaceBody(pix, heroRace ?? 'human', skin, pant, tunic, hair, race.eye, race.lip, heroClass, accent)

  // Chest gear overlay
  if (chest) drawChestGear(pix, chest.id, chest.colors, accent)

  if (accessory?.id === 'crown-of-dawn') drawCrown(pix, accessory.colors)
  if (accessory?.id === 'rune-bracers' || accessory?.id === 'copper-ring') {
    drawBracers(pix, accessory.colors)
  }
  if (accessory?.id === 'verdant-boots') {
    // recolor boots area
    for (let y = 52; y < 58; y++) {
      for (let x = 14; x < 34; x++) {
        const i = y * SPRITE_W + x
        if (pix.zbuf[i] === Z.body) {
          pix.put(x, y, accessory.colors.primary, 'accessory')
        }
      }
    }
  }

  if (weapon) drawWeapon(pix, weapon.id, weapon.colors)

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
  const H = hair.mid
  const A = hair.light
  const B = hair.shade
  const E = eye
  const M = lip
  const W = '#f5f0e6' // sclera
  const K = '#0a0806' // pupil
  const boot = '#2a2018'

  if (race === 'elf') {
    // Tall lithe ethereal — long ears, flowing hair, slight lean, half-lidded eyes
    pix.stamp(
      10,
      2,
      [
        '......AAAAAA......',
        '....AAAAAAAAAA....',
        '...AAAHHHHHHAAA...',
        '..AAHH......HHAA..',
        '.AHH..LLLLLL..HHA.',
        'AH...LLSSSSLL...HA',
        'H...LSSSSSSSSL...H',
        '....SSWESSSEWS....',
        '....SS.KK..KK.SS..',
        '....SS..SSSS..SS..',
        '....SSS.DD.SSS....',
        '....SSSSMMSSSS....',
        '....SSSSSSSSSS....',
        '...LSSSSSSSSSSL...',
        '..LL..TTTTTT..LL..',
        '.LL..TTUUUUTT..LL.',
        'LL...TUUUUUUT...LL',
        'L....TUUUUUUT....L',
        '.....TTUUUUTT.....',
        '......TTTTTT......',
        '.....PP....PP.....',
        '....PPP....PPP....',
        '....PP......PP....',
        '....PP......PP....',
        '....PP......PP....',
        '....PP......PP....',
        '....PP......PP....',
        '...PPP......PPP...',
        '...bbb......bbb...',
        '..bbbb......bbbb..',
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
        P,
        b: boot,
        '.': '',
      },
      'body',
    )
    // Long swept ears (weird beauty)
    pix.stamp(6, 6, ['..L', '.LS', 'LS.', 'S..', 'S..'], { L, S, '.': '' }, 'head')
    pix.stamp(37, 6, ['L..', 'SL.', '.LS', '..S', '..S'], { L, S, '.': '' }, 'head')
    // Cascading side locks
    for (let i = 0; i < 28; i++) {
      const wave = Math.round(Math.sin(i * 0.4) * 1)
      pix.put(11 + wave, 14 + i, i % 2 ? A : H, 'hair')
      pix.put(12 + wave, 14 + i, B, 'hair')
      pix.put(35 - wave, 14 + i, i % 2 ? A : H, 'hair')
      pix.put(36 - wave, 14 + i, B, 'hair')
    }
    // Class hat tweak for mage
    if (heroClass === 'mage') drawMageHat(pix, tunic, accent)
    if (heroClass === 'rogue') drawHood(pix, hair.shade)
    return
  }

  if (race === 'dwarf') {
    // Stout rugged — wide, short legs, massive braided beard, bushy brows
    pix.stamp(
      8,
      10,
      [
        '......AAAAAA......',
        '....AAAAAAAAAAAA..',
        '...AAAHHHHHHHAAA..',
        '..AHH.LLLLLLLL.HHA',
        '.AH.LLSSSSSSSSLL.A',
        '.H.LSSSSSSSSSSSL.H',
        '...SSWEKK..KKWES..',
        '...SS..SSSSSS..SS.',
        '...SSS.DDDD.SSS...',
        '...SSSSMMMMSSSS...',
        '..AAAAAAAAAAAAAA..',
        '.AAAHHHHHHHHHHAAA.',
        'AAHHHAAAAAAAHHHHAA',
        'AHH..TTTTTTTT..HHA',
        'HH..TTUUUUUUTT..HH',
        'H...TUUUUUUUUT...H',
        '....TTUUUUUUTT....',
        '.....TTTTTTTT.....',
        '....PPP....PPP....',
        '...PPPP....PPPP...',
        '...PPP......PPP...',
        '...PPP......PPP...',
        '...PPP......PPP...',
        '..bbbb......bbbb..',
        '.bbbbb......bbbbb.',
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
        P,
        b: boot,
        '.': '',
      },
      'body',
    )
    // Beard braid rings
    pix.put(18, 28, accent, 'hair')
    pix.put(29, 28, accent, 'hair')
    pix.put(18, 32, accent, 'hair')
    pix.put(29, 32, accent, 'hair')
    if (heroClass === 'mage') drawMageHat(pix, tunic, accent)
    if (heroClass === 'rogue') drawHood(pix, hair.shade)
    return
  }

  if (race === 'orc') {
    // Fierce weird — hunched bulk, tusks, scar, snarl, topknot
    pix.stamp(
      8,
      4,
      [
        '.........AA.......',
        '........AAAA......',
        '.......AAAAAA.....',
        '......AHHHHHHA....',
        '....LLLSSSSSSLLL..',
        '...LLSSSSSSSSSSLL.',
        '..LSSSSSSSSSSSSSL.',
        '..SSXESKK..KKSEXSS',
        '..SS..SSSSSS..SS..',
        '..SSS.DDDDDD.SSS..',
        '..SSSS......SSSS..',
        '..SSStt....ttSSSS.',
        '..SSS.MMMMMM.SSS..',
        '...SSSSSSSSSSSS...',
        '..LL.TTTTTTTT.LL..',
        '.LL.TTUUUUUUTT.LL.',
        'LL..TUUUUUUUUT..LL',
        'L...TTUUUUUUTT...L',
        '.....TTTTTTTT.....',
        '....PPP....PPP....',
        '...PPPP....PPPP...',
        '...PPP......PPP...',
        '...PPP......PPP...',
        '...PPP......PPP...',
        '...PPP......PPP...',
        '..bbbb......bbbb..',
        '.bbbbb......bbbbb.',
      ],
      {
        A,
        H: B,
        L,
        S,
        X,
        E,
        K,
        D,
        M,
        t: '#efe6d4',
        T,
        U,
        P,
        b: boot,
        '.': '',
      },
      'body',
    )
    // Battle scar across eye
    for (let i = 0; i < 10; i++) {
      pix.put(16 + Math.floor(i / 2), 10 + i, X, 'head')
      pix.put(17 + Math.floor(i / 2), 10 + i, D, 'head')
    }
    // Open snarl fill
    pix.put(20, 16, '#4a2020', 'head')
    pix.put(21, 16, '#4a2020', 'head')
    pix.put(22, 16, '#4a2020', 'head')
    pix.put(23, 16, '#4a2020', 'head')
    if (heroClass === 'mage') drawMageHat(pix, tunic, accent)
    if (heroClass === 'rogue') drawHood(pix, hair.shade)
    return
  }

  // Human — heroic adventurer, contrapposto lean, smirk, windblown hair
  pix.stamp(
    10,
    4,
    [
      '.....AAAAAAA......',
      '....AAAAAAAAAA....',
      '...AAAHHHHHHAAA...',
      '..AHH.LLLLLL.HHA..',
      '.AH.LLSSSSSSLL.HA.',
      '.H.LSSSSSSSSSSL.H.',
      '...SSWESKK.SEWSS..',
      '...SS..SSSS..SS...',
      '...SSS.DD.SSS.....',
      '...SSSS.M.SSSS....',
      '...SSSSMMSSSS.....',
      '....SSSSSSSS......',
      '...L..TTTT..L.....',
      '..LL.TTUUTT.LL....',
      '.LL..TUUUUT..LL...',
      'LL...TUUUUT...L...',
      'L....TTUUTT.......',
      '......TTTT........',
      '.....PP...PPP.....',
      '....PPP...PPP.....',
      '....PP.....PP.....',
      '....PP.....PP.....',
      '....PP.....PP.....',
      '....PP.....PP.....',
      '....PP....PPP.....',
      '...bbb....bbbb....',
      '..bbbb....bbbbb...',
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
      P,
      b: boot,
      '.': '',
    },
    'body',
  )
  // Smirk lift on one side
  pix.put(26, 14, M, 'head')
  pix.put(27, 13, M, 'head')
  // Hand on hip (asym)
  pix.stamp(30, 22, ['.LL', 'LL.', 'L..', 'SS.', '.S.'], { L, S, '.': '' }, 'body')
  // Windblown fringe
  for (let i = 0; i < 8; i++) {
    pix.put(14 + i, 6 + (i % 3), A, 'hair')
    pix.put(15 + i, 7 + (i % 2), H, 'hair')
  }
  if (heroClass === 'mage') drawMageHat(pix, tunic, accent)
  if (heroClass === 'warrior') {
    // short cropped sides
    pix.stamp(10, 8, ['BB', 'BB'], { B, '.': '' }, 'hair')
    pix.stamp(34, 8, ['BB', 'BB'], { B, '.': '' }, 'hair')
  }
  if (heroClass === 'rogue') drawHood(pix, hair.shade)
  if (heroClass === 'ranger') {
    // quiver strap hint
    for (let i = 0; i < 12; i++) pix.put(14 + Math.floor(i / 4), 20 + i, shade(tunic, -50), 'chest')
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
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 30)
  if (id === 'cloth-tunic') {
    // light stitch details only — body already has tunic
    for (let x = 18; x < 30; x += 2) pix.put(x, 22, s, 'chest')
  } else if (id === 'leather-vest') {
    // Open vest panels — not a face/shield blob
    pix.stamp(
      16,
      18,
      [
        'pp........pp',
        'pps......spp',
        'ppss....sspp',
        'pp.s.h..s.pp',
        'pp.ssssss.pp',
        'ppsssssssspp',
        '.pppppppppp.',
        '..ss....ss..',
      ],
      { p, s, h, '.': '' },
      'chest',
    )
  } else if (id === 'iron-mail') {
    pix.stamp(
      15,
      17,
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
    // pauldrons
    pix.stamp(12, 17, ['ppp', 'php', 'psp'], { p, h, s, '.': '' }, 'chest')
    pix.stamp(33, 17, ['ppp', 'php', 'psp'], { p, h, s, '.': '' }, 'chest')
  } else if (id === 'ember-plate') {
    pix.stamp(
      15,
      16,
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
    pix.stamp(11, 16, ['ppp', 'php', 'hph'], { p, h, '.': '' }, 'chest')
    pix.stamp(34, 16, ['ppp', 'php', 'hph'], { p, h, '.': '' }, 'chest')
  }
  // belt buckle
  pix.put(22, 30, accent, 'chest')
  pix.put(23, 30, shade(accent, 40), 'chest')
  pix.put(24, 30, accent, 'chest')
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

function drawBracers(pix: Pix, colors: { primary: string; secondary: string; highlight?: string }) {
  const p = colors.primary
  const h = colors.highlight ?? shade(p, 30)
  pix.stamp(12, 28, ['ppp', 'php', 'ppp'], { p, h, '.': '' }, 'accessory')
  pix.stamp(33, 28, ['ppp', 'php', 'ppp'], { p, h, '.': '' }, 'accessory')
}

function drawWeapon(
  pix: Pix,
  id: WearableId,
  colors: { primary: string; secondary: string; highlight?: string },
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 40)
  if (id === 'lantern-staff') {
    pix.stamp(
      36,
      8,
      ['..ss..', '.shhs.', 'sshhss', '.shhs.', '..ss..', '..ss..', '..ss..', '..ss..', '..ss..', '..ss..', '..ss..', '..ss..'],
      { s, h, '.': '' },
      'weapon',
    )
  } else if (id === 'hunter-bow') {
    pix.stamp(
      34,
      14,
      [
        '...p..',
        '..p.w.',
        '.p..w.',
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
    // blade
    pix.stamp(
      36,
      12,
      ['..h.', '.hh.', 'hhh.', '.hh.', '.hh.', '.hh.', '.hh.', '.ss.', 'ssss', '.ss.', '.ss.', '..h.'],
      { h, s, '.': '' },
      'weapon',
    )
  }
}
