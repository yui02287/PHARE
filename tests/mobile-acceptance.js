// 手機版固定驗收（對應 PLAN-v5-mobile.md）。請在 375×812 觸控模擬下、頁面剛載入時執行：
//   const src = await fetch('/tests/mobile-acceptance.js').then(r=>r.text()); (0,eval)(src); await runMobileAcceptance()
// Evaluator 專用；Generator 不可修改本檔。
async function runMobileAcceptance() {
  const R = [];
  const ok = (id, cond, msg = '') => R.push({ id, ok: !!cond, msg: String(msg) });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const g = window.game, D = window.RECIPE_DATA;
  const W = () => window.innerWidth, H = () => window.innerHeight;
  const shown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const rect = el => el.getBoundingClientRect();
  const inView = el => { const b = rect(el); return b.top >= -1 && b.bottom <= H() + 1 && b.left >= -1 && b.right <= W() + 1; };
  const hScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth + 1) return p; } return null; };
  const touch = (el, type) => el && el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 10 }));
  const lab = el => el.id ? '#' + el.id : (el.className && String(el.className).split(' ')[0]) || el.tagName;

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

    // M2 主要區塊寬度
    const need = { '#vessel-slot': 300, '#bench': 300, '#panel': 300, '#measure': 150, '#ice-panel': 150, '#cup': 60 };
    const narrow = Object.entries(need).filter(([s, w]) => !$(s) || !shown($(s)) || rect($(s)).width < w).map(([s]) => s + '=' + ($(s) ? Math.round(rect($(s)).width) : '無'));
    ok('M2', narrow.length === 0, narrow.join(' ') || '全部夠寬');

    // M3 沒有元素超出視窗右緣（水平捲動條內除外，但捲動條本身要在視窗內）
    const over = [];
    for (const el of $$('#app *')) {
      if (!el.getClientRects().length) continue;
      const b = rect(el); if (b.width === 0 || b.height === 0) continue;
      const sc = hScroller(el);
      const box = sc ? rect(sc) : b;
      if (box.right > W() + 1 || box.left < -1) over.push(lab(sc || el) + '@' + Math.round(box.right));
    }
    ok('M3', over.length === 0, [...new Set(over)].slice(0, 8).join(' ') || '無超出');

    // M4 可點元素寬高 ≥ 40
    const small = $$('#app button, #app .ing, #app .vessel-tab, #app .tab, #app .ice-preset, #app .fin')
      .filter(shown).filter(el => { const b = rect(el); return b.width < 40 || b.height < 40; })
      .map(el => lab(el) + '(' + Math.round(rect(el).width) + '×' + Math.round(rect(el).height) + ')');
    ok('M4', small.length === 0, `${small.length} 個過小：` + small.slice(0, 10).join(' '));

    // M5 送出鍵在頁首、頁尾都看得到
    $('#hud').scrollIntoView({ block: 'start' }); await sleep(120);
    const topOk = shown($('#btn-serve')) && inView($('#btn-serve'));
    const lastEl = $('#panel').lastElementChild || $('#panel');
    lastEl.scrollIntoView({ block: 'end' }); await sleep(120);
    const botOk = shown($('#btn-serve')) && inView($('#btn-serve'));
    ok('M5', topOk && botOk, `頁首=${topOk} 頁尾=${botOk}`);

    // M6 觸控按住裝填
    g.mountMeasure('green'); g.setMeasure(0);
    $('#measure').scrollIntoView({ block: 'center' }); await sleep(80);
    const fillBtn = $('#m-fill');
    const ta = getComputedStyle(fillBtn).touchAction, taIce = $('#ice-fill') ? getComputedStyle($('#ice-fill')).touchAction : '無';
    touch(fillBtn, 'pointerdown'); await sleep(500); touch(fillBtn, 'pointerup'); await sleep(60);
    const filled = g.state.measure.ml;
    ok('M6', filled > 0 && ta === 'none' && taIce === 'none', `量杯=${filled}ml touch-action 裝填=${ta} 加冰=${taIce}`);
    $('#m-empty') && $('#m-empty').click();

    // M7 長按不跳選單
    const cm = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const cmFill = !fillBtn.dispatchEvent(cm);
    const cm2 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const cmIce = $('#ice-fill') ? !$('#ice-fill').dispatchEvent(cm2) : false;
    ok('M7', cmFill && cmIce, `裝填鍵已阻止=${cmFill} 加冰鍵已阻止=${cmIce}`);

    // M8 只用點擊做完一杯（量杯的毫升數用 setMeasure 代替長按）
    const steps = [];
    const tap = async (sel, why) => { const el = typeof sel === 'string' ? $(sel) : sel; if (!el) { steps.push('找不到 ' + why); return false; } el.scrollIntoView({ block: 'center' }); await sleep(60); el.click(); await sleep(120); return true; };
    const card = $(`.customer[data-order-id="${order.id}"]`);
    await tap(card, '客人卡');
    const accepted = g.state.currentId === order.id;
    await tap('.vessel-tab[data-v="s"]', '雪克杯分頁');
    const teaTab = $$('#bench .tab').find(t => /茶/.test(t.textContent)); await tap(teaTab, '茶桶分頁');
    await tap('.ing[data-ing="tgy"]', '鐵觀音格');
    g.setMeasure(200); await sleep(60);
    await tap('#btn-pour', '倒入');
    const sugarTab = $$('#bench .tab').find(t => /糖/.test(t.textContent)); await tap(sugarTab, '糖分頁');
    await tap('.ing[data-ing="sugar"]', '蔗糖格');
    await tap('#modal-qty button[data-v="60"]', '60g'); await tap('#qty-add', '加入');
    const pct = { normal: 80, less: 50, light: 33 }[order.iceLevel];
    await tap(`.ice-preset[data-pct="${pct}"]`, '冰量預設');
    await tap('#btn-shake', '搖茶'); await sleep(1800);
    await tap('#pour-to-cup', '倒入紙杯');
    await tap('#cup-size-L', 'L'); await tap('#cup-temp-cold', '冰');
    await tap('.fin[data-fin="topWater"]', '補水');
    const q = Math.round(g.score(order.target, g.state.cup).Q);
    const detail = g.score(order.target, g.state.cup).details.join('；');
    await tap('#btn-serve', '送出'); await sleep(300);
    const resOpen = getComputedStyle($('#modal-result')).display !== 'none';
    const resBox = $('#modal-result .box'); const resFits = resBox && inView(resBox);
    await tap('#btn-result-close', '關閉結算'); await sleep(200);
    const resClosed = getComputedStyle($('#modal-result')).display === 'none';
    ok('M8', accepted && q === 100 && resOpen && resFits && resClosed && steps.length === 0,
      `接單=${accepted} Q=${q}${detail ? '（' + detail + '）' : ''} 結算開=${resOpen} 在視窗內=${resFits} 已關=${resClosed} ${steps.join('、')}`);

    // M9 Modal 在視窗內（配方表＋速記分頁、開始畫面）
    await tap('#btn-recipes', '配方表'); await sleep(200);
    const rb = $('#modal-recipes .box'); const recFits = rb && inView(rb);
    const memo = $('#rmode-memo'); memo && memo.click(); await sleep(150);
    const memoFits = rb && inView(rb) && shown($('#memo-panel'));
    const list = $('#rmode-list'); list && list.click(); await sleep(80);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(150);
    const ms = $('#modal-start'); ms.style.display = 'flex'; await sleep(120);
    const sb = ms.querySelector('.box'); const startFits = sb && inView(sb);
    const dayBtns = $$('#modal-start .day-btn, #modal-start [data-day]').filter(shown);
    const dayOver = dayBtns.filter(b => rect(b).right > W() + 1).length;
    ms.style.display = 'none';
    ok('M9', recFits && memoFits && startFits && dayOver === 0, `配方表=${recFits} 速記=${memoFits} 開始畫面=${startFits} Day卡超出=${dayOver}`);

    // M10 每個區塊捲到後都在視窗內
    const secs = ['#counter', '#vessel-slot', '#measure', '#ice-panel', '#bench', '#panel'];
    const bad = [];
    for (const s of secs) { const el = $(s); if (!el || !shown(el)) { bad.push(s + '不可見'); continue; } el.scrollIntoView({ block: 'start' }); await sleep(80); const b = rect(el); if (b.left < -1 || b.right > W() + 1 || b.width < 140) bad.push(s + '@' + Math.round(b.left) + '~' + Math.round(b.right)); }
    ok('M10', bad.length === 0, bad.join(' ') || '全部可達');
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
