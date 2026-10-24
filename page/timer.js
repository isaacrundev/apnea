import * as hmUI from '@zos/ui'
import {
  setPageBrightTime,
  resetPageBrightTime,
  pauseDropWristScreenOff,
  resetDropWristScreenOff,
  pausePalmScreenOff,
  resetPalmScreenOff,
} from '@zos/display'
import { load } from '../utils/store'
import { t, fmtTime } from '../utils/i18n'
import { buildQueue } from '../utils/tables'
import { notify, cancel, blip } from '../utils/alert'
import { screen, pad } from '../utils/screen'

const BG = { rest: 0x1e6f50, hold: 0xb03a2e, done: 0x1f618d }
// 抽動區就是杯底的水: 用該階段底色壓暗的同色系; 按下時亮回底色當回饋
const WATER = { rest: 0x124330, hold: 0x6a231c, done: 0x133a55 }

// 抽動鍵從這裡到底 = 錶面下 1/3, 像圓形容器裝水到 1/3 高 (圓螢幕自然把左右切齊)
const WATER_Y = 320

// 一次 session 最長 2 小時: 亮屏與「不准熄屏」都在這個窗內有效
const SESSION = 2 * 60 * 60 * 1000

// 躺著閉氣最容易觸發落腕與蓋掌熄屏, 而小程式息屏 10 秒就被系統收掉, 倒數與提示會全斷
function keepAwake() {
  try {
    setPageBrightTime({ brightTime: SESSION })
    pauseDropWristScreenOff({ duration: SESSION })
    pausePalmScreenOff({ duration: SESSION })
  } catch (e) {
    console.log('keep screen on failed', e)
  }
}

function letSleep() {
  try {
    resetDropWristScreenOff()
    resetPalmScreenOff()
    resetPageBrightTime()
  } catch (e) {}
}

Page({
  onInit() {
    this.cfg = load()
    this.q = buildQueue(this.cfg.presets[this.cfg.preset], this.cfg.maxSTA)
    this.idx = 0
    this.endsAt = 0
    this.startedAt = 0
    this.finished = false
    this.mark = null // 這一輪的抽動秒數 (閉氣已過幾秒)
    this.marks = {} // phase idx → 抽動秒數
  },

  build() {
    keepAwake()

    this.bg = hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: 480, h: 480, color: 0x101014 })
    const root = screen()

    this.label = this.text(root, 40, 36, 28, '')
    this.clock = this.text(root, 80, 136, 104, '0:00')
    this.next = this.text(root, 218, 26, 21, '', 0xc9ccd1)

    // 抽動: 記下這一輪閉氣走到第幾秒才開始抽動 (再按一次會覆寫). 呼吸階段變成唯讀參考
    this.markBtn = root.createWidget(hmUI.widget.BUTTON, {
      x: 0,
      y: WATER_Y,
      w: 480,
      h: 480 - WATER_Y,
      radius: 0,
      normal_color: WATER[this.q[0].kind],
      press_color: BG[this.q[0].kind],
      text: t('contraction', this.cfg),
      color: 0xffffff,
      text_size: 30,
      click_func: () => this.doMark(),
    })

    this.root = root
    this.startPhase(0)
    this.timer = setInterval(() => this.tick(), 250)
  },

  text(root, y, h, size, str, color = 0xffffff) {
    return root.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y,
      w: 480,
      h,
      text: str,
      color,
      text_size: size,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
    })
  },

  startPhase(i) {
    const p = this.q[i]
    this.idx = i
    this.endsAt = Date.now() + p.sec * 1000
    this.startedAt = Date.now()
    this.lastBeep = -1
    this.bg.setProperty(hmUI.prop.MORE, { color: BG[p.kind] })
    this.markBtn.setProperty(hmUI.prop.MORE, { normal_color: WATER[p.kind], press_color: BG[p.kind] })

    const n = `${p.round + 1}/${p.rounds}`
    const rep = p.reps > 1 ? ` · ${p.rep + 1}/${p.reps}` : ''
    this.label.setProperty(hmUI.prop.TEXT, `${t(p.kind === 'hold' ? 'hold' : 'breathe', this.cfg)} ${n}${rep}`)

    const nx = this.q[i + 1]
    this.next.setProperty(
      hmUI.prop.TEXT,
      nx ? `${t(nx.kind === 'hold' ? 'hold' : 'breathe', this.cfg)} ${fmtTime(nx.sec)}` : '',
    )

    // 進入新的閉氣就把上一輪的抽動清掉, 抽動鍵回到可按
    if (p.kind === 'hold') {
      this.mark = null
      this.markBtn.setProperty(hmUI.prop.TEXT, t('contraction', this.cfg))
    }
    notify(p.kind, this.cfg)
  },

  tick() {
    if (this.finished) return
    // 系統可能把暫停熄屏清掉 (例如中途按鍵亮/熄屏), 每 10 秒補一次
    if (Date.now() >= (this.awakeAt || 0)) {
      this.awakeAt = Date.now() + 10000
      keepAwake()
    }
    let left = this.endsAt - Date.now()
    while (left <= 0 && this.idx + 1 < this.q.length) {
      this.startPhase(this.idx + 1)
      left = this.endsAt - Date.now()
    }
    if (left <= 0) return this.finish()
    const s = Math.ceil(left / 1000)
    this.clock.setProperty(hmUI.prop.TEXT, fmtTime(s))
    if (s <= 3 && s !== this.lastBeep) {
      this.lastBeep = s
      notify('tick', this.cfg)
    }
  },

  doMark() {
    const p = this.q[this.idx]
    if (this.finished || p.kind !== 'hold') return
    // 用「這段開始後過了多久」算, 秒數不會虛胖
    this.mark = Math.round((Date.now() - this.startedAt) / 1000)
    this.marks[this.idx] = this.mark
    this.markBtn.setProperty(hmUI.prop.TEXT, `${t('contraction', this.cfg)} ${fmtTime(this.mark)}`)
    blip()
  },

  finish() {
    if (this.finished) return
    this.finished = true
    this.bg.setProperty(hmUI.prop.MORE, { color: BG.done })
    this.label.setProperty(hmUI.prop.TEXT, '')
    this.clock.setProperty(hmUI.prop.TEXT, t('done', this.cfg))
    this.next.setProperty(hmUI.prop.TEXT, '')
    this.markBtn.setProperty(hmUI.prop.VISIBLE, false)
    notify('done', this.cfg)
    letSleep()
    this.showSummary()
  },

  // 每一輪閉氣多久、抽動在第幾秒 (沒按就是 —), 排在按鈕下面往下滑就看得到
  showSummary() {
    const lines = []
    this.q.forEach((p, i) => {
      if (p.kind !== 'hold') return
      const m = this.marks[i]
      const rep = p.reps > 1 ? `.${p.rep + 1}` : ''
      lines.push(
        `${p.round + 1}${rep}   ${fmtTime(p.sec)}   ${t('contraction', this.cfg)} ${m ? fmtTime(m) : '—'}`,
      )
    })
    const y = WATER_Y
    const h = lines.length * 32
    this.root.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y,
      w: 480,
      h,
      text: lines.join('\n'),
      color: 0xffffff,
      text_size: 22,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
    })
    pad(this.root, y + h)
    hmUI.redraw()
  },

  onDestroy() {
    clearInterval(this.timer)
    cancel()
    letSleep()
  },
})
