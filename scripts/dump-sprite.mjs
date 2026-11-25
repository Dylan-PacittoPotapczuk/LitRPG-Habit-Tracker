/**
 * Dump native sprite buffer to PNG — proves SPRITE_W×SPRITE_H without a browser.
 * Usage: node scripts/dump-sprite.mjs [out.png]
 */
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { createHash } from 'node:crypto'

// Bundle deps via esbuild first, or import built file
const outPath = process.argv[2] || '/tmp/sprite-dump.png'

// Inline minimal loader: run esbuild then dynamic import
import { execSync } from 'node:child_process'
execSync(
  'npx esbuild src/lib/pixelSprite.ts --bundle --format=esm --outfile=/tmp/pixelSprite.mjs --platform=neutral',
  { stdio: 'inherit', cwd: new URL('..', import.meta.url).pathname },
)

const mod = await import('/tmp/pixelSprite.mjs')
const { SPRITE_W, SPRITE_H, buildSprite } = mod

console.log(`SPRITE_W=${SPRITE_W} SPRITE_H=${SPRITE_H} pixels=${SPRITE_W * SPRITE_H}`)

const rgba = buildSprite('elf', 'ranger', { chest: 'leather-vest', weapon: 'hunter-bow' }, false)
if (rgba.length !== SPRITE_W * SPRITE_H * 4) {
  throw new Error(`rgba length ${rgba.length} != ${SPRITE_W * SPRITE_H * 4}`)
}

// Count non-transparent pixels
let filled = 0
for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 0) filled++
console.log(`filled pixels=${filled}`)

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// PNG: filter none per scanline
const stride = SPRITE_W * 4
const raw = Buffer.alloc((stride + 1) * SPRITE_H)
for (let y = 0; y < SPRITE_H; y++) {
  raw[y * (stride + 1)] = 0
  Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1)
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SPRITE_W, 0)
ihdr.writeUInt32BE(SPRITE_H, 4)
ihdr[8] = 8
ihdr[9] = 6 // RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

writeFileSync(outPath, png)
console.log(`wrote ${outPath} (${png.length} bytes) sha=${createHash('sha256').update(png).digest('hex').slice(0, 12)}`)
console.log(`PROOF: native buffer is ${SPRITE_W}×${SPRITE_H}`)
