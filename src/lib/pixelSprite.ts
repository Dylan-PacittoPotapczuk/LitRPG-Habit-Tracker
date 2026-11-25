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

/** Race silhouette + pose — breaks the wooden-doll A-pose. */
function racePose(race: HeroRace | null) {
  switch (race) {
    case 'dwarf':
      // Stout / rugged cool — wide base, low center, fists ready
      return {
        yShift: 64,
        headScale: 1.12,
        torsoW: 1.32,
        legH: 0.62,
        armW: 1.28,
        hipShift: 0,
        lean: 0,
        headTilt: 0,
        weight: 0 as -1 | 0 | 1,
        leftArm: 'akimbo' as const,
        rightArm: 'fist' as const,
        jaw: 'square' as const,
        expression: 'grin' as const,
      }
    case 'elf':
      // Sleek ethereal weird-beauty — elongated, S-curve, head tilt
      return {
        yShift: -4,
        headScale: 0.9,
        torsoW: 0.78,
        legH: 1.18,
        armW: 0.82,
        hipShift: -14,
        lean: -7,
        headTilt: 5,
        weight: -1 as -1 | 0 | 1,
        leftArm: 'grace' as const,
        rightArm: 'grace' as const,
        jaw: 'narrow' as const,
        expression: 'enigmatic' as const,
      }
    case 'orc':
      // Fierce / weird intimidating — forward lean, scar, snarl
      return {
        yShift: 8,
        headScale: 1.18,
        torsoW: 1.28,
        legH: 0.9,
        armW: 1.35,
        hipShift: 8,
        lean: 10,
        headTilt: -3,
        weight: 1 as -1 | 0 | 1,
        leftArm: 'forward' as const,
        rightArm: 'fist' as const,
        jaw: 'heavy' as const,
        expression: 'snarl' as const,
      }
    default:
      // Human — heroic adventurer cool, contrapposto + smirk
      return {
        yShift: 10,
        headScale: 1,
        torsoW: 1.02,
        legH: 1,
        armW: 1.05,
        hipShift: 12,
        lean: 4,
        headTilt: 2,
        weight: 1 as -1 | 0 | 1,
        leftArm: 'loose' as const,
        rightArm: 'hip' as const,
        jaw: 'hero' as const,
        expression: 'smirk' as const,
      }
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
  const rs = racePose(heroRace)

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

  const cx = Math.floor(SPRITE_W / 2) + rs.lean
  const headCx = cx + rs.headTilt
  const headCy = 88 + rs.yShift
  const headRx = Math.round(42 * rs.headScale)
  const headRy = Math.round(
    (rs.jaw === 'narrow' ? 54 : rs.jaw === 'heavy' ? 48 : 50) * rs.headScale,
  )
  const neckY = headCy + headRy - 2
  const torsoTop = neckY + 8
  const torsoW = Math.round(90 * rs.torsoW)
  const torsoH = Math.round(128 * (heroRace === 'dwarf' ? 0.92 : heroRace === 'elf' ? 1.05 : 1))
  const hipCx = cx + rs.hipShift
  const hipY = torsoTop + torsoH
  const legH = Math.round(145 * rs.legH)
  const footY = Math.min(SPRITE_H - 32, hipY + legH)
  const armW = Math.round(22 * rs.armW)
  const armLen = Math.round(118 * (heroRace === 'dwarf' ? 0.8 : heroRace === 'elf' ? 1.08 : 1))
  const shoulderY = torsoTop + 10

  // Ground
  pix.oval(hipCx, footY + 12, 72, 14, '#6b4a32', '#8a6848', '#4a3220', 'ground')
  pix.oval(hipCx, footY + 10, 58, 10, '#7a5a40', '#9a7858', '#5a4030', 'ground')

  if (cape) drawCape(pix, cx, shoulderY, torsoW, cape.colors)

  // Legs — contrapposto / race stance (not parallel cylinders)
  const legGap = Math.round(10 * rs.torsoW) + (heroRace === 'dwarf' ? 6 : 0)
  const legW = Math.round(28 * rs.torsoW)
  const plant = rs.weight // planted leg side
  const leftLegX = hipCx - legGap - legW - (plant === -1 ? 4 : plant === 1 ? -2 : 0)
  const rightLegX = hipCx + legGap + (plant === 1 ? 4 : plant === -1 ? -2 : 0)
  for (let y = 0; y < footY - hipY + 4; y++) {
    const t = y / Math.max(1, legH)
    // weight leg thicker; free leg slight bend/outward
    const leftBend = plant === -1 ? 0 : Math.round(Math.sin(t * Math.PI) * (heroRace === 'elf' ? 8 : 5))
    const rightBend = plant === 1 ? 0 : -Math.round(Math.sin(t * Math.PI) * (heroRace === 'elf' ? 8 : 5))
    const leftThick = plant === -1 ? 2 : 0
    const rightThick = plant === 1 ? 2 : 0
    const taper = t > 0.72 ? Math.round((t - 0.72) * 12) : 0
    pix.weave(
      leftLegX + leftBend + taper,
      hipY - 2 + y,
      legW + leftThick - taper * 2,
      1,
      pant,
      'body',
    )
    pix.weave(
      rightLegX + rightBend + taper,
      hipY - 2 + y,
      legW + rightThick - taper * 2,
      1,
      pant,
      'body',
    )
    if (y === Math.round(legH * 0.38)) {
      pix.rect(leftLegX + leftBend + 4, hipY - 2 + y, legW - 8, 3, shade(pant, -45), 'body')
      pix.rect(rightLegX + rightBend + 4, hipY - 2 + y, legW - 8, 3, shade(pant, -45), 'body')
    }
  }

  const bootTop = footY - 34
  const bootCols =
    accessory?.id === 'verdant-boots'
      ? accessory.colors
      : { primary: boot, secondary: shade(boot, -20), highlight: shade(boot, 28) }
  const bootLayer = accessory?.id === 'verdant-boots' ? 'accessory' : 'body'
  drawBoots(pix, leftLegX - 2, rightLegX - 2, legW + 4, bootTop, footY, bootCols, bootLayer)

  // Torso — lean + hip offset (S-curve / heroic / stout)
  const tx0 = cx - Math.floor(torsoW / 2)
  for (let y = 0; y < torsoH; y++) {
    const t = y / torsoH
    const shoulder = t < 0.14 ? Math.round((0.14 - t) * (heroRace === 'orc' ? 40 : 26)) : 0
    const waist = t > 0.5 ? Math.round((t - 0.5) * (heroRace === 'dwarf' ? 8 : 32)) : 0
    // interpolate center from shoulders (cx) toward hips (hipCx)
    const mid = Math.round(cx + (hipCx - cx) * t)
    const w = torsoW + shoulder - waist
    const x0 = mid - Math.floor(w / 2)
    pix.weave(x0, torsoTop + y, w, 1, tunic, 'body')
    if (y % 10 === 4) {
      for (let x = 4; x < w - 4; x++) {
        const bump = Math.round(Math.sin(x * 0.35) * 2)
        pix.put(x0 + x, torsoTop + y + bump, shade(tunic, -24), 'body')
      }
    }
  }

  if (chest) drawChest(pix, chest.id, Math.round((cx + hipCx) / 2), torsoTop, torsoW, torsoH, chest.colors, accent)

  // Arms — pose-driven, not mirrored A-pose
  const leftShoulderX = tx0 - 4
  const rightShoulderX = tx0 + torsoW + 4
  const leftHand = drawArm(pix, 'left', rs.leftArm, leftShoulderX, shoulderY, armW, armLen, skin, heroRace)
  const rightHand = drawArm(pix, 'right', rs.rightArm, rightShoulderX, shoulderY, armW, armLen, skin, heroRace)

  if (accessory?.id === 'rune-bracers' || accessory?.id === 'copper-ring') {
    drawBracers(
      pix,
      leftHand.bracerX,
      rightHand.bracerX,
      armW + 2,
      leftHand.bracerY,
      accessory.colors,
    )
  }

  // Neck follows head tilt
  pix.fold(headCx - 9, neckY, 18, 14, skin.mid, 'body')
  pix.put(headCx - 9, neckY + 3, skin.shade, 'body')
  pix.put(headCx + 8, neckY + 3, skin.shade, 'body')

  drawHead(pix, headCx, headCy, headRx, headRy, race, heroRace, heroClass, hair, tunic, accent, rs)

  if (accessory?.id === 'crown-of-dawn') {
    drawCrown(pix, headCx, headCy - headRy - 6, accessory.colors)
  }

  if (weapon) {
    const wx = rs.rightArm === 'hip' ? rightHand.x + 8 : rightHand.x + armW + 4
    drawWeapon(pix, weapon.id, wx, rightHand.y - 40, weapon.colors)
  }

  pix.detailPass()
  pix.outlinePass()
  if (damaged) pix.applyDamage()
  return pix.rgba
}

type ArmStyle = 'loose' | 'hip' | 'fist' | 'akimbo' | 'grace' | 'forward'

function drawArm(
  pix: Pix,
  side: 'left' | 'right',
  style: ArmStyle,
  shoulderX: number,
  shoulderY: number,
  armW: number,
  armLen: number,
  skin: { light: string; mid: string; shade: string; deep: string },
  race: HeroRace | null,
): { x: number; y: number; bracerX: number; bracerY: number } {
  const dir = side === 'left' ? -1 : 1
  let handX = shoulderX + (side === 'left' ? -2 : armW)
  let handY = shoulderY + armLen
  const thick = race === 'orc' || race === 'dwarf' ? 4 : 0

  // Soft shoulder blend into torso — no ball-joint doll look
  for (let y = 0; y < 16; y++) {
    const w = armW + thick + 8 - Math.floor(y / 3)
    const x0 = side === 'left' ? shoulderX - w + armW : shoulderX - 4
    pix.fold(x0, shoulderY + y, w, 1, skin.mid, 'body')
  }

  for (let y = 0; y < armLen; y++) {
    const t = y / armLen
    let ox = 0
    let wy = y
    let w = armW + thick
    if (style === 'hip' && side === 'right') {
      // hand on hip — elbow out, forearm in
      ox = Math.round(Math.sin(Math.min(1, t * 1.4) * Math.PI) * 18)
      if (t > 0.55) {
        ox = 18 - Math.round((t - 0.55) * 40)
        wy = y
      }
      handX = shoulderX + ox + 4
      handY = shoulderY + Math.round(armLen * 0.72)
    } else if (style === 'akimbo') {
      ox = dir * Math.round(Math.sin(Math.min(1, t * 1.2) * Math.PI) * 16)
      if (t > 0.5) ox = dir * (16 - Math.round((t - 0.5) * 28))
      handX = shoulderX + ox + (side === 'left' ? 0 : armW)
      handY = shoulderY + Math.round(armLen * 0.7)
    } else if (style === 'fist') {
      ox = dir * Math.round(Math.sin(t * Math.PI) * 6)
      w = armW + thick + (t < 0.3 ? 3 : 0)
      handX = shoulderX + ox + (side === 'left' ? -2 : armW)
      handY = shoulderY + armLen + 2
    } else if (style === 'forward') {
      // aggressive reach
      ox = dir * -Math.round(t * 10) + (side === 'left' ? -8 : 0)
      wy = Math.round(y * 0.85)
      handX = shoulderX + ox + (side === 'left' ? -6 : armW)
      handY = shoulderY + Math.round(armLen * 0.85)
    } else if (style === 'grace') {
      ox = dir * Math.round(Math.sin(t * Math.PI) * 10)
      wy = y + Math.round(Math.sin(t * Math.PI) * 4)
      handX = shoulderX + ox + (side === 'left' ? -2 : armW)
      handY = shoulderY + armLen + 4
    } else {
      // loose
      ox = dir * Math.round(Math.sin(t * Math.PI) * 5)
      handX = shoulderX + ox + (side === 'left' ? -2 : armW)
      handY = shoulderY + armLen
    }
    const x0 = shoulderX + ox - (side === 'left' ? Math.floor(w / 2) : 0)
    pix.fold(x0, shoulderY + wy, w, 1, skin.mid, 'body')
    if ((y * 3) % 5 === 0) pix.put(x0 + 3, shoulderY + wy, skin.light, 'body')
    if (y === Math.round(armLen * 0.48)) {
      pix.rect(x0 + 2, shoulderY + wy, w - 4, 3, skin.deep, 'body')
    }
  }

  // Hand
  const hx = handX
  const hy = handY
  if (style === 'fist' || style === 'forward' || style === 'akimbo') {
    pix.oval(hx, hy, 11, 10, skin.mid, skin.light, skin.shade, 'body')
    // clenched knuckles
    for (let k = -6; k <= 6; k += 4) {
      pix.rect(hx + k - 1, hy - 2, 3, 4, skin.shade, 'body')
      pix.put(hx + k, hy - 3, skin.light, 'body')
    }
  } else {
    pix.oval(hx, hy, 11, 9, skin.mid, skin.light, skin.shade, 'body')
    for (let f = -6; f <= 6; f += 4) {
      pix.rect(hx + f - 1, hy + 6, 3, 7, skin.mid, 'body')
      pix.put(hx + f, hy + 12, skin.shade, 'body')
    }
  }

  return {
    x: hx,
    y: hy,
    bracerX: shoulderX + (side === 'left' ? -armW : 0) - 1,
    bracerY: shoulderY + Math.round(armLen * 0.55),
  }
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
  pose: ReturnType<typeof racePose>,
) {
  const skin = race.skin
  const expr = pose.expression

  // Skull shape by jaw type — not a perfect circle
  if (pose.jaw === 'narrow') {
    // Elf: elongated oval, high cheekbones
    pix.oval(cx, headCy - 4, headRx - 4, headRy + 4, skin.mid, skin.light, skin.shade, 'head')
    pix.oval(cx, headCy + 18, headRx - 10, 22, skin.mid, skin.light, skin.shade, 'head')
  } else if (pose.jaw === 'heavy') {
    // Orc: wide cranium + blocky jaw
    pix.oval(cx, headCy - 6, headRx + 4, headRy - 4, skin.mid, skin.light, skin.shade, 'head')
    pix.rect(cx - headRx + 4, headCy + 8, headRx * 2 - 8, headRy - 6, skin.mid, 'head')
    for (let y = 0; y < 18; y++) {
      const jw = headRx + 6 - Math.floor(y / 3)
      pix.fold(cx - jw, headCy + headRy - 20 + y, jw * 2, 1, skin.shade, 'head')
    }
  } else if (pose.jaw === 'square') {
    // Dwarf: rounder + broad jaw under beard
    pix.oval(cx, headCy, headRx + 2, headRy - 4, skin.mid, skin.light, skin.shade, 'head')
    pix.rect(cx - headRx + 2, headCy + 10, headRx * 2 - 4, 22, skin.mid, 'head')
  } else {
    // Human hero: strong chin
    pix.oval(cx, headCy, headRx, headRy, skin.mid, skin.light, skin.shade, 'head')
    pix.oval(cx, headCy + headRy - 12, 16, 12, skin.mid, skin.light, skin.shade, 'head')
    pix.rect(cx - 12, headCy + headRy - 18, 24, 10, skin.shade, 'head')
  }

  pix.oval(cx - 6, headCy - 18, 16, 10, mix(skin.mid, skin.light, 0.5), skin.light, skin.mid, 'head')
  pix.oval(cx - 18, headCy + 8, 11, 9, mix(skin.mid, '#e07060', 0.2), skin.light, skin.shade, 'head')
  pix.oval(cx + 18, headCy + 8, 11, 9, mix(skin.mid, '#e07060', 0.2), skin.light, skin.shade, 'head')

  // Ears
  if (heroRace === 'elf') {
    // Long swept-back ears (weird-beauty signature)
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 48; i++) {
        const sweep = Math.round(i * 0.35)
        const taper = Math.max(2, 9 - Math.floor(i / 5))
        const x = cx + side * (headRx - 2 + sweep) + (side < 0 ? -taper : 0)
        for (let t = 0; t < taper; t++) {
          const c = t === 0 || t === taper - 1 ? skin.shade : i < 8 ? skin.light : skin.mid
          pix.put(x + t, headCy - 10 - i + Math.floor(sweep / 2), c, 'head')
        }
      }
    }
  } else if (heroRace === 'orc') {
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 22; i++) {
        const taper = Math.max(2, 8 - Math.floor(i / 3))
        const x = cx + side * (headRx + 2) + (side < 0 ? -taper : 0)
        for (let t = 0; t < taper; t++) pix.put(x + t, headCy + 2 - i, t === 0 ? skin.shade : skin.mid, 'head')
      }
    }
  } else if (race.traits.ears === 'round') {
    pix.oval(cx - headRx - 4, headCy + 2, 10, 14, skin.mid, skin.light, skin.shade, 'head')
    pix.oval(cx + headRx + 4, headCy + 2, 10, 14, skin.mid, skin.light, skin.shade, 'head')
  } else {
    pix.oval(cx - headRx - 2, headCy + 4, 8, 11, skin.mid, skin.light, skin.shade, 'head')
    pix.oval(cx + headRx + 2, headCy + 4, 8, 11, skin.mid, skin.light, skin.shade, 'head')
  }

  // Brows by expression
  if (expr === 'snarl' || race.traits.brow === 'heavy') {
    // Angry / heavy — angled down toward nose
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 22; i++) {
        const y = headCy - 18 + Math.floor(i / 4) * (expr === 'snarl' ? 1 : 0)
        pix.put(cx + side * (6 + i), y, hair.shade, 'hair')
        pix.put(cx + side * (6 + i), y + 1, hair.mid, 'hair')
        pix.put(cx + side * (6 + i), y + 2, skin.deep, 'head')
      }
    }
  } else if (expr === 'enigmatic') {
    // High arched delicate brows
    for (const side of [-1, 1] as const) {
      for (let i = -11; i <= 11; i++) {
        const arch = Math.round((i * i) / 28) + 2
        pix.put(cx + side * 15 + i, headCy - 18 - arch, hair.mid, 'hair')
        pix.put(cx + side * 15 + i, headCy - 17 - arch, hair.light, 'hair')
      }
    }
  } else if (expr === 'grin') {
    // Dwarf — thick bushy brows
    for (const side of [-1, 1] as const) {
      for (let i = -12; i <= 12; i++) {
        for (let t = 0; t < 4; t++) {
          pix.put(cx + side * 14 + i, headCy - 16 - t, (i + t) % 2 === 0 ? hair.light : hair.shade, 'hair')
        }
      }
    }
  } else {
    // Human — separate angled brows (gap in center, no unibrow)
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 14; i++) {
        const x = cx + side * (8 + i)
        const y = headCy - 17 + Math.floor(i / 5) * (side === 1 ? -1 : 0)
        pix.put(x, y, hair.shade, 'hair')
        pix.put(x, y + 1, hair.mid, 'hair')
        pix.put(x, y + 2, hair.shade, 'hair')
      }
    }
  }

  // Eyes — smaller, sharper, expression-first (not vacant saucers)
  const eyeY = headCy + (expr === 'enigmatic' ? -2 : expr === 'snarl' ? -8 : -5)
  const eyeSpread = expr === 'enigmatic' ? 13 : expr === 'snarl' ? 17 : 15
  for (const side of [-1, 1] as const) {
    const ex = cx + side * eyeSpread
    let rx = 8
    let ry = 6
    if (expr === 'enigmatic') {
      rx = 11
      ry = 4
    } else if (expr === 'snarl') {
      rx = 7
      ry = 4 // fierce slits
    } else if (expr === 'smirk') {
      rx = 8
      ry = 5 // focused
    } else if (expr === 'grin') {
      rx = 8
      ry = 6
    }

    pix.oval(ex, eyeY, rx + 1, ry + 1, skin.deep, skin.shade, skin.deep, 'head')
    const sclera = expr === 'snarl' ? '#e8d0b8' : '#f7f2ea'
    pix.oval(ex, eyeY, rx - 1, ry - 1, sclera, '#ffffff', '#e8e0d4', 'head')

    const irisR = expr === 'enigmatic' ? 4 : 3
    const irisOff = expr === 'smirk' ? side * 2 : 0
    pix.oval(ex + irisOff, eyeY, irisR, irisR, race.eye, shade(race.eye, 45), shade(race.eye, -45), 'head')
    if (expr === 'enigmatic') {
      for (let a = 0; a < 10; a++) {
        const ang = (a / 10) * Math.PI * 2
        pix.put(
          ex + Math.round(Math.cos(ang) * 5),
          eyeY + Math.round(Math.sin(ang) * 3),
          mix(race.eye, '#a0ffe0', 0.45),
          'head',
        )
      }
    }
    pix.rect(ex + irisOff - 1, eyeY - 1, 2, 2, '#0a0806', 'head')
    pix.put(ex + irisOff - 2, eyeY - 2, '#ffffff', 'head')

    if (expr === 'enigmatic') {
      pix.rect(ex - rx, eyeY - ry - 1, rx * 2, 5, skin.shade, 'head')
      pix.rect(ex - rx + 2, eyeY - ry, rx * 2 - 4, 2, skin.mid, 'head')
    } else if (expr === 'snarl') {
      pix.rect(ex - rx - 1, eyeY - ry - 2, rx * 2 + 2, 4, skin.deep, 'head')
      pix.rect(ex - rx, eyeY + ry - 1, rx * 2, 3, skin.shade, 'head')
    } else {
      pix.rect(ex - rx, eyeY - ry - 1, rx * 2, 2, skin.shade, 'head')
    }
  }

  // Orc battle scar
  if (heroRace === 'orc') {
    for (let i = 0; i < 28; i++) {
      pix.put(cx - 8 + Math.floor(i / 2), headCy - 20 + i, mix(skin.deep, '#4a2020', 0.5), 'head')
      pix.put(cx - 7 + Math.floor(i / 2), headCy - 20 + i, skin.deep, 'head')
    }
  }

  // Nose by race
  if (heroRace === 'orc') {
    // Broad flat nose
    pix.oval(cx, headCy + 14, 14, 10, skin.mid, skin.light, skin.shade, 'head')
    pix.rect(cx - 10, headCy + 16, 6, 5, skin.deep, 'head')
    pix.rect(cx + 4, headCy + 16, 6, 5, skin.deep, 'head')
  } else if (heroRace === 'elf') {
    // Delicate long bridge
    for (let y = 0; y < 20; y++) {
      pix.rect(cx - 1, headCy + y, 2, 1, y < 8 ? skin.light : skin.shade, 'head')
    }
    pix.oval(cx, headCy + 20, 5, 4, skin.mid, skin.light, skin.shade, 'head')
    pix.put(cx - 3, headCy + 21, skin.deep, 'head')
    pix.put(cx + 2, headCy + 21, skin.deep, 'head')
  } else if (heroRace === 'dwarf') {
    pix.oval(cx, headCy + 14, 10, 8, skin.mid, skin.light, skin.shade, 'head')
    pix.rect(cx - 8, headCy + 16, 4, 4, skin.deep, 'head')
    pix.rect(cx + 4, headCy + 16, 4, 4, skin.deep, 'head')
  } else {
    for (let y = 0; y < 18; y++) {
      const nw = 2 + Math.floor(y / 7)
      pix.rect(cx - Math.floor(nw / 2), headCy + 2 + y, nw, 1, y < 6 ? skin.light : skin.shade, 'head')
    }
    pix.oval(cx, headCy + 20, 8, 6, skin.mid, skin.light, skin.shade, 'head')
    pix.rect(cx - 7, headCy + 20, 3, 3, skin.deep, 'head')
    pix.rect(cx + 4, headCy + 20, 3, 3, skin.deep, 'head')
  }

  // Mouth by expression
  const mouthY = headCy + (heroRace === 'orc' ? 30 : 28)
  if (expr === 'snarl') {
    // Open snarling mouth + big tusks
    pix.rect(cx - 14, mouthY, 28, 10, '#2a1810', 'head')
    pix.rect(cx - 12, mouthY + 1, 24, 4, '#8a3030', 'head')
    // upper teeth
    for (let i = -10; i <= 10; i += 4) {
      pix.rect(cx + i, mouthY + 1, 3, 4, '#f0e8d8', 'head')
    }
    // tusks curve out
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 22; i++) {
        const ox = side * (12 + Math.floor(i / 4))
        pix.rect(cx + ox - 2, mouthY + 4 + i, 5, 1, i < 4 ? '#fff8e8' : '#e8dcc0', 'head')
        pix.put(cx + ox, mouthY + 4 + i, '#d0c4a8', 'head')
      }
    }
  } else if (expr === 'smirk') {
    // Asymmetric confident smirk
    for (let x = -12; x <= 10; x++) {
      const lift = x > 2 ? Math.floor((x - 2) / 3) : 0
      pix.put(cx + x, mouthY - lift, race.lip, 'head')
      pix.put(cx + x, mouthY + 1 - lift, mix(race.lip, '#fff', 0.3), 'head')
      if (x > 4) pix.put(cx + x, mouthY + 2 - lift, mix(race.lip, '#801020', 0.3), 'head')
    }
    // chin dimple shadow
    pix.put(cx + 1, mouthY + 8, skin.shade, 'head')
  } else if (expr === 'enigmatic') {
    // Small closed mysterious smile
    for (let x = -8; x <= 8; x++) {
      const lift = Math.round(Math.sin(((x + 8) / 16) * Math.PI) * 2)
      pix.put(cx + x, mouthY - lift, race.lip, 'head')
      pix.put(cx + x, mouthY + 1 - lift, mix(race.lip, '#fff', 0.35), 'head')
    }
  } else if (expr === 'grin') {
    // Broad dwarf grin (mostly hidden by beard later)
    pix.rect(cx - 14, mouthY, 28, 5, race.lip, 'head')
    pix.rect(cx - 12, mouthY + 1, 24, 2, mix(race.lip, '#fff', 0.25), 'head')
    for (let i = -10; i <= 10; i += 3) pix.put(cx + i, mouthY + 2, '#f0e8d8', 'head')
  } else {
    pix.rect(cx - 10, mouthY, 20, 5, race.lip, 'head')
  }

  // Beard / stubble
  if (race.traits.beard === 'full') {
    // Braided rugged dwarf beard
    for (let y = 0; y < 64; y++) {
      const w = 26 + Math.floor(y * 0.55) - Math.floor(Math.abs(y - 30) * 0.12)
      for (let x = -Math.floor(w / 2); x <= Math.floor(w / 2); x++) {
        const edge = Math.abs(x) > w / 2 - 3
        const braid = Math.abs(x) < 6 && y > 20
        const strand = (x * 5 + y * 7) % 5 === 0
        let c = edge ? hair.shade : strand ? hair.light : hair.mid
        if (braid) c = (y + x) % 6 < 3 ? hair.light : hair.shade
        pix.put(cx + x, mouthY + 2 + y, c, 'hair')
      }
    }
    // Two braid tips with rings
    for (const bx of [-10, 10]) {
      pix.rect(cx + bx - 3, mouthY + 58, 6, 10, hair.mid, 'hair')
      pix.rect(cx + bx - 4, mouthY + 62, 8, 3, accent, 'hair')
    }
  } else if (heroRace === 'human') {
    // Hero stubble
    for (let y = 0; y < 16; y++) {
      for (let x = -16; x <= 16; x++) {
        if ((x * 5 + y * 7) % 3 === 0) pix.put(cx + x, mouthY + 2 + y, hair.mid, 'hair')
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

  if (race === 'orc') {
    // Fierce topknot + shaved scalp grain
    for (let y = -6; y < 14; y++) {
      for (let x = -headRx + 4; x <= headRx - 4; x++) {
        if ((x * 7 + y * 3) % 5 === 0) pix.put(cx + x, top + 8 + y, hair.shade, 'hair')
      }
    }
    for (let i = 0; i < 42; i++) {
      const w = Math.max(4, 14 - Math.floor(i / 4))
      pix.fold(cx - Math.floor(w / 2), top - 6 - i, w, 1, hair.mid, 'hair')
      pix.put(cx - 1, top - 6 - i, hair.light, 'hair')
      pix.put(cx + 1, top - 6 - i, hair.shade, 'hair')
    }
  } else if (race === 'elf') {
    // Dense silvery mass with irregular crown + cascading locks
    for (let y = -14; y < 22; y++) {
      const span = Math.round((headRx + 10) * Math.sqrt(Math.max(0, 1 - ((y + 6) / 36) ** 2)))
      for (let x = -span; x <= span; x++) {
        const edge = Math.abs(x) > span - 3
        const c = edge ? hair.shade : (x * 5 + y * 7) % 4 === 0 ? hair.light : hair.mid
        pix.put(cx + x, top + y, c, 'hair')
      }
    }
    // Face-framing strands
    for (let x = -Math.round(headRx * 0.85); x <= Math.round(headRx * 0.85); x++) {
      if (Math.abs(x) < 6) continue
      const drop = 16 + (Math.abs(x) % 9)
      for (let y = 0; y < drop; y++) {
        pix.put(cx + x, headCy - 20 + y, y % 3 === 0 ? hair.light : hair.mid, 'hair')
      }
    }
    // Long locks
    for (const side of [-1, 1] as const) {
      for (let strand = 0; strand < 4; strand++) {
        for (let i = 0; i < 100; i++) {
          const wave = Math.round(Math.sin(i * 0.14 + strand) * (3 + strand))
          const x = cx + side * (headRx + strand * 4) + wave
          for (let t = 0; t < 3; t++) {
            pix.put(x + t * side, headCy + i, (i + t) % 3 === 0 ? hair.light : hair.mid, 'hair')
          }
        }
      }
    }
  } else if (race === 'dwarf') {
    // Thick wild mop over bushy brows
    pix.oval(cx, top + 8, headRx + 12, 22, hair.mid, hair.light, hair.shade, 'hair')
    for (let s = -headRx - 4; s <= headRx + 4; s += 2) {
      for (let i = 0; i < 16 + (Math.abs(s) % 8); i++) {
        pix.put(cx + s + ((i * 3) % 3) - 1, top - 2 + i, i % 2 ? hair.light : hair.mid, 'hair')
      }
    }
  } else {
    // Human — windblown heroic hair with side part
    for (let y = -10; y < Math.round(headRy * 0.5); y++) {
      const span = Math.round(
        Math.sqrt(Math.max(0, 1 - ((y + 10) / (headRy * 0.9 + 10)) ** 2)) * (headRx + 6),
      )
      for (let x = -span; x <= span; x++) {
        const wind = Math.round(Math.sin((y + 10) * 0.2) * 3)
        const c =
          (x * 7 + y * 11) % 3 === 0 ? hair.light : Math.abs(x) > span - 3 ? hair.shade : hair.mid
        pix.put(cx + x + wind, top + y, c, 'hair')
      }
    }
    // Messy fringe swept to one side
    for (let x = -Math.round(headRx * 0.9); x <= Math.round(headRx * 0.5); x++) {
      const drop = 14 + (Math.abs(x) % 8)
      for (let y = 0; y < drop; y++) {
        pix.put(cx + x + 4, headCy - 22 + y, y % 3 === 0 ? hair.light : hair.mid, 'hair')
      }
    }
  }

  if (heroClass === 'rogue') {
    // Hood over whatever hair — keeps race silhouette under
    for (let y = -10; y < 22; y++) {
      const span = headRx + 12 - Math.max(0, y - 8)
      for (let x = -span; x <= span; x++) {
        if (y > 6 && Math.abs(x) < span - 10) continue
        pix.put(
          cx + x,
          headCy - 14 + y,
          Math.abs(x) > span - 3 ? hair.shade : mix(hair.mid, '#1a1218', 0.5),
          'hair',
        )
      }
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
