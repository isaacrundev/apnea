import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { load } from '../utils/store'
import { t, summary, fmtTime } from '../utils/i18n'
import { screen, pad } from '../utils/screen'

const BTN = {
  x: 64,
  w: 352,
  radius: 36,
  color: 0xffffff,
  text_size: 32,
}

Page({
  build() {
    const c = load()
    const root = screen()

    // 標題 48px 放得下 2~5 個字 (閉氣訓練器 = 5), 再長 (APNEA TRAINER = 13) 就縮一級才不會溢出 480
    const title = t('title', c)
    this.line(root, 46, 56, title.length > 8 ? 36 : 48, title)
    this.line(root, 104, 30, 24, summary(c), 0x8e9196)
    this.line(root, 134, 26, 22, `${t('maxSTA', c)} ${fmtTime(c.maxSTA)}`, 0x6f7276)

    // 四顆按鈕一律同寬縱向排; 排不進 480 就讓使用者往下滑, 不為了塞進圓裡縮字
    this.btn(root, { y: 172, h: 72 }, t('start', c), 0xd94a3d, 0xa8342a, () =>
      push({ url: 'page/timer' }),
    )
    this.btn(root, { y: 254, h: 64 }, t('presets', c), 0x2c2c30, 0x50505a, () =>
      push({ url: 'page/edit' }),
    )
    this.btn(root, { y: 326, h: 64 }, t('settings', c), 0x2c2c30, 0x50505a, () =>
      push({ url: 'page/settings' }),
    )
    this.btn(root, { y: 398, h: 64 }, t('maxTest', c), 0x2c2c30, 0x50505a, () =>
      push({ url: 'page/test' }),
    )

    // 免責聲明在 page/agree, 這裡不再重複一次. 墊到 480 讓最後一顆滑到底時整個落在圓內
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
      // 同標題: 長標籤 (MAX HOLD TEST = 13) 用 32px 會超出 352 寬, 縮一級就放得下
      text_size: text.length > 10 ? 26 : BTN.text_size,
      normal_color: normal,
      press_color: press,
      click_func: fn,
    })
  },
})
