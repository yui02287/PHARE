# 樂法 Le Phare 飲料店經營遊戲 — v4 UI/UX 改版規格 (PLAN-v4-ui.md)

> 目的：畫面**滿版**（不再是 1280×720 縮放置中）、資訊**分層不擠**、操作**依情境顯示**。只改 CSS／HTML 結構／render 文字，**不改遊戲規則、評分、資料、API 與元件 id**（tests/acceptance.js v3 除 #29 改為響應式檢查外全部沿用）。
> 使用者原話：「UI/UX 幫我調的更舒適一點，現在資訊又雜又擠的；整體寬度可以滿版。」

## 1. 版面：滿版流動網格

- 移除 `#app` 的固定 1280×720 與 `transform: scale`。`#app` = `100vw × 100vh`，`display:grid`，最小寬 1100px（更窄時允許水平捲動），`body` 不再有深色留白。
- 網格（桌機 ≥1100px）：
  ```
  grid-template-rows:    56px  minmax(150px, 19vh)  1fr   minmax(190px, 26vh)
  grid-template-columns: 200px  1fr  320px
  區域： hud(全寬) / counter(全寬) / [side | work | panel] / [side | bench | panel]
  ```
  - `#hud` 高 56：品牌、Day、客人進度、金錢、星等在左；音樂／音效／配方表／暫停在右，按鈕 36px 高。
  - `#counter` 客人區：格位等分寬度（最多 5 格），每格泡泡寬 ≥ 220px。
  - `#side`（左 200）：店員頭像 96px、待做清單。
  - `#work`（中上）：工作區，見 §2。
  - `#bench`（中下）：素材工作台，見 §3。
  - `#panel`（右 320）：訂單與杯內清單，見 §4。
- 字級：`html{font-size:clamp(14px, 0.85vw, 17px)}`，所有尺寸用 rem／%；大數字（量杯 ml、冰量 %）2rem；卡片標題 1rem 粗體；輔助字 0.8rem。
- 間距統一 8px 網格：卡片內距 12、卡片間距 12、區域內距 16。圓角 12px，卡片陰影只保留一層淺色。
- 色彩：背景暖米色、卡片白、主色橘（只用在「送出」「倒入」「目前容器」等主要操作）、輔色淺藍（冰／液體）、灰為停用。移除多層漸層與雙層陰影。
- 響應：寬 1100~1400 時 `#panel` 收成 280；高度 <720 時 counter 改 150、bench 190。

## 2. 工作區 `#work`（核心：依容器顯示）

四張卡片橫排，等高，卡片間距 12：

```
[ 成品：紙杯 ]  [ 目前容器（分頁）＋ 該容器的動作 ＋ 倒入 ]  [ 量杯 ]  [ 冰量 ]
   flex 1.1            flex 2                                  flex 1     flex 1
```

### 2.1 成品：紙杯 `#cup`
- 標題「成品紙杯」＋杯型／溫度切換做成兩組 segmented control（M｜L、冰｜熱），放在杯子上方一行。
- 杯圖高度隨卡片；液面與冰層照舊；杯下方顯示總量「200 ml」。點杯身 = 切到紙杯。

### 2.2 目前容器 `#vessel-slot`
- 上方四個分頁 `.vessel-tab[data-v]`：圖示＋名稱，選中者橘底白字，其餘白底；每個分頁角落顯示該容器目前的品項數徽章（0 時不顯示）。
- 中間 `#vessel-view`：容器大圖（紙杯／雪克杯／果汁機／萃茶機各一個簡單 CSS/emoji 圖），下面一行摘要「3 項・200 ml」，動作進行中在圖上顯示進度環與文字。
- **動作列**：只顯示目前容器支援的動作（其他容器的按鈕以 `hidden` 隱藏，但仍在 DOM、並保持 `disabled` 狀態）：
  - 紙杯：攪拌、榨蘋果
  - 雪克杯：搖茶、蒸汽機加熱、攪拌、榨蘋果
  - 果汁機：打冰沙
  - 萃茶機：熱水 150／350 快捷、鍵3、鍵5（`#brew-panel` 只在萃茶機時顯示）
  按鈕 44px 高、圖示＋文字，不可用時 40% 透明並在 `title` 說明原因；需時秒數放進 title，不再印在按鈕上。
- **倒入列**：`#pour-to-cup`「倒入紙杯」（橘色主按鈕；紙杯分頁時隱藏）、`#pour-to-shaker`「倒入雪克杯」（只在萃茶機顯示）。
- 舊的獨立 `#equip` 設備面板移除（按鈕元素搬進動作列，id 不變）。

### 2.3 量杯 `#measure`
- 標題「量杯」＋來源名稱（`#measure-src`，未掛時顯示「拖到液體上」）。
- 大數字 `#measure-ml` 2rem 置中。
- `#m-fill` 大按鈕「按住裝填」；下面一行 ±5／±1 四顆小鈕；最下一行「倒掉」「倒入」（`#m-empty` `#btn-pour`，倒入為主色）。

### 2.4 冰量 `#ice-panel`
- 標題「冰量」＋小字目前容器名。
- 大數字 `#ice-pct`。`#ice-fill` 大按鈕「按住加冰」；`#ice-p5/#ice-m5`；預設四顆 `.ice-preset`：微冰⅓、少冰½、8成、9成（兩排兩顆）；`#ice-clear`「去冰」文字鈕。

## 3. 素材工作台 `#bench`
- 分頁列 `.tab` 改成藥丸型，選中橘色；分頁右側放一句情境提示（只此一處）：液體頁「把量杯拖到素材上裝填」、糖醬頁「點一下設定重量」、勺料頁「點一下加一勺」、顆件頁「點一下加一個」。
- 素材格 `.ing`：改成 `grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))`，格高 84；內容只剩圖示＋名稱＋單位小字；**移除每格的操作提示文字**。液體格底部一條該液體顏色的色帶。
- 掛量杯中的來源格：橘色外框＋角落「量杯」徽章。

## 4. 右側面板 `#panel`
- 訂單卡：`#order-title` 分兩行——第一行飲料名（1.1rem 粗）、第二行 chips：尺寸／冰熱／冰量／甜度（每個 chip 圓角小標籤）。`#order-hint` 小字：系列、耐心上限。沒有訂單時顯示「點櫃台客人接單」。
- `#cup-list`：依容器分組，每組一個小標頭（圖示＋容器名），項目「綠茶 200ml」右對齊數量；紙杯組永遠在最上；空容器不顯示；動作以 chips 列在底部「已做：搖茶」；收尾以一行顯示。
- 操作列：`#btn-undo`「撤銷」、`#btn-reset-cup`「倒掉重做」兩顆小鈕並排。
- 收尾 `#finish-panel`：標題「收尾」＋三顆 segmented（補水／補茶／不補），選中橘色。
- `#btn-serve`：全寬 56px 高主色大按鈕，固定在面板底部。

## 5. 櫃台 `#counter`
- 客人格：頭像 72px 圓形＋身體色塊；泡泡在上，寬 ≥220：第一行飲料名 1rem 粗，第二行 chips（尺寸冰熱、冰量、甜度）；耐心條 8px 高在泡泡底部，顏色綠→黃→紅；「製作中」標籤放在頭像旁。
- 已接單的格子頭像外框橘色。

## 6. Modal
- 所有 modal 最大寬 720、內距 24、標題 1.25rem；配方表清單每列高 44，展開區用淺色底；結果卡三項分數用三個等寬小卡＋大星等。
- 開始畫面教學改成三欄圖示卡（接單→製作→送出），文字精簡到每欄兩行；容器說明一行。

## 7. 不變的事（Generator 必守）
- 所有元件 id／class（含 `.tab`、`.ing[data-kind]`、`.vessel-tab[data-v]`、`#brew-panel .brew-water[data-ml]`、`#btn-*`、`#modal-*`、`.customer .bubble .patience .fill`、`#queue-list li`、`#cup-list`、`.fin[data-fin]`、`.ice-preset[data-pct]`）與行為、`window.game` API、評分、資料、音訊掛點。
- 設備按鈕即使被 `hidden`，`disabled` 狀態仍須依 active 容器正確設定（驗收 #23 讀 `.disabled`）。
- 拖曳落點仍用 `elementFromPoint`；量杯拖到 `#cup` 倒入紙杯、拖到 `#vessel-view` 倒入目前容器。

## 8. 驗收（tests/acceptance.js #29 改為）
- `#app` 寬 = `window.innerWidth`（±2）、高 = `window.innerHeight`（±2）；`document.documentElement.scrollWidth <= innerWidth + 1`（無水平捲軸，視窗 ≥1100 時）；`#cup #measure #ice-panel #vessel-slot #btn-serve` 可見；`.vessel-tab` 4 個；`.ing` 格內**不含**「拖量杯來裝」「點選設定量」等提示字；紙杯分頁時 `#btn-shake` 為 hidden 且 disabled，切到雪克杯後可見。
