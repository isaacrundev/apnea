import * as hmUI from '@zos/ui'
import { t } from './i18n'
import { W, H } from './screen'

// 系統轉盤 (WIDGET_PICKER) 的共用外殼:
// 撥動只回呼 onMove 改暫存值, 按完成 (event 2) 才回呼 onDone, 然後把容器刪掉
export function openPicker({ title, cols, onMove, onDone }) {
  const vc = hmUI.createWidget(hmUI.widget.VIEW_CONTAINER, { x: 0, y: 0, w: W, h: H, scroll_enable: 0 })
  vc.createWidget(hmUI.widget.WIDGET_PICKER, {
    title,
    nb_of_columns: cols.length,
    data_config: cols,
    picker_cb: (picker, event, column, index) => {
      // event 1 = 撥動中 (官方範例如此), 2 = 按完成; 有給欄位就記下來
      if (column >= 0 && index >= 0) onMove(column, index)
      if (event !== 2) return
      onDone()
      hmUI.deleteWidget(vc)
      hmUI.redraw()
    },
  })
}

export const col = (data_array, init_val_index, unit) => ({
  data_array,
  support_loop: true,
  init_val_index,
  unit,
  font_size: 28,
  select_font_size: 44,
  col_width: 110,
})

const seq = (n, from = 0) => Array.from({ length: n }, (_, i) => from + i)

// 時間欄位: 分 + 秒 兩輪
export function secondsCols(cfg, value, maxSec) {
  return [
    col(seq(Math.floor(maxSec / 60) + 1), Math.max(0, Math.floor(value / 60)), t('min', cfg)),
    col(seq(60), Math.max(0, value) % 60, t('sec', cfg)),
  ]
}
