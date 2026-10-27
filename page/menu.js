import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { onGesture, offGesture, GESTURE_UP, GESTURE_DOWN } from '@zos/interaction'
import { load } from '../utils/store'
import { t, summary, fmtTime } from '../utils/i18n'
import { screen, pad } from '../utils/screen'

// 主畫面是直式 carousel: 5 個固定格子, 中間那格才是選定的, 上下是鄰居,
// 最上/最下兩格是隱形預備位 (黑字黑底), 換選項時整排滑一格、再把預備位傳送到另一端
const ITEMS = [
  { label: 'start', page: 'page/timer' },
  { label: 'presets', page: 'page/edit' },
  { label: 'settings', page: 'page/settings' },
  { label: 'maxTest', page: 'page/test' },
]

const BTN = { x: 60, w: 360, radius: 32 }
// 每格的中心間距一樣 (56), 高度不同所以 y 不是等差
const SLOTS = [
  { y: 140, h: 40, size: 26, color: 0x000000 },
  { y: 196, h: 40, size: 26, color: 0x555a60 },
  { y: 240, h: 64, size: 40, color: 0xffffff },
  { y: 308, h: 40, size: 26, color: 0x555a60 },
  { y: 364, h: 40, size: 26, color: 0x000000 },
]
const FRAMES = 6
const FRAME_MS = 22

const ch = (c, k) => (c >> (16 - k * 8)) & 255
function mix(a, b, t) {
  let out = 0
  for (let k = 0; k < 3; k++) out |= Math.round(ch(a, k) + (ch(b, k) - ch(a, k)) * t) << (16 - k * 8)
  return out
}

Page({
  build() {
    const c = load()
    this.c = c
    this.i = 0
    this.busy = false
    const root = screen()

    // 標題 48px 放得下 2~5 個字 (閉氣訓練器 = 5), 再長 (APNEA TRAINER = 13) 就縮一級才不會溢出 480
    const title = t('title', c)
    this.line(root, 40, 56, title.length > 8 ? 36 : 48, title)
    this.line(root, 100, 30, 24, summary(c), 0x8e9196)
    this.line(root, 130, 26, 22, `${t('maxSTA', c)} ${fmtTime(c.maxSTA)}`, 0x6f7276)

    // cell 跟著 widget 一起在陣列裡輪轉, 所以點擊時用它現在的索引判斷角色
    this.cells = SLOTS.map((s, k) => {
      const cell = { k }
      cell.w = this.opt(root, k, this.label(k), () => this.tap(cell))
      return cell
    })

    // 五格都在 480 內 (440 < 480), 不靠捲動, 上下滑留給 gesture
    pad(root, 360)

    onGesture({
      callback: (event) => {
        if (event !== GESTURE_UP && event !== GESTURE_DOWN) return false
        this.move(event === GESTURE_UP ? 1 : -1)
        return true
      },
    })
  },

  onDestroy() {
    clearTimeout(this.timer)
    try {
      offGesture()
    } catch (e) {}
  },

  label(k) {
    return t(ITEMS[(this.i + k - 2 + ITEMS.length * 2) % ITEMS.length].label, this.c)
  },

  tap(cell) {
    const k = this.cells.indexOf(cell)
    if (k === 2) return this.enter()
    if (k === 1) return this.move(-1)
    if (k === 3) return this.move(1)
  },

  enter() {
    if (!this.busy) push({ url: ITEMS[this.i].page })
  },

  move(d) {
    if (this.busy) return
    this.busy = true
    // 只有四格會滑; 另一端的隱形格留在原地, 動完再傳送到對面 (黑的, 看不到)
    const moving = d > 0 ? [1, 2, 3, 4] : [0, 1, 2, 3]
    let f = 0
    const step = () => {
      f++
      const t = f / FRAMES
      for (const k of moving) this.put(k, k - d, t)
      if (f < FRAMES) {
        this.timer = setTimeout(step, FRAME_MS)
        return
      }
      this.settle(d)
    }
    step()
  },

  put(k, to, t) {
    const a = SLOTS[k]
    const b = SLOTS[to]
    const { w } = this.cells[k]
    w.setProperty(hmUI.prop.MORE, {
      ...BTN,
      y: Math.round(a.y + (b.y - a.y) * t),
      h: Math.round(a.h + (b.h - a.h) * t),
      text_size: Math.round(a.size + (b.size - a.size) * t),
      color: mix(a.color, b.color, t),
    })
  },

  settle(d) {
    const c = this.cells
    this.cells = d > 0 ? c.slice(1).concat(c[0]) : [c[4]].concat(c.slice(0, 4))
    this.i = (this.i + d + ITEMS.length) % ITEMS.length
    this.snap()
    this.busy = false
  },

  snap() {
    SLOTS.forEach((a, k) => {
      this.cells[k].w.setProperty(hmUI.prop.MORE, {
        ...BTN,
        y: a.y,
        h: a.h,
        text_size: a.size,
        color: a.color,
        text: this.label(k),
      })
    })
  },

  line(root, y, h, size, text, color = 0xffffff) {
    return root.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y,
      w: 480,
      h,
      text,
      color,
      text_size: size,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
    })
  },

  // 外框塗成背景黑 = 看起來只有字, 但還能吃到點擊
  opt(root, k, text, fn) {
    const a = SLOTS[k]
    return root.createWidget(hmUI.widget.BUTTON, {
      ...BTN,
      y: a.y,
      h: a.h,
      text,
      color: a.color,
      text_size: a.size,
      normal_color: 0x000000,
      press_color: 0x1a1a1e,
      click_func: fn,
    })
  },
})
