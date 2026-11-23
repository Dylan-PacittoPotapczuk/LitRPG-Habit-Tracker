import { useEffect, useRef } from 'react'
import { classDef } from '../lib/classes'
import { raceDef } from '../lib/races'
import { WEARABLES } from '../lib/wearables'
import type { EquippedLoadout, HeroClass, HeroRace } from '../lib/types'

/** Dense pixel base (~128×192) — crisp nearest-neighbor upscale in CSS. */
const W = 128
const H = 192

type Layer = 'cape' | 'body' | 'chest' | 'head' | 'accessory' | 'weapon' | 'fx'

interface Pix {
  x: number
  y: number
  c: string
  z: number
}

const Z: Record<Layer, number> = {
  cape: 0,
  body: 1,
  chest: 2,
  head: 3,
  accessory: 4,
  weapon: 5,
  fx: 6,
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

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const m = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `#${m(ar, br).toString(16).padStart(2, '0')}${m(ag, bg).toString(16).padStart(2, '0')}${m(ab, bb).toString(16).padStart(2, '0')}`
}

function damagedTint(hex: string): string {
  return mix(hex, '#6b2a22', 0.38)
}

class Buffer {
  pixels: Pix[] = []
  put(x: number, y: number, c: string, layer: Layer) {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= W || yi >= H || !c) return
    this.pixels.push({ x: xi, y: yi, c, z: Z[layer] })
  }
  rect(x0: number, y0: number, w: number, h: number, c: string, layer: Layer) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) this.put(x, y, c, layer)
    }
  }
  /** Soft vertical gradient fill. */
  vgrad(
    x0: number,
    y0: number,
    w: number,
    h: number,
    top: string,
    bot: string,
    layer: Layer,
  ) {
    for (let y = 0; y < h; y++) {
      const t = h <= 1 ? 0 : y / (h - 1)
      const c = mix(top, bot, t)
      for (let x = 0; x < w; x++) this.put(x0 + x, y0 + y, c, layer)
    }
  }
  /** Ellipse-ish filled disc with edge shade. */
  disc(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    mid: string,
    light: string,
    shadeC: string,
    layer: Layer,
  ) {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const nx = x / rx
        const ny = y / ry
        const d = nx * nx + ny * ny
        if (d > 1) continue
        let c = mid
        if (d > 0.72) c = shadeC
        else if (nx + ny < -0.35) c = light
        else if (nx + ny > 0.45) c = shadeC
        this.put(cx + x, cy + y, c, layer)
      }
    }
  }
}

function buildSprite(
  heroRace: HeroRace | null,
  heroClass: HeroClass | null,
  equipped: EquippedLoadout,
  damaged: boolean,
): Pix[] {
  const buf = new Buffer()
  const race = raceDef(heroRace) ?? raceDef('human')!
  const cls = classDef(heroClass)
  const tunic = cls?.palette.tunic ?? '#6b5a4a'
  const accent = cls?.palette.accent ?? '#d4894a'
  // Prefer race hair; class can nudge mage/rogue hair darker
  let hairLight = race.hair.light
  let hairMid = race.hair.mid
  let hairShade = race.hair.shade
  if (heroClass === 'mage' && heroRace !== 'elf') {
    hairLight = '#5a5a7a'
    hairMid = '#2a2a4a'
    hairShade = '#12122a'
  } else if (heroClass === 'rogue') {
    hairLight = mix(hairLight, '#2a2218', 0.45)
    hairMid = mix(hairMid, '#1a1210', 0.5)
    hairShade = '#0a0806'
  } else if (heroClass === 'ranger' && heroRace === 'human') {
    hairLight = '#3a5a32'
    hairMid = '#1e3a28'
    hairShade = '#0e1e14'
  }

  const skin = race.skin
  const build = race.build
  const height = race.height

  // Layout anchors (human baseline), then race-scaled — denser 128×192 grid
  const cx = 64
  const headCy = Math.round(34 / height + (height < 0.9 ? 14 : 0))
  const headRx = Math.round(16 * build * (heroRace === 'elf' ? 0.92 : 1))
  const headRy = Math.round(18 * (heroRace === 'dwarf' ? 1.05 : heroRace === 'elf' ? 1.1 : 1))
  const neckY = headCy + headRy - 1
  const torsoTop = neckY + 5
  const torsoW = Math.round(32 * build)
  const torsoH = Math.round(50 * height * (heroRace === 'dwarf' ? 0.95 : 1))
  const hipY = torsoTop + torsoH
  const legH = Math.round(44 * height)
  const footY = Math.min(H - 6, hipY + legH)
  const shoulderY = torsoTop + 5
  const armLen = Math.round(40 * height)

  const chest = equipped.chest ? WEARABLES[equipped.chest] : null
  const cape = equipped.cape ? WEARABLES[equipped.cape] : null
  const weapon = equipped.weapon ? WEARABLES[equipped.weapon] : null
  const accessory = equipped.accessory ? WEARABLES[equipped.accessory] : null

  // ——— CAPE (behind) ———
  if (cape) {
    const p = cape.colors.primary
    const s = cape.colors.secondary
    const h = cape.colors.highlight ?? shade(p, 40)
    // Flowing panels
    for (let side of [-1, 1] as const) {
      const ox = cx + side * Math.round(torsoW / 2 + 2)
      for (let i = 0; i < 48; i++) {
        const wave = Math.sin(i * 0.22) * 2.2 * side
        const x0 = Math.round(ox + wave - (side < 0 ? 6 : 0))
        const w = 7 + Math.floor((i / 48) * 4)
        buf.rect(x0, shoulderY + i, w, 1, i % 5 === 0 ? h : p, 'cape')
        buf.put(x0 + (side < 0 ? 0 : w - 1), shoulderY + i, s, 'cape')
      }
    }
    // Collar
    buf.vgrad(cx - 12, shoulderY - 2, 24, 5, h, s, 'cape')
  }

  // ——— LEGS ———
  const legGap = Math.round(4 * build)
  const legW = Math.round(9 * build)
  const leftLegX = cx - legGap - legW
  const rightLegX = cx + legGap
  const pant = shade(tunic, -30)
  const pantShade = shade(tunic, -55)
  buf.vgrad(leftLegX, hipY - 2, legW, footY - hipY, pant, pantShade, 'body')
  buf.vgrad(rightLegX, hipY - 2, legW, footY - hipY, pant, pantShade, 'body')
  // Knee crease
  buf.rect(leftLegX + 1, hipY + Math.round(legH * 0.45), legW - 2, 2, pantShade, 'body')
  buf.rect(rightLegX + 1, hipY + Math.round(legH * 0.45), legW - 2, 2, pantShade, 'body')

  // Boots / verdant boots
  const bootTop = footY - 12
  if (accessory?.id === 'verdant-boots') {
    const bp = accessory.colors.primary
    const bh = accessory.colors.highlight ?? shade(bp, 35)
    const bs = accessory.colors.secondary
    for (const lx of [leftLegX - 1, rightLegX - 1]) {
      buf.vgrad(lx, bootTop, legW + 2, 12, bh, bs, 'accessory')
      buf.rect(lx, footY - 3, legW + 3, 3, bs, 'accessory')
      buf.put(lx + 2, bootTop + 2, bh, 'accessory')
      // Lace
      buf.put(lx + Math.floor(legW / 2), bootTop + 4, '#e8dcc8', 'accessory')
      buf.put(lx + Math.floor(legW / 2), bootTop + 7, '#e8dcc8', 'accessory')
    }
  } else {
    const boot = '#2a2218'
    const bootHi = '#4a3a28'
    for (const lx of [leftLegX - 1, rightLegX - 1]) {
      buf.vgrad(lx, bootTop, legW + 2, 12, bootHi, boot, 'body')
      buf.rect(lx, footY - 3, legW + 4, 3, '#1a1410', 'body')
    }
  }

  // ——— TORSO (undershirt) ———
  const tx0 = cx - Math.floor(torsoW / 2)
  buf.vgrad(tx0, torsoTop, torsoW, torsoH, shade(tunic, 25), shade(tunic, -35), 'body')
  // Side contour
  for (let y = 0; y < torsoH; y++) {
    buf.put(tx0, torsoTop + y, shade(tunic, -50), 'body')
    buf.put(tx0 + torsoW - 1, torsoTop + y, shade(tunic, -40), 'body')
  }

  // ——— CHEST ARMOR ———
  if (chest) {
    const p = chest.colors.primary
    const s = chest.colors.secondary
    const h = chest.colors.highlight ?? shade(p, 45)
    const aw = torsoW + (chest.id === 'ember-plate' || chest.id === 'iron-mail' ? 4 : 2)
    const ax0 = cx - Math.floor(aw / 2)
    const ah = torsoH - 4

    if (chest.id === 'cloth-tunic') {
      buf.vgrad(ax0, torsoTop, aw, ah, h, s, 'chest')
      // Neckline
      buf.disc(cx, torsoTop + 2, 6, 4, skin.mid, skin.light, skin.shade, 'body')
      // Stitch rows
      for (let y = torsoTop + 10; y < torsoTop + ah - 6; y += 6) {
        buf.rect(ax0 + 4, y, aw - 8, 1, mix(p, '#000', 0.2), 'chest')
      }
    } else if (chest.id === 'leather-vest') {
      buf.vgrad(ax0, torsoTop, aw, ah, h, s, 'chest')
      // Overlap panels
      buf.rect(cx - 2, torsoTop + 4, 4, ah - 10, s, 'chest')
      for (let i = 0; i < 5; i++) {
        buf.put(cx - 1, torsoTop + 8 + i * 6, h, 'chest')
        buf.put(cx + 1, torsoTop + 8 + i * 6, '#c8a060', 'chest')
      }
      // Shoulder straps
      buf.rect(ax0, torsoTop, 5, 8, s, 'chest')
      buf.rect(ax0 + aw - 5, torsoTop, 5, 8, s, 'chest')
    } else if (chest.id === 'iron-mail') {
      buf.vgrad(ax0, torsoTop, aw, ah, h, s, 'chest')
      // Mail rings grid
      for (let y = torsoTop + 4; y < torsoTop + ah - 8; y += 3) {
        for (let x = ax0 + 3; x < ax0 + aw - 3; x += 3) {
          buf.put(x, y, mix(h, '#fff', 0.15), 'chest')
          buf.put(x + 1, y + 1, s, 'chest')
        }
      }
      // Pauldrons
      buf.disc(ax0 + 2, shoulderY + 4, 7, 6, h, shade(h, 30), s, 'chest')
      buf.disc(ax0 + aw - 2, shoulderY + 4, 7, 6, h, shade(h, 30), s, 'chest')
      // Chest ridge
      buf.rect(cx - 1, torsoTop + 8, 2, ah - 16, h, 'chest')
    } else {
      // ember-plate
      buf.vgrad(ax0, torsoTop, aw, ah, h, s, 'chest')
      for (let y = torsoTop + 4; y < torsoTop + ah - 8; y += 4) {
        buf.rect(ax0 + 3, y, aw - 6, 2, mix(p, h, 0.5), 'chest')
        buf.rect(ax0 + 3, y + 2, aw - 6, 1, s, 'chest')
      }
      buf.disc(ax0 + 3, shoulderY + 5, 8, 7, p, h, s, 'chest')
      buf.disc(ax0 + aw - 3, shoulderY + 5, 8, 7, p, h, s, 'chest')
      // Ember glow core
      buf.disc(cx, torsoTop + 16, 5, 6, h, '#ffe0a0', p, 'chest')
    }

    // Belt
    buf.rect(ax0 - 1, hipY - 6, aw + 2, 5, s, 'chest')
    buf.rect(cx - 4, hipY - 7, 8, 7, h, 'chest')
    buf.rect(cx - 2, hipY - 5, 4, 3, accent, 'chest')
  }

  // ——— ARMS ———
  const armW = Math.round(8 * build)
  const leftArmX = tx0 - armW - 1
  const rightArmX = tx0 + torsoW + 1
  buf.vgrad(leftArmX, shoulderY, armW, armLen, skin.light, skin.shade, 'body')
  buf.vgrad(rightArmX, shoulderY, armW, armLen, skin.light, skin.shade, 'body')
  // Elbow dimple
  buf.rect(leftArmX + 1, shoulderY + Math.round(armLen * 0.45), armW - 2, 2, skin.deep, 'body')
  buf.rect(rightArmX + 1, shoulderY + Math.round(armLen * 0.45), armW - 2, 2, skin.deep, 'body')
  // Hands
  buf.disc(leftArmX + armW / 2, shoulderY + armLen + 2, 5, 4, skin.mid, skin.light, skin.shade, 'body')
  buf.disc(rightArmX + armW / 2, shoulderY + armLen + 2, 5, 4, skin.mid, skin.light, skin.shade, 'body')

  // Bracers / ring
  if (accessory?.id === 'rune-bracers' || accessory?.id === 'copper-ring') {
    const ap = accessory.colors.primary
    const ah = accessory.colors.highlight ?? shade(ap, 40)
    const as_ = accessory.colors.secondary
    const by = shoulderY + Math.round(armLen * 0.62)
    for (const ax of [leftArmX - 1, rightArmX - 1]) {
      buf.vgrad(ax, by, armW + 2, 8, ah, as_, 'accessory')
      if (accessory.id === 'rune-bracers') {
        buf.rect(ax + 2, by + 2, armW - 2, 1, ah, 'accessory')
        buf.put(ax + Math.floor(armW / 2), by + 4, '#c8e0ff', 'accessory')
      }
    }
  }

  // ——— NECK ———
  buf.vgrad(cx - 4, neckY, 8, 6, skin.light, skin.shade, 'body')

  // ——— HEAD ———
  buf.disc(cx, headCy, headRx, headRy, skin.mid, skin.light, skin.shade, 'head')
  // Cheek warmth
  buf.disc(cx - Math.round(headRx * 0.45), headCy + 4, 3, 2, mix(skin.mid, '#e07060', 0.25), skin.light, skin.shade, 'head')
  buf.disc(cx + Math.round(headRx * 0.45), headCy + 4, 3, 2, mix(skin.mid, '#e07060', 0.25), skin.light, skin.shade, 'head')

  // Ears
  if (race.traits.ears === 'pointed') {
    // Elven / orc pointed
    for (const side of [-1, 1] as const) {
      const ex = cx + side * (headRx + 1)
      for (let i = 0; i < (heroRace === 'elf' ? 14 : 10); i++) {
        const taper = Math.max(1, 4 - Math.floor(i / 3))
        buf.rect(ex + (side < 0 ? -taper : 0), headCy - 2 - i, taper, 1, i < 3 ? skin.light : skin.mid, 'head')
        buf.put(ex + (side < 0 ? -taper : taper - 1), headCy - 2 - i, skin.shade, 'head')
      }
    }
  } else if (race.traits.ears === 'round') {
    buf.disc(cx - headRx - 1, headCy + 1, 4, 5, skin.mid, skin.light, skin.shade, 'head')
    buf.disc(cx + headRx + 1, headCy + 1, 4, 5, skin.mid, skin.light, skin.shade, 'head')
  } else {
    // dwarf small
    buf.disc(cx - headRx, headCy + 2, 3, 4, skin.mid, skin.light, skin.shade, 'head')
    buf.disc(cx + headRx, headCy + 2, 3, 4, skin.mid, skin.light, skin.shade, 'head')
  }

  // Brow ridge
  if (race.traits.brow === 'heavy') {
    buf.rect(cx - 10, headCy - 4, 20, 3, skin.shade, 'head')
    buf.rect(cx - 9, headCy - 5, 18, 1, skin.deep, 'head')
  }

  // Eyes — denser sockets, sclera, iris, pupil, highlight
  const eyeY = headCy
  const eyeSpread = Math.round(6 + build)
  for (const side of [-1, 1] as const) {
    const ex = cx + side * eyeSpread
    buf.rect(ex - 4, eyeY - 2, 8, 6, skin.deep, 'head')
    buf.rect(ex - 3, eyeY - 1, 7, 5, '#f7f2ea', 'head')
    buf.rect(ex - 2, eyeY, 5, 4, race.eye, 'head')
    buf.rect(ex - 1, eyeY + 1, 3, 3, shade(race.eye, -45), 'head')
    buf.put(ex, eyeY + 2, '#0a0806', 'head')
    buf.put(ex - 2, eyeY, '#ffffff', 'head')
    buf.rect(ex - 4, eyeY - 2, 8, 2, skin.shade, 'head')
    buf.rect(ex - 3, eyeY - 3, 6, 1, hairShade, 'head')
  }

  // Nose bridge + tip
  buf.rect(cx, headCy + 3, 1, 4, skin.shade, 'head')
  buf.put(cx - 1, headCy + 6, skin.deep, 'head')
  buf.put(cx + 1, headCy + 6, skin.shade, 'head')
  buf.rect(cx - 1, headCy + 7, 3, 1, skin.mid, 'head')

  // Mouth / tusks
  const mouthY = headCy + 11
  if (race.traits.tusks) {
    buf.rect(cx - 5, mouthY, 10, 3, race.lip, 'head')
    buf.rect(cx - 6, mouthY, 2, 6, '#f0e8d8', 'head')
    buf.rect(cx + 4, mouthY, 2, 6, '#f0e8d8', 'head')
    buf.put(cx - 6, mouthY + 6, '#d8d0c0', 'head')
    buf.put(cx + 5, mouthY + 6, '#d8d0c0', 'head')
  } else {
    buf.rect(cx - 4, mouthY, 8, 2, race.lip, 'head')
    buf.rect(cx - 3, mouthY, 6, 1, mix(race.lip, '#fff', 0.25), 'head')
    buf.put(cx - 4, mouthY + 1, skin.shade, 'head')
    buf.put(cx + 3, mouthY + 1, skin.shade, 'head')
  }

  // Beard
  if (race.traits.beard === 'full') {
    for (let y = 0; y < 18; y++) {
      const w = 10 + Math.floor(y * 0.55) - Math.floor(Math.abs(y - 10) * 0.2)
      buf.rect(cx - Math.floor(w / 2), mouthY + 1 + y, w, 1, y % 3 === 0 ? hairLight : hairMid, 'head')
      buf.put(cx - Math.floor(w / 2), mouthY + 1 + y, hairShade, 'head')
      buf.put(cx + Math.floor(w / 2), mouthY + 1 + y, hairShade, 'head')
    }
  } else if (race.traits.beard === 'stubble' && heroClass === 'warrior') {
    for (let y = 0; y < 5; y++) {
      for (let x = -6; x <= 6; x++) {
        if ((x + y) % 2 === 0) buf.put(cx + x, mouthY + 2 + y, hairMid, 'head')
      }
    }
  }

  // Hair / class headgear
  drawHair(buf, cx, headCy, headRx, headRy, hairLight, hairMid, hairShade, heroRace, heroClass, tunic, accent)

  // Crown
  if (accessory?.id === 'crown-of-dawn') {
    const cp = accessory.colors.primary
    const ch = accessory.colors.highlight ?? '#fff0a8'
    const top = headCy - headRy - 2
    buf.rect(cx - 12, top, 24, 4, cp, 'accessory')
    buf.rect(cx - 12, top - 1, 24, 1, ch, 'accessory')
    for (const px of [-10, -4, 0, 4, 10]) {
      buf.rect(cx + px - 1, top - 6, 3, 6, cp, 'accessory')
      buf.put(cx + px, top - 7, ch, 'accessory')
    }
    buf.put(cx, top - 8, '#fff8d0', 'fx')
  }

  // ——— WEAPON ———
  if (weapon) {
    const wp = weapon.colors.primary
    const ws = weapon.colors.secondary
    const wh = weapon.colors.highlight ?? shade(wp, 50)
    const hx = rightArmX + armW + 2
    const hy = shoulderY - 4

    if (weapon.id === 'lantern-staff') {
      buf.vgrad(hx + 2, hy, 3, 70, ws, shade(ws, -40), 'weapon')
      // Lantern box
      buf.rect(hx - 2, hy - 2, 11, 12, ws, 'weapon')
      buf.rect(hx, hy, 7, 8, wh, 'weapon')
      buf.disc(hx + 3, hy + 4, 3, 3, '#ffe6a0', '#fff8d0', '#f0b06a', 'fx')
      // Soft glow ring
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        buf.put(
          hx + 3 + Math.round(Math.cos(a) * 6),
          hy + 4 + Math.round(Math.sin(a) * 6),
          '#f0c878',
          'fx',
        )
      }
    } else if (weapon.id === 'hunter-bow') {
      for (let i = 0; i < 36; i++) {
        const t = i / 35
        const x = hx + Math.round(Math.sin(t * Math.PI) * 8)
        const y = hy + 4 + i
        buf.put(x, y, wp, 'weapon')
        buf.put(x + 1, y, ws, 'weapon')
      }
      // String
      for (let i = 0; i < 36; i++) buf.put(hx, hy + 4 + i, '#d8d0c0', 'weapon')
      // Grip
      buf.rect(hx - 1, hy + 18, 4, 6, wh, 'weapon')
    } else {
      // Blade
      buf.vgrad(hx + 2, hy, 4, 28, wh, wp, 'weapon')
      buf.rect(hx + 1, hy + 2, 1, 24, mix(wh, '#fff', 0.3), 'weapon')
      buf.rect(hx + 5, hy + 2, 1, 24, shade(wp, -30), 'weapon')
      // Tip
      for (let i = 0; i < 6; i++) {
        buf.rect(hx + 2 + Math.floor(i / 3), hy - 1 - i, 4 - Math.floor(i / 2), 1, wh, 'weapon')
      }
      // Guard
      buf.rect(hx - 2, hy + 28, 12, 3, ws, 'weapon')
      buf.rect(hx - 1, hy + 27, 10, 1, wh, 'weapon')
      // Grip
      buf.vgrad(hx + 2, hy + 31, 4, 12, ws, shade(ws, -40), 'weapon')
      // Pommel
      buf.disc(hx + 4, hy + 44, 3, 3, wh, shade(wh, 20), ws, 'weapon')
    }
  }

  // Soft ground shadow
  for (let x = -18; x <= 18; x++) {
    const a = 1 - Math.abs(x) / 18
    if (a < 0.15) continue
    buf.rect(cx + x, footY + 1, 1, 2, mix('#000000', '#0a1511', 0.4), 'body')
  }

  if (!damaged) return buf.pixels
  return buf.pixels.map((p) => ({ ...p, c: damagedTint(p.c) }))
}

function drawHair(
  buf: Buffer,
  cx: number,
  headCy: number,
  headRx: number,
  headRy: number,
  light: string,
  mid: string,
  shadeC: string,
  race: HeroRace | null,
  heroClass: HeroClass | null,
  tunic: string,
  accent: string,
) {
  const top = headCy - headRy

  if (heroClass === 'mage') {
    // Pointed hood / hat
    for (let i = 0; i < 28; i++) {
      const t = i / 27
      const w = Math.max(2, Math.round(22 * (1 - t * 0.85)))
      buf.rect(cx - Math.floor(w / 2), top - 6 - i, w, 1, mix(tunic, accent, t * 0.35), 'head')
      buf.put(cx - Math.floor(w / 2), top - 6 - i, shade(tunic, -40), 'head')
      buf.put(cx + Math.floor(w / 2), top - 6 - i, shade(tunic, -20), 'head')
    }
    buf.put(cx, top - 34, accent, 'fx')
    // Brim
    buf.rect(cx - 16, top - 4, 32, 4, shade(tunic, -25), 'head')
    buf.rect(cx - 14, top - 3, 28, 2, mix(tunic, accent, 0.3), 'head')
    return
  }

  // Hair cap sits on the crown only — leave forehead/cheeks readable
  for (let y = -3; y < Math.round(headRy * 0.35); y++) {
    const span = Math.round(
      Math.sqrt(Math.max(0, 1 - ((y + 3) / (headRy * 0.7 + 3)) ** 2)) * (headRx + 3),
    )
    for (let x = -span; x <= span; x++) {
      const edge = Math.abs(x) > span - 2 || y <= -1
      const hi = x + y < -3
      buf.put(cx + x, top + y, edge ? shadeC : hi ? light : mid, 'head')
    }
  }
  // Soft bangs above the eyes (not a solid helmet)
  for (let x = -Math.round(headRx * 0.75); x <= Math.round(headRx * 0.75); x++) {
    if (Math.abs(x) < 3) continue // part in the middle
    const drop = 3 + (Math.abs(x) % 4 === 0 ? 2 : 0)
    for (let y = 0; y < drop; y++) {
      buf.put(cx + x, headCy - 8 + y, y === 0 ? light : mid, 'head')
    }
  }

  if (heroClass === 'rogue') {
    // Hood shadow / mask band
    buf.rect(cx - headRx + 1, headCy - 2, headRx * 2 - 2, 5, '#1a1218', 'head')
    buf.rect(cx - headRx + 2, headCy - 1, headRx * 2 - 4, 3, '#2a1a28', 'head')
    // Eye slits
    buf.rect(cx - 8, headCy - 1, 5, 3, '#0a0806', 'head')
    buf.rect(cx + 3, headCy - 1, 5, 3, '#0a0806', 'head')
  }

  if (heroClass === 'ranger') {
    // Side braids / longer locks
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 16; i++) {
        buf.put(cx + side * (headRx - 1) + side * Math.floor(i / 8), headCy + i, i % 2 ? light : mid, 'head')
      }
    }
  }

  if (heroClass === 'warrior') {
    // Short cropped sides
    buf.rect(cx - headRx - 1, headCy - 2, 3, 8, shadeC, 'head')
    buf.rect(cx + headRx - 2, headCy - 2, 3, 8, shadeC, 'head')
  }

  if (race === 'elf') {
    // Long flowing locks — solid strands with a highlight edge
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 30; i++) {
        const wave = Math.round(Math.sin(i * 0.28) * 1.2)
        const x = cx + side * (headRx + 1) + wave
        buf.rect(x, headCy + 2 + i, 3, 1, mid, 'head')
        buf.put(x + (side < 0 ? 0 : 2), headCy + 2 + i, light, 'head')
        buf.put(x + (side < 0 ? 2 : 0), headCy + 2 + i, shadeC, 'head')
      }
    }
  }
}

function flatten(pixels: Pix[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4)
  const sorted = [...pixels].sort((a, b) => a.z - b.z)
  for (const p of sorted) {
    const [r, g, b] = hexToRgb(p.c.length === 9 ? p.c.slice(0, 7) : p.c)
    // Skip near-transparent fx placeholders with invalid hex
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
  // Large: 2.75× crisp upscale (~352×528). Compact nav chip: ~0.4×.
  const scale = large ? 2.75 : 0.4
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
