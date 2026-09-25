# 樂法 Le Phare 飲料店經營遊戲 — 背景音樂＋音效設計規格 (AUDIO-PLAN.md)

> 版本 1.0 ｜ 依附於 PLAN.md 1.0 與現行 `index.html`（1169 行）｜ 全部音訊以 Web Audio API 即時合成，無外部音檔、無 CDN、`file://` 可玩。
> 「【決定】」為 Planner 在需求未明處自行做的決定。既有 `tests/acceptance.js` 28 條不可改且必須全過；新增 `tests/audio-acceptance.js` 為音訊驗收（Evaluator 專用，Generator 不可改）。

## 0. 總覽與檔案配置

```
drink-game/
  index.html      只允許三類改動：(a) 載入 audio.js  (b) 事件函式內加一行 GameAudio 呼叫  (c) HUD 加 #btn-music #btn-sfx
  audio.js        【新增】全部音訊程式（IIFE + 'use strict'，只輸出 window.GameAudio）
  recipes.js      不動
  tests/acceptance.js        不動
  tests/audio-acceptance.js  不動（Evaluator）
```

載入順序（index.html 第 327 行處）：

```html
<script src="recipes.js"></script>
<script src="audio.js"></script>     <!-- 新增，必須在遊戲 script 之前 -->
<script>
(function () {
  'use strict';
  const D = window.RECIPE_DATA;
```

audio.js 放在 `<body>` 末端、HUD 之後，載入時 `#hud` 已存在，可直接綁定切換按鈕。

命名：`window.GameAudio`（不可用 `window.Audio`，會覆蓋原生 `Audio` 建構子）。

## 1. 架構與訊號鏈

```
one-shot 節點 ──┐
loop 節點 ──────┼─→ sfxBus (Gain 1.0 / 0 when sfxOff)  ─┐
                                                          ├─→ master (Gain 0.8) → DynamicsCompressor → destination
lead/bass/pad/drums ─→ musicBus (Gain 0.35；menu 0.30；ducked 0.10；hidden 0) ─┘
```

- Compressor：threshold −12 dB、knee 20、ratio 6、attack 0.003、release 0.15。
- 所有 Gain 變化用 `setTargetAtTime` / `linearRampToValueAtTime`，避免爆音。
- AudioContext 只在 `unlock()` 建立；任何時間 `ctx` 可能為 `null`，所有方法必須容忍。

### 1.1 合成原語（audio.js 內部 helper）

| helper | 說明 |
|---|---|
| `osc({type, f0, f1?, dur, a=0.005, d?, sus=1, r=0.03, gain, detune=0, filter?, at=0})` | OscillatorNode，f0 在 dur 內 exponentialRamp 到 f1；Gain 包絡 attack→decay→sus→release；可選 BiquadFilter；`at` 為相對 currentTime 延遲秒 |
| `noise({dur, gain, filter:{type,f,q,f1?}, a, r, at})` | 預生成 2 秒白噪音 AudioBuffer（lazy、一次、loop）→ BiquadFilter（f 可滑到 f1）→ Gain 包絡 |
| `lfo(target, {rate, depth, type='sine'})` | Oscillator→Gain(depth)→AudioParam，用於水聲/馬達顫動 |
| `mtof(midi)` | `440 * 2^((m-69)/12)` |
| `voice(nodes, stopAt)` | 登錄到 `activeVoices`，`onended` 時 disconnect 並移出；一次性語音上限 16，超過丟棄並 `stats.dropped++` |

## 2. API — `window.GameAudio`

### 2.1 狀態與統計

```js
GameAudio.available   // boolean：typeof (AudioContext||webkitAudioContext)==='function'
GameAudio.state = {
  musicOn: true, sfxOn: true,        // localStorage
  musicMode: 'menu',                 // 'menu' | 'play' | 'dayend' | 'none'
  tense: false, paused: false, ducked: false, hidden: false,
  loops: [],                         // 邏輯上啟動中的持續音名稱
  unlocked: false, ctxState: 'none', // 'none'|'suspended'|'running'|'closed'|'interrupted'
  bpm: 0,
};
GameAudio.stats = { requested:0, played:0, suppressed:0, dropped:0, loopsStarted:0, musicNotes:0, onceHits:0, byName:{} };
```

- `requested`：每次 `play()` +1。`played`：真正建立節點 +1（同時 `byName[name]++`）。`suppressed`：sfxOff／無 ctx／未知名稱／rate-limit 略過 +1。`dropped`：語音上限丟棄。`onceHits`：`playOnce` 首次命中 key 的次數（不論有無 ctx）。

### 2.2 方法

| 方法 | 行為 |
|---|---|
| `unlock(evt?)` | 若 `available` 且 ctx 不存在則建立 ctx 與 bus；`ctx.resume().catch(()=>{})`。**由事件觸發時**只在 `evt.isTrusted===true` 且（若支援）`navigator.userActivation.isActive!==false` 才建立（避免合成事件觸發 autoplay 警告）；**無參數呼叫**一律嘗試建立。running 後移除文件層監聽；ctx 進入 interrupted/suspended 則重掛。回傳 boolean（ctx 是否存在）。永不拋錯。 |
| `play(name, delaySec=0)` | `requested++` → 若 `!sfxOn || !ctx || !SFX[name]` → `suppressed++`, return false → 每名稱 rate-limit（預設 60ms；表列覆寫）→ 語音上限 → 建節點 → `played++`, `byName[name]++`, `lastPlayTs=performance.now()`, return true。未知名稱不拋錯。 |
| `playOnce(name, key)` | 同 key 只播一次（`onceKeys: Set`）；首次命中 `onceHits++` 後呼叫 `play`。`music('play')` 時清空 Set。 |
| `startLoop(name)` | 幂等；push 進 `state.loops`（不論 ctx/sfxOn）；ctx && sfxOn 時建節點存 `loopHandles[name]`；`loopsStarted++`。別名 brew2/brew3 → brew 聲音（loops 仍記原名）。 |
| `stopLoop(name, silent=false)` | 從 `state.loops` 移除；有 handle → 40~120ms 淡出後 stop/disconnect、清 timers；`!silent` 且 handle 存在且定義 `tail` → `play(tail)`。不存在時無事、O(1)。 |
| `stopAllLoops(silent=true)` | 對全部 loops 呼叫 stopLoop。 |
| `music(mode)` | `state.musicMode = mode`（合法 'menu'/'play'/'dayend'/'none'，非法→'none'），即使 musicOn=false 或無 ctx 也更新。ctx && musicOn 時：停現行排程器（淡出 .15s）、啟新模式。'play' 清空 onceKeys 並 `tense=false`。'dayend' 8 步不循環，播完停排程器但 mode 保持。 |
| `setTense(bool)` | 更新 `state.tense`；mode==='play' 時影響 BPM/鼓組。同值直接 return。 |
| `setPaused(bool)` | `paused=ducked=bool`。true：musicBus .25s 降到 .10、loop 節點靜默停止但**保留 `state.loops`**（記 `suspendedLoops`）。false：還原音量、對 `suspendedLoops ∩ state.loops` 重建節點。 |
| `setMusicOn/setSfxOn/toggleMusic/toggleSfx` | 更新 state、寫 localStorage、更新 HUD 文字與 aria-pressed。`setMusicOn(true)` 且 ctx → 依 mode 啟動；false → 停排程器淡出。`setSfxOn(false)` → 停所有 loop 節點（保留名單）、sfxBus 0。 |
| `resetStats()` | stats 全歸零（含 byName、onceHits）。 |
| `now()` | `ctx ? ctx.currentTime : 0`。 |

### 2.3 內建自動行為（不需 index.html 掛點）

1. 解鎖監聽：`document.addEventListener('pointerdown', unlock, {capture:true, passive:true})` 與 `keydown`；running 後移除。
2. 通用 UI 點擊音：`document.addEventListener('click', e => { if (e.target.closest('button') && performance.now() - lastPlayTs > 30) play('click'); })`。專屬音效在 bubbling 時已先播並更新 `lastPlayTs`，通用 click 自動略過。
3. HUD `#btn-music`/`#btn-sfx` click → toggle。
4. visibilitychange（§7.2）。
5. `ctx.onstatechange` 同步 `ctxState`/`unlocked`。

## 3. 音效清單

音量為送入 sfxBus 前的 Gain 峰值；「→」為指數滑音；「+噪」疊加噪音層。

### 3.1 一次性音效

| # | 名稱 | 事件 | 合成方式 | 時長 | 音量 | rate-limit |
|---|---|---|---|---|---|---|
| 1 | `click` | 任何按鈕（通用） | square 1200→900，a 2ms，指數衰減 | 30ms | .15 | 40ms |
| 2 | `tab` | 分頁切換 | triangle 660 (40ms) 接 880 (50ms) | 90ms | .18 | 60 |
| 3 | `ui_open` | 開配方表／數量選擇器 | sine 520→780 掃頻 80ms ＋噪 HP 4000 30ms | 90ms | .18 | 100 |
| 4 | `accept` | 接單 | triangle E5 659 (60ms) → A5 880 (120ms) ＋噪 BP 3000 Q2 20ms | 180ms | .25 | 100 |
| 5 | `customer` | 客人進場 | 門鈴：sine E6 1318 decay .4s 於 t、sine C6 1046 decay .45s 於 t+180ms；各疊 detune +7 cents | 650ms | .22 | 300 |
| 6 | `mount` | 量杯掛上來源 | triangle 2400 decay 120ms ＋ sine 3600 decay 60ms | 120ms | .20 | 60 |
| 7 | `drip` | 裝填結束尾音 | sine 1400→900 40ms | 40ms | .15 | 40 |
| 8 | `tick_up` | 微調 + | sine 880 35ms | 35ms | .12 | 20 |
| 9 | `tick_down` | 微調 − | sine 660 35ms | 35ms | .12 | 20 |
| 10 | `dump` | 量杯倒掉 | 噪 LP 1200→400 300ms ＋ sine 300→120 250ms | 300ms | .25 | 100 |
| 11 | `pour` | 倒入工作杯（含熱水快捷） | 噪 BP 700→1100 Q1.5 350ms 包絡 0→峰(120ms)→0 ＋ sine 400→650 250ms gain .08 | 350ms | .25 | 80 |
| 12 | `scoop` | 加勺料 | 噪 BP 2500 Q2 40ms ＋ triangle 300 60ms | 70ms | .22 | 60 |
| 13 | `unit` | 加顆件 | sine 520→380 90ms，a 3ms | 90ms | .25 | 60 |
| 14 | `qty_confirm` | 數量選擇器確認 | 噪 BP 3000 Q.8 200ms 加 30Hz 顫音 ＋ triangle B5 987 80ms | 220ms | .22 | 100 |
| 15 | `undo` | 撤銷 | triangle 700→450 120ms | 120ms | .20 | 80 |
| 16 | `reset` | 倒掉重做 | `dump` 層 ＋ 噪 HP 3000 100ms（t+60ms）＋ 噪 LP 800 400ms | 450ms | .28 | 200 |
| 17 | `shake_end` | 雪克完成 tail | 噪 BP 2500 Q1 80ms ＋ square 1500 15ms | 90ms | .22 | — |
| 18 | `ding` | 打熱完成 tail | sine C7 2093 decay .6s ＋ sine G7 3136 decay .3s ×.4 | 600ms | .30 | — |
| 19 | `blend_end` | 冰沙完成 tail | sawtooth 140→60 300ms LP 900 ＋ 噪 HP 2000 100ms | 300ms | .20 | — |
| 20 | `juice_end` | 榨汁完成 tail | 噪 HP 1500 90ms ＋ `drip` | 130ms | .20 | — |
| 21 | `brew_end` | 旋茶完成 tail | 噪 HP 2000 200ms decay ＋ sine 900→600 60ms | 200ms | .22 | — |
| 22 | `finish_topIce` | 收尾 補冰/水 | 3 個 triangle 2200/2600/1900(±100) 於 0/70/150ms 各 decay 90ms ＋ 噪 HP 5000 20ms | 240ms | .20 | 100 |
| 23 | `finish_topHot` | 收尾 補熱水 | 噪 BP 900 Q1 250ms ＋ 噪 HP 3000 250ms gain .06 | 250ms | .18 | 100 |
| 24 | `finish_topTea` | 收尾 補桶茶 | 噪 BP 900 Q1 250ms | 250ms | .18 | 100 |
| 25 | `finish_none` / `finish_noTop` | 收尾 不補 | 別名 → `click` | 30ms | .15 | 40 |
| 26 | `serve` | 送出 | sine G6 1568 ＋ D7 2349 (×.5) decay .4s ＋ 噪 BP 1000→3000 200ms whoosh | 450ms | .30 | 200 |
| 27 | `star1` | ★1 | triangle E4 330 150ms → C4 262 200ms（第二音 5Hz 顫音） | 350ms | .22 | 120 |
| 28 | `star2` | ★2 | triangle G4 392 120ms → F4 349 160ms | 280ms | .22 | 120 |
| 29 | `star3` | ★3 | sine C5 523 120ms、E5 659 160ms | 280ms | .22 | 120 |
| 30 | `star4` | ★4 | triangle 琶音 C5 E5 G5 各 100ms，再 C6 250ms | 550ms | .25 | 120 |
| 31 | `star5` | ★5 | triangle+square(.3) C5 E5 G5 C6 E6 各 90ms，接和弦 C6+E6+G6 500ms ＋ 噪 HP 6000 300ms gain .06 | 950ms | .28 | 120 |
| 32 | `coin` | 金錢入帳（延遲 .35s） | sine B5 987 60ms → E6 1318 200ms，疊 square ×.08 | 260ms | .22 | 100 |
| 33 | `overtime` | 耐心歸零（每客一次） | square 440 90ms、隔 60ms、square 330 90ms，LP 2000 | 240ms | .20 | 300 |
| 34 | `dayend_chime` | 每日結算 | triangle C6 E6 G6 C7 於 0/120/240/360ms 各 decay .8s | 1.2s | .22 | 500 |
| 35 | `open` | 開店 | sine A6 1760 decay .5s ＋ E6 1318 於 t+120ms decay .6s | 750ms | .28 | 500 |
| 36 | `error` | toast | square 220 70ms、隔 50ms、square 220 70ms，LP 800 | 190ms | .18 | 150 |

### 3.2 持續音（Loop）

Loop handle：`{ nodes: AudioNode[], timers: number[], stop(fadeMs) }`。淡入 60ms、淡出 80ms。

| 名稱 | 事件 | 合成方式 | 音量 | tail |
|---|---|---|---|---|
| `fill` | 按住裝填 | 噪 → BP 900 Q1.2；lfo 6Hz depth 200 調濾波、lfo 5Hz depth 15% 調 gain；氣泡 timer 120ms 隨機 600~1200Hz sine 25ms gain .06 | .18 | `drip` |
| `shake` | 雪克 1.5s | 每 150ms：噪 BP 1800 Q1 60ms（gain 交替 .30/.18）＋ sine 120 40ms gain .12 | .30 | `shake_end` |
| `heat` | 打熱 2s | 噪 LP 3000→6000（setTargetAtTime τ .8s），gain .10→.22 2s ＋ sine 60 hum .06 | .22 | `ding` |
| `blend` | 冰沙 2.5s | sawtooth 90→140 (300ms) LP 900 ＋ square 180 detune −5 ×.3；噪 HP 2000 .05 lfo 12Hz depth 60% | .22 | `blend_end` |
| `stir` | 攪拌 0.8s | 每 200ms triangle 1800±200 30ms .15 ＋ 噪 BP 500 Q1 .08 | .15 | — |
| `juice` | 榨汁 1.8s | 噪 BP 1200 Q3 lfo 3Hz depth 90% ＋ sine 200→150 150ms 每 330ms | .20 | `juice_end` |
| `brew` | 旋茶 brew2/brew3 | 噪 HP 1500→LP 5000 .12 ＋ sine 1200 .04 vibrato 5Hz ＋ 氣泡 timer 160ms .04 | .12 | `brew_end` |

## 4. index.html 掛點表（行號以現行檔為準；加入 script 後 +1）

| # | 函式（原行） | 插入位置 | 程式碼 |
|---|---|---|---|
| H0 | IIFE 開頭 | `const D = window.RECIPE_DATA;` 之前 | `const GameAudio = window.GameAudio \|\| { play(){}, playOnce(){}, startLoop(){}, stopLoop(){}, stopAllLoops(){}, music(){}, setPaused(){}, setTense(){} };` |
| H1 | `toast` (531) | 設文字後 | `GameAudio.play('error');` |
| H2 | buildBench tab click (556) | click handler 內 | `GameAudio.play('tab');` |
| H3 | `openQty` (613) | showModal 前 | `GameAudio.play('ui_open');` |
| H4 | `addItem` (635) | render 前 | `GameAudio.play({ liquid:'pour', weigh:'qty_confirm', scoop:'scoop', unit:'unit' }[kind]);` |
| H5 | `undo` (649) | render 前 | `GameAudio.play('undo');` |
| H6 | `resetCup` (654) | render 前 | `GameAudio.play('reset');` |
| H7 | `setFinish` (656) | renderPanel 前 | `GameAudio.play('finish_' + state.cup.finish);` |
| H8 | `mountMeasure` (665) | 成功掛上後 | `GameAudio.play('mount');` |
| H9 | `setMeasure` (667) | 第一句 | `GameAudio.play(Number(ml) > state.measure.ml ? 'tick_up' : 'tick_down');` |
| H10 | `emptyMeasure` (668) | render 前 | `GameAudio.play('dump');` |
| H11 | `startFill` (683) | setInterval 後 | `GameAudio.startLoop('fill');` |
| H12 | `stopFill` (691) | 函式末 | `GameAudio.stopLoop('fill');` |
| H13 | `doAction` (743) | 設 busy/action 後 | `GameAudio.startLoop(code);` |
| H14 | `finishAction` (749) | 清 busy 後 | `GameAudio.stopLoop(a.code);` |
| H15 | `spawnCustomer` (777) | renderCounter 前 | `GameAudio.play('customer');` |
| H16 | `acceptOrder` (785) | accepted=true 後 | `GameAudio.play('accept');` |
| H17 | `serve` (828) | leaveCustomer 後 | `GameAudio.play('serve');` |
| H18 | `showResult` (850) | showModal 前 | `GameAudio.play('star' + r.stars); if (r.money > 0) GameAudio.play('coin', 0.35);` |
| H19 | `showDayEnd` (882) | showModal 前 | `GameAudio.music('dayend'); GameAudio.play('dayend_chime');` |
| H20 | `showDayEnd` 回主選單 (881) | showModal('modal-start') 後 | `GameAudio.music('menu');` |
| H21 | `startDay` (908) | stopFill 後 | `GameAudio.stopAllLoops(true); GameAudio.music('play'); GameAudio.play('open');` |
| H22 | `togglePause` (923) | 翻轉 paused 後 | `GameAudio.setPaused(state.paused);` |
| H23 | `openRecipes` (953) | showModal 前 | `GameAudio.play('ui_open');` |
| H24 | `updatePatience` (995) | toggle over 後 | `if (ratio <= 0) GameAudio.playOnce('overtime', o.id);` |
| H25 | `updatePatience` (997) | forEach 後 | `GameAudio.setTense(state.orders.some(o => o.elapsed >= o.patienceMax));` |
| H26 | HUD (209) | `#btn-recipes` 之前 | `<button id="btn-music" aria-pressed="true" title="背景音樂">🎵 音樂</button><button id="btn-sfx" aria-pressed="true" title="音效">🔊 音效</button>` |

註：倒入統一在 addItem 依 kind 判斷（涵蓋 #btn-pour、拖到 #cup、熱水快捷、加奶蓋）。startDay 取消進行中動作時用 stopAllLoops(true) 靜默。H24/H25 位於 50ms tick 路徑，必須便宜。

## 5. 背景音樂

### 5.1 排程器
`setInterval(scheduleTick, 25)`；lookahead 0.12s；`while (nextStepTime < ctx.currentTime + lookahead) { scheduleStep(i); nextStepTime += stepDur; i = (i+1) % len; }`。`stepDur = 60/bpm/stepsPerBeat`。BPM 變更下一步生效。每音 `stats.musicNotes++`。每音新建 osc+gain，onended disconnect。

### 5.2 樂器

| 樂器 | 合成 | 包絡 | 音量 |
|---|---|---|---|
| lead | triangle ＋ square(×.25) → LP 2400（tense 4000） | a .01、decay 至 .6（80ms）、r .10 | .16 |
| bass | sine ＋ triangle(×.3) | a .005、r .05 | .20（tense .24） |
| pad（menu） | 兩支 triangle detune ±6 cents → LP 1200 | a .3、r .4 | .06 |
| kick | sine 150→45 (100ms) | decay .18 | .50 |
| hat | 噪 HP 7000 Q.7 | decay .04 | .12 |
| snare（tense） | 噪 BP 1800 Q.8 decay .10 ＋ sine 180 decay .06 | — | .25 |

### 5.3 樂句（MIDI；0 = 休止）。C 大調五聲音階，和聲 C–Am–F–G。

**menu** — BPM 72、四分音符格、16 步、無鼓、musicBus .30：
```
lead : [76,79,81,79, 76,74,72,0, 74,76,79,76, 74,72,69,0]
bass : 步 0/4/8/12 根音 [48,45,41,43]；步 2/6/10/14 五音 [55,52,48,50]
pad  : 步 0/4/8/12 和弦 C[60,64,67] Am[57,60,64] F[53,57,60] G[55,59,62]，持續整小節
```

**play** — BPM 116、八分音符格、32 步、A/B 交替、musicBus .35：
```
leadA: [72,76,79,76,81,79,76,74, 69,72,76,72,74,72,69,0, 65,69,72,69,74,72,69,67, 67,71,74,71,76,74,71,0]
leadB: [79,81,79,76,72,74,76,0, 76,74,72,69,72,0,69,0, 65,69,72,74,77,74,72,69, 67,71,74,76,79,76,74,0]
bass : 每小節 [根,0,五,0,根,0,五,0]：C[48,55] Am[45,52] F[41,48] G[43,50]
kick : 每小節步 0、4；hat：每小節步 1、3、5、7
```

**tense**：BPM 134；hat 每步；snare 每小節步 2、6；lead LP 4000；bass .24。setTense(false) 還原。

**dayend** — BPM 96、四分音符格、8 步、播一次：
```
lead : [79,81,84,0, 88,0,0,0]（E6 持續 2 拍 r .6）
bass : 步 0 = 41、步 2 = 43、步 4 = 48（持續 4 拍）
pad  : 步 0 F、步 2 G、步 4 C（4 拍 r .8）；無鼓；結束後 clearInterval
```

### 5.4 模式切換
`music(mode)`：舊排程器 clearInterval、淡出 150ms → 新模式 nextStepTime = now+0.2、淡入 600ms。載入時 mode='menu'；第一次 unlock 成功時若 musicOn → 啟動。回主選單 → 'menu'；startDay → 'play'。

## 6. HUD 切換按鈕

| 按鈕 | on | off | aria-pressed |
|---|---|---|---|
| `#btn-music` | `🎵 音樂` | `🔇 音樂` | 'true' / 'false' |
| `#btn-sfx` | `🔊 音效` | `🔇 音效` | 'true' / 'false' |

off 時 `btn.style.opacity='.6'`。由 audio.js 載入時綁 click 並依 localStorage 初始化。不加快捷鍵【決定】。

## 7. 暫停與隱藏分頁

### 7.1 暫停
進入：`paused=ducked=true`；musicBus .25s 降到 .10（音樂不停）；loop 節點靜默停止、名單保留於 `suspendedLoops`（`state.loops` 不變）。恢復：音量還原；`suspendedLoops ∩ state.loops` 重建。音訊完全不讀寫 `window.game.state`。

### 7.2 隱藏分頁
hidden：musicBus .1s 降到 0、clearInterval 排程器。visible：若 musicOn 且 mode 有音樂 → 重啟並淡回。

## 8. 設定持久化
`localStorage['lephare_audio']` = `{"v":1,"music":true,"sfx":true}`；try/catch 靜默；載入即讀；setMusicOn/setSfxOn 即寫。

## 9. 相容性
`available===false` 時所有方法仍可呼叫、更新 state/stats（suppressed++），不建節點、不拋錯、不 console.error。所有 ctx 操作 try/catch；resume 的 Promise 一律 catch。Safari：webkitAudioContext；iOS interrupted → 重掛解鎖監聽。

## 10. 給 Evaluator 的固定驗收清單（音訊）— 對應 tests/audio-acceptance.js

`A = window.GameAudio`、`g = window.game`。

| # | 條目 | 機械驗證 |
|---|---|---|
| A1 | 物件與方法存在 | typeof A==='object'；unlock/play/playOnce/startLoop/stopLoop/stopAllLoops/music/setTense/setPaused/setMusicOn/setSfxOn/toggleMusic/toggleSfx/resetStats 皆為 function；state、stats 為物件；Array.isArray(state.loops) |
| A2 | 不覆蓋原生 Audio | typeof window.Audio==='function' && window.Audio!==A |
| A3 | 手勢前呼叫不拋錯 | 無點擊下：play/startLoop/stopLoop/music/setPaused 全不拋錯；stats.requested≥1 |
| A4 | 未知名稱 | play('___nope___') 回傳 false 且 suppressed +1 |
| A5 | 關閉音效 | unlock(); setSfxOn(false); play×3 → played 不變、suppressed +3；sfxOn===false；#btn-sfx 含 🔇、aria-pressed==='false' |
| A6 | 開啟音效有建節點 | setSfxOn(true); unlock(); 若 ctxState!=='none'：play('accept') → played +1（無 ctx 記 skip） |
| A7 | 音樂模式狀態 | music('play')→'play'；'menu'；'dayend'；'bogus'→'none'；setMusicOn(false) 後仍成立 |
| A8 | localStorage | setMusicOn(false); setSfxOn(true) → JSON.parse(localStorage.lephare_audio) music:false sfx:true；（重載後 musicOn===false 且 #btn-music 含 🔇，由 phase2 驗證）；測後還原 |
| A9 | HUD 切換 | #btn-music click 文字改變且 aria-pressed===String(state.musicOn)，再 click 還原；#btn-sfx 同；#btn-music 在 #btn-recipes 之前 |
| A10 | loop 邏輯狀態 | startLoop('fill') 幂等、stopLoop 移除、重複 stopLoop 不拋錯 |
| A11 | 裝填掛點 | startDay(1); mountMeasure('green'); pointerdown #m-fill → loops 含 fill；pointerup → 不含 |
| A12 | 設備動作掛點 | addItem('green',100); p=doAction('shake') → loops 含 shake；await p → 不含；loopsStarted 增加 |
| A13 | 暫停 ducking | #btn-pause → ducked===true && paused===true；再按 → ducked===false |
| A14 | 暫停保留 loop | doAction('blend') 中按暫停 → loops 仍含 blend；恢復 → 仍含；await p → 空 |
| A15 | 耐心歸零一次＋tense | resetStats(); o.elapsed=o.patienceMax+1; 等 300ms → onceHits===1（有 ctx 且 sfxOn 時 byName.overtime===1）；tense===true；o.elapsed=0 等 120ms → tense===false |
| A16 | 結算與主選單模式 | 跑完 Day1 → musicMode==='dayend'；回主選單 → 'menu'；startDay → 'play' |
| A17 | 無 AudioContext 靜默 | 在 iframe 內以 AudioContext=undefined 載入 audio.js → available===false，A3/A4/A7/A10 仍過且無 console.error |
| A18 | 既有驗收不退步 | runAcceptance() 28/28 |
| A19 | 通用點擊音不重複 | unlock(); 若 ctx：resetStats(); #btn-undo.click() → byName.undo===1 且 !byName.click |
| A20 | 人工聽測 | 開店有 BGM；裝填按住有水聲放開停；雪克後「扣」；打熱後「叮」；★5 號角；耐心歸零 BGM 加速加鼓；暫停 BGM 變小聲 |

## 11. 實作步驟
1. audio.js 骨架（feature detect、state/stats、localStorage、no-op 佇位）。2. ctx 與 bus、unlock、文件層監聽。3. 合成原語、語音上限、rate-limit。4. SFX 表 36 個＋別名；play/playOnce。5. Loop 表七個、start/stop、tail、暫停 suspend/restore。6. 音樂：樂器、四組 pattern、排程器、music/setTense/setPaused/visibilitychange。7. 設定與 HUD、通用 click。8. index.html：H26、script、H0~H25。9. 驗證：runAcceptance 28/28 → tests/audio-acceptance.js A1~A19 → 人工聽測 A20；確認 console 無「AudioContext was not allowed to start」。

## 12. 風險與對策

| 風險 | 對策 |
|---|---|
| Autoplay 政策 | ctx 僅在 unlock 建立；事件觸發時檢查 isTrusted 與 userActivation；resume 一律 catch |
| acceptance #5 合成 pointerdown/up | stopLoop 幂等 O(1)；不建 ctx |
| acceptance #22 暫停 elapsed | 音訊模組不讀寫 game.state |
| #2 瞬間 101 客人、#25 連續送出 | rate-limit ＋ 語音上限 16 ＋ compressor |
| 節點洩漏 | onended disconnect；handle 持有節點與 timer |
| 隱藏分頁節流 | visibilitychange 靜音並停排程器 |
| 開店手勢同時切 menu→play | music() 先 clearInterval 再啟新，150ms 淡出 |
| audio.js 缺檔 | H0 備援物件 |
| iOS interrupted | onstatechange 重掛 unlock |
| 通用 click 與專屬音重疊 | lastPlayTs 30ms 抑制 |
