# 樂法 Le Phare 飲料店遊戲 — v5 手機版規格 (PLAN-v5-mobile.md)

> 目的：手機直向（375～430 寬）也能完整玩一局；平板直向（≤ 820 寬）共用同一套版面。
> 桌機版面（> 820 寬）**完全不變**，既有驗收 tests/acceptance.js（32 條）與 tests/audio-acceptance.js（20 條）在 1440×900 必須維持全過。
> 手機驗收：tests/mobile-acceptance.js（M1～M10），在 375×812 觸控模擬下執行。Generator 不可修改任何 tests/*。

## 現況（375×812 量測）
3 欄格線在窄螢幕把中間工作區壓成 32px、紙杯 5px；右側面板蓋住工作區；47 個可點元素小於 40px。完全無法操作。

## 1. 版面：≤ 820px 改單欄直向捲動

只新增 `@media (max-width: 820px)` 區塊（觸控微調可再加 `@media (pointer: coarse)`），不改桌機規則。

- `html, body` 改為可垂直捲動；`#stage` 取消 fixed 滿版；`#app` 改單欄 flex/grid，高度由內容決定。
- 由上到下的順序（用 `order` 或 grid-template-areas 重排，**不搬動 DOM**，id 不變）：
  1. `#hud`：可換成兩列（上：字標＋Day／客人／金錢／星等；下：音樂／音效／配方表／暫停），按鈕高 ≥ 40。
  2. `#counter`：客人卡片改水平捲動條（`overflow-x:auto`、`scroll-snap`），每張卡寬約 170～200，點卡片接單。
  3. `#staff`：隱藏店員大頭像；待做清單 `#queue-list` 改成一列可水平捲動的小膠囊。
  4. `#work`：四張卡改排列 —
     - 目前容器 `#vessel-slot` 全寬（分頁 4 顆一列；容器圖縮小；七顆設備按鈕 3 欄網格，每顆高 ≥ 44）。
     - 量杯 `#measure` 與冰量 `#ice-panel` 並排兩欄（各約一半寬）。
     - 成品紙杯 `#cup` 所在卡改成橫向精簡條（小杯圖＋杯型/溫度切換＋總量），仍需可見。
  5. `#bench`：分頁列可水平捲動；素材格 3～4 欄、每格高 ≥ 56。**緊接在量杯／冰量下面**，讓「點素材 → 按住裝填 → 倒入」不用來回捲很遠。
  6. `#panel`：訂單標題、杯內清單、撤銷／倒掉、收尾。
  7. **送出列固定在畫面底部**（`position: sticky` 或 fixed，含 `env(safe-area-inset-bottom)`）：`#btn-serve` 任何捲動位置都在畫面內。可在同一列加一顆開配方表的按鈕（新元素，綁 openRecipes），但 HUD 的 `#btn-recipes` 仍要保留。
- 不得產生水平捲軸；所有元素右緣不超出視窗（水平捲動條內的內容除外）。

## 2. 觸控操作
- 按住類按鈕（`#m-fill` 按住裝填、`#ice-fill` 按住加冰）：`touch-action: none`、`-webkit-touch-callout: none`，並阻止 `contextmenu`（長按不跳選單、不捲動、不放大）。
- 所有按鈕 `touch-action: manipulation`（避免雙擊放大）。
- 量杯拖曳在手機上可有可無：**點液體格即掛上量杯、按「倒入」倒進目前容器**這條路一定要順（既有行為，確認手機可用）。
- 所有可點元素（`#app button`、`.ing`、`.vessel-tab`、`.tab`、`.ice-preset`、`.fin`）在手機版寬高都 ≥ 40px。
- `<meta viewport>` 加 `viewport-fit=cover`；不要禁止使用者縮放。

## 3. Modal
- 手機版 `.modal .box` 寬 `calc(100vw - 16px)`、高 ≤ 92vh、內部捲動；開始畫面的 Day 卡片可換行；配方表列表與速記分頁在手機可讀可捲。
- 結算卡、配方表、開始畫面、數量選擇器都不得超出視窗。

## 4. 不變的事
- 所有元件 id／class、遊戲邏輯、計分、資料、window.game API、音訊掛點不變。
- 桌機（> 820 寬）CSS 規則不動；既有 52 條驗收在 1440×900 維持全過。

## 5. 驗收（tests/mobile-acceptance.js，375×812 觸控）
M1 無水平捲軸｜M2 主要區塊寬度夠用（容器卡、素材台、面板 ≥ 300，量杯與冰量各 ≥ 150，紙杯 ≥ 60）｜M3 沒有元素超出視窗右緣（水平捲動條內除外）｜M4 可點元素寬高 ≥ 40｜M5 送出鍵在頁首與頁尾捲動位置都在畫面內｜M6 觸控按住裝填會增加量杯、按住鍵 touch-action 為 none｜M7 按住鍵長按不跳選單｜M8 只用點擊完整做一杯林華泰鐵觀音 L 冰得 100 分並能手動關閉結算｜M9 配方表與開始畫面 Modal 都在視窗內｜M10 每個區塊捲到後都在視窗內且寬度正常。
