// 產生桌面圖示, 輸出 assets/default.r/icon.png
// 用繪圖軟體改 icon 太囉唆: 形狀就這幾條, 用程式畫還順便留著怎麼畫。
// 執行: node scripts/icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const SS = 4 // 4×4 超取樣, 邊緣才不會有鋸齒

const CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(rgba, w, h) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // 每條掃描線前面補 filter byte 0
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- 桌面圖示 ----
// 深藍圓角方塊 + 四條遞減的白線, 一眼看出是「一張表」
const APP = { size: 256, bg: [0x1f, 0x61, 0x8d], ink: [0xff, 0xff, 0xff], r: 56, bar: 16, cap: 8 }
const BARS = [
  [128, 92],
  [104, 124],
  [80, 156],
  [56, 188],
] // [寬, 上緣]

function inRoundRect(x, y, w, h, r) {
  if (x < 0 || y < 0 || x > w || y > h) return false
  const cx = Math.min(Math.max(x, r), w - r)
  const cy = Math.min(Math.max(y, r), h - r)
  return Math.hypot(x - cx, y - cy) <= r
}

function inBar(x, y, w, top) {
  return inRoundRect(x - (APP.size - w) / 2, y - top, w, APP.bar, APP.cap)
}

function appIcon() {
  const s = APP.size
  const px = Buffer.alloc(s * s * 4)
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let inside = 0
      const sum = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px_ = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          if (!inRoundRect(px_, py, s, s, APP.r)) continue
          inside++
          const c = BARS.some(([w, top]) => inBar(px_, py, w, top)) ? APP.ink : APP.bg
          for (let i = 0; i < 3; i++) sum[i] += c[i]
        }
      }
      const o = (y * s + x) * 4
      for (let i = 0; i < 3; i++) px[o + i] = inside ? Math.round(sum[i] / inside) : 0
      px[o + 3] = Math.round((inside / (SS * SS)) * 255)
    }
  }
  return png(px, s, s)
}

const out = new URL('../assets/default.r/icon.png', import.meta.url)
writeFileSync(out, appIcon())
console.log(`wrote ${out.pathname}`)
