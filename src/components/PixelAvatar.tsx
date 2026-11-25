import { useEffect, useRef } from 'react'
import { classDef } from '../lib/classes'
import { raceDef, type RaceDef } from '../lib/races'
import { WEARABLES } from '../lib/wearables'
import type { EquippedLoadout, HeroClass, HeroRace, WearableId } from '../lib/types'

/**
 * Dense detailed pixel heroes — spirit of classic DnD sheet art
 * at ~10–20× our old 32×48 footprint (256×400 ≈ 64× the pixels).
 * Native display ~400px tall; optional light nearest-neighbor upscale.
 */
const W = 256
const H = 400

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

/** Packed RGBA + z canvas. */
class Pix {
  rgba: Uint8ClampedArray
  zbuf: Int8Array
  constructor() {
    this.rgba = new Uint8ClampedArray(W * H * 4)
    this.zbuf = new Int8Array(W * H).fill(-1)
  }
  put(x: number, y: number, hex: string, layer: Layer) {
    const xi = x | 0
    const yi = y | 0
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return
    const zi = Z[layer]
    const i = yi * W + xi
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
  /** Filled ellipse with light from top-left. */
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
        let c = mid
        const lit = -x * 0.55 - y * 0.85
        if (d > 0.78) c = dark
        else if (lit > 0.55) c = light
        else if (lit < -0.45) c = dark
        this.put(cx + x, cy + y, c, layer)
      }
    }
  }
  /** Soft vertical fold strip. */
  fold(x0: number, y0: number, w: number, h: number, base: string, layer: Layer) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = x / Math.max(1, w - 1)
        const c = t < 0.25 ? shade(base, 28) : t > 0.75 ? shade(base, -35) : base
        this.put(x0 + x, y0 + y, c, layer)
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
      const x = i % W
      const y = (i / W) | 0
      for (const [dx, dy] of dirs) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const ni = ny * W + nx
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
      return { yShift: 48, headScale: 1.08, torsoW: 1.2, legH: 0.72, armW: 1.15 }
    case 'elf':
      return { yShift: 0, headScale: 0.95, torsoW: 0.88, legH: 1.08, armW: 0.9 }
    case 'orc':
      return { yShift: 8, headScale: 1.12, torsoW: 1.18, legH: 0.95, armW: 1.2 }
    default:
      return { yShift: 12, headScale: 1, torsoW: 1, legH: 1, armW: 1 }
  }
}

function buildSprite(
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

  const cx = 128
  const headCy = 72 + rs.yShift
  const headRx = Math.round(34 * rs.headScale)
  const headRy = Math.round(40 * rs.headScale)
  const neckY = headCy + headRy - 2
  const torsoTop = neckY + 8
  const torsoW = Math.round(72 * rs.torsoW)
  const torsoH = Math.round(108 * (heroRace === 'dwarf' ? 0.9 : 1))
  const hipY = torsoTop + torsoH
  const legH = Math.round(118 * rs.legH)
  const footY = Math.min(H - 28, hipY + legH)
  const armW = Math.round(18 * rs.armW)
  const armLen = Math.round(96 * (heroRace === 'dwarf' ? 0.85 : 1))
  const shoulderY = torsoTop + 10

  // ——— Ground disk ———
  pix.oval(cx, footY + 10, 58, 12, '#6b4a32', '#8a6848', '#4a3220', 'ground')
  pix.oval(cx, footY + 8, 48, 8, '#7a5a40', '#9a7858', '#5a4030', 'ground')

  // ——— Cape ———
  if (cape) drawCape(pix, cx, shoulderY, torsoW, cape.colors)

  // ——— Legs ———
  const legGap = Math.round(8 * rs.torsoW)
  const legW = Math.round(22 * rs.torsoW)
  const leftLegX = cx - legGap - legW
  const rightLegX = cx + legGap
  for (let y = 0; y < footY - hipY + 4; y++) {
    const taper = y > legH * 0.7 ? 1 : 0
    pix.fold(leftLegX + taper, hipY - 2 + y, legW - taper * 2, 1, pant, 'body')
    pix.fold(rightLegX + taper, hipY - 2 + y, legW - taper * 2, 1, pant, 'body')
    // outer seam
    pix.put(leftLegX + taper, hipY - 2 + y, shade(pant, -30), 'body')
    pix.put(rightLegX + legW - 1 - taper, hipY - 2 + y, shade(pant, -30), 'body')
    // knee crease
    if (y === Math.round(legH * 0.42)) {
      pix.rect(leftLegX + 3, hipY - 2 + y, legW - 6, 2, shade(pant, -40), 'body')
      pix.rect(rightLegX + 3, hipY - 2 + y, legW - 6, 2, shade(pant, -40), 'body')
    }
  }

  // Boots
  const bootTop = footY - 28
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
      { primary: boot, secondary: shade(boot, -20), highlight: shade(boot, 25) },
      'body',
    )
  }

  // ——— Torso undershirt ———
  const tx0 = cx - Math.floor(torsoW / 2)
  for (let y = 0; y < torsoH; y++) {
    const waist = y > torsoH * 0.65 ? Math.round((y - torsoH * 0.65) * 0.15) : 0
    const w = torsoW - waist * 2
    const x0 = cx - Math.floor(w / 2)
    pix.fold(x0, torsoTop + y, w, 1, tunic, 'body')
    pix.put(x0, torsoTop + y, shade(tunic, -40), 'body')
    pix.put(x0 + w - 1, torsoTop + y, shade(tunic, -25), 'body')
  }

  // ——— Chest armor ———
  if (chest) drawChest(pix, chest.id, cx, torsoTop, torsoW, torsoH, chest.colors, accent)

  // ——— Arms ———
  const leftArmX = tx0 - armW - 2
  const rightArmX = tx0 + torsoW + 2
  for (let y = 0; y < armLen; y++) {
    pix.fold(leftArmX, shoulderY + y, armW, 1, skin.mid, 'body')
    pix.fold(rightArmX, shoulderY + y, armW, 1, skin.mid, 'body')
    pix.put(leftArmX, shoulderY + y, skin.shade, 'body')
    pix.put(rightArmX + armW - 1, shoulderY + y, skin.shade, 'body')
    if (y < 4) {
      pix.put(leftArmX + 1, shoulderY + y, skin.light, 'body')
      pix.put(rightArmX + 1, shoulderY + y, skin.light, 'body')
    }
    if (y === Math.round(armLen * 0.48)) {
      pix.rect(leftArmX + 2, shoulderY + y, armW - 4, 2, skin.deep, 'body')
      pix.rect(rightArmX + 2, shoulderY + y, armW - 4, 2, skin.deep, 'body')
    }
  }
  // Hands
  pix.oval(leftArmX + armW / 2, shoulderY + armLen + 4, 10, 8, skin.mid, skin.light, skin.shade, 'body')
  pix.oval(rightArmX + armW / 2, shoulderY + armLen + 4, 10, 8, skin.mid, skin.light, skin.shade, 'body')

  if (accessory?.id === 'rune-bracers' || accessory?.id === 'copper-ring') {
    drawBracers(pix, leftArmX - 1, rightArmX - 1, armW + 2, shoulderY + Math.round(armLen * 0.62), accessory.colors)
  }

  // Neck
  pix.fold(cx - 8, neckY, 16, 12, skin.mid, 'body')
  pix.put(cx - 8, neckY + 2, skin.shade, 'body')
  pix.put(cx + 7, neckY + 2, skin.shade, 'body')

  // ——— Head ———
  drawHead(pix, cx, headCy, headRx, headRy, race, heroRace, heroClass, hair, tunic, accent)

  // Crown
  if (accessory?.id === 'crown-of-dawn') {
    drawCrown(pix, cx, headCy - headRy - 4, accessory.colors)
  }

  // Weapon
  if (weapon) drawWeapon(pix, weapon.id, rightArmX + armW + 4, shoulderY - 8, weapon.colors)

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
  // Collar
  pix.rect(cx - 28, shoulderY - 4, 56, 8, p, 'cape')
  pix.rect(cx - 26, shoulderY - 2, 52, 3, h, 'cape')
  // Flowing panels
  for (const side of [-1, 1] as const) {
    const ox = cx + side * (Math.floor(torsoW / 2) + 4)
    for (let i = 0; i < 130; i++) {
      const wave = Math.sin(i * 0.09) * 5 * side
      const x0 = Math.round(ox + wave - (side < 0 ? 14 : 0))
      const w = 14 + Math.floor(i / 18)
      pix.fold(x0, shoulderY + i, w, 1, p, 'cape')
      pix.put(x0 + (side < 0 ? 0 : w - 1), shoulderY + i, s, 'cape')
      if (i % 7 === 0) pix.put(x0 + Math.floor(w / 2), shoulderY + i, h, 'cape')
      // hem folds
      if (i > 100) {
        const foldX = x0 + 3 + ((i + side) % 5)
        pix.put(foldX, shoulderY + i, s, 'cape')
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
      const flare = y > footY - 8 ? Math.round((y - (footY - 8)) * 0.6) : 0
      pix.fold(lx - flare, y, w + flare * 2, 1, p, layer)
      pix.put(lx - flare, y, s, layer)
      if (y === top + 4 || y === top + 12) pix.rect(lx + 4, y, w - 8, 1, h, layer)
    }
    // sole
    pix.rect(lx - 2, footY - 3, w + 6, 3, s, layer)
    // lace / buckle
    pix.put(lx + Math.floor(w / 2), top + 6, h, layer)
    pix.put(lx + Math.floor(w / 2), top + 14, h, layer)
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
  const aw = torsoW + (id === 'iron-mail' || id === 'ember-plate' ? 8 : 4)
  const ax0 = cx - Math.floor(aw / 2)
  const ah = torsoH - 6

  for (let y = 0; y < ah; y++) {
    const waist = y > ah * 0.7 ? Math.round((y - ah * 0.7) * 0.2) : 0
    const w = aw - waist * 2
    const x0 = cx - Math.floor(w / 2)
    for (let x = 0; x < w; x++) {
      let c = p
      const edge = x < 3 || x > w - 4
      if (edge) c = s
      if (id === 'cloth-tunic') {
        if (y < 8 && x > w / 2 - 10 && x < w / 2 + 10) continue // neckline
        if (y % 10 === 4 && x > 6 && x < w - 6) c = shade(p, -18) // stitch
        if (x > 4 && x < 10 && y > 12 && y < ah - 10) c = shade(p, 18) // fold hi
      } else if (id === 'leather-vest') {
        if (x >= w / 2 - 3 && x <= w / 2 + 2) c = s
        if ((x === w / 2 || x === w / 2 - 1) && y % 8 === 3) c = h // rivets/laces
        if (y < 14 && (x < 10 || x > w - 11)) c = s // straps
      } else if (id === 'iron-mail') {
        // ring mail checker
        if ((x + y) % 3 === 0) c = h
        else if ((x + y) % 3 === 1) c = p
        else c = s
        if (edge) c = s
      } else if (id === 'ember-plate') {
        if (y % 8 < 3) c = mix(p, h, 0.45)
        else if (y % 8 < 5) c = s
        else c = p
        // glowing core
        const dx = x - w / 2
        const dy = y - 28
        if (dx * dx + dy * dy < 80) c = mix(h, '#ffe0a0', 0.5)
        if (dx * dx + dy * dy < 28) c = '#ffe8b0'
      }
      pix.put(x0 + x, torsoTop + y, c, 'chest')
    }
  }

  // Pauldrons
  if (id === 'iron-mail' || id === 'ember-plate') {
    pix.oval(ax0 + 4, torsoTop + 14, 16, 14, p, h, s, 'chest')
    pix.oval(ax0 + aw - 4, torsoTop + 14, 16, 14, p, h, s, 'chest')
    // rivets on pauldrons
    for (const ox of [ax0 + 4, ax0 + aw - 4]) {
      for (const [dx, dy] of [
        [-4, -2],
        [4, -2],
        [0, 4],
        [-6, 6],
        [6, 6],
      ]) {
        pix.put(ox + dx, torsoTop + 14 + dy, h, 'chest')
        pix.put(ox + dx + 1, torsoTop + 14 + dy, shade(h, 20), 'chest')
      }
    }
  }

  if (id === 'cloth-tunic') {
    // open neck showing skin — handled by skip; add collar trim
    pix.rect(cx - 12, torsoTop, 24, 3, s, 'chest')
  }

  // Belt
  pix.rect(ax0 - 2, torsoTop + ah - 8, aw + 4, 7, s, 'chest')
  pix.rect(cx - 10, torsoTop + ah - 10, 20, 11, h, 'chest')
  pix.rect(cx - 6, torsoTop + ah - 8, 12, 7, accent, 'chest')
  pix.put(cx, torsoTop + ah - 5, shade(accent, 40), 'chest')
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
    pix.fold(ax, y, w, 16, p, 'accessory')
    pix.rect(ax, y, w, 2, h, 'accessory')
    pix.rect(ax, y + 14, w, 2, s, 'accessory')
    pix.put(ax + Math.floor(w / 2), y + 7, h, 'accessory')
    pix.put(ax + Math.floor(w / 2) + 1, y + 8, '#c8e0ff', 'accessory')
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

  // Skull
  pix.oval(cx, headCy, headRx, headRy, skin.mid, skin.light, skin.shade, 'head')
  // Cheek warmth
  pix.oval(cx - 16, headCy + 8, 8, 6, mix(skin.mid, '#e07060', 0.2), skin.light, skin.shade, 'head')
  pix.oval(cx + 16, headCy + 8, 8, 6, mix(skin.mid, '#e07060', 0.2), skin.light, skin.shade, 'head')
  // Chin shade
  pix.rect(cx - 10, headCy + headRy - 10, 20, 6, skin.shade, 'head')

  // Ears
  if (race.traits.ears === 'pointed') {
    const tall = heroRace === 'elf' ? 28 : 16
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < tall; i++) {
        const taper = Math.max(2, 8 - Math.floor(i / 3))
        const x = cx + side * (headRx + 1) + (side < 0 ? -taper : 0)
        for (let t = 0; t < taper; t++) {
          const c = t === 0 || t === taper - 1 ? skin.shade : i < 4 ? skin.light : skin.mid
          pix.put(x + t, headCy - 4 - i, c, 'head')
        }
      }
    }
  } else if (race.traits.ears === 'round') {
    pix.oval(cx - headRx - 2, headCy + 2, 8, 12, skin.mid, skin.light, skin.shade, 'head')
    pix.oval(cx + headRx + 2, headCy + 2, 8, 12, skin.mid, skin.light, skin.shade, 'head')
  } else {
    pix.oval(cx - headRx, headCy + 4, 6, 9, skin.mid, skin.light, skin.shade, 'head')
    pix.oval(cx + headRx, headCy + 4, 6, 9, skin.mid, skin.light, skin.shade, 'head')
  }

  // Brow ridge
  if (race.traits.brow === 'heavy') {
    pix.rect(cx - 22, headCy - 10, 44, 6, skin.shade, 'head')
    pix.rect(cx - 20, headCy - 12, 40, 2, skin.deep, 'head')
  }

  // Eyes — full detail
  const eyeY = headCy - 2
  const eyeSpread = 14
  for (const side of [-1, 1] as const) {
    const ex = cx + side * eyeSpread
    // socket
    pix.oval(ex, eyeY, 9, 7, skin.deep, skin.shade, skin.deep, 'head')
    // sclera
    pix.oval(ex, eyeY, 7, 5, '#f7f2ea', '#ffffff', '#e8e0d4', 'head')
    // iris
    pix.oval(ex + side, eyeY, 4, 4, race.eye, shade(race.eye, 40), shade(race.eye, -40), 'head')
    // pupil
    pix.rect(ex + side - 1, eyeY - 1, 3, 3, '#0a0806', 'head')
    // specular
    pix.put(ex + side - 2, eyeY - 2, '#ffffff', 'head')
    pix.put(ex + side - 1, eyeY - 2, '#ffffff', 'head')
    // lid
    pix.rect(ex - 8, eyeY - 5, 16, 3, skin.shade, 'head')
    // lashes
    for (let i = -6; i <= 6; i += 2) pix.put(ex + i, eyeY - 6, hair.shade, 'hair')
  }

  // Nose
  pix.rect(cx - 1, headCy + 4, 3, 10, skin.shade, 'head')
  pix.put(cx - 2, headCy + 12, skin.deep, 'head')
  pix.put(cx + 2, headCy + 12, skin.shade, 'head')
  pix.rect(cx - 3, headCy + 13, 7, 2, skin.mid, 'head')
  pix.put(cx, headCy + 6, skin.light, 'head')

  // Mouth
  const mouthY = headCy + 22
  if (race.traits.tusks) {
    pix.rect(cx - 10, mouthY, 20, 5, race.lip, 'head')
    pix.rect(cx - 8, mouthY + 1, 16, 2, mix(race.lip, '#fff', 0.15), 'head')
    // tusks
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 12; i++) {
        pix.rect(cx + side * 10 - 2, mouthY + i, 4, 1, i < 2 ? '#fff8e8' : '#efe6d4', 'head')
      }
      pix.put(cx + side * 10, mouthY + 12, '#d8d0c0', 'head')
    }
  } else {
    pix.rect(cx - 8, mouthY, 16, 4, race.lip, 'head')
    pix.rect(cx - 6, mouthY + 1, 12, 2, mix(race.lip, '#fff', 0.22), 'head')
    pix.put(cx - 8, mouthY + 3, skin.shade, 'head')
    pix.put(cx + 7, mouthY + 3, skin.shade, 'head')
  }

  // Beard
  if (race.traits.beard === 'full') {
    for (let y = 0; y < 48; y++) {
      const w = 18 + Math.floor(y * 0.55) - Math.floor(Math.abs(y - 24) * 0.15)
      for (let x = -Math.floor(w / 2); x <= Math.floor(w / 2); x++) {
        const edge = Math.abs(x) > w / 2 - 2
        const strand = (x * 3 + y * 5) % 7 === 0
        const c = edge ? hair.shade : strand ? hair.light : hair.mid
        pix.put(cx + x, mouthY + 2 + y, c, 'hair')
      }
    }
  } else if (race.traits.beard === 'stubble' && heroClass === 'warrior') {
    for (let y = 0; y < 12; y++) {
      for (let x = -14; x <= 14; x++) {
        if ((x * 5 + y * 7) % 4 === 0) pix.put(cx + x, mouthY + 3 + y, hair.mid, 'hair')
      }
    }
  }

  // Hair / class hat
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
    // Pointed hat with band
    for (let i = 0; i < 70; i++) {
      const t = i / 69
      const w = Math.max(4, Math.round((headRx * 2 + 20) * (1 - t * 0.92)))
      const c = mix(tunic, accent, t * 0.4)
      pix.rect(cx - Math.floor(w / 2), top - 8 - i, w, 1, c, 'hair')
      pix.put(cx - Math.floor(w / 2), top - 8 - i, shade(tunic, -40), 'hair')
      pix.put(cx + Math.floor(w / 2), top - 8 - i, shade(tunic, -20), 'hair')
    }
    pix.put(cx, top - 78, accent, 'hair')
    pix.rect(cx - 40, top - 6, 80, 8, shade(tunic, -30), 'hair')
    pix.rect(cx - 36, top - 4, 72, 4, mix(tunic, accent, 0.25), 'hair')
    return
  }

  // Hair volume on crown — strandy, not a solid helmet
  for (let y = -6; y < Math.round(headRy * 0.42); y++) {
    const span = Math.round(
      Math.sqrt(Math.max(0, 1 - ((y + 6) / (headRy * 0.75 + 6)) ** 2)) * (headRx + 6),
    )
    for (let x = -span; x <= span; x++) {
      const edge = Math.abs(x) > span - 3 || y <= -3
      const strand = (x * 7 + y * 11) % 5 === 0
      const hi = x + y < -4
      const c = edge ? hair.shade : hi || strand ? hair.light : hair.mid
      pix.put(cx + x, top + y, c, 'hair')
    }
  }

  // Bangs / fringe with part
  for (let x = -Math.round(headRx * 0.85); x <= Math.round(headRx * 0.85); x++) {
    if (Math.abs(x) < 4) continue
    const drop = 8 + (Math.abs(x) % 5)
    for (let y = 0; y < drop; y++) {
      const c = y === 0 ? hair.light : (x + y) % 3 === 0 ? hair.shade : hair.mid
      pix.put(cx + x, headCy - 18 + y, c, 'hair')
    }
  }

  if (heroClass === 'rogue') {
    // Hood
    for (let y = -8; y < 20; y++) {
      const span = headRx + 8 - Math.max(0, y - 8)
      for (let x = -span; x <= span; x++) {
        if (y > 6 && Math.abs(x) < span - 6) continue // face opening
        pix.put(cx + x, headCy - 10 + y, Math.abs(x) > span - 2 ? hair.shade : hair.mid, 'hair')
      }
    }
    // Mask band
    pix.rect(cx - headRx + 4, headCy - 4, headRx * 2 - 8, 10, '#1a1218', 'hair')
    pix.rect(cx - 18, headCy - 2, 10, 6, '#0a0806', 'hair')
    pix.rect(cx + 8, headCy - 2, 10, 6, '#0a0806', 'hair')
  }

  if (heroClass === 'ranger' || race === 'elf') {
    // Long side locks / braids
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 70; i++) {
        const wave = Math.round(Math.sin(i * 0.18) * 3)
        const x = cx + side * (headRx + 2) + wave
        pix.rect(x, headCy + 4 + i, 4, 1, hair.mid, 'hair')
        pix.put(x + (side < 0 ? 0 : 3), headCy + 4 + i, hair.light, 'hair')
        pix.put(x + (side < 0 ? 3 : 0), headCy + 4 + i, hair.shade, 'hair')
      }
    }
  }

  if (heroClass === 'warrior') {
    // Short cropped sides
    pix.rect(cx - headRx - 2, headCy - 4, 6, 20, hair.shade, 'hair')
    pix.rect(cx + headRx - 4, headCy - 4, 6, 20, hair.shade, 'hair')
  }

  if (race === 'dwarf') {
    // Thick top mop
    pix.oval(cx, top + 4, headRx + 8, 16, hair.mid, hair.light, hair.shade, 'hair')
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
  pix.rect(cx - 28, top, 56, 8, p, 'accessory')
  pix.rect(cx - 28, top - 2, 56, 2, h, 'accessory')
  pix.rect(cx - 28, top + 6, 56, 2, s, 'accessory')
  for (const px of [-22, -10, 0, 10, 22]) {
    pix.rect(cx + px - 3, top - 14, 6, 14, p, 'accessory')
    pix.put(cx + px, top - 16, h, 'accessory')
    pix.put(cx + px, top - 15, '#fff8d0', 'accessory')
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
    pix.fold(x + 4, y, 6, 160, s, 'weapon')
    pix.rect(x + 3, y, 8, 160, s, 'weapon')
    pix.rect(x + 5, y, 2, 160, shade(s, 25), 'weapon')
    // lantern
    pix.rect(x - 4, y - 8, 22, 24, s, 'weapon')
    pix.rect(x - 2, y - 5, 18, 18, h, 'weapon')
    pix.oval(x + 7, y + 4, 8, 8, '#ffe6a0', '#fff8d0', '#f0b06a', 'weapon')
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      pix.put(x + 7 + Math.round(Math.cos(a) * 12), y + 4 + Math.round(Math.sin(a) * 12), '#f0c878', 'weapon')
    }
  } else if (id === 'hunter-bow') {
    for (let i = 0; i < 90; i++) {
      const t = i / 89
      const curve = Math.round(Math.sin(t * Math.PI) * 18)
      pix.rect(x + curve, y + i, 4, 1, p, 'weapon')
      pix.put(x + curve + 3, y + i, s, 'weapon')
      pix.put(x, y + i, '#d8d0c0', 'weapon') // string
    }
    pix.rect(x, y + 38, 8, 12, h, 'weapon')
  } else {
    // blade
    pix.fold(x + 4, y - 10, 8, 70, h, 'weapon')
    pix.rect(x + 3, y - 10, 2, 70, '#ffffff', 'weapon')
    pix.rect(x + 10, y - 8, 2, 66, shade(p, -30), 'weapon')
    // tip
    for (let i = 0; i < 14; i++) {
      pix.rect(x + 4 + Math.floor(i / 4), y - 10 - i, 8 - Math.floor(i / 2), 1, h, 'weapon')
    }
    // guard
    pix.rect(x - 4, y + 60, 24, 6, s, 'weapon')
    pix.rect(x - 2, y + 58, 20, 2, h, 'weapon')
    // grip
    pix.fold(x + 4, y + 66, 8, 28, s, 'weapon')
    for (let i = 0; i < 5; i++) pix.rect(x + 4, y + 68 + i * 5, 8, 1, shade(s, 20), 'weapon')
    // pommel
    pix.oval(x + 8, y + 98, 7, 7, h, shade(h, 20), s, 'weapon')
  }
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
  // Large: ~1.4× crisp upscale → ~358×560 (in the 320–640px tall band).
  // Compact: shrink for nav/class chips.
  const scale = large ? 1.4 : 0.28
  const displayW = Math.round(W * scale)
  const displayH = Math.round(H * scale)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rgba = buildSprite(heroRace ?? null, heroClass, equipped, damaged)
    const img = ctx.createImageData(W, H)
    img.data.set(rgba)
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
