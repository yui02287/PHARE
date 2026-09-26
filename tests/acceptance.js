// 固定驗收腳本 v3（對應 PLAN-v2.md ＋ PLAN-v3.md）。在遊戲頁面 console 或 javascript_tool 執行：
//   const src = await fetch('/tests/acceptance.js').then(r=>r.text()); (0,eval)(src); await runAcceptance()
// Evaluator 專用；Generator 不可修改本檔。
async function runAcceptance() {
  const R = [];
  const ok = (id, cond, msg = '') => R.push({ id, ok: !!cond, msg: String(msg) });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const g = window.game, D = window.RECIPE_DATA;
  const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;
  const fire = (el, type) => el && el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, isPrimary: true, clientX: 1, clientY: 1 }));
  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const disp = s => $(s) && getComputedStyle($(s)).display !== 'none';
  const clearCup = () => { $('#btn-reset-cup') ? $('#btn-reset-cup').click() : null; g.state.cup.actions = []; g.setFinish('none'); if (g.selectVessel) g.selectVessel('c'); if (g.render) g.render(); };
  const clearCounter = () => { g.state.orders = []; g.state.queue = []; g.state.currentId = null; document.querySelectorAll('.customer').forEach(e => e.remove()); if (g.render) g.render(); };
  const mk = (items, actions = [], finish = 'none', extra = {}) => Object.assign({ id: 't', name: 't', size: 'L', temp: '冰', cat: 't', items: items.map(i => Object.assign({ v: 'c' }, i)), actions, finish, steps: '', ice: 'none', iceV: null, pour: {}, sv: null, sweet: '正常', full: 't L-冰' }, extra);
  const cup = (items, actions = [], finish = 'none', size = 'L', temp = '冰') => ({ size, temp, items: items.map(i => Object.assign({ v: 'c' }, i)), actions, finish });
  const vq = (v, ing) => (g.state.vessels[v].items.find(i => i.ing === ing) || {}).qty;
  // 依 target 完美製作：素材放對容器、在對容器做動作、依 pour 倒入
  async function makePerfect(t) {
    clearCup();
    g.state.cup.size = t.size; g.state.cup.temp = t.temp;
    t.items.forEach(i => { if (i.ing === 'ice') g.setIce(D.ICE_LEVELS[i.qty].min, i.v); else g.addItem(i.ing, i.qty === -1 ? 50 : i.qty, i.v); });
    const vFor = a => {
      if (a === 'blend') return 'b'; if (/brew/.test(a)) return 't'; if (a === 'shake' || a === 'steam') return 's';
      return ['s', 'c'].find(v => g.state.vessels[v].items.some(i => a !== 'juice' || i.ing === 'apple')) || 'c';
    };
    for (const a of t.actions) { g.selectVessel(vFor(a)); const p = g.doAction(a); if (p && p.then) await p; }
    for (const from of ['t', 'b', 's']) { const to = (t.pour && t.pour[from]) || 'c'; if (g.state.vessels[from].items.length) g.pourInto(from, to); }
    if (g.state.vessels.s.items.length) g.pourInto('s', 'c');
    g.setFinish(t.finish); g.selectVessel('c'); if (g.render) g.render();
  }

  try {
    // #1 基本與 API
    const api = ['setIce', 'resolveOrder', 'getDeck', 'drawCounts', 'resetDraws', 'bubbleText', 'selectVessel', 'pourInto'];
    ok(1, typeof g === 'object' && g && Array.isArray(g.RECIPES) && g.RECIPES.length === 108 && D && D.ICE_LEVELS && D.VESSELS && api.every(k => typeof g[k] === 'function') && g.state.vessels && ['c', 's', 'b', 't'].every(v => Array.isArray(g.state.vessels[v].items)) && g.state.cup.items === g.state.vessels.c.items,
      'recipes=' + (g && g.RECIPES && g.RECIPES.length) + ' api=' + api.map(k => typeof (g && g[k])).join(',') + ' cupAlias=' + (g && g.state.cup.items === g.state.vessels.c.items));
    if (typeof g !== 'object') return summarize();
    g.startPractice(); await sleep(150);

    // #2 所有配方皆可被點到
    let bad = [];
    for (const r of g.RECIPES) {
      let o = null; try { g.forceNextRecipe(r.id); o = g.spawnCustomer(); } catch (e) { bad.push(r.id + ':' + e.message); continue; }
      if (!o || !o.recipe || o.recipe.id !== r.id || !o.target) bad.push(r.id);
      g.state.orders = g.state.orders.filter(x => x !== o);
    }
    clearCounter();
    ok(2, bad.length === 0 && g.getPool().length === g.RECIPES.length, 'bad=' + bad.slice(0, 5).join(',') + ' poolAll=' + g.getPool().length);

    // #3 練習範圍（v7：不再分天，改選練習的飲料系列）：getPool(cats) 只含所選系列；只選一個系列時抽到的全是該系列
    const APPLE_CATS = ['老饕蘋果系列', '蘋果系列'];
    const isApple = r => APPLE_CATS.includes(r.cat);
    const allCats = [...new Set(g.RECIPES.map(r => r.cat))];
    const poolOk = allCats.every(c => { const p = g.getPool([c]); return p.length === g.RECIPES.filter(r => r.cat === c).length && p.every(r => r.cat === c); });
    const pool2 = g.getPool(['台灣茶系列', '紅茶系列']);
    const pool2Ok = pool2.length === g.RECIPES.filter(r => r.cat === '台灣茶系列' || r.cat === '紅茶系列').length;
    g.startPractice(['台灣茶系列']); await sleep(80);
    const startActiveC = g.state.active === 'c';   // v7：預設容器改回紙杯
    const single = []; for (let i = 0; i < 30; i++) { const o = g.spawnCustomer(); single.push(o.recipe); g.state.orders = g.state.orders.filter(x => x !== o); }
    clearCounter();
    const singleOk = single.every(r => r.cat === '台灣茶系列');
    const nTw = g.RECIPES.filter(r => r.cat === '台灣茶系列').length;
    const singleSpread = new Set(single.slice(0, Math.min(10, nTw)).map(r => r.id)).size === Math.min(10, nTw);   // 前 10 杯不重複（款數夠時）
    const scopeOk = g.state.practice && Array.isArray(g.state.practice.cats) && g.state.practice.cats.join() === '台灣茶系列' && /台灣茶/.test($('#hud-day').textContent);
    ok(3, allCats.length === 16 && poolOk && pool2Ok && singleOk && singleSpread && scopeOk && startActiveC && !g.DAY_CONFIG,
      `cats=${allCats.length} poolOk=${poolOk} pool2=${pool2Ok} 只抽台灣茶=${singleOk} 前10不重複=${singleSpread} state.practice=${JSON.stringify(g.state.practice && g.state.practice.cats)} hud=${$('#hud-day').textContent} DAY_CONFIG已移除=${!g.DAY_CONFIG} 開局容器=${g.state.active}`);

    // #4 開始畫面：16 個系列＋「全部」可多選，沒有 Day 選擇；選了系列後開始 → HUD 顯示練習範圍；選擇會記住
    const ms4 = $('#modal-start'); ms4.style.display = 'flex'; await sleep(60);
    const catBtns = $$('#modal-start .cat-btn[data-cat]');
    const catSet = new Set(catBtns.map(b => b.dataset.cat));
    const pickerOk = catBtns.length === 17 && catSet.has('all') && allCats.every(c => catSet.has(c)) && $$('#modal-start .day-btn, #modal-start [data-day]').length === 0;
    const btnAll = catBtns.find(b => b.dataset.cat === 'all');
    const btnMilk = catBtns.find(b => b.dataset.cat === '紅茶系列'), btnTw = catBtns.find(b => b.dataset.cat === '台灣茶系列');
    // 先按「全部」確保全選，再按一次取消全選，接著選兩個系列
    if (btnAll && btnAll.getAttribute('aria-pressed') !== 'true') { btnAll.click(); await sleep(30); }
    const allOn = catBtns.filter(b => b.dataset.cat !== 'all').every(b => b.getAttribute('aria-pressed') === 'true');
    btnAll && btnAll.click(); await sleep(30);
    btnMilk && btnMilk.click(); await sleep(30); btnTw && btnTw.click(); await sleep(30);
    const twoOn = catBtns.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.cat).sort().join();
    $('#btn-start').click(); await sleep(150);
    const started = getComputedStyle(ms4).display === 'none' && g.state.started && g.state.practice.cats.slice().sort().join() === ['台灣茶系列', '紅茶系列'].sort().join();
    let saved = null; try { saved = JSON.parse(localStorage.getItem('lephare_practice')); } catch (e) { }
    const savedOk = Array.isArray(saved) && saved.slice().sort().join() === ['台灣茶系列', '紅茶系列'].sort().join();
    ok(4, pickerOk && allOn && twoOn === ['台灣茶系列', '紅茶系列'].sort().join() && started && savedOk,
      `按鈕=${catBtns.length} picker=${pickerOk} 全部→全選=${allOn} 兩系列=${twoOn} 開始=${started} 記住=${JSON.stringify(saved)}`);
    try { localStorage.removeItem('lephare_practice'); } catch (e) { }

    // #5 蘋果配額（使用者指定）：練習「全部」時每 10 杯恰好 4 杯 蘋果系列／老饕蘋果系列
    g.resetDraws(); g.startPractice(); await sleep(100);
    const drawSeq = [];
    for (let i = 0; i < 200; i++) { const o = g.spawnCustomer(); drawSeq.push(o.recipe); g.state.orders = g.state.orders.filter(x => x !== o); }
    clearCounter();
    const blocks = [], dupBlocks = [];
    for (let i = 0; i < 200; i += 10) {
      const b = drawSeq.slice(i, i + 10);
      blocks.push(b.filter(isApple).length);
      if (new Set(b.map(r => r.id)).size !== 10) dupBlocks.push(i / 10);   // 同一個 10 杯區塊不可出現重複飲料
    }
    const appleRate = drawSeq.filter(isApple).length / drawSeq.length;
    ok(5, blocks.every(n => n === 4) && dupBlocks.length === 0 && Math.abs(appleRate - 0.4) < 0.001,
      `每10杯蘋果數=${blocks.join(',')} 比例=${(appleRate * 100).toFixed(1)}% 區塊內重複=${dupBlocks.join(',') || '無'}`);

    // #6 兩條佇列各自輪流（界線取整數個區塊：蘋果 5 塊＝20 杯、非蘋果 14 塊＝84 杯）；全部款式都會出現
    const appleSeq = drawSeq.filter(isApple), otherSeq = drawSeq.filter(r => !isApple(r));
    const apple20 = new Set(appleSeq.slice(0, 20).map(r => r.id)).size === 20;          // 21 款輪完才重複
    const appleBoth = new Set(appleSeq.slice(0, 20).map(r => r.cat)).size === 2;        // 老饕蘋果與蘋果系列都會出現
    const other12 = new Set(otherSeq.slice(0, 12).map(r => r.cat)).size === 12;         // 另外 14 系列輪流
    const other84 = new Set(otherSeq.slice(0, 84).map(r => r.id)).size === 84;          // 86 款輪完才重複
    const allSeen = new Set(drawSeq.map(r => r.id)).size === g.RECIPES.length;
    // 部分範圍：同時選了蘋果類與其他系列 → 仍是每 10 杯 4 杯蘋果；只選非蘋果系列 → 不會出現蘋果
    g.startPractice(['蘋果系列', '台灣茶系列']); await sleep(50);
    const mix = []; for (let i = 0; i < 40; i++) { const o = g.spawnCustomer(); mix.push(o.recipe); g.state.orders = g.state.orders.filter(x => x !== o); }
    clearCounter();
    const mixOk = [0, 10, 20, 30].every(i => mix.slice(i, i + 10).filter(isApple).length === 4) && mix.every(r => r.cat === '蘋果系列' || r.cat === '台灣茶系列');
    g.startPractice(['紅茶系列', '台灣茶系列']); await sleep(50);
    const noA = []; for (let i = 0; i < 20; i++) { const o = g.spawnCustomer(); noA.push(o.recipe); g.state.orders = g.state.orders.filter(x => x !== o); }
    clearCounter();
    const noAppleOk = noA.every(r => r.cat === '紅茶系列' || r.cat === '台灣茶系列') && new Set(noA.map(r => r.cat)).size === 2;
    ok(6, apple20 && appleBoth && other12 && other84 && allSeen && mixOk && noAppleOk,
      `apple20=${apple20} 兩系列都有=${appleBoth} other12=${other12} other84=${other84} 全部出現=${new Set(drawSeq.map(r => r.id)).size}/${g.RECIPES.length} 蘋果+台灣茶每10杯4蘋果=${mixOk} 無蘋果範圍=${noAppleOk}`);

    // #7 訂單欄位、target 容器、泡泡
    g.startPractice(); await sleep(100);
    const rCold = g.RECIPES.find(r => r.name === '西瓜多多');
    const rHot = g.RECIPES.find(r => r.temp === '熱');
    const rSv = g.RECIPES.find(r => r.name === '西瓜四季青');
    g.forceNextRecipe(rCold.id); const oC = g.spawnCustomer();
    g.forceNextRecipe(rHot.id); const oH = g.spawnCustomer();
    g.forceNextRecipe(rSv.id); const oS = g.spawnCustomer();
    if (g.render) g.render(); await sleep(50);
    const lv = ['normal', 'less', 'light'];
    const tIce = oC.target.items.find(i => i.ing === 'ice');
    const tIceS = oS.target.items.find(i => i.ing === 'ice');
    const svOk = Object.keys(rSv.sv.opts).includes(oS.sweetKey) && oS.target.items.find(i => i.ing === 'sugar').qty === rSv.sv.opts[oS.sweetKey];
    const vOk = oS.target.items.every(i => ['c', 's', 'b', 't'].includes(i.v)) && oS.target.items.find(i => i.ing === 'qing').v === 's' && oS.target.items.find(i => i.ing === 'watermelon').v === 'c';
    const bubbles = $$('.customer .bubble').map(b => b.textContent).join(' | ');
    const bubOk = bubbles.includes(D.ICE_LEVELS[oC.iceLevel].name) && bubbles.includes(oS.sweetKey) && g.bubbleText(oC).includes(D.ICE_LEVELS[oC.iceLevel].name);
    ok(7, lv.includes(oC.iceLevel) && tIce && tIce.qty === oC.iceLevel && tIce.v === 'c' && tIceS && tIceS.v === 's' && oH.iceLevel == null && !oH.target.items.some(i => i.ing === 'ice') && svOk && vOk && bubOk,
      `cold=${oC.iceLevel}/${tIce && tIce.v} svIceV=${tIceS && tIceS.v} hot=${oH.iceLevel} sv=${oS.sweetKey}/${svOk} v=${vOk} bubbles=${bubbles.slice(0, 60)}`);
    clearCounter();

    // #8 量杯按住填充
    g.selectVessel('c'); g.mountMeasure('green'); g.setMeasure(0);
    fire($('#m-fill'), 'pointerdown'); await sleep(500); fire($('#m-fill'), 'pointerup'); await sleep(60);
    const shown = parseInt($('#measure-ml').textContent, 10);
    ok(8, shown > 0 && Number.isInteger(shown) && shown === g.state.measure.ml, 'shown=' + shown + ' state=' + g.state.measure.ml);

    // #9 量杯微調
    g.setMeasure(100); $('#m-p5').click(); $('#m-p1').click(); $('#m-m5').click(); $('#m-m1').click(); const a9 = g.state.measure.ml;
    $('#m-p1').click(); $('#m-p1').click(); $('#m-p1').click(); const b9 = g.state.measure.ml;
    g.setMeasure(0); $('#m-m5').click(); const lo = g.state.measure.ml; g.setMeasure(500); $('#m-p5').click(); const hi = g.state.measure.ml;
    ok(9, a9 === 100 && b9 === 103 && lo === 0 && hi === 500, `${a9},${b9},${lo},${hi}`);

    // #10 量杯倒入（active = 紙杯）
    clearCup(); g.mountMeasure('green'); g.setMeasure(350); $('#btn-pour').click(); await sleep(50);
    const it10 = g.state.cup.items.find(i => i.ing === 'green');
    ok(10, it10 && it10.qty === 350 && it10.v === 'c' && /綠茶\s*350\s*ml/.test($('#cup-list').textContent) && g.state.measure.ml === 0, 'items=' + JSON.stringify(g.state.cup.items) + ' list=' + $('#cup-list').textContent.slice(0, 60));

    // #11 單一液體
    g.mountMeasure('green'); g.setMeasure(100); g.mountMeasure('black');
    ok(11, g.state.measure.src === 'green' && g.state.measure.ml === 100, 'src=' + g.state.measure.src); $('#m-empty').click();

    // #12 液體 18、全素材可見、每頁 ≤12
    const liq = $$('.ing[data-kind=liquid]').length;
    const need = new Set(g.RECIPES.flatMap(r => r.items.map(i => i.ing)).filter(x => x !== 'ice'));
    const have = new Set($$('.ing').map(e => e.dataset.ing));
    const missing = [...need].filter(x => !have.has(x));
    const tabs = $$('.tab'); let maxPer = 0;
    for (const t of tabs) { t.click(); await sleep(20); maxPer = Math.max(maxPer, $$('.ing').filter(visible).length); }
    ok(12, liq === 18 && missing.length === 0 && tabs.length >= 5 && maxPer <= 12 && !have.has('jasmine') && !have.has('foam'), `liquid=${liq} missing=${missing.join(',')} tabs=${tabs.length} maxPerTab=${maxPer}`);

    // #13 冰量控制（active = 紙杯）
    clearCup(); g.selectVessel('c');
    const ip = $('#ice-panel') && $('#ice-pct') && $('#ice-fill') && $('#ice-p5') && $('#ice-m5') && $('#ice-clear');
    const presets = $$('.ice-preset').map(b => Number(b.dataset.pct)).sort((a, b) => a - b).join(',');
    const iceQ = () => g.state.cup.items.filter(i => i.ing === 'ice').map(i => i.qty);
    g.setIce(85); const i1 = iceQ(); g.setIce(50); const i2 = iceQ();
    const pre = $('.ice-preset[data-pct="33"]'); pre && pre.click(); await sleep(30); const i3 = iceQ()[0];
    $('#ice-p5').click(); const i4 = iceQ()[0]; $('#ice-m5').click(); const i5 = iceQ()[0];
    const pctTxt = $('#ice-pct').textContent; const listIce = /冰塊\s*\d+\s*%/.test($('#cup-list').textContent);
    $('#ice-clear').click(); await sleep(20); const i6 = iceQ().length;
    fire($('#ice-fill'), 'pointerdown'); await sleep(300); fire($('#ice-fill'), 'pointerup'); await sleep(40); const i7 = iceQ()[0];
    ok(13, ip && presets === '33,50,80,90' && i1.length === 1 && i1[0] === 85 && i2.length === 1 && i2[0] === 50 && i3 === 33 && i4 === 38 && i5 === 33 && /33/.test(pctTxt) && i6 === 0 && i7 > 0 && listIce,
      `panel=${!!ip} presets=${presets} i1=${i1} i2=${i2} i3=${i3} i4=${i4} i5=${i5} txt=${pctTxt} clear=${i6} fill=${i7} list=${listIce}`);
    clearCup();

    // #14 冰量計分 normal
    const Rn = g.resolveOrder(mk([], [], 'none', { ice: 'cup', iceV: 'c' }), { iceLevel: 'normal' });
    const sN = [85, 78, 95, 75, 70, 60].map(p => g.score(Rn, cup([{ ing: 'ice', qty: p }])).S_ing);
    const sMiss = g.score(Rn, cup([])).S_ing;
    ok(14, [100, 100, 100, 100, 50, 0].every((v, i) => near(sN[i], v)) && near(sMiss, 0), sN.join(',') + ' miss=' + sMiss);

    // #15 冰量 less / light
    const Rl = g.resolveOrder(mk([], [], 'none', { ice: 'cup', iceV: 'c' }), { iceLevel: 'less' });
    const Rg = g.resolveOrder(mk([], [], 'none', { ice: 'cup', iceV: 'c' }), { iceLevel: 'light' });
    const sL = [50, 55, 60, 65].map(p => g.score(Rl, cup([{ ing: 'ice', qty: p }])).S_ing);
    const sG = [33, 38, 43, 48].map(p => g.score(Rg, cup([{ ing: 'ice', qty: p }])).S_ing);
    ok(15, [100, 100, 50, 0].every((v, i) => near(sL[i], v) && near(sG[i], v)), sL.join(',') + ' | ' + sG.join(','));

    // #16 熱飲加冰 −10；適量；容器路徑扣分
    const Rh = mk([{ ing: 'green', qty: 200 }], [], 'none', { temp: '熱', full: 't L-熱' });
    const sH = g.score(Rh, cup([{ ing: 'green', qty: 200 }, { ing: 'ice', qty: 50 }], [], 'none', 'L', '熱')).S_ing;
    const Rq = mk([{ ing: 'ro', qty: -1 }]);
    const sQ1 = g.score(Rq, cup([{ ing: 'ro', qty: 30 }])).S_ing, sQ0 = g.score(Rq, cup([])).S_ing;
    const Rs3 = mk([{ ing: 'green', qty: 200, v: 's' }, { ing: 'sugar', qty: 60, v: 's' }], ['shake'], 'topWater', { ice: 'cup', iceV: 's' });
    const Ts3 = g.resolveOrder(Rs3, { iceLevel: 'less' });
    const good = g.score(Ts3, { size: 'L', temp: '冰', items: [{ ing: 'green', qty: 200, v: 's' }, { ing: 'sugar', qty: 60, v: 's' }, { ing: 'ice', qty: 50, v: 's' }], actions: ['shake'], finish: 'topWater' });
    const wrong = g.score(Ts3, { size: 'L', temp: '冰', items: [{ ing: 'green', qty: 200, v: 'c' }, { ing: 'sugar', qty: 60, v: 'c' }, { ing: 'ice', qty: 50, v: 'c' }], actions: ['shake'], finish: 'topWater' });
    const one = g.score(Ts3, { size: 'L', temp: '冰', items: [{ ing: 'green', qty: 200, v: 's' }, { ing: 'sugar', qty: 60, v: 'c' }, { ing: 'ice', qty: 50, v: 's' }], actions: ['shake'], finish: 'topWater' });
    // 不加（qty 0，例如無糖）：沒放糖才滿分；放了糖要扣分並寫明「應 不加」
    const Rz = mk([{ ing: 'sugar', qty: 0 }]);
    const sZ0 = g.score(Rz, cup([])).S_ing, zAdded = g.score(Rz, cup([{ ing: 'sugar', qty: 30 }]));
    const zeroOk = near(sZ0, 100) && near(zAdded.S_ing, 0) && zAdded.details.some(d => /不加/.test(d));
    ok(16, near(sH, 90) && near(sQ1, 100) && near(sQ0, 0) && zeroOk && near(good.S_ing, 100) && near(wrong.S_ing, 70) && near(one.S_ing, 90) && wrong.details.some(d => /雪克杯/.test(d)),
      `hot+ice=${sH} 適量=${sQ1},${sQ0} 無糖=${sZ0}/${zAdded.S_ing}(${zAdded.details[0]}) route good=${good.S_ing} wrong=${wrong.S_ing} one=${one.S_ing} detail=${wrong.details[0]}`);

    // #17 sv 解析：西瓜牛奶 三分～五分；西瓜四季青 五分～七分；葡萄多多 無糖／全糖
    const rs = g.RECIPES.find(r => r.name === '西瓜四季青'), rmk = g.RECIPES.find(r => r.name === '西瓜牛奶'), rgp = g.RECIPES.find(r => r.name === '葡萄多多');
    const sq = (r, k) => g.resolveOrder(r, k == null ? {} : { sweetKey: k }).items.find(i => i.ing === 'sugar').qty;
    const q3 = sq(rmk, '三分'), q5m = sq(rmk, '五分'), q7 = sq(rs, '七分'), qd = sq(rs);
    const h7 = g.resolveOrder(g.RECIPES.find(r => r.name === '蘋果蜂蜜綠'), { sweetKey: '七分' }).items.find(i => i.ing === 'honey').qty;
    const rangeOk = Object.keys(rmk.sv.opts).join() === '三分,五分' && Object.keys(rs.sv.opts).join() === '五分,七分' && Object.keys(rgp.sv.opts).join() === '無糖,全糖';
    const recOk = rmk.rec === '三分' && rs.rec === '五分' && rgp.rec === '無糖';
    ok(17, q3 === 40 && q5m === 60 && q7 === 80 && qd === 60 && h7 === 40 && sq(rgp, '無糖') === 0 && sq(rgp, '全糖') === 30 && rangeOk && recOk,
      `西瓜牛奶 三分${q3}/五分${q5m} 四季青 七分${q7}/預設${qd} 蜂蜜綠七分${h7} 葡萄 無糖${sq(rgp, '無糖')}/全糖${sq(rgp, '全糖')} 範圍=${rangeOk} 建議=${recOk}`);

    // #18 容差
    const R350 = mk([{ ing: 'green', qty: 350 }]);
    const s18 = [350, 320, 385, 420, 455].map(q => g.score(R350, cup([{ ing: 'green', qty: q }])).S_ing);
    const s18b = [40, 50].map(q => g.score(mk([{ ing: 'lemon', qty: 30 }]), cup([{ ing: 'lemon', qty: q }])).S_ing);
    const s18c = [5, 6, 7].map(q => g.score(mk([{ ing: 'plum', qty: 5 }]), cup([{ ing: 'plum', qty: q }])).S_ing);
    ok(18, [100, 100, 100, 50, 0].every((v, i) => near(s18[i], v)) && near(s18b[0], 100) && near(s18b[1], 50) && near(s18c[0], 100) && near(s18c[1], 100) && near(s18c[2], 50), s18.join(',') + ' | ' + s18b.join(',') + ' | ' + s18c.join(','));

    // #19 勺數
    const s19 = [2, 1, 3, 4].map(q => g.score(mk([{ ing: 'pearl', qty: 2 }]), cup([{ ing: 'pearl', qty: q }])).S_ing);
    ok(19, near(s19[0], 100) && near(s19[1], 50) && near(s19[2], 50) && near(s19[3], 0), s19.join(','));

    // #20 製程
    const Ra = mk([{ ing: 'green', qty: 350 }], ['steam', 'stir']);
    const a1 = g.score(Ra, cup([{ ing: 'green', qty: 350 }], ['steam', 'stir'])).S_act;
    const a2 = g.score(Ra, cup([{ ing: 'green', qty: 350 }], ['steam'])).S_act;
    const a3 = g.score(Ra, cup([{ ing: 'green', qty: 350 }], ['steam', 'stir', 'shake'])).S_act;
    const a4 = g.score(R350, cup([{ ing: 'green', qty: 350 }], ['blend'])).S_act;
    ok(20, near(a1, 100) && near(a2, 50) && near(a3, 80) && near(a4, 75), `${a1},${a2},${a3},${a4}`);

    // #21 收尾
    const Rf = mk([{ ing: 'green', qty: 350 }], [], 'topWater');
    const f = x => g.score(Rf, cup([{ ing: 'green', qty: 350 }], [], x)).S_fin;
    ok(21, near(f('topWater'), 100) && near(f('topTea'), 0) && near(f('none'), 0) && near(g.score(R350, cup([{ ing: 'green', qty: 350 }], [], 'none')).S_fin, 100), `${f('topWater')},${f('topTea')},${f('none')}`);

    // #22 權重 / 時間 / 耐心 / 星等
    const Rw = mk([{ ing: 'green', qty: 350 }], ['shake'], 'topWater');
    const w1 = g.score(Rw, cup([{ ing: 'green', qty: 350 }], [], 'topTea')).Q, w2 = g.score(Rw, cup([], ['shake'], 'topWater')).Q, w3 = g.score(Rw, cup([{ ing: 'green', qty: 350 }], ['shake'], 'topWater')).Q;
    const t = [[60, 100, 1], [100, 100, 1], [150, 100, 0.6], [200, 100, 0.2], [500, 100, 0.2]].every(([e, m, x]) => near(g.timeFactor(e, m), x, 0.001));
    const pats = g.RECIPES.map(r => g.patienceFor(r));
    const st = [[90, 5], [89, 4], [75, 4], [74, 3], [60, 3], [59, 2], [40, 2], [39, 1]].every(([s, x]) => g.starsFor(s) === x);
    ok(22, near(w1, 60) && near(w2, 40) && near(w3, 100) && t && pats.every(p => p >= 60 && p <= 150) && st, `Q ${w1},${w2},${w3} time=${t} pat=${Math.min(...pats)}-${Math.max(...pats)} stars=${st}`);

    // #23 設備按鈕依 active 容器；brew 互斥；juice 前置
    const eq = ['#btn-shake', '#btn-steam', '#btn-blend', '#btn-stir', '#btn-juice', '#btn-brew3', '#btn-brew5'].every(s => !!$(s)) && !$('#btn-heat') && !$('#btn-brew2');
    const bw = $$('.brew-water').map(b => b.dataset.ml).sort().join(',');
    clearCup(); g.selectVessel('c'); g.addItem('green', 100, 'c'); if (g.render) g.render(); await sleep(30);
    const cupShakeDis = $('#btn-shake').disabled && $('#btn-steam').disabled && $('#btn-blend').disabled && $('#btn-brew3').disabled && !$('#btn-stir').disabled;
    const rShakeOnCup = await g.doAction('shake');
    g.selectVessel('t'); if (g.render) g.render(); await sleep(30);
    const b0 = $('#btn-brew3').disabled && $('#btn-brew5').disabled;
    g.addItem('teabag', 1, 't'); g.addItem('hot', 350, 't'); if (g.render) g.render(); await sleep(30);
    const b1 = !$('#btn-brew3').disabled && !$('#btn-brew5').disabled && $('#btn-shake').disabled;
    let p = g.doAction('brew3'); if (p && p.then) await p; await sleep(80);
    p = g.doAction('brew5'); if (p && p.then) await p; await sleep(80);
    const acts = g.state.cup.actions.slice();
    g.selectVessel('c'); if (g.render) g.render(); await sleep(30); const j0 = $('#btn-juice').disabled;
    g.addItem('apple', 1, 'c'); if (g.render) g.render(); await sleep(30); const j1 = !$('#btn-juice').disabled;
    ok(23, eq && bw === '150,350' && cupShakeDis && rShakeOnCup === false && !acts.includes('shake') && b0 && b1 && acts.includes('brew5') && !acts.includes('brew3') && j0 && j1,
      `eq=${eq} water=${bw} cupDis=${cupShakeDis} shakeOnCup=${rShakeOnCup} pre=${b0},${b1} acts=${acts} juice=${j0},${j1}`);
    clearCup();

    // #24 杯型只有 M/L、收尾三顆、無奶蓋
    const fins = $$('#finish-panel .fin').map(b => b.dataset.fin).sort().join(',');
    ok(24, !!$('#cup-size-M') && !!$('#cup-size-L') && !$('#cup-size-H') && fins === 'none,topTea,topWater' && !$('#btn-foam'), `fins=${fins}`);

    // #25 撤銷（跨容器）/ 倒掉重做
    clearCup(); g.addItem('green', 100, 'c'); g.addItem('sugar', 30, 's'); g.setIce(50, 's');
    $('#btn-undo').click(); await sleep(30);
    const n25 = g.state.vessels.c.items.length + g.state.vessels.s.items.length, noIce = !g.state.vessels.s.items.some(i => i.ing === 'ice');
    g.setIce(80, 'c'); g.setFinish('topWater'); g.selectVessel('s'); $('#btn-reset-cup').click(); await sleep(30);
    const allEmpty = ['c', 's', 'b', 't'].every(v => g.state.vessels[v].items.length === 0);
    ok(25, n25 === 2 && noIce && allEmpty && g.state.cup.actions.length === 0 && g.state.cup.finish === 'none' && g.state.active === 'c', `undo=${n25} noIce=${noIce} empty=${allEmpty} active=${g.state.active}`);

    // #26 空杯 disabled；完美製作（分容器、倒入）→ Q 100；送出流程
    g.startPractice(); await sleep(100); clearCounter();
    g.forceNextRecipe(g.RECIPES.find(r => r.name === '西瓜四季青').id); const o26 = g.spawnCustomer(); if (g.render) g.render(); await sleep(30);
    clearCup(); const dis = $('#btn-serve').disabled === true;
    g.acceptOrder(o26.id);
    await makePerfect(o26.target);
    const sc26 = g.score(o26.target, g.state.cup);
    const m0 = g.state.money, cb = $$('.customer').length;
    $('#btn-serve').click(); await sleep(300);
    const resVis = disp('#modal-result'), pausedOnResult = g.state.paused === true;   // 結算開著時暫停
    await sleep(1800);
    const stillOpen = disp('#modal-result');                                          // 不再自動關閉
    const closeBtn = $('#btn-result-close'); closeBtn && closeBtn.click(); await sleep(250);
    const closedByBtn = !disp('#modal-result'), resumed26 = g.state.paused === false;
    ok(26, dis && near(sc26.Q, 100) && resVis && pausedOnResult && stillOpen && !!closeBtn && closedByBtn && resumed26 && g.state.cup.items.length === 0 && g.state.money > m0 && $$('.customer').length < cb,
      `disabled=${dis} Q=${sc26.Q} details=${sc26.details.join(';')} res=${resVis} paused=${pausedOnResult} stillOpen=${stillOpen} closeBtn=${!!closeBtn} closed=${closedByBtn} resumed=${resumed26} money ${m0}->${g.state.money}`);

    // #27 配方表：steps、sv 行、容器配置；開啟時遊戲暫停、關閉後恢復計時；Modal 不超出視窗
    clearCounter(); g.forceNextRecipe(g.RECIPES.find(r => r.name === '西瓜四季青').id); const o27 = g.spawnCustomer(); g.acceptOrder(o27.id); if (g.render) g.render();
    if (g.state.paused) $('#btn-pause').click();
    const e0 = o27.elapsed; $('#btn-recipes').click(); await sleep(1500); const e1 = o27.elapsed;
    const mrVis = disp('#modal-recipes'), pausedWhileOpen = g.state.paused === true;
    const row = $$('#modal-recipes [data-recipe-id]').find(r => r.dataset.recipeId === o27.recipe.id); row && row.click(); await sleep(50);
    const mtxt = $('#modal-recipes').textContent;
    const hasSteps = mtxt.includes(o27.recipe.steps.slice(0, 12)), hasSv = /五分/.test(mtxt) && /七分/.test(mtxt) && /80/.test(mtxt), hasVessel = /雪克杯/.test(mtxt) && /紙杯/.test(mtxt);
    // 展開內容精簡：每個容器一行 .vrow、有 .r-memo 速記規則（≥2 條、含西瓜甜度規則），不再有重複的「製程順序」行
    const openRow = $('#modal-recipes .recipe-row.open');
    // 用量列：每個素材一個 .qc 標籤（含冰塊），數字在 em 內；例如 西瓜四季青 → 西瓜汁 160ml、青茶 200ml、蔗糖 60g、冰塊
    const qcs = openRow ? [...openRow.querySelectorAll('.qc')] : [];
    const qcTxt = qcs.map(c => c.textContent).join('|');
    const vrows = (qcs.length >= o27.recipe.items.length + (o27.recipe.ice === 'cup' ? 1 : 0) && /西瓜汁160ml/.test(qcTxt.replace(/\s/g, '')) && /200ml/.test(qcTxt) && /60g/.test(qcTxt) && qcs.every(c => c.querySelector('em'))) ? 2 : 0;
    const memoLis = openRow ? [...openRow.querySelectorAll('.r-memo li')].map(l => l.textContent) : [];
    const hasMemoRules = vrows >= 2 && memoLis.length >= 2 && memoLis.some(t => /五分 60／七分 80/.test(t) && /建議五分/.test(t)) && !/製程順序/.test(mtxt);
    const box27 = $('#modal-recipes .box') || $('#modal-recipes > *'); const br27 = box27 && box27.getBoundingClientRect();
    const boxFits = br27 && br27.bottom <= window.innerHeight + 1 && br27.right <= window.innerWidth + 1 && br27.top >= -1;
    // v7：獨立的「速記法」分頁已移除（速記只放在每個配方展開內）；配方表只有列表
    const memoGone = !$('#rmode-memo') && !$('#memo-panel') && !$('#memo-tpl') && !$('#modal-recipes .rmode');
    const listVis = visible($('#recipe-list')) && visible($('#recipe-search'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    $$('#modal-recipes button').forEach(b => { if (/關閉/.test(b.textContent)) b.click(); });
    await sleep(100); const resumed = g.state.paused === false; const e2 = o27.elapsed; await sleep(700); const e3 = o27.elapsed;
    ok(27, mrVis && pausedWhileOpen && (e1 - e0) < 0.1 && hasSteps && hasSv && hasVessel && hasMemoRules && boxFits && resumed && (e3 - e2) >= 0.5 && memoGone && listVis,
      `vis=${mrVis} paused=${pausedWhileOpen} dtOpen=${(e1 - e0).toFixed(2)} steps=${hasSteps} sv=${hasSv} vessel=${hasVessel} rules=${hasMemoRules}(vrows=${vrows},lis=${memoLis.length}) boxFits=${boxFits}(${br27 && Math.round(br27.bottom)}/${window.innerHeight}) resumed=${resumed} dtAfter=${(e3 - e2).toFixed(2)} 速記分頁已移除=${memoGone} 列表可見=${listVis}`);

    // #28 暫停
    const q0 = o27.elapsed; $('#btn-pause').click(); await sleep(2000); const q1 = o27.elapsed; $('#btn-pause').click();
    ok(28, (q1 - q0) < 0.1, 'dt=' + (q1 - q0).toFixed(3));

    // #29 版面（v4 滿版響應式）
    const app = $('#app'); const rct = app && app.getBoundingClientRect();
    const fullW = rct && Math.abs(rct.width - window.innerWidth) <= 2, fullH = rct && Math.abs(rct.height - window.innerHeight) <= 2;
    const noHScroll = window.innerWidth < 1100 || document.documentElement.scrollWidth <= window.innerWidth + 1;
    const noHint = !$$('.ing').some(e => /拖量杯|點選設定|點一下/.test(e.textContent));
    // 設備一律可見（使用者反映「沒有蒸汽機」）：紙杯分頁時 搖茶/蒸汽機 可見但 disabled；雪克杯分頁時可用
    clearCup(); g.selectVessel('c'); g.addItem('green', 100, 'c'); if (g.render) g.render(); await sleep(30);
    const eqAlwaysVisible = ['#btn-shake', '#btn-steam', '#btn-blend', '#btn-stir', '#btn-juice', '#btn-brew3', '#btn-brew5'].every(s => visible($(s)));
    const steamDisOnCup = $('#btn-steam').disabled === true && $('#btn-shake').disabled === true;
    g.selectVessel('s'); g.addItem('green', 100, 's'); if (g.render) g.render(); await sleep(30);
    const steamOkOnShaker = visible($('#btn-steam')) && $('#btn-steam').disabled === false && $('#btn-shake').disabled === false;
    // 溢出檢查：杯內清單塞 10 項後，#cup-list 的每個子項都在視窗內（清單自己捲動）；容器卡摘要不被裁切
    ['sugar', 'honey', 'milk', 'creamer', 'pearl', 'coconut', 'gjelly', 'grass', 'plum'].forEach(k => g.addItem(k, (k === 'creamer' || k === 'pearl' || k === 'coconut' || k === 'gjelly' || k === 'grass') ? 2 : (k === 'plum' ? 3 : 100), 's'));
    g.addItem('watermelon', 160, 'c'); if (g.render) g.render(); await sleep(60);
    const inView = el => { const r = el.getBoundingClientRect(); return r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1; };
    const listKids = $$('#cup-list *').filter(e => e.getClientRects().length);
    const listFits = listKids.length > 0 && listKids.every(inView);
    const clippedCards = $$('#work *').filter(e => { const cs = getComputedStyle(e); return e.getClientRects().length && (cs.overflow === 'hidden' || cs.overflowY === 'hidden') && e.scrollHeight > e.clientHeight + 2 && !e.closest('#cup') && !e.classList.contains('nm') && cs.textOverflow !== 'ellipsis'; }).map(e => e.id || e.className);
    clearCup();
    ok(29, app && fullW && fullH && noHScroll && visible($('#cup')) && visible($('#measure')) && visible($('#btn-serve')) && visible($('#ice-panel')) && visible($('#vessel-slot')) && $$('.vessel-tab').length === 4 && noHint && eqAlwaysVisible && steamDisOnCup && steamOkOnShaker && listFits && clippedCards.length === 0,
      `app=${rct && Math.round(rct.width)}x${rct && Math.round(rct.height)} win=${window.innerWidth}x${window.innerHeight} hscroll=${!noHScroll} noHint=${noHint} eqVisible=${eqAlwaysVisible} steamDisCup=${steamDisOnCup} steamOkShaker=${steamOkOnShaker} listFits=${listFits} clipped=${clippedCards.join('|')}`);

    // #30 一輪結算（全部完美製作）：「再練一輪」沿用同一個練習範圍；「換練習種類」回開始畫面
    g.startPractice(['紅茶系列']); await sleep(200); clearCounter();
    const total = g.PRACTICE && g.PRACTICE.customers; let served = 0, guard = 0, qs = [];
    while (served < total && guard++ < 40) {
      const o = g.spawnCustomer(); g.acceptOrder(o.id);
      await makePerfect(o.target); qs.push(Math.round(g.score(o.target, g.state.cup).Q));
      await sleep(20); g.serve(); served++; await sleep(80);
      const rc = $('#btn-result-close'); if (rc && disp('#modal-result')) { rc.click(); await sleep(60); }   // 結算需手動關閉
    }
    await sleep(1200);
    const deVis = disp('#modal-day-end');
    const deTxt = $('#modal-day-end').textContent;
    const noDayWords = !/Day|下一天/.test(deTxt) && /紅茶系列/.test(deTxt);
    const retry = $$('#modal-day-end button').find(b => /再練一輪/.test(b.textContent)); retry && retry.click(); await sleep(200);
    const retried = !disp('#modal-day-end') && g.state.served === 0 && g.state.started && g.state.practice.cats.join() === '紅茶系列';
    const retryOnce = qs.length === total;
    // 再結束一次（直接把 served 補滿），這次按「換練習種類」
    g.state.served = total - 1; const o30 = g.spawnCustomer(); g.acceptOrder(o30.id); await makePerfect(o30.target); g.serve(); await sleep(80);
    const rc30 = $('#btn-result-close'); if (rc30 && disp('#modal-result')) { rc30.click(); await sleep(60); }
    await sleep(600);
    const menu = $$('#modal-day-end button').find(b => /換練習種類/.test(b.textContent)); menu && menu.click(); await sleep(200);
    const backToStart = disp('#modal-start') && !disp('#modal-day-end') && $$('#modal-start .cat-btn[data-cat="紅茶系列"][aria-pressed="true"]').length === 1;
    $('#modal-start').style.display = 'none';
    ok(30, total >= 5 && deVis && noDayWords && !!retry && retried && retryOnce && !!menu && backToStart && qs.every(q => q === 100),
      `杯數=${total} 結算=${deVis} 無Day字樣=${noDayWords} 再練一輪=${retried} 換種類回開始畫面且保留選擇=${backToStart} Qs=${qs.join(',')}`);
    g.startPractice(); await sleep(100);

    // #31 容器槽 UI 與 pourInto
    clearCup();
    const vt = ['c', 's', 'b', 't'].every(v => !!$(`.vessel-tab[data-v="${v}"]`)) && !!$('#vessel-view') && !!$('#pour-to-cup') && !!$('#pour-to-shaker');
    $('.vessel-tab[data-v="s"]').click(); await sleep(30); const actS = g.state.active === 's';
    g.mountMeasure('green'); g.setMeasure(200); $('#btn-pour').click(); await sleep(30);
    g.addItem('sugar', 60); g.setIce(50);
    const inS = vq('s', 'green') === 200 && vq('s', 'sugar') === 60 && vq('s', 'ice') === 50 && g.state.vessels.c.items.length === 0;
    const listS = /雪克杯/.test($('#cup-list').textContent);
    const pourDis0 = !$('#pour-to-cup').disabled;
    $('#pour-to-cup').click(); await sleep(50);
    const inC = vq('c', 'green') === 200 && vq('c', 'sugar') === 60 && vq('c', 'ice') === 50 && g.state.vessels.s.items.length === 0 && g.state.cup.items.every(i => i.v === 's');
    // 萃茶機 → 雪克杯
    g.selectVessel('t'); g.addItem('teabag', 1); g.addItem('hot', 350); if (g.render) g.render(); await sleep(30);
    const shakerBtnVis = visible($('#pour-to-shaker'));
    $('#pour-to-shaker').click(); await sleep(50);
    const toS = vq('s', 'hot') === 350 && vq('s', 'teabag') === 1 && g.state.vessels.t.items.length === 0;
    // 留在雪克杯 = 缺少
    const left = g.score(mk([{ ing: 'hot', qty: 350, v: 't' }]), g.state.cup).S_ing;
    // 合併：再倒一次到紙杯後 green 仍 200、hot 350
    g.pourInto('s', 'c'); const merged = vq('c', 'hot') === 350 && vq('c', 'green') === 200;
    // 紙杯 → 雪克杯：按鈕在紙杯分頁可見可用；倒入後素材改記為雪克杯（放錯紙杯可補救）
    clearCup(); g.selectVessel('c'); g.addItem('black', 200, 'c'); if (g.render) g.render(); await sleep(30);
    const c2sBtn = visible($('#pour-to-shaker')) && !$('#pour-to-shaker').disabled;
    $('#pour-to-shaker').click(); await sleep(50);
    const c2s = vq('s', 'black') === 200 && g.state.vessels.c.items.length === 0 && g.state.vessels.s.items.every(i => i.v === 's') && g.state.active === 's';
    g.pourInto('s', 'c'); const keepS = g.state.vessels.c.items.every(i => i.v === 's');
    ok(31, vt && actS && inS && listS && pourDis0 && inC && shakerBtnVis && toS && near(left, 0) && merged && c2sBtn && c2s && keepS, `tabs=${vt} actS=${actS} inS=${inS} listS=${listS} pourEnabled=${pourDis0} inC=${inC} shakerBtn=${shakerBtnVis} toS=${toS} left=${left} merged=${merged} c2sBtn=${c2sBtn} c2s=${c2s} keepS=${keepS}`);
    clearCup();

    // #32 完美製作掃描：每個系列取一款（含 t→s 特例）皆 Q=100
    const picks = [];
    const seenCat = new Set();
    for (const r of g.RECIPES) { if (!seenCat.has(r.cat)) { seenCat.add(r.cat); picks.push(r); } }
    picks.push(g.RECIPES.find(r => r.name === '琥珀高山青歐蕾' && r.temp === '冰'));
    const fails = [];
    for (const r of picks) { const tg = g.resolveOrder(r, { iceLevel: r.ice === 'cup' ? 'less' : null, sweetKey: r.sv ? Object.keys(r.sv.opts)[0] : r.sweet }); await makePerfect(tg); const s = g.score(tg, g.state.cup); if (!near(s.Q, 100)) fails.push(r.full + ':' + Math.round(s.Q) + ' ' + s.details.join(';')); }
    clearCup();
    ok(32, fails.length === 0, fails.slice(0, 3).join(' | ') || `${picks.length} recipes all 100`);
  } catch (e) {
    R.push({ id: 'EXC', ok: false, msg: e.stack || e.message });
  }
  return summarize();

  function summarize() {
    const pass = R.filter(r => r.ok).length, fail = R.filter(r => !r.ok);
    const out = { pass, fail: fail.length, total: R.length, results: R.slice().sort((a, b) => (Number(a.id) || 99) - (Number(b.id) || 99)), failed: fail };
    console.log('[acceptance v3]', pass + '/' + R.length, fail.map(f => `#${f.id} ${f.msg}`).join(' | '));
    return out;
  }
}
window.runAcceptance = runAcceptance;
