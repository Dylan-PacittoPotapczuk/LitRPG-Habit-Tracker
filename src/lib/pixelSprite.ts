import { classDef } from './classes'
import { raceDef, type RaceDef } from './races'
import { WEARABLES } from './wearables'
import type { EquippedLoadout, HeroClass, HeroRace, WearableId } from './types'

/** Native sprite buffer — ≥256×400 as required (~10–20× old 32×48). */
export const SPRITE_W = 320
export const SPRITE_H = 500

type Layer =
  | 'ground'
  | 'cape'
  | 'body'
  | 'chest'
  | 'head'
  | 'hair'
  | 'accessory'
  | 'weapon'
  | 'outline'

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

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  const m = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `#${m(ar, br).toString(16).padStart(2, '0')}${m(ag, bg).toString(16).padStart(2, '0')}${m(ab, bb).toString(16).padStart(2, '0')}`
}

function damage(hex: string): string {
  if (hex === OUTLINE) return hex
  return mix(hex, '#6b2418', 0.35)
}

/** Packed RGBA + z canvas at SPRITE_W × SPRITE_H. */
export class Pix {
  rgba: Uint8ClampedArray
  zbuf: Int8Array
  readonly w = SPRITE_W
  readonly h = SPRITE_H
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
  rect(x0: number, y0: number, w: number, h: number, hex: string, layer: Layer) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.put(x, y, hex, layer)
  }
  oval(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    mid: string,
    light: string,
    dark: string,
    layer: Layer,
  ) {
    const rx2 = rx * rx
    const ry2 = ry * ry
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / rx2 + (y * y) / ry2
        if (d > 1) continue
        // Smooth multi-stop lighting (not a hard left/right split)
        const lit = (-x * 0.45 - y * 0.75 + 0.15) / 1.4
        let t = Math.max(0, Math.min(1, (lit + 1) / 2))
        let c = mix(dark, light, t)
        c = mix(c, mid, 0.35)
        if (d > 0.88) c = mix(c, dark, 0.7)
        else if (d > 0.72) c = mix(c, dark, 0.35)
        // Specular hot-spot
        if (d < 0.35 && lit > 0.35) c = mix(c, light, 0.45)
        this.put(cx + x, cy + y, c, layer)
      }
    }
  }
  /** Multi-band fabric fold across a horizontal strip. */
  fold(x0: number, y0: number, w: number, h: number, base: string, layer: Layer) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = x / Math.max(1, w - 1)
        let c = base
        if (t < 0.12) c = shade(base, 32)
        else if (t < 0.22) c = shade(base, 18)
        else if (t > 0.88) c = shade(base, -38)
        else if (t > 0.78) c = shade(base, -22)
        else if (t > 0.45 && t < 0.55) c = shade(base, -12) // center crease
        this.put(x0 + x, y0 + y, c, layer)
      }
    }
  }
  /** Fine weave / stitch noise on cloth. */
  weave(x0: number, y0: number, w: number, h: number, base: string, layer: Layer) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = x / Math.max(1, w - 1)
        let c = base
        if (t < 0.1) c = shade(base, 28)
        else if (t > 0.9) c = shade(base, -32)
        if ((x + y * 2) % 6 === 0) c = shade(c, -14)
        if ((x * 3 + y) % 11 === 0) c = shade(c, 10)
        this.put(x0 + x, y0 + y, c, layer)
      }
    }
  }
  rivet(x: number, y: number, hi: string, layer: Layer) {
    this.put(x, y, hi, layer)
    this.put(x + 1, y, shade(hi, 30), layer)
    this.put(x, y + 1, shade(hi, -40), layer)
    this.put(x + 1, y + 1, shade(hi, -20), layer)
    this.put(x - 1, y, shade(hi, -50), layer)
  }
  /** Micro-dither + edge shading so large fills don't read as flat stamps. */
  detailPass() {
    for (let i = 0; i < this.zbuf.length; i++) {
      const z = this.zbuf[i]
      if (z < 0 || z === Z.outline || z === Z.ground) continue
      const o = i * 4
      const x = i % SPRITE_W
      const y = (i / SPRITE_W) | 0
      // Bayer-ish dither
      const bayer = ((x & 1) * 2 + (y & 1)) % 4
      let dr = 0
      if (bayer === 0) dr = 6
      else if (bayer === 3) dr = -6
      // Neighbor edge darken
      let edge = false
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const ni = (y + dy) * SPRITE_W + (x + dx)
        if (x + dx < 0 || x + dx >= SPRITE_W || y + dy < 0 || y + dy >= SPRITE_H || this.zbuf[ni] < 0) {
          edge = true
          break
        }
      }
      if (edge) dr -= 18
      // Speckle
      if (((x * 17 + y * 31) % 23) === 0) dr += 10
      if (((x * 13 + y * 7) % 29) === 0) dr -= 8
      this.rgba[o] = Math.max(0, Math.min(255, this.rgba[o] + dr))
      this.rgba[o + 1] = Math.max(0, Math.min(255, this.rgba[o + 1] + dr))
      this.rgba[o + 2] = Math.max(0, Math.min(255, this.rgba[o + 2] + Math.round(dr * 0.85)))
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
      const hex = `#${this.rgba[o].toString(16).padStart(2, '0')}${this.rgba[o + 1]
        .toString(16)
        .padStart(2, '0')}${this.rgba[o + 2].toString(16).padStart(2, '0')}`
      const d = damage(hex)
      const [r, g, b] = parseHex(d)
      this.rgba[o] = r
      this.rgba[o + 1] = g
      this.rgba[o + 2] = b
    }
  }
}

function raceScale(race: HeroRace | null) {
  switch (race) {
    case 'dwarf':
      return { yShift: 56, headScale: 1.1, torsoW: 1.22, legH: 0.7, armW: 1.18 }
    case 'elf':
      return { yShift: 0, headScale: 0.94, torsoW: 0.86, legH: 1.1, armW: 0.88 }
    case 'orc':
      return { yShift: 10, headScale: 1.14, torsoW: 1.2, legH: 0.94, armW: 1.22 }
    default:
      return { yShift: 14, headScale: 1, torsoW: 1, legH: 1, armW: 1 }
  }
}

/** Build a dense SPRITE_W×SPRITE_H RGBA buffer (not a tiny stamp). */
export function buildSprite(
  heroRace: HeroRace | null,
  heroClass: HeroClass | null,
  equipped: EquippedLoadout,
  damaged: boolean,
): Uint8ClampedArray {
  const pix = new Pix()
  const race = raceDef(heroRace) ?? raceDef('human')!
  const cls = classDef(heroClass)
  const rs = raceScale(heroRace)

  const skin = race.skin
  let hair = { ...race.hair }
  if (heroClass === 'mage' && heroRace !== 'elf') {
    hair = { light: '#6a6a8a', mid: '#2a2a4a', shade: '#12122a' }
  } else if (heroClass === 'rogue') {
    hair = {
      light: mix(hair.light, '#2a2218', 0.4),
      mid: mix(hair.mid, '#1a1210', 0.5),
      shade: '#0a0806',
    }
  }
  const tunic = cls?.palette.tunic ?? '#6b5a4a'
  const accent = cls?.palette.accent ?? '#d4894a'
  const pant = shade(tunic, -42)
  const boot = '#2a2018'

  const chest = equipped.chest ? WEARABLES[equipped.chest] : null
  const cape = equipped.cape ? WEARABLES[equipped.cape] : null
  const weapon = equipped.weapon ? WEARABLES[equipped.weapon] : null
  const accessory = equipped.accessory ? WEARABLES[equipped.accessory] : null

  const cx = Math.floor(SPRITE_W / 2)
  const headCy = 88 + rs.yShift
  const headRx = Math.round(42 * rs.headScale)
  const headRy = Math.round(50 * rs.headScale)
  const neckY = headCy + headRy - 2
  const torsoTop = neckY + 10
  const torsoW = Math.round(90 * rs.torsoW)
  const torsoH = Math.round(130 * (heroRace === 'dwarf' ? 0.88 : 1))
  const hipY = torsoTop + torsoH
  const legH = Math.round(145 * rs.legH)
  const footY = Math.min(SPRITE_H - 32, hipY + legH)
  const armW = Math.round(22 * rs.armW)
  const armLen = Math.round(118 * (heroRace === 'dwarf' ? 0.85 : 1))
  const shoulderY = torsoTop + 12

  // Ground
  pix.oval(cx, footY + 12, 72, 14, '#6b4a32', '#8a6848', '#4a3220', 'ground')
  pix.oval(cx, footY + 10, 58, 10, '#7a5a40', '#9a7858', '#5a4030', 'ground')
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    pix.put(cx + Math.round(Math.cos(a) * 50), footY + 10 + Math.round(Math.sin(a) * 8), '#5a4030', 'ground')
  }

  if (cape) drawCape(pix, cx, shoulderY, torsoW, cape.colors)

  // Legs with seams + knee pad
  const legGap = Math.round(10 * rs.torsoW)
  const legW = Math.round(28 * rs.torsoW)
  const leftLegX = cx - legGap - legW
  const rightLegX = cx + legGap
  for (let y = 0; y < footY - hipY + 4; y++) {
    const taper = y > legH * 0.72 ? Math.round((y - legH * 0.72) * 0.15) : 0
    pix.weave(leftLegX + taper, hipY - 2 + y, legW - taper * 2, 1, pant, 'body')
    pix.weave(rightLegX + taper, hipY - 2 + y, legW - taper * 2, 1, pant, 'body')
    if (y === Math.round(legH * 0.4)) {
      pix.rect(leftLegX + 4, hipY - 2 + y, legW - 8, 3, shade(pant, -45), 'body')
      pix.rect(rightLegX + 4, hipY - 2 + y, legW - 8, 3, shade(pant, -45), 'body')
      pix.rect(leftLegX + 6, hipY - 3 + y, legW - 12, 1, shade(pant, 20), 'body')
      pix.rect(rightLegX + 6, hipY - 3 + y, legW - 12, 1, shade(pant, 20), 'body')
    }
  }

  const bootTop = footY - 34
  if (accessory?.id === 'verdant-boots') {
    drawBoots(pix, leftLegX - 2, rightLegX - 2, legW + 4, bootTop, footY, accessory.colors, 'accessory')
  } else {
    drawBoots(
      pix,
      leftLegX - 2,
      rightLegX - 2,
      legW + 4,
      bootTop,
      footY,
      { primary: boot, secondary: shade(boot, -20), highlight: shade(boot, 28) },
      'body',
    )
  }

  // Undershirt — tapered torso with shoulder slope (not a flat box)
  const tx0 = cx - Math.floor(torsoW / 2)
  for (let y = 0; y < torsoH; y++) {
    const t = y / torsoH
    const shoulder = t < 0.12 ? Math.round((0.12 - t) * 28) : 0
    const waist = t > 0.55 ? Math.round((t - 0.55) * 28) : 0
    const w = torsoW + shoulder - waist
    const x0 = cx - Math.floor(w / 2)
    pix.weave(x0, torsoTop + y, w, 1, tunic, 'body')
    // horizontal cloth wrinkle every ~10px
    if (y % 10 === 4) {
      for (let x = 4; x < w - 4; x++) {
        const bump = Math.round(Math.sin(x * 0.35) * 2)
        pix.put(x0 + x, torsoTop + y + bump, shade(tunic, -24), 'body')
      }
    }
  }

  if (chest) drawChest(pix, chest.id, cx, torsoTop, torsoW, torsoH, chest.colors, accent)

  // Arms — slight outward bow + deltoid bulge
  const leftArmX = tx0 - armW - 2
  const rightArmX = tx0 + torsoW + 2
  for (let y = 0; y < armLen; y++) {
    const bow = Math.round(Math.sin((y / armLen) * Math.PI) * 3)
    const bulge = y < 18 ? Math.round((18 - y) * 0.25) : 0
    const lw = armW + bulge
    pix.fold(leftArmX - bow - Math.floor(bulge / 2), shoulderY + y, lw, 1, skin.mid, 'body')
    pix.fold(rightArmX + bow - Math.floor(bulge / 2), shoulderY + y, lw, 1, skin.mid, 'body')
    if ((y * 3) % 5 === 0) {
      pix.put(leftArmX - bow + 4, shoulderY + y, skin.light, 'body')
      pix.put(rightArmX + bow + 4, shoulderY + y, skin.light, 'body')
    }
    if (y === Math.round(armLen * 0.48)) {
      pix.rect(leftArmX - bow + 2, shoulderY + y, lw - 4, 3, skin.deep, 'body')
      pix.rect(rightArmX + bow + 2, shoulderY + y, lw - 4, 3, skin.deep, 'body')
    }
  }
  // Shoulders
  pix.oval(leftArmX + 4, shoulderY + 4, 14, 12, skin.mid, skin.light, skin.shade, 'body')
  pix.oval(rightArmX + armW - 4, shoulderY + 4, 14, 12, skin.mid, skin.light, skin.shade, 'body')
  pix.oval(leftArmX + armW / 2 - 3, shoulderY + armLen + 5, 12, 10, skin.mid, skin.light, skin.shade, 'body')
  pix.oval(rightArmX + armW / 2 + 3, shoulderY + armLen + 5, 12, 10, skin.mid, skin.light, skin.shade, 'body')
  for (const hx of [leftArmX + armW / 2 - 3, rightArmX + armW / 2 + 3]) {
    for (let f = -7; f <= 7; f += 3.5) {
      const fx = Math.round(hx + f)
      pix.rect(fx - 1, shoulderY + armLen + 12, 3, 7, skin.mid, 'body')
      pix.put(fx, shoulderY + armLen + 18, skin.shade, 'body')
      pix.put(fx, shoulderY + armLen + 19, skin.deep, 'body')
    }
  }

  if (accessory?.id === 'rune-bracers' || accessory?.id === 'copper-ring') {
    drawBracers(pix, leftArmX - 1, rightArmX - 1, armW + 2, shoulderY + Math.round(armLen * 0.62), accessory.colors)
  }

  pix.fold(cx - 10, neckY, 20, 14, skin.mid, 'body')
  pix.put(cx - 10, neckY + 3, skin.shade, 'body')
  pix.put(cx + 9, neckY + 3, skin.shade, 'body')

  drawHead(pix, cx, headCy, headRx, headRy, race, heroRace, heroClass, hair, tunic, accent)

  if (accessory?.id === 'crown-of-dawn') {
    drawCrown(pix, cx, headCy - headRy - 6, accessory.colors)
  }

  if (weapon) drawWeapon(pix, weapon.id, rightArmX + armW + 6, shoulderY - 10, weapon.colors)

  pix.detailPass()
  pix.outlinePass()
  if (damaged) pix.applyDamage()
  return pix.rgba
}

function drawCape(
  pix: Pix,
  cx: number,
  shoulderY: number,
  torsoW: number,
  colors: { primary: string; secondary: string; highlight?: string },
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 32)
  pix.rect(cx - 34, shoulderY - 6, 68, 10, p, 'cape')
  pix.rect(cx - 32, shoulderY - 4, 64, 4, h, 'cape')
  for (const side of [-1, 1] as const) {
    const ox = cx + side * (Math.floor(torsoW / 2) + 6)
    for (let i = 0; i < 160; i++) {
      const wave = Math.sin(i * 0.08) * 7 * side
      const x0 = Math.round(ox + wave - (side < 0 ? 18 : 0))
      const w = 18 + Math.floor(i / 16)
      pix.fold(x0, shoulderY + i, w, 1, p, 'cape')
      // vertical fold lines
      if (i % 5 === 0) pix.put(x0 + Math.floor(w * 0.35), shoulderY + i, s, 'cape')
      if (i % 9 === 0) pix.put(x0 + Math.floor(w * 0.65), shoulderY + i, h, 'cape')
      pix.put(x0 + (side < 0 ? 0 : w - 1), shoulderY + i, s, 'cape')
      if (i > 120) {
        for (let k = 0; k < 3; k++) {
          pix.put(x0 + 4 + k * 5 + (i % 3), shoulderY + i, s, 'cape')
        }
      }
    }
  }
}

function drawBoots(
  pix: Pix,
  leftX: number,
  rightX: number,
  w: number,
  top: number,
  footY: number,
  colors: { primary: string; secondary: string; highlight?: string },
  layer: Layer,
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 28)
  for (const lx of [leftX, rightX]) {
    for (let y = top; y < footY; y++) {
      const flare = y > footY - 10 ? Math.round((y - (footY - 10)) * 0.7) : 0
      pix.fold(lx - flare, y, w + flare * 2, 1, p, layer)
      pix.put(lx - flare, y, s, layer)
      // stitching
      if (y % 4 === 0) pix.put(lx + 3, y, h, layer)
      if (y % 4 === 0) pix.put(lx + w - 4, y, h, layer)
    }
    pix.rect(lx - 3, footY - 4, w + 8, 4, s, layer)
    // buckles
    pix.rect(lx + Math.floor(w / 2) - 4, top + 8, 10, 5, h, layer)
    pix.rect(lx + Math.floor(w / 2) - 2, top + 9, 6, 3, s, layer)
    pix.rivet(lx + Math.floor(w / 2) - 1, top + 18, h, layer)
    pix.rivet(lx + Math.floor(w / 2) - 1, top + 26, h, layer)
  }
}

function drawChest(
  pix: Pix,
  id: WearableId,
  cx: number,
  torsoTop: number,
  torsoW: number,
  torsoH: number,
  colors: { primary: string; secondary: string; highlight?: string },
  accent: string,
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 36)
  const aw = torsoW + (id === 'iron-mail' || id === 'ember-plate' ? 10 : 6)
  const ax0 = cx - Math.floor(aw / 2)
  const ah = torsoH - 8

  for (let y = 0; y < ah; y++) {
    const waist = y > ah * 0.7 ? Math.round((y - ah * 0.7) * 0.22) : 0
    const w = aw - waist * 2
    const x0 = cx - Math.floor(w / 2)
    for (let x = 0; x < w; x++) {
      let c = p
      const edge = x < 4 || x > w - 5
      if (edge) c = s
      if (id === 'cloth-tunic') {
        if (y < 12 && x > w / 2 - 14 && x < w / 2 + 14) continue
        // Weave + vertical folds + stitch rows
        const fold = Math.sin((x / w) * Math.PI * 3) * 18
        c = shade(p, fold)
        if (y % 6 === 2 && x > 6 && x < w - 6) c = shade(c, -22)
        if ((x + y * 2) % 4 === 0) c = shade(c, 8)
        if (x === Math.floor(w * 0.28) || x === Math.floor(w * 0.72)) c = shade(p, -28)
        // Pocket flap
        if (y > ah * 0.45 && y < ah * 0.58 && x > w * 0.55 && x < w * 0.82) {
          c = shade(p, y === Math.floor(ah * 0.45) ? 20 : -10)
        }
      } else if (id === 'leather-vest') {
        // Organic leather: curved folds, grain, stitch, rivets — not a grid
        const foldL = Math.sin((y / ah) * Math.PI * 2.2 + x * 0.08) * 14
        const foldR = Math.cos((y / ah) * Math.PI * 1.7 - x * 0.06) * 10
        const grain = ((x * 5 + y * 3) % 7) - 3
        c = shade(p, foldL * 0.4 + foldR * 0.25 + grain * 3)
        // Center lace channel
        if (x >= w / 2 - 4 && x <= w / 2 + 3) c = mix(s, shade(p, -20), 0.5)
        if (x >= w / 2 - 1 && x <= w / 2 && y > 18 && y < ah - 18) c = h
        // Eyelets
        if ((x === w / 2 - 4 || x === w / 2 + 3) && y % 7 === 2 && y > 18 && y < ah - 18) {
          pix.rivet(x0 + x, torsoTop + y, h, 'chest')
          continue
        }
        // Diagonal wear scratch
        if (Math.abs(x - y * 0.4 - w * 0.2) < 1.2 && y > 24 && y < ah - 24) c = shade(c, 18)
        // Shoulder straps (curved)
        if (y < 24 && (x < 18 || x > w - 19)) {
          c = mix(s, p, y / 24)
          if (y % 3 === 0) c = shade(c, -12)
        }
        // Stitch along edge
        if ((x === 5 || x === w - 6) && y % 3 === 0) c = h
        // Scattered rivets on panels
        if (y > 30 && y < ah - 30 && (x === 12 || x === w - 13) && y % 16 === 0) {
          pix.rivet(x0 + x, torsoTop + y, h, 'chest')
          continue
        }
      } else if (id === 'iron-mail') {
        const cell = (x + y * 2) % 4
        if (cell === 0) c = h
        else if (cell === 1) c = p
        else if (cell === 2) c = s
        else c = mix(p, h, 0.3)
        if (edge) c = s
      } else if (id === 'ember-plate') {
        if (y % 10 < 3) c = mix(p, h, 0.5)
        else if (y % 10 < 6) c = s
        else c = p
        // plate seams
        if (y % 10 === 0) c = shade(s, -20)
        const dx = x - w / 2
        const dy = y - 36
        if (dx * dx + dy * dy < 120) c = mix(h, '#ffe0a0', 0.55)
        if (dx * dx + dy * dy < 40) c = '#ffe8b0'
        if (x % 14 === 7 && y > 20 && y < ah - 20 && Math.abs(x - w / 2) > 16) {
          pix.rivet(x0 + x, torsoTop + y, h, 'chest')
          continue
        }
      }
      pix.put(x0 + x, torsoTop + y, c, 'chest')
    }
  }

  if (id === 'iron-mail' || id === 'ember-plate') {
    pix.oval(ax0 + 6, torsoTop + 16, 20, 16, p, h, s, 'chest')
    pix.oval(ax0 + aw - 6, torsoTop + 16, 20, 16, p, h, s, 'chest')
    for (const ox of [ax0 + 6, ax0 + aw - 6]) {
      for (const [dx, dy] of [
        [-6, -4],
        [6, -4],
        [0, 2],
        [-8, 6],
        [8, 6],
        [-4, 10],
        [4, 10],
      ]) {
        pix.rivet(ox + dx, torsoTop + 16 + dy, h, 'chest')
      }
    }
  }

  if (id === 'cloth-tunic') {
    pix.rect(cx - 14, torsoTop, 28, 4, s, 'chest')
    // collar stitch
    for (let i = -12; i <= 12; i += 3) pix.put(cx + i, torsoTop + 5, shade(s, 20), 'chest')
  }

  // Belt + buckle detail
  pix.rect(ax0 - 2, torsoTop + ah - 10, aw + 4, 9, s, 'chest')
  pix.rect(ax0, torsoTop + ah - 9, aw, 2, shade(s, 25), 'chest')
  pix.rect(cx - 14, torsoTop + ah - 14, 28, 16, h, 'chest')
  pix.rect(cx - 10, torsoTop + ah - 12, 20, 12, accent, 'chest')
  pix.rect(cx - 6, torsoTop + ah - 10, 12, 8, shade(accent, 30), 'chest')
  pix.put(cx, torsoTop + ah - 6, '#fff0c0', 'chest')
  pix.rivet(cx - 16, torsoTop + ah - 6, h, 'chest')
  pix.rivet(cx + 14, torsoTop + ah - 6, h, 'chest')
}

function drawBracers(
  pix: Pix,
  leftX: number,
  rightX: number,
  w: number,
  y: number,
  colors: { primary: string; secondary: string; highlight?: string },
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 30)
  for (const ax of [leftX, rightX]) {
    pix.fold(ax, y, w, 20, p, 'accessory')
    pix.rect(ax, y, w, 3, h, 'accessory')
    pix.rect(ax, y + 17, w, 3, s, 'accessory')
    // rune glow
    pix.rect(ax + 3, y + 7, w - 6, 6, mix(h, '#c8e0ff', 0.4), 'accessory')
    pix.put(ax + Math.floor(w / 2), y + 9, '#e8f0ff', 'accessory')
    pix.rivet(ax + 2, y + 4, h, 'accessory')
    pix.rivet(ax + w - 4, y + 4, h, 'accessory')
  }
}

function drawHead(
  pix: Pix,
  cx: number,
  headCy: number,
  headRx: number,
  headRy: number,
  race: RaceDef,
  heroRace: HeroRace | null,
  heroClass: HeroClass | null,
  hair: { light: string; mid: string; shade: string },
  tunic: string,
  accent: string,
) {
  const skin = race.skin

  pix.oval(cx, headCy, headRx, headRy, skin.mid, skin.light, skin.shade, 'head')
  // forehead highlight
  pix.oval(cx - 6, headCy - 18, 16, 10, mix(skin.mid, skin.light, 0.5), skin.light, skin.mid, 'head')
  // cheeks
  pix.oval(cx - 20, headCy + 10, 10, 8, mix(skin.mid, '#e07060', 0.22), skin.light, skin.shade, 'head')
  pix.oval(cx + 20, headCy + 10, 10, 8, mix(skin.mid, '#e07060', 0.22), skin.light, skin.shade, 'head')
  // jaw
  pix.rect(cx - 14, headCy + headRy - 14, 28, 10, skin.shade, 'head')
  // freckles / grain
  for (let i = 0; i < 18; i++) {
    const fx = cx - 16 + ((i * 7) % 33)
    const fy = headCy + 4 + ((i * 11) % 20)
    if ((i * 3) % 5 === 0) pix.put(fx, fy, mix(skin.mid, '#c07050', 0.25), 'head')
  }

  // Ears
  if (race.traits.ears === 'pointed') {
    const tall = heroRace === 'elf' ? 36 : 20
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < tall; i++) {
        const taper = Math.max(2, 10 - Math.floor(i / 3))
        const x = cx + side * (headRx + 1) + (side < 0 ? -taper : 0)
        for (let t = 0; t < taper; t++) {
          const c = t === 0 || t === taper - 1 ? skin.shade : i < 5 ? skin.light : skin.mid
          pix.put(x + t, headCy - 6 - i, c, 'head')
        }
        // inner ear
        if (i > 4 && i < tall - 6 && taper > 4) {
          pix.put(x + Math.floor(taper / 2), headCy - 6 - i, mix(skin.mid, '#e08070', 0.3), 'head')
        }
      }
    }
  } else if (race.traits.ears === 'round') {
    pix.oval(cx - headRx - 4, headCy + 2, 10, 14, skin.mid, skin.light, skin.shade, 'head')
    pix.oval(cx + headRx + 4, headCy + 2, 10, 14, skin.mid, skin.light, skin.shade, 'head')
    pix.oval(cx - headRx - 2, headCy + 2, 4, 6, mix(skin.mid, '#e08070', 0.25), skin.light, skin.shade, 'head')
    pix.oval(cx + headRx + 2, headCy + 2, 4, 6, mix(skin.mid, '#e08070', 0.25), skin.light, skin.shade, 'head')
  } else {
    pix.oval(cx - headRx - 2, headCy + 4, 8, 11, skin.mid, skin.light, skin.shade, 'head')
    pix.oval(cx + headRx + 2, headCy + 4, 8, 11, skin.mid, skin.light, skin.shade, 'head')
  }

  if (race.traits.brow === 'heavy') {
    pix.rect(cx - 26, headCy - 14, 52, 8, skin.shade, 'head')
    pix.rect(cx - 24, headCy - 16, 48, 3, skin.deep, 'head')
    // brow hairs
    for (let i = -22; i <= 22; i += 2) pix.put(cx + i, headCy - 17, hair.shade, 'hair')
  }

  // Eyebrows — individual hairs
  for (const side of [-1, 1] as const) {
    const bx = cx + side * 16
    for (let i = -10; i <= 10; i++) {
      const arch = Math.round((i * i) / 40)
      const c = i % 3 === 0 ? hair.light : hair.shade
      pix.put(bx + i * side * 0 + i, headCy - 16 - arch, c, 'hair')
      pix.put(bx + i, headCy - 15 - arch, hair.mid, 'hair')
    }
  }

  // Eyes — large enough to read at card scale
  const eyeY = headCy - 4
  const eyeSpread = 16
  for (const side of [-1, 1] as const) {
    const ex = cx + side * eyeSpread
    pix.oval(ex, eyeY, 12, 9, skin.deep, skin.shade, skin.deep, 'head')
    pix.oval(ex, eyeY, 10, 7, '#f7f2ea', '#ffffff', '#e8e0d4', 'head')
    pix.oval(ex + side, eyeY, 5, 5, race.eye, shade(race.eye, 45), shade(race.eye, -45), 'head')
    // iris rings
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2
      pix.put(ex + side + Math.round(Math.cos(ang) * 3), eyeY + Math.round(Math.sin(ang) * 3), shade(race.eye, -20), 'head')
    }
    pix.rect(ex + side - 1, eyeY - 1, 3, 3, '#0a0806', 'head')
    pix.put(ex + side - 2, eyeY - 3, '#ffffff', 'head')
    pix.put(ex + side - 1, eyeY - 2, '#ffffff', 'head')
    // upper lid + lashes
    pix.rect(ex - 10, eyeY - 7, 20, 3, skin.shade, 'head')
    for (let i = -9; i <= 9; i += 2) {
      pix.put(ex + i, eyeY - 8, hair.shade, 'hair')
      pix.put(ex + i, eyeY - 9, hair.mid, 'hair')
    }
    // lower lid
    pix.rect(ex - 8, eyeY + 5, 16, 2, mix(skin.mid, skin.shade, 0.5), 'head')
  }

  // Nose — bridge, ball, nostrils (readable at distance)
  for (let y = 0; y < 18; y++) {
    const nw = 2 + Math.floor(y / 7)
    pix.rect(cx - Math.floor(nw / 2), headCy + 2 + y, nw, 1, y < 6 ? skin.light : skin.shade, 'head')
  }
  pix.oval(cx, headCy + 20, 8, 6, skin.mid, skin.light, skin.shade, 'head')
  pix.rect(cx - 7, headCy + 20, 3, 3, skin.deep, 'head')
  pix.rect(cx + 4, headCy + 20, 3, 3, skin.deep, 'head')
  pix.put(cx - 6, headCy + 21, '#1a100c', 'head')
  pix.put(cx + 5, headCy + 21, '#1a100c', 'head')
  pix.put(cx - 1, headCy + 8, skin.light, 'head')
  pix.put(cx, headCy + 8, '#fff5e8', 'head')

  // Mouth with lip volume
  const mouthY = headCy + 28
  if (race.traits.tusks) {
    pix.rect(cx - 12, mouthY, 24, 6, race.lip, 'head')
    pix.rect(cx - 10, mouthY + 1, 20, 3, mix(race.lip, '#fff', 0.18), 'head')
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 16; i++) {
        pix.rect(cx + side * 12 - 2, mouthY + i, 5, 1, i < 3 ? '#fff8e8' : '#efe6d4', 'head')
        pix.put(cx + side * 12, mouthY + i, '#d8d0c0', 'head')
      }
    }
  } else {
    pix.rect(cx - 10, mouthY, 20, 5, race.lip, 'head')
    pix.rect(cx - 8, mouthY + 1, 16, 2, mix(race.lip, '#fff', 0.28), 'head')
    pix.rect(cx - 6, mouthY + 3, 12, 2, mix(race.lip, '#801020', 0.35), 'head')
    pix.put(cx - 10, mouthY + 4, skin.shade, 'head')
    pix.put(cx + 9, mouthY + 4, skin.shade, 'head')
  }

  if (race.traits.beard === 'full') {
    for (let y = 0; y < 58; y++) {
      const w = 22 + Math.floor(y * 0.6) - Math.floor(Math.abs(y - 28) * 0.18)
      for (let x = -Math.floor(w / 2); x <= Math.floor(w / 2); x++) {
        const edge = Math.abs(x) > w / 2 - 3
        const strand = (x * 5 + y * 7) % 5 === 0
        const hi = (x * 3 + y) % 9 === 0
        const c = edge ? hair.shade : hi ? hair.light : strand ? mix(hair.mid, hair.light, 0.4) : hair.mid
        pix.put(cx + x, mouthY + 2 + y, c, 'hair')
      }
    }
  } else if (race.traits.beard === 'stubble' && heroClass === 'warrior') {
    for (let y = 0; y < 14; y++) {
      for (let x = -16; x <= 16; x++) {
        if ((x * 5 + y * 7) % 3 === 0) pix.put(cx + x, mouthY + 3 + y, hair.mid, 'hair')
      }
    }
  }

  drawHair(pix, cx, headCy, headRx, headRy, hair, heroRace, heroClass, tunic, accent)
}

function drawHair(
  pix: Pix,
  cx: number,
  headCy: number,
  headRx: number,
  headRy: number,
  hair: { light: string; mid: string; shade: string },
  race: HeroRace | null,
  heroClass: HeroClass | null,
  tunic: string,
  accent: string,
) {
  const top = headCy - headRy

  if (heroClass === 'mage') {
    for (let i = 0; i < 88; i++) {
      const t = i / 87
      const w = Math.max(4, Math.round((headRx * 2 + 28) * (1 - t * 0.93)))
      const c = mix(tunic, accent, t * 0.45)
      pix.rect(cx - Math.floor(w / 2), top - 10 - i, w, 1, c, 'hair')
      pix.put(cx - Math.floor(w / 2), top - 10 - i, shade(tunic, -40), 'hair')
      pix.put(cx + Math.floor(w / 2), top - 10 - i, shade(tunic, -20), 'hair')
      if (i % 6 === 0) pix.put(cx - Math.floor(w / 4), top - 10 - i, shade(c, 20), 'hair')
    }
    pix.put(cx, top - 98, accent, 'hair')
    pix.put(cx - 1, top - 99, '#fff0a0', 'hair')
    pix.rect(cx - 48, top - 8, 96, 10, shade(tunic, -30), 'hair')
    pix.rect(cx - 44, top - 6, 88, 5, mix(tunic, accent, 0.3), 'hair')
    // stars on brim
    for (const bx of [-30, -10, 10, 30]) pix.put(cx + bx, top - 4, accent, 'hair')
    return
  }

  // Crown — dense strand field (not a flat helmet plate)
  for (let y = -8; y < Math.round(headRy * 0.48); y++) {
    const span = Math.round(
      Math.sqrt(Math.max(0, 1 - ((y + 8) / (headRy * 0.85 + 8)) ** 2)) * (headRx + 8),
    )
    for (let x = -span; x <= span; x++) {
      const edge = Math.abs(x) > span - 4 || y <= -5
      const strand = (x * 9 + y * 13) % 3 === 0
      const hi = (x * 2 + y * 3) % 7 === 0
      const lo = (x * 5 + y * 2) % 11 === 0
      let c = hair.mid
      if (edge) c = hair.shade
      else if (hi) c = hair.light
      else if (lo) c = hair.shade
      else if (strand) c = mix(hair.mid, hair.light, 0.5)
      pix.put(cx + x, top + y, c, 'hair')
    }
  }
  // Explicit strand curves over crown
  for (let s = -headRx; s <= headRx; s += 3) {
    for (let i = 0; i < 24; i++) {
      const wx = Math.round(Math.sin(i * 0.35 + s * 0.2) * 2)
      pix.put(cx + s + wx, top - 2 + i, i % 2 === 0 ? hair.light : hair.mid, 'hair')
      if (i % 4 === 0) pix.put(cx + s + wx + 1, top - 2 + i, hair.shade, 'hair')
    }
  }

  // Fringe — each strand independent length + twin tip
  for (let x = -Math.round(headRx * 0.92); x <= Math.round(headRx * 0.92); x++) {
    if (Math.abs(x) < 5) continue
    const drop = 12 + (Math.abs(x) % 7) + ((x * x) % 6)
    for (let y = 0; y < drop; y++) {
      const c = y === 0 ? hair.light : (x + y) % 3 === 0 ? hair.shade : hair.mid
      pix.put(cx + x, headCy - 24 + y, c, 'hair')
      if (y > 2 && y % 3 === 0) pix.put(cx + x + (x > 0 ? 1 : -1), headCy - 24 + y, hair.shade, 'hair')
    }
  }

  if (heroClass === 'rogue') {
    for (let y = -10; y < 26; y++) {
      const span = headRx + 10 - Math.max(0, y - 10)
      for (let x = -span; x <= span; x++) {
        if (y > 8 && Math.abs(x) < span - 8) continue
        const fold = Math.abs(x) > span - 3 ? hair.shade : (x + y) % 5 === 0 ? hair.light : hair.mid
        pix.put(cx + x, headCy - 12 + y, fold, 'hair')
      }
    }
    pix.rect(cx - headRx + 6, headCy - 6, headRx * 2 - 12, 12, '#1a1218', 'hair')
    pix.rect(cx - 22, headCy - 4, 12, 8, '#0a0806', 'hair')
    pix.rect(cx + 10, headCy - 4, 12, 8, '#0a0806', 'hair')
  }

  if (heroClass === 'ranger' || race === 'elf') {
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 90; i++) {
        const wave = Math.round(Math.sin(i * 0.16) * 4)
        const x = cx + side * (headRx + 3) + wave
        pix.rect(x, headCy + 6 + i, 5, 1, hair.mid, 'hair')
        pix.put(x + (side < 0 ? 0 : 4), headCy + 6 + i, hair.light, 'hair')
        pix.put(x + (side < 0 ? 4 : 0), headCy + 6 + i, hair.shade, 'hair')
        if (i % 8 === 0) pix.put(x + 2, headCy + 6 + i, hair.light, 'hair')
      }
    }
  }

  if (heroClass === 'warrior') {
    pix.rect(cx - headRx - 4, headCy - 6, 8, 26, hair.shade, 'hair')
    pix.rect(cx + headRx - 4, headCy - 6, 8, 26, hair.shade, 'hair')
    for (let i = 0; i < 20; i++) {
      pix.put(cx - headRx - 2 + (i % 3), headCy - 4 + i, hair.mid, 'hair')
      pix.put(cx + headRx + (i % 3), headCy - 4 + i, hair.mid, 'hair')
    }
  }

  if (race === 'dwarf') {
    pix.oval(cx, top + 6, headRx + 10, 18, hair.mid, hair.light, hair.shade, 'hair')
    for (let i = 0; i < 30; i++) {
      const x = cx - headRx + ((i * 11) % (headRx * 2))
      pix.put(x, top + 2 + (i % 8), hair.light, 'hair')
    }
  }
}

function drawCrown(
  pix: Pix,
  cx: number,
  top: number,
  colors: { primary: string; secondary: string; highlight?: string },
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? '#fff0a8'
  pix.rect(cx - 34, top, 68, 10, p, 'accessory')
  pix.rect(cx - 34, top - 2, 68, 3, h, 'accessory')
  pix.rect(cx - 34, top + 8, 68, 3, s, 'accessory')
  for (const px of [-26, -13, 0, 13, 26]) {
    pix.rect(cx + px - 4, top - 18, 8, 18, p, 'accessory')
    pix.put(cx + px, top - 20, h, 'accessory')
    pix.put(cx + px, top - 21, '#fff8d0', 'accessory')
    pix.rivet(cx + px - 1, top + 2, h, 'accessory')
  }
}

function drawWeapon(
  pix: Pix,
  id: WearableId,
  x: number,
  y: number,
  colors: { primary: string; secondary: string; highlight?: string },
) {
  const p = colors.primary
  const s = colors.secondary
  const h = colors.highlight ?? shade(p, 40)

  if (id === 'lantern-staff') {
    pix.fold(x + 5, y, 8, 190, s, 'weapon')
    pix.rect(x + 7, y, 3, 190, shade(s, 28), 'weapon')
    pix.rect(x - 6, y - 10, 28, 30, s, 'weapon')
    pix.rect(x - 4, y - 7, 24, 24, h, 'weapon')
    pix.oval(x + 8, y + 5, 10, 10, '#ffe6a0', '#fff8d0', '#f0b06a', 'weapon')
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      pix.put(x + 8 + Math.round(Math.cos(a) * 14), y + 5 + Math.round(Math.sin(a) * 14), '#f0c878', 'weapon')
    }
  } else if (id === 'hunter-bow') {
    for (let i = 0; i < 110; i++) {
      const t = i / 109
      const curve = Math.round(Math.sin(t * Math.PI) * 22)
      pix.rect(x + curve, y + i, 5, 1, p, 'weapon')
      pix.put(x + curve + 4, y + i, s, 'weapon')
      pix.put(x, y + i, '#d8d0c0', 'weapon')
    }
    pix.rect(x, y + 48, 10, 14, h, 'weapon')
  } else {
    pix.fold(x + 5, y - 12, 10, 85, h, 'weapon')
    pix.rect(x + 4, y - 12, 2, 85, '#ffffff', 'weapon')
    pix.rect(x + 12, y - 10, 2, 80, shade(p, -30), 'weapon')
    for (let i = 0; i < 18; i++) {
      pix.rect(x + 5 + Math.floor(i / 5), y - 12 - i, 10 - Math.floor(i / 2), 1, h, 'weapon')
    }
    pix.rect(x - 6, y + 72, 28, 7, s, 'weapon')
    pix.rect(x - 4, y + 70, 24, 2, h, 'weapon')
    pix.fold(x + 5, y + 79, 10, 34, s, 'weapon')
    for (let i = 0; i < 6; i++) pix.rect(x + 5, y + 81 + i * 5, 10, 1, shade(s, 22), 'weapon')
    pix.oval(x + 10, y + 118, 8, 8, h, shade(h, 20), s, 'weapon')
  }
}
