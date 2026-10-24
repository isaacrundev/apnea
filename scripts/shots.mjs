// 把真錶截圖轉成商店後台要的「應用介紹截圖」:
// 360×360、透明背景的圓形、手錶介面放到滿 (上下左右不留邊)
//
// 用法: 把手錶截圖 (480×480 png, Zepp App 開發者模式的「手錶截圖」或模擬器) 丟進
//       assets/store/raw/, 然後 node scripts/shots.mjs → assets/store/shot-*.png
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { decode, encode } from './png.mjs'

const SIZE = 360
const SS = 4 // 縮小與圓形遮罩都用 4×4 超取樣, 邊緣才不會有鋸齒
const STORE = fileURLToPath(new URL('../assets/store/', import.meta.url))
const RAW = STORE + 'raw/'

if (!existsSync(RAW)) {
  console.log(`沒有 ${RAW}\n把截圖 (480×480 png, 至少 3 張) 放進去再跑一次`)
  process.exit(0)
}

// 16 點取樣縮圖 (480 → 360 這種非整數倍也適用)
function resize(src, from) {
  const out = Buffer.alloc(SIZE * SIZE * 4)
  const k = from / SIZE
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const acc = [0, 0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = Math.min(from - 1, Math.floor((x + (sx + 0.5) / SS) * k))
          const py = Math.min(from - 1, Math.floor((y + (sy + 0.5) / SS) * k))
          const o = (py * from + px) * 4
          for (let i = 0; i < 4; i++) acc[i] += src[o + i]
        }
      }
      const o = (y * SIZE + x) * 4
      for (let i = 0; i < 4; i++) out[o + i] = Math.round(acc[i] / (SS * SS))
    }
  }
  return out
}

// 圓形遮罩: 圓外的 alpha 歸零 (錶面是圓的, 截圖四角本來就是黑的, 不遮會露出來)
function maskCircle(px) {
  const r = SIZE / 2
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let hit = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (Math.hypot(x + (sx + 0.5) / SS - r, y + (sy + 0.5) / SS - r) <= r) hit++
        }
      }
      const o = (y * SIZE + x) * 4
      px[o + 3] = Math.round((px[o + 3] * hit) / (SS * SS))
    }
  }
}

mkdirSync(STORE, { recursive: true })
const files = readdirSync(RAW).filter((f) => f.toLowerCase().endsWith('.png'))
if (!files.length) console.log(`${RAW} 裡沒有 .png`)

for (const f of files) {
  const { w, h, rgba } = decode(readFileSync(RAW + f))
  if (w !== h) {
    console.log(`跳過 ${f}: ${w}×${h} 不是正方形`)
    continue
  }
  const px = resize(rgba, w)
  maskCircle(px)
  const corner = px[3]
  const center = px[((SIZE >> 1) * SIZE + (SIZE >> 1)) * 4 + 3]
  if (corner !== 0 || center === 0) throw new Error(`${f}: 圓形遮罩怪怪的 (角落 ${corner}, 中心 ${center})`)
  const out = `${STORE}shot-${f}`
  writeFileSync(out, encode(SIZE, SIZE, px))
  console.log(`wrote ${out} (${w}→${SIZE})`)
}
