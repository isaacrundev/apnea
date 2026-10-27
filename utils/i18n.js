import { getLanguage } from '@zos/settings'
import { load } from './store'
import { holdSec, totalSec } from './tables'

// getLanguage(): 0 = zh-CN, 1 = zh-TW, 其他（2 = en-US 等）都當英文
function systemLang() {
  try {
    return getLanguage() <= 1 ? 'zh' : 'en'
  } catch (e) {
    return 'zh'
  }
}

export function lang(cfg = load()) {
  const pick = cfg.lang || 'auto'
  return pick === 'auto' ? systemLang() : pick
}

export function t(key, cfg) {
  const dict = T[lang(cfg)] || T.zh
  return dict[key] !== undefined ? dict[key] : T.zh[key] !== undefined ? T.zh[key] : key
}

// 秒數 → 分:秒, 例如 90 → "1:30"
// shortcut: 只支援到 59:59, 閉氣表不會有一小時的階段
const pad2 = (n) => (n < 10 ? `0${n}` : String(n))

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0))
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`
}

// 增減欄位: 15 → "+0:15", -15 → "-0:15", 0 → "0:00"
export function fmtDiff(sec) {
  const s = Math.round(sec || 0)
  if (!s) return '0:00'
  return `${s > 0 ? '+' : '-'}${fmtTime(Math.abs(s))}`
}

// 主選單的副標: 第幾組 · 閉氣 2:00 · 8 次 · 總長 25:00
export function summary(cfg) {
  const p = cfg.presets[cfg.preset]
  const n = p.rounds * p.reps
  return `${cfg.preset + 1} · ${t('hold', cfg)} ${fmtTime(holdSec(p, cfg.maxSTA))} · ${n}${t('times', cfg)} · ${fmtTime(totalSec(p, cfg.maxSTA))}`
}

const T = {
  zh: {
    title: '閉氣訓練器',
    start: '開始',
    presets: '預設',
    settings: '設定',
    maxTest: '最大閉氣測試',
    maxSTA: '最大閉氣',
    hold: '閉氣',
    breathe: '呼吸',
    contraction: '抽動',
    holdStart: '閉氣起始',
    holdStep: '閉氣增減',
    restStart: '呼吸起始',
    restStep: '呼吸增減',
    rounds: '輪數',
    reps: '每輪次數',
    times: '次',
    done: '完成',
    allDone: '完成',
    stop: '停止',
    testHint: '閉氣到極限後按「停止」',
    testHint2: '結果會存成最大閉氣時間',
    min: '分',
    sec: '秒',
    language: '語言',
    lang: '介面語言',
    auto: '跟隨手錶',
    alerts: '提示',
    alert: '提示方式',
    vibLen: '震動長度',
    tick: '最後 3 秒',
    vib: '震動',
    sound: '音效',
    both: '兩者',
    off: '關',
    len1: '短',
    len2: '長',
    hintAlign: '閉氣與呼吸切換、完成時',
    hintLen: '只影響階段切換與完成',
    hintTick: '倒數 3 秒每秒一下',
    hintMax: 'CO2 表的閉氣時間 = 這個值的 50%',
    soundOn: '音效 = 手錶鈴聲',
    soundOff: '手錶鈴聲已關閉',
    disclaimerTitle: '免責聲明',
    // 手錶一頁看得完的長度: 3 行, 每行不超過 12 字
    disclaimer: '本APP僅提供閉氣計時\n嚴禁用於水中閉氣\n並遵從自潛閉氣教材進行練習',
    agree: '同意',
  },
  en: {
    title: 'APNEA TRAINER',
    start: 'START',
    presets: 'PRESETS',
    settings: 'SETTINGS',
    maxTest: 'HOLD TEST',
    maxSTA: 'Max hold',
    hold: 'HOLD',
    breathe: 'BREATHE',
    contraction: 'CONTRACT',
    holdStart: 'Hold from',
    holdStep: 'Hold step',
    restStart: 'Breathe from',
    restStep: 'Breathe step',
    rounds: 'Rounds',
    reps: 'Repeats',
    times: ' holds',
    done: 'DONE',
    allDone: 'All done',
    stop: 'STOP',
    testHint: 'Hold to the limit, then STOP',
    testHint2: 'The result becomes your max hold',
    min: 'm',
    sec: 's',
    language: 'LANGUAGE',
    lang: 'Language',
    auto: 'Follow watch',
    alerts: 'ALERTS',
    alert: 'Alert',
    vibLen: 'Buzz',
    tick: 'Last 3s',
    vib: 'Vibrate',
    sound: 'Sound',
    both: 'Both',
    off: 'Off',
    len1: 'Short',
    len2: 'Long',
    hintAlign: 'On hold/breathe change and finish',
    hintLen: 'Only on change and finish',
    hintTick: 'One pulse per second',
    hintMax: 'CO2 table holds 50% of this',
    soundOn: 'Sound = watch ringtone',
    soundOff: 'Watch ringtone is off',
    disclaimerTitle: 'DISCLAIMER',
    disclaimer: 'This app only times holds\nNever use it in water\nFollow your freediving course',
    agree: 'AGREE',
  },
}
