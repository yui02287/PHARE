# 樂法 Le Phare 飲料店經營遊戲 — v3 變更規格：雪克杯與紙杯分開 (PLAN-v3.md)

> 目的：容器真實化。配方裡「杯底加入…」是放**紙杯**；「雪克杯盛…搖茶…倒入紙杯」是另一個容器；果汁機與萃茶機同理。玩家必須把素材放進正確容器、在該容器做動作、再倒入紙杯。
> 沿用 PLAN-v2.md 的一切（資料、冰量、平均抽取、評分權重、元件 id），本文件只寫差異。驗收：`tests/acceptance.js`（v3，32 條）＋ `tests/audio-acceptance.js`。

## 1. 資料（recipes.js v3，已完成，不可改）

```js
RECIPE_DATA.VESSELS = { c:{name:'紙杯',emoji:'🥤',actions:['stir','juice']}, s:{name:'雪克杯',…,actions:['shake','steam','stir','juice']},
                        b:{name:'果汁機',actions:['blend']}, t:{name:'萃茶機',actions:['brew3','brew5']} }
recipe.items[i].v   // 'c'|'s'|'b'|'t' 該素材應放入的容器
recipe.iceV         // 'c'|'s'|null 客人指定的冰塊應放的容器（搖茶類為 s）
recipe.pour         // 例 { s:'c' }、{ t:'s', s:'c' }、{ b:'c' }：各非紙杯容器最後要倒去哪
```

## 2. 狀態模型

```js
state.vessels = { c:{items:[]}, s:{items:[]}, b:{items:[]}, t:{items:[]} }   // 每筆 item = {ing, qty, v}，v = 最初加入的容器（倒入後不變）
state.active  = 'c'                                                         // 目前操作中的容器
state.cup     = { size, temp, items: state.vessels.c.items /*同一個陣列*/, actions:[], finish:'none' }
state.history = [{v, index}]  // 撤銷用
```
- `addItem(ing, qty, v = state.active)`：加入指定容器，item.v = v。勺料同容器合併、ice 同容器覆蓋。
- `setIce(pct, v = state.active)`：該容器唯一 ice 項覆蓋為 pct（0 移除），item.v = v。
- `selectVessel(v)`：切換 active；更新 UI。
- `pourInto(from, to)`：把 from 的全部 items 搬到 to（保留每筆 item.v）；to 若已有同 ing：一般素材加總、勺料加總、ice 取加總上限 100；from 清空；播 `GameAudio.play('pour')`；回傳搬動筆數。from===to 或 from 空 → 回傳 0。
- `doAction(code)`：只對 active 容器有效：`VESSELS[active].actions.includes(code)` 且前置成立（shake/steam/blend/stir：該容器有內容；steam：該容器有液體；juice：該容器有 apple；brew3/brew5：active==='t' 且有 teabag 與 hot）。否則 toast 並回傳 `Promise.resolve(false)`。動作完成後 push 到 `state.cup.actions`（字串，去重、brew3/brew5 互斥）。
- `undo()`：移除最後一筆加入的 item（任一容器）。`resetCup()`：清空四個容器、actions、finish、active='c'。
- `serve()`：只以 **紙杯** 的內容評分（留在其他容器的東西 = 缺少）。

## 3. 評分（差異）

在 PLAN-v2 §4.1 之上加**容器路徑**扣分：對每個 target item（含 ice，其 v = recipe.iceV），若紙杯內對應素材的 `v` 集合不包含 target.v → 扣 10（此類扣分上限 30，與「多餘」扣分分開計算）；details 寫「芭樂泥 應放紙杯(杯底)，你放在雪克杯」。cup.items 若無 `v` 欄位視為 'c'。
範例：純茶 L target（tea@s, sugar@s, ice@s）：三項都在雪克杯加、倒入紙杯 → 100；三項直接加在紙杯 → 100 − 30 = 70。

## 4. 介面

### 4.1 工作區（x:200~1020，y:240~500）
```
[紙杯 #cup 150px][容器槽 #vessel-slot 200px][量杯 #measure 110px][冰量 #ice-panel 110px][設備 #equip 250px]
```
- `#vessel-slot`：上方四個分頁 `.vessel-tab[data-v=c|s|b|t]`（🥤紙杯 🫗雪克杯 🌀果汁機 ☕萃茶機），下方 `#vessel-view` 顯示 active 容器的圖與內容摘要（品項數／總 ml）。active='c' 時 `#vessel-view` 顯示紙杯縮圖並提示「素材會加進紙杯」。`#cup` 也可點擊 → selectVessel('c')。
- `#pour-to-cup`：「⬇ 倒入紙杯」，active 為 s/b/t 且有內容時可用；`#pour-to-shaker`：「→ 倒入雪克杯」，只在 active==='t' 顯示。兩者 disabled 時仍存在 DOM。
- 量杯：`#btn-pour` 與拖到 `#vessel-view` → 倒入 active 容器；拖到 `#cup` → 倒入紙杯。
- 冰量面板：作用於 active 容器（`#ice-pct` 顯示 active 容器的冰量）。
- 設備按鈕：不符 active 容器的按鈕 disabled（例：active 為紙杯時 搖茶/蒸汽機/果汁機/萃茶鍵 都 disabled；active 為雪克杯時 果汁機/萃茶鍵 disabled）。`.brew-water` 150/350：加 hot 到萃茶機並 `selectVessel('t')`。
- 動作進行中顯示在該容器上（店員 emoji 照舊）。

### 4.2 右側面板
- `#cup-list`：先列「紙杯」內容；其後對每個非空的 s/b/t 容器加一行標頭（如「雪克杯：」）再列其內容。格式沿用「綠茶 350ml」「冰塊 50%」「珍珠 2勺」。
- `#order-title` 沿用 bubbleText。

### 4.3 配方表 Modal
展開時除 steps 原文，再列「容器配置」：`紙杯：芭樂泥 100ml、蘋果 1顆｜雪克杯：綠茶 150ml、蔗糖 40g、冰塊 → 倒入紙杯｜動作：搖茶、榨蘋果｜收尾：剩餘補水`；有 sv 的仍列甜度行。

### 4.4 教學文字（#modal-start）
加一段：「杯底料放紙杯；要搖、要加熱的放雪克杯；打冰沙放果汁機；茶包放萃茶機，做完按『倒入紙杯』。」

## 5. window.game API 新增
`VESSELS, selectVessel(v), pourInto(from, to), addItem(ing, qty, v?), setIce(pct, v?)`；`state.vessels`、`state.active`。其餘沿用。

## 6. 音訊
沿用；`pourInto` 播 `pour`；切換容器分頁播 `tab`。

## 7. index.html 需改動位置
狀態初始化與 `snapshotCup`、`addItem/setIce/undo/resetCup`、`doAction` 前置、`serve`、`score`（路徑扣分）、`renderCup/renderPanel/renderButtons`（active、容器槽、pour 按鈕、設備 disabled）、量杯拖曳落點、HTML 工作區、配方表 Modal、開始畫面文字、`window.game` 匯出。

## 8. 驗收摘要（tests/acceptance.js v3）
沿用 v2 30 條並調整：#1 API 含容器；#7 target items 有 v、ice 項 v = iceV；#13 冰量在 active='c'；#16 新增路徑扣分案例（雪克杯路徑 100 vs 全放紙杯 70）；#23 設備前置改為依 active 容器；#26/#30 完美製作改為依 v 分容器、做動作、倒入；新增 #31 容器槽 UI（四分頁、pour 按鈕、pourInto 搬移與合併、留在雪克杯＝缺少）、#32 配方表容器配置文字。
