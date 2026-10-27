import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { onGesture, offGesture, GESTURE_UP, GESTURE_DOWN } from '@zos/interaction'
import { load } from '../utils/store'
import { t, summary, fmtTime } from '../utils/i18n'
import { screen, pad } from '../utils/screen'

// 主畫面是直式 carousel: 中間那行才是現在選的, 上下兩行是鄰居 (淡色), 沒有按鈕外框
const ITEMS = [
  { label: 'start', page: 'page/timer' },
  { label: 'presets', page: 'page/edit' },
  { label: 'settings', page: 'page/settings' },
  { label: 'maxTest', page: 'page/test' },
]

const BTN = { x: 60, w: 360, radius: 32 }
const MID = { y: 240, h: 64, size: 40, color: 0xffffff, press: 0x1e1e22 }
// 鄰居用暗灰當「淡出」: 手錶的 TEXT 沒有透明度, 只能靠顏色退到背景
const NEAR = { h: 40, size: 26, color: 0x555a60, press: 0x1a1a1e }
const UP_Y = MID.y - NEAR.h - 4
const DOWN_Y = MID.y + MID.h + 4

Page({
  build() {
    const c = load()
    this.c = c
    this.i = 0
    const root = screen()

    // 標題 48px 放得下 2~5 個字 (閉氣訓練器 = 5), 再長 (APNEA TRAINER = 13) 就縮一級才不會溢出 480
    const title = t('title', c)
    this.line(root, 40, 56, title.length > 8 ? 36 : 48, title)
    this.line(root, 100, 30, 24, summary(c), 0x8e9196)
    this.line(root, 130, 26, 22, `${t('maxSTA', c)} ${fmtTime(c.maxSTA)}`, 0x6f7276)

    // 點鄰居 = 把它移到中間, 點中間那行 = 選定進下一頁; 上下滑也換行
    const at = (d) => t(ITEMS[(this.i + d + ITEMS.length) % ITEMS.length].label, c)
    this.up = this.opt(root, { ...NEAR, y: UP_Y }, at(-1), () => this.move(-1))
    this.mid = this.opt(root, MID, at(0), () => push({ url: ITEMS[this.i].page }))
    this.down = this.opt(root, { ...NEAR, y: DOWN_Y }, at(1), () => this.move(1))

    // 只有三行, 不靠捲動 (內容 440 < 480), 滑動留給上面的 gesture
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
    try {
      offGesture()
    } catch (e) {}
  },

  paint() {
    const at = (d) => t(ITEMS[(this.i + d + ITEMS.length) % ITEMS.length].label, this.c)
    // BUTTON 的 setProperty 少了 x/y/w/h 會被忽略, 即使只改 text 也要整組帶上
    this.up.setProperty(hmUI.prop.MORE, { ...BTN, y: UP_Y, h: NEAR.h, text: at(-1) })
    this.mid.setProperty(hmUI.prop.MORE, { ...BTN, y: MID.y, h: MID.h, text: at(0) })
    this.down.setProperty(hmUI.prop.MORE, { ...BTN, y: DOWN_Y, h: NEAR.h, text: at(1) })
  },

  move(d) {
    this.i = (this.i + d + ITEMS.length) % ITEMS.length
    this.paint()
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
  opt(root, { y, h, size, color, press }, text, fn) {
    return root.createWidget(hmUI.widget.BUTTON, {
      ...BTN,
      y,
      h,
      text,
      color,
      text_size: size,
      normal_color: 0x000000,
      press_color: press,
      click_func: fn,
    })
  },
})
