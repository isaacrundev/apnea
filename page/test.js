import * as hmUI from '@zos/ui'
import { back } from '@zos/router'
import {
  setPageBrightTime,
  resetPageBrightTime,
  pauseDropWristScreenOff,
  resetDropWristScreenOff,
  pausePalmScreenOff,
  resetPalmScreenOff,
} from '@zos/display'
import { load, save } from '../utils/store'
import { t, fmtTime } from '../utils/i18n'
import { screen } from '../utils/screen'

const SESSION = 20 * 60 * 1000 // 測一次最大閉氣 20 分鐘的亮屏窗很夠了

function keepAwake() {
  try {
    setPageBrightTime({ brightTime: SESSION })
    pauseDropWristScreenOff({ duration: SESSION })
    pausePalmScreenOff({ duration: SESSION })
  } catch (e) {}
}

function letSleep() {
  try {
    resetDropWristScreenOff()
    resetPalmScreenOff()
    resetPageBrightTime()
  } catch (e) {}
}

// 最大閉氣測試 = 往上數的碼錶, 按「停止」就把秒數寫回 maxSTA
// 只驗到 10 秒就按的手滑不覆寫舊值
Page({
  onInit() {
    this.cfg = load()
    this.t0 = 0
  },

  build() {
    keepAwake()
    const root = screen()

    root.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 44,
      w: 480,
      h: 36,
      text: t('maxTest', this.cfg),
      color: 0xffffff,
      text_size: 28,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
    })

    this.clock = root.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 90,
      w: 480,
      h: 150,
      text: '0:00',
      color: 0xffffff,
      text_size: 104,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
    })

    root.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 246,
      w: 480,
      h: 28,
      text: t('testHint', this.cfg),
      color: 0xc9ccd1,
      text_size: 22,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
    })

    root.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 274,
      w: 480,
      h: 28,
      text: t('testHint2', this.cfg),
      color: 0x6f7276,
      text_size: 20,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
    })

    root.createWidget(hmUI.widget.BUTTON, {
      x: 140,
      y: 328,
      w: 200,
      h: 76,
      radius: 38,
      normal_color: 0xb03a2e,
      press_color: 0x8a2b22,
      text: t('stop', this.cfg),
      color: 0xffffff,
      text_size: 32,
      click_func: () => this.stop(),
    })

    this.t0 = Date.now()
    this.timer = setInterval(() => this.tick(), 250)
  },

  tick() {
    const s = Math.floor((Date.now() - this.t0) / 1000)
    this.clock.setProperty(hmUI.prop.TEXT, fmtTime(s))
  },

  stop() {
    clearInterval(this.timer)
    const s = Math.round((Date.now() - this.t0) / 1000)
    if (s >= 10) {
      this.cfg.maxSTA = Math.min(600, s)
      save(this.cfg)
    }
    letSleep()
    back()
  },

  onDestroy() {
    clearInterval(this.timer)
    letSleep()
  },
})
