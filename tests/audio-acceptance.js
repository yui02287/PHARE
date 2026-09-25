// 音訊固定驗收腳本（對應 AUDIO-PLAN.md 第 10 節 A1~A19）。Evaluator 專用；Generator 不可修改。
// 用法：在遊戲頁面（剛載入、尚未點擊）執行：
//   const src = await fetch('/tests/audio-acceptance.js').then(r=>r.text()); (0,eval)(src);
//   await runAudioAcceptance()          // 主要流程，回傳 {pass, fail, skip, results, failed}
//   // 重新載入頁面後：
//   await runAudioAcceptancePhase2()    // A8 持久化的第二階段
async function runAudioAcceptance() {
  const R = [];
  const ok = (id, cond, msg = '') => R.push({ id, ok: !!cond, skip: false, msg: String(msg) });
  const skip = (id, msg) => R.push({ id, ok: true, skip: true, msg: String(msg) });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const fire = (el, type) => el && el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, isPrimary: true, clientX: 1, clientY: 1 }));
  const A = window.GameAudio, g = window.game;
  const errors = [];
  const origErr = console.error; console.error = (...a) => { errors.push(a.join(' ')); origErr.apply(console, a); };
  const noThrow = fn => { try { fn(); return true; } catch (e) { errors.push('THROW ' + e.message); return false; } };

  try {
    // A1
    const methods = ['unlock', 'play', 'playOnce', 'startLoop', 'stopLoop', 'stopAllLoops', 'music', 'setTense', 'setPaused', 'setMusicOn', 'setSfxOn', 'toggleMusic', 'toggleSfx', 'resetStats'];
    const missing = methods.filter(k => !A || typeof A[k] !== 'function');
    ok('A01', A && typeof A === 'object' && missing.length === 0 && typeof A.state === 'object' && typeof A.stats === 'object' && Array.isArray(A.state.loops), 'missing=' + missing.join(','));
    if (!A) return summarize();

    // A2
    ok('A02', typeof window.Audio === 'function' && window.Audio !== A && noThrow(() => new window.Audio()), 'Audio ctor intact');

    // A3 手勢前（本腳本應在未點擊時執行）
    const req0 = A.stats.requested;
    const t3 = noThrow(() => { A.play('click'); A.startLoop('fill'); A.stopLoop('fill'); A.music('play'); A.setPaused(true); A.setPaused(false); A.setTense(true); A.setTense(false); });
    ok('A03', t3 && A.stats.requested >= req0 + 1 && A.state.loops.length === 0, `requested ${req0}->${A.stats.requested} ctx=${A.state.ctxState}`);

    // A4
    const s4 = A.stats.suppressed; const r4 = A.play('___nope___');
    ok('A04', r4 === false && A.stats.suppressed === s4 + 1, `ret=${r4} suppressed ${s4}->${A.stats.suppressed}`);

    // A5 關閉音效
    A.unlock(); A.setSfxOn(false);
    const p5 = A.stats.played, s5 = A.stats.suppressed;
    A.play('click'); A.play('serve'); A.play('star5');
    ok('A05', A.stats.played === p5 && A.stats.suppressed === s5 + 3 && A.state.sfxOn === false && $('#btn-sfx') && $('#btn-sfx').textContent.includes('🔇') && $('#btn-sfx').getAttribute('aria-pressed') === 'false',
      `played ${p5}->${A.stats.played} sup ${s5}->${A.stats.suppressed} btn=${$('#btn-sfx') && $('#btn-sfx').textContent}`);

    // A6 開啟音效
    A.setSfxOn(true); A.unlock(); await sleep(50);
    if (A.state.ctxState === 'none') skip('A06', 'no AudioContext'); else {
      const p6 = A.stats.played; const r6 = A.play('accept');
      ok('A06', A.stats.played === p6 + 1 && r6 === true, `ret=${r6} played ${p6}->${A.stats.played} ctx=${A.state.ctxState}`);
    }

    // A7 音樂模式
    const modes = [];
    A.music('play'); modes.push(A.state.musicMode); A.music('menu'); modes.push(A.state.musicMode); A.music('dayend'); modes.push(A.state.musicMode); A.music('bogus'); modes.push(A.state.musicMode);
    A.setMusicOn(false); A.music('play'); modes.push(A.state.musicMode); A.setMusicOn(true); A.music('menu');
    ok('A07', modes.join() === 'play,menu,dayend,none,play', modes.join());

    // A8 localStorage（第一階段）
    A.setMusicOn(false); A.setSfxOn(true);
    let ls = null; try { ls = JSON.parse(localStorage.getItem('lephare_audio')); } catch (e) { }
    ok('A08', ls && ls.music === false && ls.sfx === true, 'ls=' + JSON.stringify(ls) + '（重載後執行 runAudioAcceptancePhase2 驗第二階段）');
    try { localStorage.setItem('lephare_audio_phase2', '1'); } catch (e) { }
    // 保持 musicOn=false 供 phase2；phase2 會還原

    // A9 HUD 切換
    const bm = $('#btn-music'), bs = $('#btn-sfx'), br = $('#btn-recipes');
    const t0 = bm.textContent; bm.click(); const t1 = bm.textContent, ap1 = bm.getAttribute('aria-pressed') === String(A.state.musicOn); bm.click(); const t2 = bm.textContent;
    const u0 = bs.textContent; bs.click(); const u1 = bs.textContent, ap2 = bs.getAttribute('aria-pressed') === String(A.state.sfxOn); bs.click(); const u2 = bs.textContent;
    const before = !!(bm.compareDocumentPosition(br) & Node.DOCUMENT_POSITION_FOLLOWING);
    ok('A09', t1 !== t0 && t2 === t0 && ap1 && u1 !== u0 && u2 === u0 && ap2 && before, `music ${t0}/${t1}/${t2} sfx ${u0}/${u1}/${u2} before=${before}`);
    A.setMusicOn(false); // 維持 phase2 條件

    // A10 loop 邏輯
    A.stopAllLoops(true);
    A.startLoop('fill'); const l1 = A.state.loops.includes('fill'); A.startLoop('fill'); const l2 = A.state.loops.length;
    A.stopLoop('fill'); const l3 = A.state.loops.length; const l4 = noThrow(() => A.stopLoop('fill'));
    ok('A10', l1 && l2 === 1 && l3 === 0 && l4, `${l1},${l2},${l3},${l4}`);

    // A11 裝填掛點
    g.startDay(1); await sleep(100); g.mountMeasure('green'); g.setMeasure(0);
    fire($('#m-fill'), 'pointerdown'); await sleep(80); const f1 = A.state.loops.includes('fill');
    fire($('#m-fill'), 'pointerup'); await sleep(50); const f2 = A.state.loops.includes('fill');
    ok('A11', f1 && !f2, `down=${f1} up=${f2} loops=${A.state.loops}`);
    $('#m-empty') && $('#m-empty').click();

    // A12 設備動作掛點
    g.state.cup.items = []; g.state.cup.actions = []; if (g.selectVessel) g.selectVessel('s'); if (g.render) g.render();
    g.addItem('green', 100); const ls0 = A.stats.loopsStarted;
    const p12 = g.doAction('shake'); await sleep(50); const s12a = A.state.loops.includes('shake');
    if (p12 && p12.then) await p12; await sleep(150);
    ok('A12', s12a && !A.state.loops.includes('shake') && A.stats.loopsStarted > ls0, `during=${s12a} after=${A.state.loops} started ${ls0}->${A.stats.loopsStarted}`);

    // A13 暫停 ducking
    if (g.state.paused) $('#btn-pause').click();
    $('#btn-pause').click(); await sleep(30); const d1 = A.state.ducked === true && A.state.paused === true;
    $('#btn-pause').click(); await sleep(30); const d2 = A.state.ducked === false && A.state.paused === false;
    ok('A13', d1 && d2, `${d1},${d2}`);

    // A14 暫停保留 loop
    g.state.cup.items = []; g.state.cup.actions = []; if (g.selectVessel) g.selectVessel('b'); g.addItem('green', 100); if (g.render) g.render();
    const p14 = g.doAction('blend'); await sleep(100);
    $('#btn-pause').click(); await sleep(50); const b1 = A.state.loops.includes('blend');
    $('#btn-pause').click(); await sleep(50); const b2 = A.state.loops.includes('blend');
    if (p14 && p14.then) await p14; await sleep(200);
    ok('A14', b1 && b2 && A.state.loops.length === 0, `${b1},${b2},after=${A.state.loops}`);

    // A15 耐心歸零一次 + tense
    if (!g.state.orders.length) { g.spawnCustomer(); await sleep(50); }
    const o = g.state.orders[0];
    A.resetStats(); o.elapsed = o.patienceMax + 1; await sleep(300);
    const once = A.stats.onceHits, byOver = (A.stats.byName && A.stats.byName.overtime) || 0;
    const tense1 = A.state.tense;
    const needName = A.state.ctxState !== 'none' && A.state.sfxOn;
    o.elapsed = 0; await sleep(150); const tense2 = A.state.tense;
    ok('A15', once === 1 && (!needName || byOver === 1) && tense1 === true && tense2 === false, `onceHits=${once} byName.overtime=${byOver} tense ${tense1}->${tense2}`);

    // A19 通用點擊音不重複
    if (A.state.ctxState === 'none') skip('A19', 'no AudioContext'); else {
      A.setSfxOn(true); g.state.cup.items = []; g.addItem('green', 50); if (g.render) g.render(); await sleep(30);
      A.resetStats(); $('#btn-undo').disabled = false; $('#btn-undo').click(); await sleep(30);
      const bn = A.stats.byName || {};
      ok('A19', bn.undo === 1 && !bn.click, JSON.stringify(bn));
    }

    // A16 結算與主選單模式（跑完 Day1）
    g.startDay(1); await sleep(200);
    const total = g.DAY_CONFIG[1].customers; let served = 0, guard = 0;
    while (served < total && guard++ < 40) {
      if (!g.state.orders.length) g.spawnCustomer();
      const od = g.state.orders[0]; g.acceptOrder(od.id);
      g.state.cup.size = od.recipe.size; g.state.cup.temp = od.recipe.temp;
      od.recipe.items.forEach(i => g.addItem(i.ing, i.qty)); g.setFinish(od.recipe.finish);
      if (g.render) g.render(); await sleep(20); g.serve(); served++; await sleep(80);
      const rc = $('#btn-result-close'); if (rc && getComputedStyle($('#modal-result')).display !== 'none') { rc.click(); await sleep(60); }   // 結算需手動關閉
    }
    await sleep(1200);
    const m1 = A.state.musicMode;
    const menuBtn = $$('#modal-day-end button').find(b => /主選單/.test(b.textContent));
    menuBtn && menuBtn.click(); await sleep(100); const m2 = A.state.musicMode;
    g.startDay(1); await sleep(100); const m3 = A.state.musicMode;
    ok('A16', m1 === 'dayend' && m2 === 'menu' && m3 === 'play', `${m1},${m2},${m3} menuBtn=${!!menuBtn}`);

    // A17 無 AudioContext 靜默（iframe）
    try {
      const src = await fetch('audio.js?ts=' + Date.now()).then(r => r.text());
      const ifr = document.createElement('iframe'); ifr.style.display = 'none'; document.body.appendChild(ifr);
      const w = ifr.contentWindow, d = ifr.contentDocument;
      d.open(); d.write('<div id="hud"><button id="btn-music"></button><button id="btn-sfx"></button><button id="btn-recipes"></button></div>'); d.close();
      w.AudioContext = undefined; w.webkitAudioContext = undefined;
      const errs17 = []; w.console.error = (...a) => errs17.push(a.join(' '));
      let threw = null; try { w.eval(src); } catch (e) { threw = e.message; }
      const B = w.GameAudio; let t17 = false;
      if (B) {
        const s = B.stats.suppressed;
        t17 = noThrow(() => { B.play('click'); B.startLoop('fill'); B.stopLoop('fill'); B.music('play'); B.setPaused(true); B.setPaused(false); B.unlock(); })
          && B.available === false && B.play('___nope___') === false && B.stats.suppressed > s && B.state.musicMode === 'play'
          && (B.startLoop('fill'), B.state.loops.includes('fill')) && (B.stopLoop('fill'), B.state.loops.length === 0);
      }
      ok('A17', !threw && !!B && t17 && errs17.length === 0, `threw=${threw} B=${!!B} t=${t17} errs=${errs17.join('|')}`);
      ifr.remove();
    } catch (e) { ok('A17', false, 'exception ' + e.message); }

    // A18 既有驗收
    if (!window.runAcceptance) { const s = await fetch('/tests/acceptance.js?ts=' + Date.now()).then(r => r.text()); (0, eval)(s); }
    const acc = await window.runAcceptance();
    ok('A18', acc.fail === 0 && acc.pass >= 30, `${acc.pass}/${acc.total} failed=${acc.failed.map(f => '#' + f.id).join(',')}`);

    // console.error 總檢
    ok('AERR', errors.filter(e => !/THROW/.test(e)).length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    R.push({ id: 'EXC', ok: false, skip: false, msg: e.stack || e.message });
  } finally { console.error = origErr; }
  return summarize();

  function summarize() {
    const pass = R.filter(r => r.ok && !r.skip).length, sk = R.filter(r => r.skip).length, fail = R.filter(r => !r.ok);
    const out = { pass, skip: sk, fail: fail.length, total: R.length, results: R.sort((a, b) => (a.id > b.id ? 1 : -1)), failed: fail };
    console.log('[audio-acceptance]', `${pass} pass / ${sk} skip / ${fail.length} fail`, fail.map(f => `${f.id} ${f.msg}`).join(' | '));
    return out;
  }
}

// A8 第二階段：頁面重新載入後執行
async function runAudioAcceptancePhase2() {
  const A = window.GameAudio, $ = s => document.querySelector(s);
  let flag = null; try { flag = localStorage.getItem('lephare_audio_phase2'); } catch (e) { }
  const okv = flag === '1' && A && A.state.musicOn === false && $('#btn-music').textContent.includes('🔇') && $('#btn-music').getAttribute('aria-pressed') === 'false';
  const msg = `flag=${flag} musicOn=${A && A.state.musicOn} btn=${$('#btn-music') && $('#btn-music').textContent}`;
  try { localStorage.removeItem('lephare_audio_phase2'); } catch (e) { }
  if (A) { A.setMusicOn(true); A.setSfxOn(true); } // 還原預設
  console.log('[audio-acceptance] A08 phase2', okv ? 'PASS' : 'FAIL', msg);
  return { id: 'A08-phase2', ok: okv, msg };
}
window.runAudioAcceptance = runAudioAcceptance;
window.runAudioAcceptancePhase2 = runAudioAcceptancePhase2;
