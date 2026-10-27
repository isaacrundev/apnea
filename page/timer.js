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

const BG = 0x101014
// 圓環就是進度條: 軌道固定, 進度弧的「錶冠」(弧的頭) 隨倒數順時針跑, 一圈走完 = 這段結束
const TRACK = 0x26262b
const RING = { x: 10, y: 10, w: 460, h: 460, line_width: 20 }
// ARC 的 0 度在 3 點鐘方向, -90 就是 12 點鐘
const TOP = -90
// 階段主色只上在進度弧與階段名上, 底色一律深灰 (整片變色會蓋掉環)
const ACCENT = { rest: 0x3ddc84, hold: 0xf2b824, done: 0x3b9ae1 }

// 三行字 (階段標籤 / 倒數 / 下一階段) 的相對位置與高度, 用來把整團字垂直置中
const TEXT_DY = [0, 40, 212]
const TEXT_H = [40, 168, 36]
const STACK_H = TEXT_DY[2] + TEXT_H[2]
const STACK_Y = Math.round((480 - STACK_H) / 2)
// 抽動鍵是整個下半部 (躺著閉氣看不到, 不用瞄準), 不畫底色, 只留環內一行字
const MARK_Y = 320
const MARK_TEXT_Y = 372
const GREY = 0x8b9096

// 一次 session 最長 2 小時: 亮屏與「不准熄屏」都在這個窗內有效
const SESSION = 2 * 60 * 60 * 1000

// 環每 60ms 補一格: 一秒才動一次的話尖端是一跳 40px, 看起來就是「停一下再走」
const TICK = 60

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

    this.bg = hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: 480, h: 480, color: BG })
    const root = screen()

    // 抽動: 記下這一輪閉氣走到第幾秒才開始抽動 (再按一次會覆寫). 呼吸階段變成唯讀參考
    this.markBtn = root.createWidget(hmUI.widget.BUTTON, {
      x: 0,
      y: MARK_Y,
      w: 480,
      h: 480 - MARK_Y,
      radius: 0,
      normal_color: BG,
      press_color: 0x1d1d24,
      text: '',
      click_func: () => this.doMark(),
    })
    // 環畫在按鈕之上, 下半圈的弧才不會被按鈕的底色蓋掉
    this.track = root.createWidget(hmUI.widget.ARC, {
      ...RING,
      start_angle: TOP,
      end_angle: TOP + 360,
      color: TRACK,
    })
    this.arc = root.createWidget(hmUI.widget.ARC, { ...RING, start_angle: TOP, end_angle: TOP, color: ACCENT.hold })

    // 三行字裝在同一個容器裡, 結束時整團往上挪讓明細接在下面
    this.stack = root.createWidget(hmUI.widget.VIEW_CONTAINER, {
      x: 0,
      y: STACK_Y,
      w: 480,
      h: STACK_H,
      scroll_enable: 0,
    })
    this.label = this.text(this.stack, TEXT_DY[0], TEXT_H[0], 28, '')
    this.clock = this.text(this.stack, TEXT_DY[1], TEXT_H[1], 144, '0:00')
    this.next = this.text(this.stack, TEXT_DY[2], TEXT_H[2], 30, '', 0xc9ccd1)
    // 抽動那行字放在環內下方: 蓋不到弧, 又有整個下半部可以按
    this.markLabel = this.text(root, MARK_TEXT_Y, 44, 28, '', GREY)

    this.root = root
    this.startPhase(0)
    this.timer = setInterval(() => this.tick(), TICK)
  },

  moveStack(y) {
    this.stack.setProperty(hmUI.prop.MORE, { x: 0, y, w: 480, h: STACK_H })
  },

  // 抽動那行字: 閉氣沒按 = 灰字提示, 按過 = 主色數字, 呼吸 = 留著上一輪的數字當參考
  setMark(sec) {
    const p = this.q[this.idx]
    const s = sec == null ? null : `${t('contraction', this.cfg)} ${fmtTime(sec)}`
    this.markLabel.setProperty(hmUI.prop.MORE, {
      text: s == null ? (p.kind === 'hold' ? t('contraction', this.cfg) : '') : s,
      color: p.kind === 'hold' && sec != null ? ACCENT.hold : GREY,
    })
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
    this.lastSec = -1
    // 新的一段從 12 點鐘重新長出來
    this.arc.setProperty(hmUI.prop.MORE, { color: ACCENT[p.kind], start_angle: TOP, end_angle: TOP })

    const n = `${p.round + 1}/${p.rounds}`
    const rep = p.reps > 1 ? ` · ${p.rep + 1}/${p.reps}` : ''
    this.label.setProperty(hmUI.prop.MORE, {
      text: `${t(p.kind === 'hold' ? 'hold' : 'breathe', this.cfg)} ${n}${rep}`,
      color: ACCENT[p.kind],
    })

    const nx = this.q[i + 1]
    this.next.setProperty(
      hmUI.prop.TEXT,
      nx ? `${t(nx.kind === 'hold' ? 'hold' : 'breathe', this.cfg)} ${fmtTime(nx.sec)}` : '',
    )

    // 抽動只有閉氣階段能按; 呼吸時按鈕收起來, 但數字留在畫面上
    this.markBtn.setProperty(hmUI.prop.VISIBLE, p.kind === 'hold')
    if (p.kind === 'hold') this.mark = null
    this.setMark(this.mark) // 呼吸時這個值還是上一個閉氣的抽動秒數, 留著當參考
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
    const p = this.q[this.idx]
    const s = Math.ceil(left / 1000)
    if (s !== this.lastSec) {
      this.lastSec = s
      this.clock.setProperty(hmUI.prop.TEXT, fmtTime(s))
    }
    // 錶冠 (弧的頭) 跟著倒數連續走: 比例直接吃毫秒, 不取整到秒
    const prog = Math.min(1, Math.max(0, 1 - left / (p.sec * 1000)))
    this.arc.setProperty(hmUI.prop.MORE, { end_angle: TOP + 360 * prog })
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
    this.setMark(this.mark)
    blip()
  },

  finish() {
    if (this.finished) return
    this.finished = true
    // 環收起來, 讓明細一路往下排 (明細有 8 輪, 環留著會壓在字上)
    this.track.setProperty(hmUI.prop.VISIBLE, false)
    this.arc.setProperty(hmUI.prop.VISIBLE, false)
    this.markBtn.setProperty(hmUI.prop.VISIBLE, false)
    this.markLabel.setProperty(hmUI.prop.VISIBLE, false)
    this.moveStack(60) // 字團往上, 明細接在下面
    this.label.setProperty(hmUI.prop.MORE, { text: '', color: ACCENT.done })
    this.clock.setProperty(hmUI.prop.MORE, { text: t('done', this.cfg), color: ACCENT.done })
    this.next.setProperty(hmUI.prop.TEXT, '')
    notify('done', this.cfg)
    letSleep()
    this.showSummary()
  },

  // 每一輪閉氣多久、抽動在第幾秒 (沒按就是 —), 往下滑就看得到
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
    const y = 290
    const h = lines.length * 32
    this.root.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y,
      w: 480,
      h,
      text: lines.join('\n'),
      color: 0xffffff,
      text_size: 26,
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
