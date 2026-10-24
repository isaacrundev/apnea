import * as hmUI from '@zos/ui'
import { push, replace } from '@zos/router'
import { load, save } from '../utils/store'
import { t, fmtTime, fmtDiff } from '../utils/i18n'
import { holdSec } from '../utils/tables'
import { screen, pad } from '../utils/screen'
import { openPicker, col, secondsCols } from '../utils/picker'

// 6 個數字就表達得完所有表: 閉氣起始/增減、呼吸起始/增減、輪數、每輪重複次數
// pctOff: 改到閉氣時間就把「50% maxSTA」規則拿掉, 變成固定秒數
const ROWS = [
  { key: 'holdStart', min: 5, max: 600, secs: true, pctOff: true },
  { key: 'holdStep', min: -120, max: 120, step: 5, diff: true, pctOff: true },
  { key: 'restStart', min: 5, max: 600, secs: true },
  { key: 'restStep', min: -120, max: 120, step: 5, diff: true },
  { key: 'rounds', min: 1, max: 20 },
  { key: 'reps', min: 1, max: 10 },
]

const ROW_Y = [246, 324, 402, 480, 558, 636]

const seq = (n, from = 0) => Array.from({ length: n }, (_, i) => from + i)

// 單欄轉盤的候選值 (時間欄位走分+秒兩輪, 不走這裡)
function candidates(row) {
  if (row.diff) {
    const a = []
    for (let v = row.min; v <= row.max; v += row.step) a.push(v)
    return a
  }
  return seq(row.max - row.min + 1, row.min)
}

Page({
  build() {
    const cfg = load()
    this.cfg = cfg
    this.cur = cfg.presets[cfg.preset]
    this.values = {}
    const root = screen()

    root.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 44,
      w: 480,
      h: 48,
      text: t('presets', cfg),
      color: 0xffffff,
      text_size: 36,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
    })

    // 5 組: 點一下切過去編輯, 順便記住下次「開始」要用哪組
    cfg.presets.forEach((_, i) => {
      root.createWidget(hmUI.widget.BUTTON, {
        x: 36 + i * 84,
        y: 132,
        w: 72,
        h: 64,
        radius: 32,
        normal_color: i === cfg.preset ? 0xd94a3d : 0x2c2c30,
        press_color: 0xa8342a,
        text: String(i + 1),
        color: 0xffffff,
        text_size: 30,
        click_func: () => {
          if (i === cfg.preset) return
          cfg.preset = i
          save(cfg)
          replace({ url: 'page/edit' })
        },
      })
    })

    this.maxLine = root.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 200,
      w: 480,
      h: 30,
      text: '',
      color: 0x6f7276,
      text_size: 22,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
    })

    ROWS.forEach((row, i) => {
      const y = ROW_Y[i]

      root.createWidget(hmUI.widget.TEXT, {
        x: 44,
        y,
        w: 124,
        h: 72,
        text: t(row.key, cfg),
        color: 0x8e9196,
        text_size: 24,
        align_h: hmUI.align.LEFT,
        align_v: hmUI.align.CENTER_V,
      })

      // 數值本身就是按鈕: 點一下開轉盤
      this.values[row.key] = root.createWidget(hmUI.widget.BUTTON, {
        x: 168,
        y: y + 4,
        w: 264,
        h: 64,
        radius: 32,
        normal_color: 0x2c2c30,
        press_color: 0x50505a,
        text: this.show(row),
        color: 0xffffff,
        text_size: 32,
        click_func: () => this.pick(row),
      })
    })

    // 這一組的閉氣到底從幾秒開始 (第 1 組 = maxSTA 的 50%, 所以要在這裡看得到)
    this.maxLine.setProperty(hmUI.prop.TEXT, `${t('maxSTA', cfg)} ${fmtTime(cfg.maxSTA)} → ${fmtTime(holdSec(this.cur, cfg.maxSTA))}`)

    pad(root, 800)

    root.createWidget(hmUI.widget.BUTTON, {
      x: 100,
      y: 716,
      w: 280,
      h: 80,
      radius: 40,
      normal_color: 0xd94a3d,
      press_color: 0xa8342a,
      text: t('start', cfg),
      color: 0xffffff,
      text_size: 34,
      click_func: () => push({ url: 'page/timer' }),
    })
  },

  show(row) {
    const v = this.cur[row.key]
    return row.secs ? fmtTime(v) : row.diff ? fmtDiff(v) : String(v)
  },

  // 轉盤: 撥動只改暫存, 按完成才寫回存檔
  pick(row) {
    const cfg = this.cfg
    const cur = this.cur[row.key]
    const vals = row.secs ? null : candidates(row)
    let mins = Math.max(0, Math.floor(cur / 60))
    let secs = Math.max(0, cur) % 60
    let picked = vals ? vals[Math.max(0, vals.indexOf(cur))] : cur

    openPicker({
      title: t(row.key, cfg),
      cols: row.secs
        ? secondsCols(cfg, cur, row.max)
        : [col(vals, Math.max(0, vals.indexOf(cur)), row.diff ? t('sec', cfg) : '')],
      onMove: (c, i) => {
        if (!row.secs) picked = vals[i]
        else if (c === 0) mins = i
        else secs = i
      },
      onDone: () => this.commit(row, row.secs ? mins * 60 + secs : picked),
    })
  },

  commit(row, v) {
    const p = this.cur
    p[row.key] = Math.min(row.max, Math.max(row.min, v))
    if (row.pctOff) p.pct = null
    this.values[row.key].setProperty(hmUI.prop.TEXT, this.show(row))
    this.maxLine.setProperty(
      hmUI.prop.TEXT,
      `${t('maxSTA', this.cfg)} ${fmtTime(this.cfg.maxSTA)} → ${fmtTime(holdSec(p, this.cfg.maxSTA))}`,
    )
    save(this.cfg)
  },
})
