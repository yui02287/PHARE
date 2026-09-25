# 樂法 Le Phare 飲料店經營遊戲 — 遊戲設計規格 (PLAN.md)

> 版本 1.0 ｜ 目標平台：桌機瀏覽器 1280×720（可縮放）｜ 技術：單一 `index.html` + `recipes.js`，Vanilla JS，無外部套件，`file://` 可離線開啟。
> 「【決定】」為 Planner 在需求未明處自行做出的合理決定，Generator 依此實作即可。**附錄 A 與實際資料檔的差異以附錄 A 為準。**

## 0. 總覽與核心循環

選日 → 開店 → 客人排隊(帶訂單泡泡) → 點選客人接單 → 在工作台製作 → 上桌(送出) → 結算該杯 (素材/製程/收尾 + 時間係數 → 星等/金錢) → 下一位 … → 當日客人結束 → 每日結算 → 下一天 / 重玩

- 一次只製作一杯（單一「工作杯」），但可同時「接」多位客人的訂單排在待做清單（最多 3 張）。耐心條從客人出現在隊伍時就開始倒數。
- 全部 101 款飲料皆可被客人點到；每日開放的系列（cat）不同（見第 4 節）。

## 1. 畫面配置（1280×720）

```
 y:0   A. 頂部狀態列 (1280×44)  Day 3 │ 客人 5/10 │ $ 1,240 │ ★4.2 │ [配方表] [暫停]
 y:44  B. 櫃台區 (1280×196)  最多 5 個客人格位 220×180，間距 20，左起 x=60；每格：頭像、訂單泡泡(飲料名/M L H/冰熱/甜度)、耐心條(綠→黃→紅)
 y:240 C. 店員/待做清單 (x:0 w:200 h:480)  店員頭像(動作時顯示 emoji) + 待做訂單列表(最多 3)
       D. 工作杯區 (x:200 w:820 h:260)
            工作杯 (x:230 w:180 h:210，液面依總量比例填色，上方顯示總 ml) + 杯型[M][L][H] 溫度[冰][熱]
            量杯 (x:440 w:120 h:210，大字 ml、來源名稱/顏色、[按住裝填][+5][+1][-5][-1][倒掉][倒入])
            設備面板 (x:580~1020 w:440：[雪克][打熱70°C][冰沙][攪拌][榨汁] 大按鈕 130×56 + 旋茶子面板 熱水[150][200][350] [萃茶第2鍵][萃茶第3鍵] + 動作進度條)
       F. 素材工作台 (x:200 w:820 y:500~720)  分頁列 [茶桶][水/冷藏][糖/醬/秤][勺料][顆/件]，每頁最多 10 格(約 96×88)，不滾動
       E. 訂單/杯內清單面板 (x:1040 w:240 h:480)  目前訂單標題(不顯示配方內容)、杯內內容清單(加入順序)、[撤銷最後][倒掉重做]、收尾單選 [補冰/水][補熱水][不補][補桶茶][加奶蓋]、[送出 ▶]
```

實作用 `#app` 固定 1280×720，`transform: scale(min(innerW/1280, innerH/720))` 置中。

元件 id（Evaluator 會用到）：
- HUD：`#hud-day #hud-cust #hud-money #hud-star #btn-recipes #btn-pause`
- 客人：`.customer[data-order-id]`、泡泡 `.bubble`、耐心 `.patience > .fill`
- 待做：`#queue-list li[data-order-id]`
- 工作杯：`#cup #cup-total #cup-size-M #cup-size-L #cup-size-H #cup-temp-cold #cup-temp-hot`
- 量杯：`#measure #measure-ml #measure-src #m-fill #m-p5 #m-p1 #m-m5 #m-m1 #m-empty #btn-pour`
- 設備：`#btn-shake #btn-heat #btn-blend #btn-stir #btn-juice #brew-panel .brew-water[data-ml] #btn-brew2 #btn-brew3 #action-progress`
- 素材：分頁 `.tab[data-tab]`，素材格 `.ing[data-ing][data-kind=liquid|weigh|scoop|unit]`
- 面板：`#order-title #order-hint #cup-list #btn-undo #btn-reset-cup #finish-panel #btn-serve`
- Modal：`#modal-recipes #modal-result #modal-day-end #modal-start #modal-qty`，`#recipe-search`

## 2. 互動流程

### 2.1 客人
spawn → 進場動畫(0.6s) → 耐心倒數 → 玩家點客人接單（加入待做、若無目前訂單則成為目前訂單；格上標「已接」）→ 送出 → 結算 → 離開(0.6s) → 下一位。【決定】客人不會自行離開；超時懲罰全由時間係數承擔（下限 0.2）。切換目前訂單須工作杯為空或彈出確認。

### 2.2 量杯（硬性需求）
狀態機 EMPTY → FILLING → HOLDING → POURED。
1. 拖曳 `#measure`（pointer events，ghost 跟隨游標，用 `document.elementFromPoint` 判落點）到 `.ing[data-kind=liquid]` 放開 → 量杯掛在該來源，來源格高亮。
2. 按住 `#m-fill`：每 50ms +5ml（前 1 秒）之後每 50ms +10ml，放開停止；數字即時跳動；上限 500。
3. 微調 `[+5][+1][-5][-1]`，範圍 0~500。`[倒掉]` 歸零並解除來源。
4. 量杯只能裝單一液體；已有 A 再掛 B → 拒絕並提示「請先倒掉」。
5. 拖曳到 `#cup` 放開或點 `#btn-pour` → 加入 {ing, qty}，量杯歸零。同一液體多次倒入計分時合併。
液體來源共 17 個：8 茶桶 + ro, hot, milk, yogurt, peach, lemon, orange, guava, guava_jam。

### 2.3 其他素材
- 秤重/計量（sugar, honey, mango_jam, straw_jam, plum, icecream, foam, ice）：點格開 `#modal-qty`：數字、[+10][+5][+1][-1][-5][-10]、預設快捷（果糖 15/30/40/50/60；蜂蜜 25/40/50/60；果醬 25/35；梅粉 3/5（顯示秤圖示）；冰淇淋 100；奶蓋 100；冰塊 適量/200/250）、[加入][取消]。
- 勺類：點一次加一勺，量記 g（依 ING.spoon）；奶精記匙數；寒天彈出 [半勺30][八分勺50][1勺75]。連點同一勺料合併為一筆顯示「珍珠 2勺(150g)」。
- 顆/件：apple +1（最多 3）、teabag（最多 1）、yakult（最多 1）。

### 2.4 設備動作
| 按鈕 | code | 需時 | 前置 |
|---|---|---|---|
| 雪克 | shake | 1500ms | 杯內有內容 |
| 打熱 70°C | heat | 2000ms | 杯內有液體 |
| 冰沙 | blend | 2500ms | 杯內有內容 |
| 攪拌 | stir | 800ms | 杯內有內容 |
| 榨汁 | juice | 1800ms | apple ≥1 |
| 旋茶第2/3鍵 | brew2/brew3 | 2000ms | teabag 且有 hot；熱水快捷 [150][200][350] 直接加入 hot |

動作進行中鎖定輸入、顯示進度條；完成後寫入 actions（評分不看順序，重複去重）。

### 2.5 送出
`#btn-serve`：計分 → `#modal-result`（三項分數、時間係數、星等、金額、錯誤明細如「綠茶 300ml → 應 350ml」）→ 清空杯、客人離開、待做清單下一筆自動成為目前訂單。空杯時 disabled。

### 2.6 配方表 Modal
系列 Tab + 搜尋框；每列 full/sweet，點擊展開顯示 steps 原文與 items 摘要；目前訂單置頂高亮但不自動展開；開啟時計時繼續並顯示「⏱ 計時進行中」；Esc 關閉。

### 2.7 暫停
`#btn-pause`：所有耐心與動作計時停止，覆蓋層「已暫停」。

## 3. 評分

### 3.1 素材 S_ing（60%）
- 杯型錯 −15、溫度錯 −15。
- 每項目標素材單項得分 p：
  - 液體/秤重：tol = max(0.10q, 10)；d ≤ tol → 1；否則 max(0, 1 − (d − tol)/(2·tol))；缺少 → 0。梅粉 tol = 1g。
  - 冰塊 qty=1（適量）：有任意冰塊 → 1，否則 0；200/250 走數字規則。
  - 勺類：勺數比對（targetScoops = round(q/spoon)；仙草 200→3、150→2；奶精直接匙數；寒天以 g 比對 30/50/75）；相等 1、差 1 勺 0.5、差 ≥2 → 0。
  - 顆/件：相等 1 否則 0。
- 多餘素材每項 −10（上限 −30）。
- 權重 w：液體 3；sugar/honey/mango_jam/straw_jam/creamer/guava_jam 2；其餘 1。
- S_ing = clamp(Σp·w/Σw × 100 − 扣分, 0, 100)。

### 3.2 製程 S_act（25%）
need 空：done 空 → 100，每多一個 −25。否則 S_act = clamp(hit/|need|×100 − extra×20, 0, 100)。brew2/brew3 互斥。

### 3.3 收尾 S_fin（15%）
相同 → 100；none 與 noTop 互為等價 → 100；topIce vs topTea → 40；其他 0。加奶蓋屬 items(foam)。

### 3.4 合成
Q = 0.6·S_ing + 0.25·S_act + 0.15·S_fin；T ∈ [0.2, 1]；Sat = Q·T。

### 3.5 星等與金錢
Sat ≥90 ★5 ×1.5(+10 小費)；75~89 ★4 ×1.2；60~74 ★3 ×1.0；40~59 ★2 ×0.6；<40 ★1 ×0.2。
price = (size==='L') ? 65 : 50，+5×(items≥5) +5×actions.length。Sat=0 金錢 0。

## 4. 客人與難度

- pool = RECIPES.filter(cat ∈ DAY_CATS[day])，避免與前 2 位重複；提供 `game.forceNextRecipe(id)`。
- complexity = items.length + actions.length×2 + (finish 不是 none/noTop ? 1 : 0)；patienceMax = clamp(60 + complexity×10, 60, 150) 秒。
- T：elapsed ≤ max → 1；否則 max(0.2, 1 − 0.8×(elapsed−max)/max)。耐心條 1 − elapsed/max，歸零後紅色閃爍。

| Day | 開放系列 | 客人數 | 進場間隔 | 同時上限 |
|---|---|---|---|---|
| 1 | 純茶、台灣茶系列 | 8 | 20s | 2 |
| 2 | + 歐蕾、奶茶、奶蓋 | 9 | 16s | 3 |
| 3 | + 蜜桃/芒果/草莓/芭樂/水果/多多系列、南區限定仙草 | 10 | 13s | 4 |
| 4 | 全部（+ 老饕蘋果系列、蘋果系列） | 12 | 10s | 5 |
| 5+ | 全部 | 12 | 8s | 5 |

- 完成 Day N 解鎖 Day N+1；localStorage['lephare_progress'] = {maxDay, bestMoney}；不可用時靜默略過。
- 每日結算 `#modal-day-end`：客人數、平均星等、總收入、★5 次數、最慢一杯、[下一天][重玩本日][回主選單]。

## 5. 固定驗收清單（Evaluator 用；Evaluator 不可修改本節）

需暴露 `window.game`：`state, serve(), addItem(ing, qty), doAction(code), setFinish(code), score(recipe, cup), forceNextRecipe(id), spawnCustomer(), getPool(day), DAY_CONFIG, timeFactor(elapsed,max), patienceFor(r), starsFor(sat), RECIPES`。

| # | 條目 | 驗證 |
|---|---|---|
| 1 | 離線開啟無錯誤 | console 無 Uncaught；typeof window.game==='object' |
| 2 | 所有配方皆可被點到 | 每個 r：forceNextRecipe(r.id) 後 spawnCustomer().recipe.id===r.id；getPool(4).length===RECIPES.length（101） |
| 3 | 每日系列限制 | getPool(1) 只含 純茶/台灣茶系列；pool(2)⊇pool(1)；pool(3)⊇pool(2)；pool(4)=全部 |
| 4 | 每日客人數 | DAY_CONFIG[1].customers===8，[2]===9，[3]===10，[4]===12 |
| 5 | 量杯按住填充 | #m-fill pointerdown 500ms 後 pointerup，#measure-ml >0 整數且等於 state.measure.ml |
| 6 | 量杯微調 | 100 → 點 +5 +1 −5 −1 → 100；+1×3 → 103；下限 0 上限 500 |
| 7 | 量杯倒入 | 掛 green 350 後 #btn-pour → cup.items 含 {green,350}；#cup-list 有「綠茶 350ml」；量杯歸零 |
| 8 | 單一液體 | 有 green 再掛 black → 拒絕，src 仍 green，有提示 |
| 9 | 液體來源數 | .ing[data-kind=liquid] 共 17 |
| 10 | 全素材可見 | 所有配方 ing 皆有對應 .ing |
| 11 | 容差計分 | 單液體 350 配方：350→100；320→100；385→100；420→50；455+→0 |
| 12 | 小量容差 | 目標 30：40→100；50→50 |
| 13 | 權重 | (100,0,0)→Q60；(0,100,100)→Q40；全 100→100 |
| 14 | 製程計分 | need [shake]：shake→100；無→0；shake+heat→80；need 空做 heat→75 |
| 15 | 收尾計分 | topIce：topIce→100；topTea→40；topHot→0；none 選 noTop→100 |
| 16 | 時間係數 | (60,100)→1；(100,100)→1；(150,100)→0.6；(200,100)→0.2；(500,100)→0.2 |
| 17 | 耐心範圍 | 所有 patienceFor(r) ∈ [60,150] |
| 18 | 星等 | 90→5；89→4；75→4；74→3；60→3；59→2；40→2；39→1 |
| 19 | 撤銷/倒掉 | 3 筆後 #btn-undo → 2；#btn-reset-cup → items/actions 空、finish none |
| 20 | 勺類合併 | 珍珠點 2 次 → 一筆 {pearl,150}，清單含「2勺」；寒天出現 30/50/75 |
| 21 | 配方表計時不停 | 開 #modal-recipes 等 2s，elapsed 增加 ≥1.8s；展開後含 recipe.steps 原文 |
| 22 | 暫停 | #btn-pause 等 2s，elapsed 增加 <0.1s |
| 23 | 送出流程 | 接單、加內容、#btn-serve → #modal-result 顯示、cup 清空、money ≥ 原值、.customer 移除 |
| 24 | 空杯 | 工作杯空時 #btn-serve disabled |
| 25 | 每日結算 | 送完當日客人 → #modal-day-end 顯示，可 +1 day，#hud-day 更新 |
| 26 | 版面 | #app 1280×720；#cup #measure #btn-serve .tab 存在可見 |
| 27 | 旋茶前置 | 無 teabag → #btn-brew2 disabled；teabag+hot 200 後可用；點擊 2s 內 actions 含 brew2 |
| 28 | 榨汁前置 | 無 apple → #btn-juice disabled；apple≥1 可用 |

## 6. 實作步驟（Generator）
1. 骨架 + 縮放；2. 載入 RECIPE_DATA、建 DAY_CATS（關鍵字對映、空池回退）；3. 素材分頁；4. 量杯狀態機與拖曳；5. 杯內清單/撤銷/數量選擇器/勺類/顆件；6. 設備動作與前置；7. 純函式評分模組；8. 客人生成與耐心計時（100ms tick，暫停凍結）；9. 送出/結算/每日結算/存檔；10. 配方表/暫停/開始畫面；11. 暴露 window.game 並自測第 5 節。

風險：transform scale 下拖曳座標 → 用 elementFromPoint；仙草勺數 round(q/67)。

---

## 附錄 A：與實際 recipes.js 的差異（以本附錄為準，覆蓋上文）

1. 資料掛在 `window.RECIPE_DATA = { ING, ACTIONS, FINISH, RECIPES, CATEGORIES, VERSION }`，不是 `window.RECIPES`。`<script src="recipes.js">` 載入即可。
2. `ING` 字典已在 recipes.js 定義（含 name/unit/group/color/spoon/spoonName/sizes），index.html 直接沿用，不要重新定義另一份；如需 presets/weight 等 UI 屬性，在 index.html 用一張補充表合併。
   - group 對映分頁：tea→茶桶、water+fridge→水/冷藏、dial→糖/醬/秤(weigh)、spoon→勺料、count→顆/件(unit)。
3. 冰塊「適量」在配方中是 `{ing:'ice', qty:1}`（不是 −1）。數字 200/250 才走容差。玩家按「適量」也記 qty:1。
4. 熱飲 size 有 'H'（如「蘋果鮮綠 H-熱」），M/L/H 三種；杯型按鈕做 M / L / H 三個。
5. 奶精 creamer 的 qty 單位是「匙」(3/4/5)，spoon=1；勺數比對直接用 qty。
6. 寒天 agar 的 sizes 已在 ING.agar.sizes：{半勺:30, 八分勺:50, 1勺:75}。
7. 每筆配方有 `full`（如「蘋果鮮綠 M-冰」）與 `sweet`（無/三/五/正）。
8. 系列（cat）實際值：老饕蘋果系列、蘋果系列、蜜桃系列、芒果系列、草莓系列、芭樂系列、水果系列、多多系列、台灣茶系列、純茶、歐蕾、奶茶、奶蓋、南區限定仙草。
9. 檔案位置：本資料夾 `index.html` + `recipes.js`；預覽用 .claude/launch.json 的 drink-game（http://localhost:8765）。
10. 遊戲文字全部繁體中文；畫面風格參考卡通小攤（暖色木紋櫃台、圓角卡片、emoji 圖示即可，不需外部圖片）。
