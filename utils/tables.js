// 表 → 一段一段的 phase 佇列. 引擎跟間歇計時器一樣: 牆鐘倒數, 一個 idx 指到現在這段
const round5 = (s) => Math.max(5, Math.round(s / 5) * 5)

// 第 1 輪的閉氣時間: pct 有值就吃 maxSTA (教材: 50% of maxSTA), 否則用存下來的秒數
export function holdSec(p, maxSTA) {
  return p.pct ? round5((maxSTA * p.pct) / 100) : Math.max(5, p.holdStart | 0)
}

// 每輪: 先呼吸、再閉氣 (教材的表都是一行「呼吸時間 + 閉氣時間」), 兩個都可逐輪增減
// 每輪可以重複 reps 次; 整張表以最後一次閉氣結束, 後面不接呼吸
// 第一段就是呼吸, 順便當開始前的準備, 所以不需要額外的準備倒數
export function buildQueue(p, maxSTA) {
  const q = []
  const base = holdSec(p, maxSTA)
  for (let r = 0; r < p.rounds; r++) {
    const hold = Math.max(5, base + r * p.holdStep)
    const rest = Math.max(5, p.restStart + r * p.restStep)
    for (let k = 0; k < p.reps; k++) {
      const at = { round: r, rep: k, rounds: p.rounds, reps: p.reps }
      q.push({ kind: 'rest', sec: rest, ...at })
      q.push({ kind: 'hold', sec: hold, ...at })
    }
  }
  return q
}

export const totalSec = (p, maxSTA) => buildQueue(p, maxSTA).reduce((a, s) => a + s.sec, 0)
