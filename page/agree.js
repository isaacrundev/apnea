import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { load } from '../utils/store'
import { t } from '../utils/i18n'
import { screen, pad } from '../utils/screen'

// 每次開 app 都先過這一頁: 按「同意」才 replace 進主選單 (不存「已同意」, 免責要每次確認)
// 一頁看得完就好: 標題 + 3 行短句 + 一顆鈕, 不用滑
const LINE = 40

Page({
  build() {
    const c = load()
    const root = screen()
    const body = t('disclaimer', c)
    const h = body.split('\n').length * LINE
    const btnY = 168 + h + 36

    this.text(root, 104, 40, 30, t('disclaimerTitle', c), 0xf0b429)
    this.text(root, 168, h, 24, body, 0xd8dadd)

    // 只有一顆按鈕, 用主選單「開始」那顆的尺寸, 一定完整落在圓內
    root.createWidget(hmUI.widget.BUTTON, {
      x: 92,
      y: btnY,
      w: 296,
      h: 76,
      radius: 36,
      text: t('agree', c),
      color: 0xffffff,
      normal_color: 0xd94a3d,
      press_color: 0xa8342a,
      text_size: 32,
      // replace: 按返回鍵是離開 app, 不會回到這頁
      click_func: () => replace({ url: 'page/menu' }),
    })

    pad(root, btnY + 76)
  },

  text(root, y, h, size, str, color) {
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
})
