# PLAN v7：選練習種類、預設紙杯、移除速記分頁

使用者三項要求：

1. 預設容器從雪克杯改回**紙杯**。
2. 開始畫面**不選天數**，改成**選要練習的飲料種類（系列）**。
3. 配方表旁的「速記法」分頁**刪掉**。每個配方展開後的速記規則（`.r-memo`，由 `memoFor()`／`MEMO_RULES` 產生）**保留**。

## 1. 預設容器＝紙杯

以下時機 `state.active` 一律設成 `'c'`：初始 state、開始練習、送出後換下一杯、倒掉重做（`resetCup`）。
移除「v5：預設容器為雪克杯」之類的註解與說明文字。開始畫面的說明文字如果提到預設容器，也一起改。
玩家手動切到雪克杯等容器的行為不變；紙杯倒入雪克杯後自動切到雪克杯的行為（`pourInto('c','s')` 後 active='s'）也不變。

## 2. 練習種類取代天數

### 開始畫面 `#modal-start`

- 移除 `#day-picker`、`.day-btn`、`buildDayPicker`、進度鎖（`progress.maxDay`，localStorage 裡舊的進度鍵可以直接忽略）。
- 新增 `#practice-picker`，內含 17 顆 `<button class="cat-btn" data-cat="…" aria-pressed="true|false">`：
  - 第一顆 `data-cat="all"`：「全部系列」。按下時，如果還沒全選就全選，已經全選就全部取消。全選時它自己 `aria-pressed="true"`。
  - 其餘 16 顆，每個系列一顆，`data-cat` 等於系列名（`RECIPE_DATA.CATEGORIES` 的順序）。按鈕上顯示系列名和款數小字（例如「台灣茶系列 · 12 款」）。可以多選，按一下切換。
- 按鈕下面一行摘要：「已選 N 個系列・M 款」。全部系列，或同時選了蘋果類與其他系列時，加註「每 10 杯有 4 杯蘋果類」。
- 沒有選任何系列時，「開始練習」鍵 disabled（或按下時等同全部，二擇一；建議 disabled＋提示「請至少選一個系列」）。
- 開始鍵 `#btn-start` 文字改成「開始練習」。
- 選擇存進 localStorage `lephare_practice`，值是系列名陣列（JSON）。全選時存全部 16 個名字。下次開啟預設帶入；沒有存過就預設全選。讀寫都包 try/catch。
- 版面照 BRAND.md：按鈕用白底細框，選中時粉霧藍底白字，和舊 `.day-btn.on` 一樣。桌機大概 4～6 欄格狀，手機 2～3 欄。17 顆全部要在畫面內；開始畫面的 `.box` 在手機上可以內部捲動，但 box 本身不可超出視窗。

### 引擎 API（`window.game`）

- 移除 `DAY_CONFIG`、`dayConf`、`startDay`。`window.game.DAY_CONFIG` 必須是 undefined。
- 新增 `PRACTICE = { customers: 10, interval: 16, maxOnCounter: 3 }`。每輪固定 10 杯，節奏大約是原本的 Day 2。原本用 `dayConf(state.day)` 的地方全部改用 `PRACTICE`。
- `startPractice(cats)`：
  - `cats` 是系列名陣列。null、undefined、空陣列或 `'all'` 都代表全部 16 系列。
  - 未知的系列名濾掉；濾完變空陣列就視為全部。
  - 記錄 `state.practice = { cats: [...] }`，順序照 CATEGORIES。其他重設行為和原本的 `startDay` 相同：金額、客人數、牌組都重設，`active='c'`，手機切回素材分頁並收起量杯。
  - 回傳 true。開始畫面的開始鍵呼叫 `startPractice(已選系列)`，並寫入 localStorage。
- `getPool(cats)`：回傳所選系列的 RECIPES，沒給參數就用 `state.practice.cats`（若無則全部）。
- 移除 `state.day`，或保留但不再使用、不再顯示（建議移除）。

### 牌組（抽單）

- 範圍 = `getPool(state.practice.cats)`。
- 範圍內**同時有**蘋果類（老饕蘋果系列、蘋果系列）**和**非蘋果類：沿用現有兩條佇列＋每 10 杯 4 蘋果、6 其他的區塊（`APPLE_PER_10`）。
- 範圍內**只有**其中一類：只用那一條佇列，每個區塊 10 杯都從它抽。系列輪流、依累計抽取次數排序、區塊內不重複（款數不足 10 時才允許重複）等規則照舊。
- `forceNextRecipe` 行為不變，不受範圍限制。

### HUD

- `#hud-day`（id 保留）顯示練習範圍：全部時「全部系列」，只選一個時顯示系列名（如「台灣茶系列」），多選時「N 個系列」。手機 HUD 空間小，過長用省略號，但要是完整文字。
- `#hud-cust` 顯示「客人 served/10」。

### 一輪結算 `#modal-day-end`（id 保留）

- 標題改成「🌙 本輪結算 · 〈練習範圍文字〉」，不要出現「Day」或「下一天」。
- 按鈕：`再練一輪`（主色，用同一個範圍呼叫 `startPractice`）和 `換練習種類`（回開始畫面，保留目前選擇，音樂切回 `menu`，就是原本「回主選單」的行為）。移除「下一天」和「重玩本日」。
- 統計內容（客人數、平均星等、總收入、★5 次數、最慢一杯）不變。

## 3. 移除速記法分頁

- 移除 `.rmode`（配方列表／速記法兩顆切換鍵）、`#rmode-list`、`#rmode-memo`、`#memo-panel`、`<template id="memo-tpl">` 整段內容、`renderMemo`、`setRecipeMode`，以及只給速記頁用的 CSS（`#memo-panel …`、`.memo-now`）。
- `familyOf` 如果只有速記頁在用就刪；其他地方有用就保留。
- 配方表只剩搜尋、系列分頁、列表。每個配方展開後的 `.r-memo` 速記規則照舊。
- `docs/配方速記法.md` 保留不動（外部參考文件）。

## 不可改動

- 計分、配方資料、音訊、手機 v6 版面（`applyLayout`、三分頁、量杯面板）都不變。
- 桌機版面除了開始畫面、結算畫面、配方表標題列，其餘不變。

## 驗收（Evaluator 固定腳本，Generator 不可改 tests/）

- `tests/acceptance.js`：1440×900 下 32/32。本版改寫了這幾條：
  - #3：練習範圍、開局容器＝紙杯、DAY_CONFIG 已移除。
  - #4：開始畫面的系列選擇與記憶。
  - #6：部分範圍的蘋果配額。
  - #25：重做後容器＝紙杯。
  - #27：速記分頁已移除。
  - #30：一輪結算、再練一輪、換練習種類。
- `tests/audio-acceptance.js`：20/20。A16 改用 `startPractice` 與「換練習種類」。
- `tests/mobile-acceptance.js`：375×812 與 360×640 皆 10/10。M9 檢查開始畫面有 17 顆 `.cat-btn` 且不超出視窗。
- README 的「怎麼玩」加一句：開始時選要練習的系列（可多選或全部）。
- 同時更新 README 裡說明預設容器的文字。
