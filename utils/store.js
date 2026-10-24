import { statSync, readFileSync, writeFileSync } from '@zos/fs'

const FILE = 'apnea-cfg.json'

// 一個預設就是 6 個數字: 閉氣起始 / 閉氣增減 / 呼吸起始 / 呼吸增減 / 輪數 / 每輪重複次數
// pct 有值代表閉氣時間 = maxSTA 的百分比 (教材「50% 規則」), 改過閉氣數字就清掉變固定秒數
const CO2 = { holdStart: 120, holdStep: 0, restStart: 120, restStep: -15, rounds: 8, reps: 1, pct: 50 }
const O2 = { holdStart: 60, holdStep: 15, restStart: 120, restStep: 0, rounds: 8, reps: 1, pct: null }

// 1 = 教材圖17 (CO2 STA), 2 = O2 表 (暫代值, 等正式資料再換), 3-5 = 自訂 (出廠先複製第 1 組)
export const PRESETS = [
  { ...CO2 },
  { ...O2 },
  { ...CO2 },
  { ...CO2 },
  { ...CO2 },
]

export const DEFAULTS = {
  maxSTA: 240, // 秒. 預設 4:00, 這樣第 1 組出廠剛好等於教材圖17 的 2:00
  presets: PRESETS,
  preset: 0, // 最後一次按開始用的那一組 (也是編輯中的那一組)
  alert: 'vib',
  vibLen: 2, // 1 = 短 250ms / 2 = 長 480ms
  tickAlert: 'off',
  lang: 'auto',
}

const LIMITS = {
  holdStart: [5, 600],
  holdStep: [-120, 120],
  restStart: [5, 600],
  restStep: [-120, 120],
  rounds: [1, 20],
  reps: [1, 10],
}

function clamp(n, [lo, hi]) {
  return Math.min(hi, Math.max(lo, Math.round(Number(n) || 0)))
}

export function load() {
  let cfg = { ...DEFAULTS }
  try {
    if (statSync({ path: FILE })) {
      cfg = { ...cfg, ...JSON.parse(readFileSync({ path: FILE, options: { encoding: 'utf8' } })) }
    }
  } catch (e) {
    cfg = { ...DEFAULTS }
  }

  // 一定長成 5 組完整物件: 存檔壞掉或缺欄位都開得起來
  const saved = Array.isArray(cfg.presets) ? cfg.presets : []
  cfg.presets = PRESETS.map((d, i) => {
    const p = { ...d, ...(saved[i] || {}) }
    for (const k of Object.keys(LIMITS)) p[k] = clamp(p[k], LIMITS[k])
    p.pct = p.pct ? clamp(p.pct, [10, 100]) : null
    return p
  })
  cfg.preset = Math.min(PRESETS.length - 1, Math.max(0, cfg.preset | 0))
  cfg.maxSTA = clamp(cfg.maxSTA, [30, 600])
  cfg.vibLen = Math.min(2, Math.max(1, cfg.vibLen | 0))
  return cfg
}

export function save(cfg) {
  try {
    writeFileSync({ path: FILE, data: JSON.stringify(cfg), options: { encoding: 'utf8' } })
  } catch (e) {
    console.log('save failed', e)
  }
}
