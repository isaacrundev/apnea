// 產生手錶桌面圖示與商店後台用的圖示
// 用繪圖軟體改 icon 太囉唆: 形狀就這幾條, 用程式畫還順便留著怎麼畫。
// 執行: node scripts/icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { encode } from './png.mjs'

const SS = 4 // 4×4 超取樣, 邊緣才不會有鋸齒

// ---- 桌面圖示 ----
// 深藍底 + 四條遞減的白線, 一眼看出是「一張表」。幾何都寫在 256 的座標系, 要別的尺寸就整張縮放
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

// clip(u, v): 這個點在 256 座標系裡算不算圖示內部
function drawIcon(outSize, clip) {
  const k = APP.size / outSize
  const px = Buffer.alloc(outSize * outSize * 4)
  for (let y = 0; y < outSize; y++) {
    for (let x = 0; x < outSize; x++) {
      let inside = 0
      const sum = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) * k
          const v = (y + (sy + 0.5) / SS) * k
          if (!clip(u, v)) continue
          inside++
          const c = BARS.some(([w, top]) => inBar(u, v, w, top)) ? APP.ink : APP.bg
          for (let i = 0; i < 3; i++) sum[i] += c[i]
        }
      }
      const o = (y * outSize + x) * 4
      for (let i = 0; i < 3; i++) px[o + i] = inside ? Math.round(sum[i] / inside) : 0
      px[o + 3] = Math.round((inside / (SS * SS)) * 255)
    }
  }
  return encode(outSize, outSize, px)
}

const half = APP.size / 2

const watch = new URL('../assets/default.r/icon.png', import.meta.url)
writeFileSync(watch, drawIcon(APP.size, (u, v) => inRoundRect(u, v, APP.size, APP.size, APP.r)))
console.log(`wrote ${watch.pathname}`)

// 商店後台另外要一張 240x240 的 icon: 透明背景的圓形, 四周不留邊 (所以用圓而不是圓角方塊)
const storeDir = new URL('../assets/store/', import.meta.url)
mkdirSync(storeDir, { recursive: true })
const store = new URL('icon-240.png', storeDir)
writeFileSync(store, drawIcon(240, (u, v) => Math.hypot(u - half, v - half) <= half))
console.log(`wrote ${store.pathname}`)
