// 手機版固定驗收 v6（對應 PLAN-v6-mobile-ux.md）。請在手機尺寸（375×812，另需通過 360×640）、頁面剛載入時執行：
//   const src = await fetch('/tests/mobile-acceptance.js').then(r=>r.text()); (0,eval)(src); await runMobileAcceptance()
// Evaluator 專用；Generator 不可修改本檔。
// v6 核心：整頁不捲動。所有點擊都「不捲頁面」直接點在畫面上看得到、沒被蓋住的位置（只允許捲動區塊內部的捲動列）。
async function runMobileAcceptance() {
  const R = [];
  const ok = (id, cond, msg = '') => R.push({ id, ok: !!cond, msg: String(msg) });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const g = window.game;
  const W = () => window.innerWidth, H = () => window.innerHeight;
  const shown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const rect = el => el.getBoundingClientRect();
  const inView = el => { const b = rect(el); return b.top >= -1 && b.bottom <= H() + 1 && b.left >= -1 && b.right <= W() + 1; };
  const lab = el => el.id ? '#' + el.id : (el.className && String(el.className).split(' ')[0]) || el.tagName;
  const scroller = (el, axis) => { for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) { const o = getComputedStyle(p)[axis === 'x' ? 'overflowX' : 'overflowY']; if (o === 'auto' || o === 'scroll') return p; } return null; };
  const hScroller = el => { const p = scroller(el, 'x'); return p && p.scrollWidth > p.clientWidth + 1 ? p : null; };
  const touch = (el, type) => el && el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 10 }));
  const pageY = () => Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop, ($('#stage') || {}).scrollTop || 0, ($('#app') || {}).scrollTop || 0);
  // 只捲「區塊內部」的捲動列（x/y 皆可），絕不捲頁面
  function bringInto(el) {
    for (const axis of ['y', 'x']) {
      const p = scroller(el, axis); if (!p) continue;
      const b = rect(el), pb = rect(p);
      if (axis === 'y') { if (b.top < pb.top) p.scrollTop -= pb.top - b.top + 4; else if (b.bottom > pb.bottom) p.scrollTop += b.bottom - pb.bottom + 4; }
      else { if (b.left < pb.left) p.scrollLeft -= pb.left - b.left + 4; else if (b.right > pb.right) p.scrollLeft += b.right - pb.right + 4; }
    }
  }
  // 可點＝顯示中、完整在視窗內、中心點沒有被其他元素蓋住
  function hittable(el) {
    if (!el || !shown(el)) return false;
    bringInto(el);
    if (!inView(el)) return false;
    const b = rect(el); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  }
  const why = el => !el ? '不存在' : !shown(el) ? '未顯示' : !inView(el) ? '在視窗外(' + Math.round(rect(el).top) + '~' + Math.round(rect(el).bottom) + ')' : '被蓋住(' + lab(document.elementFromPoint(rect(el).left + rect(el).width / 2, rect(el).top + rect(el).height / 2) || document.body) + ')';
  const steps = [];
  const tap = async (sel, name) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!hittable(el)) { steps.push(name + '：' + why(el)); return false; }
    el.click(); await sleep(140); return true;
  };
  const mtab = k => $(`#mtabs [data-mtab="${k}"]`);
  const openTab = async k => { const ok2 = await tap(mtab(k), '分頁 ' + k); await sleep(60); return ok2; };
  const benchTab = re => $$('#bench .tab').find(t => re.test(t.textContent));

  if (W() > 820) { ok('M0', false, `視窗寬 ${W()} > 820，請先切到手機尺寸（375×812）再執行`); return summarize(); }

  try {
    g.startDay(4); await sleep(300);
    g.state.orders = []; g.state.queue = []; g.state.currentId = null;
    const rec = g.RECIPES.find(r => r.name === '林華泰鐵觀音' && r.size === 'L' && r.temp === '冰');
    g.forceNextRecipe(rec.id); const order = g.spawnCustomer(); g.spawnCustomer();
    if (g.render) g.render(); await sleep(150);

    // M1 無水平捲軸
    const sw = document.documentElement.scrollWidth;
    ok('M1', sw <= W() + 1, `scrollWidth=${sw} 視窗=${W()}`);

    // M2 整頁不能上下捲動（html／body 內容高度 ≤ 視窗）
    const sh = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    ok('M2', sh <= H() + 1 && pageY() === 0, `scrollHeight=${sh} 視窗高=${H()} scrollTop=${pageY()}`);

    // M3 沒有元素超出視窗（區塊內部捲動列裡的除外，但捲動列本身要在視窗內）
    const over = [];
    for (const el of $$('#app *')) {
      if (!el.getClientRects().length) continue;
      const b = rect(el); if (b.width === 0 || b.height === 0) continue;
      const sx = hScroller(el), sy = scroller(el, 'y');
      const bx = sx ? rect(sx) : b, by = sy ? rect(sy) : b;
      if (bx.right > W() + 1 || bx.left < -1) over.push(lab(sx || el) + '→' + Math.round(bx.right));
      if (by.bottom > H() + 1 || by.top < -1) over.push(lab(sy || el) + '↓' + Math.round(by.bottom));
    }
    ok('M3', over.length === 0, [...new Set(over)].slice(0, 8).join(' ') || '無超出');

    // M4 可點元素寬高 ≥ 40（逐一檢查三個分頁）
    const small = new Set();
    for (const k of ['ing', 'tools', 'cup']) {
      if (mtab(k)) { mtab(k).click(); await sleep(80); }
      $$('#app button, #app .ing, #app .vessel-tab, #app .tab, #app .ice-preset, #app .fin, #app .customer, #queue-list li[data-order-id]')
        .filter(shown).filter(el => { const b = rect(el); return b.width < 40 || b.height < 40; })
        .forEach(el => small.add(lab(el) + '(' + Math.round(rect(el).width) + '×' + Math.round(rect(el).height) + ')'));
    }
    ok('M4', small.size === 0, `${small.size} 個過小：` + [...small].slice(0, 10).join(' '));

    // M5 分頁列：三個分頁都在，切換後各自的內容可點、其他分頁的內容收起來
    const tabsOk = ['ing', 'tools', 'cup'].every(k => mtab(k));
    const content = {
      ing: ['#tabs .tab', '#bench .ing'],
      tools: ['#ice-fill', '.ice-preset[data-pct="50"]', '#ice-clear', '#btn-shake', '#btn-steam', '#btn-blend', '#btn-brew3', '#btn-brew5', '.brew-water'],
      cup: ['#cup-list', '.fin[data-fin="topWater"]', '.fin[data-fin="none"]', '#btn-reset-cup'],
    };
    const m5 = [];
    for (const k of Object.keys(content)) {
      if (!tabsOk) break;
      mtab(k).click(); await sleep(100);
      if (mtab(k).getAttribute('aria-selected') !== 'true') m5.push(k + ' 未標 aria-selected');
      for (const s of content[k]) { const el = $(s); if (!hittable(el)) m5.push(k + ':' + s + ' ' + why(el)); }
      for (const other of Object.keys(content)) if (other !== k) {
        const vis = content[other].filter(s => $(s) && shown($(s)) && inView($(s)));
        if (vis.length) m5.push(k + ' 分頁仍看得到 ' + vis.slice(0, 2).join(','));
      }
    }
    ok('M5', tabsOk && m5.length === 0, tabsOk ? (m5.slice(0, 6).join('；') || '三分頁正常') : '缺少 #mtabs [data-mtab=ing|tools|cup]');

    // M6 常駐元素：任何分頁下都可點（訂單、容器分頁、成品紙杯、M/L、冰熱、撤銷、配方表、送出）
    const persist = ['#order-title', '.vessel-tab[data-v="c"]', '.vessel-tab[data-v="t"]', '#vessel-view', '#cup', '#cup-size-L', '#cup-temp-hot', '#btn-undo', '#btn-serve', '#mtabs'];
    const m6 = [];
    for (const k of ['ing', 'tools', 'cup']) {
      if (mtab(k)) { mtab(k).click(); await sleep(80); }
      for (const s of persist) {
        const el = $(s);
        const good = s === '#btn-serve' || s === '#order-title' || s === '#mtabs' || s === '#vessel-view' ? (shown(el) && inView(el)) : hittable(el);
        if (!good) m6.push(k + ':' + s + ' ' + why(el));
      }
      const rb = ['#btn-recipes-dock', '#btn-recipes'].map($).find(el => el && shown(el));
      if (!hittable(rb)) m6.push(k + ':配方表鍵 ' + why(rb));
    }
    ok('M6', m6.length === 0, m6.slice(0, 6).join('；') || '常駐元素都在');

    // M7 點液體 → 量杯面板自動出現且可操作；觸控按住裝填；長按不跳選單；倒掉後面板收起、素材可再點
    const m7 = [];
    await openTab('ing');
    await tap(benchTab(/茶/), '茶桶分頁');
    await tap('.ing[data-ing="green"]', '綠茶格');
    for (const s of ['#m-fill', '#m-p5', '#m-m5', '#m-p1', '#m-m1', '#btn-pour', '#m-empty', '#m-close', '#measure-ml']) if (!hittable($(s))) m7.push(s + ' ' + why($(s)));
    const fillBtn = $('#m-fill');
    const ta = fillBtn ? getComputedStyle(fillBtn).touchAction : '無', taIce = $('#ice-fill') ? getComputedStyle($('#ice-fill')).touchAction : '無';
    touch(fillBtn, 'pointerdown'); await sleep(500); touch(fillBtn, 'pointerup'); await sleep(60);
    const filled = g.state.measure.ml;
    const cmFill = fillBtn ? !fillBtn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })) : false;
    const cmIce = $('#ice-fill') ? !$('#ice-fill').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })) : false;
    if (!(filled > 0)) m7.push('按住裝填沒有進量');
    if (ta !== 'none' || taIce !== 'none') m7.push(`touch-action 裝填=${ta} 加冰=${taIce}`);
    if (!cmFill || !cmIce) m7.push(`長按選單未阻止 裝填=${cmFill} 加冰=${cmIce}`);
    await tap('#m-empty', '倒掉');
    if (!hittable($('.ing[data-ing="green"]'))) m7.push('倒掉後素材格 ' + why($('.ing[data-ing="green"]')));
    // ✕ 收起：量杯內容保留，再點同一液體會回來
    await tap('.ing[data-ing="green"]', '綠茶格（再開）'); g.setMeasure(30); await sleep(60);
    await tap('#m-close', '收起量杯');
    if (!hittable($('.ing[data-ing="green"]'))) m7.push('收起後素材格 ' + why($('.ing[data-ing="green"]')));
    if (g.state.measure.ml !== 30) m7.push('收起後量杯內容沒保留（' + g.state.measure.ml + 'ml）');
    await tap('.ing[data-ing="green"]', '綠茶格（第三次）');
    if (!hittable($('#m-fill'))) m7.push('再點液體面板沒回來');
    await tap('#m-empty', '倒掉');
    ok('M7', m7.length === 0 && steps.length === 0, [...m7, ...steps.splice(0)].slice(0, 6).join('；') || `量杯正常（按住進 ${filled}ml）`);

    // M8 只用點擊、完全不捲頁面，做完一杯林華泰鐵觀音 L 冰 → Q=100（毫升數用 setMeasure 代替長按）
    const card = $(`.customer[data-order-id="${order.id}"]`);
    await tap(card, '客人卡');
    const accepted = g.state.currentId === order.id;
    const titleOk = !!$('#order-title') && /林華泰鐵觀音/.test($('#order-title').textContent) && inView($('#order-title'));
    await tap('.vessel-tab[data-v="s"]', '雪克杯分頁');
    await openTab('ing');
    await tap(benchTab(/茶/), '茶桶分頁');
    await tap('.ing[data-ing="tgy"]', '鐵觀音格');
    g.setMeasure(200); await sleep(60);
    await tap('#btn-pour', '倒入');
    await tap(benchTab(/糖/), '糖分頁');
    await tap('.ing[data-ing="sugar"]', '蔗糖格');
    await tap('#modal-qty button[data-v="60"]', '60g'); await tap('#qty-add', '加入');
    await openTab('tools');
    const pct = { normal: 80, less: 50, light: 33 }[order.iceLevel];
    await tap(`.ice-preset[data-pct="${pct}"]`, '冰量預設');
    await tap('#btn-shake', '搖茶'); await sleep(1800);
    await tap('#pour-to-cup', '倒入紙杯');
    await tap('#cup-size-L', 'L'); await tap('#cup-temp-cold', '冰');
    await openTab('cup');
    await tap('.fin[data-fin="topWater"]', '補水');
    const q = Math.round(g.score(order.target, g.state.cup).Q);
    const detail = g.score(order.target, g.state.cup).details.join('；');
    const noScroll = pageY() === 0;
    await tap('#btn-serve', '送出'); await sleep(300);
    const resOpen = getComputedStyle($('#modal-result')).display !== 'none';
    const resBox = $('#modal-result .box'); const resFits = resBox && inView(resBox);
    await tap('#btn-result-close', '關閉結算'); await sleep(200);
    const resClosed = getComputedStyle($('#modal-result')).display === 'none';
    ok('M8', accepted && titleOk && q === 100 && noScroll && resOpen && resFits && resClosed && steps.length === 0,
      `接單=${accepted} 訂單標題=${titleOk} Q=${q}${detail ? '（' + detail + '）' : ''} 頁面未捲=${noScroll} 結算開=${resOpen} 在視窗內=${resFits} 已關=${resClosed} ${steps.splice(0).join('、')}`);

    // M9 Modal 在視窗內（配方表＋速記分頁、開始畫面）
    const rbtn = ['#btn-recipes-dock', '#btn-recipes'].map($).find(el => el && shown(el));
    await tap(rbtn, '配方表鍵'); await sleep(200);
    const rb = $('#modal-recipes .box'); const recFits = rb && inView(rb);
    const memo = $('#rmode-memo'); memo && memo.click(); await sleep(150);
    const memoFits = rb && inView(rb) && shown($('#memo-panel'));
    const list = $('#rmode-list'); list && list.click(); await sleep(80);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(150);
    const recClosed = getComputedStyle($('#modal-recipes')).display === 'none';
    const ms = $('#modal-start'); ms.style.display = 'flex'; await sleep(120);
    const sb = ms.querySelector('.box'); const startFits = sb && inView(sb);
    const dayOver = $$('#modal-start .day-btn, #modal-start [data-day]').filter(shown).filter(b => rect(b).right > W() + 1).length;
    ms.style.display = 'none';
    ok('M9', recFits && memoFits && recClosed && startFits && dayOver === 0 && steps.length === 0, `配方表=${recFits} 速記=${memoFits} Esc關閉=${recClosed} 開始畫面=${startFits} Day卡超出=${dayOver} ${steps.splice(0).join('、')}`);

    // M10 整段操作後頁面仍未捲動、仍無水平捲軸
    ok('M10', pageY() === 0 && document.documentElement.scrollWidth <= W() + 1, `scrollTop=${pageY()} scrollWidth=${document.documentElement.scrollWidth}`);
  } catch (e) {
    R.push({ id: 'EXC', ok: false, msg: e.stack || e.message });
  }
  return summarize();

  function summarize() {
    const pass = R.filter(r => r.ok).length, fail = R.filter(r => !r.ok);
    console.log('[mobile-acceptance]', pass + '/' + R.length, fail.map(f => `${f.id} ${f.msg}`).join(' | '));
    return { pass, fail: fail.length, total: R.length, results: R, failed: fail };
  }
}
window.runMobileAcceptance = runMobileAcceptance;
