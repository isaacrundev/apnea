# Apnea Trainer

Amazfit Balance 2（Zepp OS 5 / API_LEVEL 4.2）用的**乾式靜態閉氣**訓練計時器。純手錶端，不需要手機端。
預設表來自 AIDA3 手冊第 8 章（CO2 表 圖17），O2 表為暫代值。

## 執行

```bash
npm i -g @zeppos/zeus-cli   # 已裝可略過
zeus login
zeus dev                    # 模擬器
bash scripts/watch-install.sh                # 直接裝到真錶（手機端 Zepp app 要先開 Bridge）
zeus preview --target "Amazfit Balance 2"    # 或產生 QR code 掃進真錶
```

直接安裝：手機 Zepp App →「我的 → 設定 → 關於」連點 Zepp 圖示 7 次 → 開發者模式 → 打開 Bridge，然後在電腦跑 `bash scripts/watch-install.sh`（約 15 秒，`exit 0` = 手錶回報安裝成功）。

掃 QR（bridge 連不上時的備援）：同一頁的「掃一掃」掃 terminal 的 QR。

## 檔案

- `page/agree.js` — 免責聲明（開 app 第一頁，按「同意」才進主選單，每次開啟都要確認）
- `page/menu.js` — 主選單（開始 / 預設 / 設定 / 最大閉氣測試 + 目前這組的摘要）
- `page/edit.js` — 5 組預設的編輯頁（1–5 切換，6 個數字，點數值開轉盤）
- `page/timer.js` — 倒數頁（圓環進度條、抽動記錄、結束後的每輪明細）
- `page/test.js` — 最大閉氣測試（往上數的碼錶，按停止寫回 maxSTA）
- `page/settings.js` — 最大閉氣 / 語言 / 提示方式 / 震動長度 / 最後 3 秒
- `utils/store.js` — 設定讀寫（5 組預設 + maxSTA + 提示/語言）
- `utils/tables.js` — 表 → phase 佇列的展開（純函式，沒有 `@zos/*`）
- `utils/alert.js` — 提示實作（震動、系統鈴聲、抽動鍵的單下短震）
- `utils/i18n.js` — 中／英字典、`fmtTime()`、`fmtDiff()`
- `utils/picker.js` — 系統轉盤（`WIDGET_PICKER`）的共用外殼
- `utils/screen.js` — 480×480 圓屏的縱向捲動容器
- `scripts/icons.mjs` — 產生按鈕圖示與桌面圖示（`node scripts/icons.mjs`）
- `scripts/shots.mjs` — 真錶截圖 → 商店用的 360×360 圓形截圖
- `scripts/png.mjs` — 自己寫的 PNG 讀寫（8-bit、非交錯），給上面兩支用

## 表的模型

一張表就是 6 個數字：

```js
{ holdStart, holdStep, restStart, restStep, rounds, reps, pct }
```

- 每一輪 = **先呼吸、再閉氣**（教材的表都是一行「呼吸時間 + 閉氣時間」），整張表以最後一次閉氣結束。
- 閉氣與呼吸都可以逐輪增減：第 r 輪 = `起始 + r × 增減`（最少 5 秒）。
- `reps` = 同一輪重複幾次（教材動態表「每行 4 次」）。
- `pct` 有值就代表閉氣時間 = `maxSTA × pct%`（取 5 秒整），改過任何閉氣數字就清掉，變成固定秒數。

出廠值：

| 槽 | 來源 | 閉氣 | 呼吸 | 總長 |
|---|---|---|---|---|
| 1 | AIDA3 圖17 CO2 STA | `maxSTA × 50%`（maxSTA 4:00 → 2:00） | 2:00 起每輪 −0:15 | 25:00 |
| 2 | O2（暫代值） | 1:00 起每輪 +0:15 | 固定 2:00 | 31:00 |
| 3–5 | 自訂 | 出廠先複製第 1 組 | | |

「最大閉氣測試」按停止就把秒數寫回 `maxSTA`（**低於 10 秒不覆寫**，擋手滑），第 1 組立刻跟著變。

## 抽動記錄

閉氣階段有一顆「抽動」鍵：按一下記下**這一輪閉氣走到第幾秒**才開始抽動（再按會覆寫），並發一下短震確認（躺著閉眼看不到畫面，所以這一下固定有，不受提示設定影響）。
進入休息階段時該輪的數字留在畫面上，訓練結束後每一輪的「閉氣時間 / 抽動時間」會列在按鈕下面，往下滑就看得到。抽動時間不寫進存檔，下次訓練重來。

## 提示

震動只在**階段切換**與**完成**時發，一次提示就是一次震動，不重覆。
閉氣用設定的震動長度（SHORT 0.6 秒 / LONG 0.9 秒），呼吸與最後 3 秒是固定短震，不給調。

## 螢幕常亮

倒數頁一 build 就 `keepAwake()`：`setPageBrightTime`（2 小時）＋ `pauseDropWristScreenOff` / `pausePalmScreenOff`，`tick()` 每 10 秒補一次。
躺著練最容易落腕與蓋掌熄屏，而小程式息屏 10 秒就被系統收掉——倒數和提示會整個斷掉，所以這兩個手勢一定要一起暫停。

## 上架素材

商店後台（console.zepp.com）要的圖只有兩張格式要求，都用程式生，不用開繪圖軟體：

```bash
node scripts/icons.mjs    # assets/store/icon-240.png  ← 240×240 透明圓形 icon
node scripts/shots.mjs    # assets/store/shot-*.png    ← 360×360 透明圓形截圖
```

截圖要先把真錶截圖（480×480 png，Zepp App 開發者模式的「手錶截圖」）丟進 `assets/store/raw/`，再跑 `scripts/shots.mjs`：它會縮成 360×360、把四角遮成透明圓（圓外不留邊）。每個上架語系至少 3 張。

## 語言

界面文字全部走 `utils/i18n.js` 的 `t('key', cfg)`，字典裡有 `zh`（繁中）與 `en` 兩份，key 必須一一對應。
`cfg.lang = 'auto'` 跟隨手錶語言（`0`/`1` = 中文，其他 = 英文）；設定頁可固定在中文或 English，改完用 `replace()` 重建頁面。

## 安全

這是**陸上乾式**訓練用的計時器。水中（池邊、開放水域）訓練必須有合格的潛伴在旁邊戒護。
開 app 第一頁固定是 `page/agree` 的免責聲明（乾式／非醫療器材／缺氧昏厥／水中須有潛伴），按「同意」才進主選單，不存「已同意」狀態。
O2 表的數值是暫代值，不是任何訓練建議。
