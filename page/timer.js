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
import { load } from '../utils/store'
import { t, fmtTime } from '../utils/i18n'
import { buildQueue } from '../utils/tables'
import { notify, cancel, blip } from '../utils/alert'
import { screen, pad } from '../utils/screen'

const BG = { rest: 0x1e6f50, hold: 0xb03a2e, done: 0x1f618d }

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
    this.paused = false
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
      x: 130,
      y: 250,
      w: 220,
      h: 60,
      radius: 30,
      normal_color: 0x000000,
      press_color: 0x000000,
      text: t('contraction', this.cfg),
      color: 0xffffff,
      text_size: 26,
      click_func: () => this.doMark(),
    })

    // 播放器式圖示按鈕 (圖檔來源 scripts/icons.mjs), 三顆拼成一個膠囊
    const pill = (x, w, name, fn) =>
      root.createWidget(hmUI.widget.BUTTON, {
        x,
        y: 314,
        w,
        h: 84,
        normal_src: `images/${name}_n.png`,
        press_src: `images/${name}_p.png`,
        click_func: fn,
      })

    pill(56, 123, 'skip', () => this.skip())
    this.pauseBtn = pill(179, 122, 'pause', () => this.togglePause())
    this.playBtn = pill(179, 122, 'play', () => this.togglePause())
    this.playBtn.setProperty(hmUI.prop.VISIBLE, false)
    pill(301, 123, 'stop', () => this.stop())

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
    if (this.finished || this.paused) return
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
    if (this.finished || this.paused || p.kind !== 'hold') return
    // 用「這段開始後過了多久」算, 暫停時 startedAt 會往後補, 數字不會虛胖
    this.mark = Math.round((Date.now() - this.startedAt) / 1000)
    this.marks[this.idx] = this.mark
    this.markBtn.setProperty(hmUI.prop.TEXT, `${t('contraction', this.cfg)} ${fmtTime(this.mark)}`)
    blip()
  },

  setPaused(on) {
    this.paused = on
    this.pauseBtn.setProperty(hmUI.prop.VISIBLE, !on)
    this.playBtn.setProperty(hmUI.prop.VISIBLE, on)
  },

  togglePause() {
    if (this.finished) return
    if (this.paused) {
      // 暫停期間不算進閉氣時間: 起點跟結束點一起往後推
      const gap = Date.now() - this.pauseAt
      this.endsAt += gap
      this.startedAt += gap
    } else {
      this.pauseAt = Date.now()
    }
    this.setPaused(!this.paused)
  },

  skip() {
    if (this.finished) return
    if (this.paused) this.setPaused(false)
    if (this.idx + 1 >= this.q.length) return this.finish()
    this.startPhase(this.idx + 1)
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
    const y = 414
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

  stop() {
    cancel()
    letSleep()
    // back 是「回上一頁」: 用 replace 會在主畫面上再疊一層主畫面
    back()
  },

  onDestroy() {
    clearInterval(this.timer)
    cancel()
    letSleep()
  },
})
