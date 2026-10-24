import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { SystemSounds } from '@zos/sensor'
import { load, save } from '../utils/store'
import { t, fmtTime } from '../utils/i18n'
import { preview } from '../utils/alert'
import { screen, pad } from '../utils/screen'
import { openPicker, secondsCols } from '../utils/picker'

const ROW = { x: 48, w: 384, h: 72, radius: 36 }

Page({
  build() {
    const cfg = load()
    this.cfg = cfg

    const root = screen()
    this.root = root
    this.text(0, 40, 52, 36, t('settings', cfg))

    // 最大閉氣: 點一下開轉盤改秒數 (CO2 表的閉氣時間 = 這個值的 50%)
    this.maxBtn = this.root.createWidget(hmUI.widget.BUTTON, {
      ...ROW,
      y: 108,
      normal_color: 0x2c2c30,
      press_color: 0x50505a,
      text: `${t('maxSTA', cfg)}: ${fmtTime(cfg.maxSTA)}`,
      color: 0xffffff,
      text_size: 26,
      click_func: () => this.pickMax(),
    })
    this.text(0, 186, 30, 20, t('hintMax', cfg), 0x777b80)

    this.row(228, 'lang', t('lang', cfg), [t('auto', cfg), '中文', 'English'], ['auto', 'zh', 'en'], () =>
      replace({ url: 'page/settings' }),
    )

    this.row(320, 'alert', t('alert', cfg), [t('vib', cfg), t('sound', cfg), t('both', cfg)], ['vib', 'sound', 'both'])
    this.text(0, 398, 28, 20, t('hintAlign', cfg), 0x777b80)

    this.row(436, 'vibLen', t('vibLen', cfg), [t('len1', cfg), t('len2', cfg)], [1, 2], () => preview(cfg))
    this.text(0, 514, 28, 20, t('hintLen', cfg), 0x777b80)

    this.row(552, 'tickAlert', t('tick', cfg), [t('off', cfg), t('vib', cfg), t('sound', cfg), t('both', cfg)], [
      'off',
      'vib',
      'sound',
      'both',
    ])
    this.text(0, 630, 28, 20, t('hintTick', cfg), 0x777b80)

    pad(root, 720)
    this.text(0, 672, 28, 18, soundEnabled() ? t('soundOn', cfg) : t('soundOff', cfg), 0x6f7276)
  },

  text(x, y, h, size, str, color = 0xffffff) {
    return this.root.createWidget(hmUI.widget.TEXT, {
      x,
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

  // 一般設定列: 點一下就換下一個值, 改完立刻生效 (震動長度順便試聽)
  row(y, key, title, labels, values, onPick) {
    const cfg = this.cfg
    const text = () => `${title}: ${labels[Math.max(0, values.indexOf(cfg[key]))]}`
    const btn = this.root.createWidget(hmUI.widget.BUTTON, {
      ...ROW,
      y,
      normal_color: 0x2c2c30,
      press_color: 0x50505a,
      text: text(),
      color: 0xffffff,
      text_size: 26,
      click_func: () => {
        cfg[key] = values[(values.indexOf(cfg[key]) + 1) % values.length]
        save(cfg)
        btn.setProperty(hmUI.prop.TEXT, text())
        if (onPick) onPick()
      },
    })
    return btn
  },

  pickMax() {
    const cfg = this.cfg
    let mins = Math.floor(cfg.maxSTA / 60)
    let secs = cfg.maxSTA % 60
    openPicker({
      title: t('maxSTA', cfg),
      cols: secondsCols(cfg, cfg.maxSTA, 600),
      onMove: (c, i) => (c === 0 ? (mins = i) : (secs = i)),
      onDone: () => {
        cfg.maxSTA = Math.min(600, Math.max(30, mins * 60 + secs))
        save(cfg)
        this.maxBtn.setProperty(hmUI.prop.TEXT, `${t('maxSTA', cfg)}: ${fmtTime(cfg.maxSTA)}`)
      },
    })
  },
})

function soundEnabled() {
  try {
    return new SystemSounds().getEnabled()
  } catch (e) {
    return false
  }
}
