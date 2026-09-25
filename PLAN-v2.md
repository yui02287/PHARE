# 樂法 Le Phare 飲料店經營遊戲 — v2 變更規格 (PLAN-v2.md)

> 目的：改用「樂法斗六店 - 配方表.csv」的完整資料（recipes.js v2，107 款、16 系列），新增**冰量**機制與**平均抽取**機制，並讓工作台配置完全對應配方表需要的素材與設備。
> 沿用 PLAN.md 的畫面骨架、元件 id、量杯機制、評分三段權重（60/25/15）與音訊掛點（AUDIO-PLAN.md 第 4 節）。本文件與 PLAN.md 衝突時以本文件為準。
> 驗收：`tests/acceptance.js`（v2，30 條，Evaluator 專用，Generator 不可改）＋ `tests/audio-acceptance.js`（音訊，A18 改為既有驗收 fail===0）。

## 1. 資料模型（recipes.js v2，已完成，不可改）

```js
window.RECIPE_DATA = { ING, ACTIONS, FINISH, ICE_LEVELS, RECIPES, CATEGORIES, VERSION }
ING[id] = { name, unit, group: 'tea'|'water'|'fridge'|'juice'|'dial'|'ice'|'spoon'|'count', color, presets?, tol?, max? }
ACTIONS = { juice, shake, stir, steam, blend, brew3, brew5 }        // 舊 heat / brew2 已移除
FINISH  = { topWater: '剩餘補水', topTea: '剩餘補茶', none: '不補' } // 舊 topIce/topHot/noTop 已移除
ICE_LEVELS = { normal:{name:'正常冰',min:80,max:90}, less:{name:'少冰',min:50,max:50}, light:{name:'微冰',min:33,max:33} }
recipe = { id, name, size:'M'|'L', temp:'冰'|'熱', cat, items:[{ing, qty}], actions, finish, steps,
           ice:'cup'|'none', sv: null | { ing, opts:{甜度名: 數量} }, sweet:'正常'|'固定', full }
```

規則：
- `items[].qty === 0` 表示「適量」：玩家加任意 > 0 的量即滿分，沒加為 0。
- `recipe.ice === 'cup'`：杯內要加冰，冰量由客人指定（見 §4）。果汁機類用 `ice_g`（g，走一般容差）。熱飲 `ice === 'none'`。
- `sv`：甜度變體。客人下單時隨機選一個 key，該素材的目標量改為 `opts[key]`。無 sv 的飲料甜度固定顯示 `recipe.sweet`（「正常」或「固定」）。
- 勺類 qty 就是勺數（不再換算 g）。

## 2. 工作台配置（完全對應配方表）

### 2.1 素材分頁（`.tab[data-tab]`，每頁最多 12 格：6 欄 × 2 列，格約 125×88，工作台寬 820）

| tab id | 標籤 | 內容（group）| 格數 | 操作 |
|---|---|---|---|---|
| `tea` | 茶桶 | tea：綠茶、紅茶、青茶(四季青)、鐵觀音、冷縮紅茶、冷縮青茶、冷縮鐵觀音 | 7 | 量杯 |
| `liquid` | 水/奶/果汁 | water + fridge + juice：水(RO)、熱水、牛奶、優酪乳、蜜桃汁、檸檬汁、柳橙汁、葡萄汁、西瓜汁、芭樂泥、芭樂醬 | 11 | 量杯 |
| `dial` | 糖/醬/果料 | dial：蔗糖、蜂蜜、芒果醬、草莓醬、梅子粉、冰淇淋、芒果丁、草莓丁、藍莓、冰塊(果汁機) | 10 | 數量選擇器（預設鍵用 `ING[id].presets`） |
| `spoon` | 勺料 | spoon：葡萄柚、奶精、珍珠、椰果、綠茶凍、仙草凍、寒天 | 7 | 點一次加一勺 |
| `count` | 顆/件 | count：蘋果(≤3)、茶包(≤1)、多多(≤1) | 3 | 點一次加一個 |

- `.ing[data-ing][data-kind]`：kind 對映 tea/water/fridge/juice → `liquid`、dial → `weigh`、spoon → `scoop`、count → `unit`。**杯內冰塊 `ice` 不做成 .ing 格**，改為工作杯旁的冰量控制（§2.3）。
- 液體來源 `.ing[data-kind=liquid]` 必須正好 18 個。所有 .ing 常駐 DOM（非當前分頁 hidden）。
- 寒天現在是一般勺料（1 勺），不再彈三選一。

### 2.2 設備面板（取代舊面板）

| 按鈕 id | 標籤 | action | 需時 | 前置 |
|---|---|---|---|---|
| `#btn-shake` | 🫨 搖茶(雪克) | shake | 1500ms | 杯內有內容 |
| `#btn-steam` | ♨️ 蒸汽機加熱 | steam | 2000ms | 杯內有液體 |
| `#btn-blend` | 🌀 果汁機 | blend | 2500ms | 杯內有內容 |
| `#btn-stir` | 🥄 攪拌 | stir | 800ms | 杯內有內容 |
| `#btn-juice` | 🍎 榨蘋果 | juice | 1800ms | apple ≥ 1 |
| `#brew-panel`：`.brew-water[data-ml]` 150 / 350（直接加入 hot）、`#btn-brew3` 萃茶鍵3、`#btn-brew5` 萃茶鍵5 | | brew3 / brew5 | 2000ms | teabag 且 hot |

- 移除 `#btn-heat`、`#btn-brew2`、`.brew-water[data-ml=200]`、`#btn-foam`。brew3 / brew5 互斥（後按者取代前者）。
- 音訊別名（audio.js 可改）：`steam` → 用 heat 的聲音與 tail（ding）；`brew5` → brew 聲。

### 2.3 冰量控制（新，放在量杯右側、設備面板左側或工作杯下方，id 固定）

```
#ice-panel
  #ice-pct         目前冰量文字，如 "50%"（無冰顯示 "0%"）
  #ice-fill        按住加冰：pointerdown 開始每 50ms +2%，pointerup 停（上限 100）
  #ice-p5 / #ice-m5 微調 ±5%
  .ice-preset[data-pct]  四顆：33（微冰 1/3）、50（少冰 1/2）、80（8成）、90（9成）
  #ice-clear       去冰（歸 0）
```

- `setIce(pct)`：pct 0 → 移除 ice 項；否則杯內 `ice` 項**覆蓋**為 `{ing:'ice', qty: pct}`（不加總，始終最多一筆）。`#cup-list` 顯示「冰塊 50%」。
- 工作杯視覺：杯內畫一層冰塊（淺藍格紋），高度 = pct% 杯高，液面畫在其上。
- 熱飲杯型下仍可加冰（會被扣分）。

### 2.4 杯型／溫度／收尾
- 杯型按鈕只有 `#cup-size-M`、`#cup-size-L`（移除 H）；溫度 `#cup-temp-cold`、`#cup-temp-hot`。
- 收尾 `#finish-panel .fin[data-fin]` 三顆：`topWater` 💧 補水、`topTea` 🍵 補茶、`none` ✋ 不補。

### 2.5 訂單顯示
- 客人泡泡 `.bubble` 與 `#order-title` 格式：`名稱 尺寸[熱]・冰量・甜度`，例：「林華泰四季青 L・少冰・正常」「西瓜多多 L・正常冰・七分」「熟成奶茶 M熱・正常」（熱飲不顯示冰量）。
- `#order-hint` 顯示系列；配方表 Modal 中列出 steps 原文；有 sv 的飲料在展開時加一行「甜度：三分 40g／五分 60g／七分 80g」。

## 3. 訂單生成與平均抽取

### 3.1 平均抽取（硬性）
- `state.deck`：當日 pool 的 id 牌組。`refillDeck()`：取 `getPool(day)` 的 id，先隨機洗牌，再依 `drawCounts[id]`（累計被抽次數）**穩定排序遞增**，讓抽過最少次的排前面。
- `spawnCustomer()`：若 `state.forcedNext` 有值則用它（不動牌組、不計次）；否則從 deck 前端取出（deck 空則 refillDeck），`drawCounts[id]++`，並寫入 `localStorage['lephare_draws']`（try/catch 靜默）。
- 換天（`startDay`）時重建 deck（依新 pool 與累計次數），因此跨天也趨向平均；同一 pool 連續抽 N 次（N = pool 大小）保證每款各出現一次。
- 公開 API：`getDeck()`（回傳 deck 複本）、`drawCounts()`（回傳 {id: n} 複本）、`resetDraws()`（清零並清 localStorage、重建 deck）。
- 不再使用 `state.lastRecipes` 避重機制（牌組已保證不重複）。

### 3.2 每筆 order
```js
order = { id, recipe, iceLevel: 'normal'|'less'|'light'|null, sweetKey: string,
          target: resolveOrder(recipe, {iceLevel, sweetKey}), elapsed, spawnedAt, accepted, patienceMax, face, color }
```
- `iceLevel`：`recipe.ice==='cup'` 時從 normal/less/light 均勻隨機；否則 `null`。
- `sweetKey`：有 sv → 從 `Object.keys(sv.opts)` 均勻隨機；否則 `recipe.sweet`。
- `resolveOrder(recipe, {iceLevel, sweetKey})`（公開、純函式）→ 回傳 recipe 的複本，其中：sv 素材 qty 改為 `sv.opts[sweetKey]`（key 不在 opts 時維持原量）；若 `recipe.ice==='cup'` 且 iceLevel 有值，`items` 末端追加 `{ing:'ice', qty: iceLevel}`（qty 為 level 字串）。評分一律用 `order.target`。
- `patienceFor(recipe)` 沿用 v1 公式（items.length + actions×2 + finish 非 none 加 1），範圍 60~150。

### 3.3 每日開放系列（DAY_CONFIG，customers 8/9/10/12 不變，interval 20/16/13/10，maxOnCounter 2/3/4/5）
```
CATS1 = ['純茶系列','台灣茶系列']                                         // 24 款
CATS2 = CATS1 + ['紅茶系列','四季青系列','鐵觀音系列','仙草系列']          // 57 款
CATS3 = CATS2 + ['蜜桃系列','芒果系列','草莓系列','藍莓系列','芭樂系列','水果系列','西瓜系列','多多系列'] // 86 款
CATS4 = 全部（+ 老饕蘋果系列、蘋果系列）                                   // 107 款；Day 5+ 同
```

## 4. 評分（沿用 Q = 0.6·S_ing + 0.25·S_act + 0.15·S_fin）

### 4.1 S_ing（以 `order.target` 為目標）
- 杯型錯 −15、溫度錯 −15；多餘素材每項 −10（上限 −30）。
- 權重：liquid 3；sugar/honey/mango_jam/straw_jam/guava_jam/creamer 2；**ice 2**；其餘 1。
- 單項 p：
  - **適量（q === 0）**：have > 0 → 1；否則 0。
  - **液體 / 秤重（含 ice_g、芒果丁、草莓丁、藍莓）**：tol = max(0.1q, 10)；d ≤ tol → 1；否則 max(0, 1 − (d − tol)/(2·tol))。梅子粉 tol = 1（`ING.plum.tol`）。
  - **杯內冰 ice（q 為 level 字串）**：`L = ICE_LEVELS[q]`；`d = have < L.min ? L.min − have : have > L.max ? have − L.max : 0`；d ≤ 5 → 1；否則 max(0, 1 − (d − 5)/10)（d ≥ 15 → 0）。缺冰 → 0。
    範例 normal：85→1、78→1、95→1、75→1、70→0.5、60→0。less：50→1、55→1、60→0.5、65→0。light：33→1、38→1、43→0.5、48→0。
  - **勺類**：|have − q| = 0 → 1；= 1 → 0.5；≥ 2 → 0。
  - **顆件**：相等 1，否則 0。
- 熱飲（target 無 ice）但玩家加冰 → 視為多餘素材 −10。

### 4.2 S_act
- 同 v1：need 空時 100 − 25×多做；否則 hit/|need|×100 − 20×多做。brew3/brew5 互斥（做錯鍵 = 缺一 + 多一）。

### 4.3 S_fin
- 相同 → 100；否則 0（不再有 40 分部分分）。未選視為 none。

### 4.4 星等、金錢、時間係數：沿用 v1（price：L 65 / M 50）。

## 5. window.game API（Evaluator 依此測試）

沿用：`state, RECIPES, ING, ACTIONS, FINISH, DAY_CONFIG, serve(), addItem(ing, qty), doAction(code)→Promise, setFinish(code), score(target, cup), forceNextRecipe(id), spawnCustomer()→order, getPool(day), timeFactor, patienceFor, starsFor, mountMeasure(ing), setMeasure(ml), acceptOrder(id), startDay(day), render()`。
新增：`setIce(pct)`, `resolveOrder(recipe, opts)`, `ICE_LEVELS`, `getDeck()`, `drawCounts()`, `resetDraws()`, `bubbleText(order)`（回傳 §2.5 的字串）。
`state.cup = { size, temp, items, actions, finish }`（冰以 items 中的 ice 項表示）。

## 6. index.html 需改動的位置（供 Generator 對照）
- 純函式區：`LIQUID_GROUPS`（加 'juice'）、`WEIGHT2`（加 'ice'）、`EQ_FIN/ICE_FIN` 移除、`kindOf`、`fmtQty`（ice → `%`、qty 0 → 「適量」、勺 → `N勺`）、`itemScore`（適量、ice level、勺數）、`finishScore`、`score` 保持簽名、`resolveOrder` 新增。
- `CATS1~4 / DAY_CONFIG / getPool`。
- `UI`（emoji 表補 grape 🍇、watermelon 🍉、blueberry 🫐、ice_g 🧊；移除 jasmine/foam；presets 改讀 `ING[id].presets`）、`TABS`、`ACTION_DEF`（steam/brew5 取代 heat/brew2）、`UNIT_MAX` 改讀 `ING[id].max`。
- HTML：設備面板、`#ice-panel`、杯型按鈕、收尾按鈕、移除 `#btn-foam`。
- `spawnCustomer`（deck、iceLevel、sweetKey、target）、`serve`（用 `order.target` 評分）、`renderCounter/renderPanel`（bubbleText）、`renderCup`（冰層）、`openQty`（presets、移除 agar 特例與 ice 特例）、`addItem`（ice 覆蓋邏輯）、`resetCup`、`undo`（撤銷 ice 亦可）、配方表 Modal（sv 行）、`startDay`（refillDeck）、`window.game` 匯出。
- audio.js：loop 別名 steam→heat、brew5→brew；`finish_topWater`→用 finish_topHot/topIce 其一、`finish_topTea` 保留、`finish_none` 保留（缺名稱不可拋錯）。

## 7. 固定驗收清單 v2（tests/acceptance.js，Evaluator 專用）
見 tests/acceptance.js 內 30 條（#1~#30）。摘要：107 款全可被點到；Day pool 24/57/86/107；牌組平均抽取（Day4 連抽 107 次每款恰一次，再抽 107 次每款恰兩次；Day1 連抽 24 次即 pool 全部）；訂單含 iceLevel/sweetKey/target 且泡泡文字含冰量與甜度；量杯四條；18 液體、全素材可見、每頁 ≤12 格；冰量控制（setIce 覆蓋、預設鍵、按住加冰、±5、清除）；冰量計分三組數值；適量規則；sv 解析；容差；勺數；製程（steam/stir、brew3/brew5 互斥）；收尾三態；權重；時間係數；耐心；星等；設備按鈕存在與前置；杯型只有 M/L；收尾按鈕三顆；撤銷/倒掉（含冰）；送出流程；空杯 disabled；配方表含 steps 與 sv 行、計時不停；暫停；每日結算；版面。
