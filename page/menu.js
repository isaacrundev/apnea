import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { load } from '../utils/store'
import { t, summary, fmtTime } from '../utils/i18n'
import { screen, pad } from '../utils/screen'

const BTN = {
  radius: 36,
  color: 0xffffff,
  text_size: 32,
}

Page({
  build() {
    const c = load()
    const root = screen()

    this.line(root, 52, 56, 48, t('title', c))
    this.line(root, 112, 34, 24, summary(c), 0x8e9196)
    this.line(root, 148, 30, 22, `${t('maxSTA', c)} ${fmtTime(c.maxSTA)}`, 0x6f7276)

    this.btn(root, { x: 92, y: 196, w: 296, h: 76 }, t('start', c), 0xd94a3d, 0xa8342a, () =>
      push({ url: 'page/timer' }),
    )
    this.btn(root, { x: 88, y: 292, w: 140, h: 64 }, t('presets', c), 0x2c2c30, 0x50505a, () =>
      push({ url: 'page/edit' }),
    )
    this.btn(root, { x: 252, y: 292, w: 140, h: 64 }, t('settings', c), 0x2c2c30, 0x50505a, () =>
      push({ url: 'page/settings' }),
    )
    // 圓屏下緣只剩 96..384 的寬度, 這顆按鈕刻意比上面兩顆窄, 才完整落在圓內
    this.btn(root, { x: 96, y: 368, w: 288, h: 64 }, t('maxTest', c), 0x2c2c30, 0x50505a, () =>
      push({ url: 'page/test' }),
    )

    this.line(root, 448, 32, 18, t('safety', c), 0x6f7276)
    pad(root, 480)
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

  btn(root, geo, text, normal, press, fn) {
    return root.createWidget(hmUI.widget.BUTTON, {
      ...BTN,
      ...geo,
      text,
      normal_color: normal,
      press_color: press,
      click_func: fn,
    })
  },
})
