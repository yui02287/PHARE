// audio.js — 樂法 Le Phare 飲料店經營遊戲 背景音樂＋音效（AUDIO-PLAN.md 1.0）
// 全部以 Web Audio API 即時合成，無外部音檔。只輸出 window.GameAudio。
(function () {
  'use strict';
  const W = window;
  const doc = W.document;

  // ===== feature detect =====
  const Ctor = typeof W.AudioContext === 'function' ? W.AudioContext : (typeof W.webkitAudioContext === 'function' ? W.webkitAudioContext : null);
  const available = !!Ctor;
  const nowMs = () => (W.performance && typeof W.performance.now === 'function') ? W.performance.now() : Date.now();
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ===== localStorage =====
  const LS_KEY = 'lephare_audio';
  function loadPrefs() {
    try {
      const raw = W.localStorage ? W.localStorage.getItem(LS_KEY) : null;
      if (!raw) return null;
      const o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : null;
    } catch (e) { return null; }
  }
  function savePrefs() {
    try { if (W.localStorage) W.localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, music: state.musicOn, sfx: state.sfxOn })); } catch (e) { /* silent */ }
  }
  const prefs = loadPrefs();

  // ===== state / stats =====
  const state = {
    musicOn: prefs ? prefs.music !== false : true,
    sfxOn: prefs ? prefs.sfx !== false : true,
    musicMode: 'menu',
    tense: false, paused: false, ducked: false, hidden: false,
    loops: [],
    unlocked: false, ctxState: 'none',
    bpm: 0,
  };
  const stats = { requested: 0, played: 0, suppressed: 0, dropped: 0, loopsStarted: 0, musicNotes: 0, onceHits: 0, byName: {} };
  function resetStats() {
    stats.requested = 0; stats.played = 0; stats.suppressed = 0; stats.dropped = 0;
    stats.loopsStarted = 0; stats.musicNotes = 0; stats.onceHits = 0; stats.byName = {};
  }

  // ===== 內部狀態 =====
  let ctx = null, master = null, comp = null, sfxBus = null, musicBus = null;
  let noiseBuf = null;
  let lastPlayTs = -1e9;
  const lastByName = {};
  const activeVoices = new Set();
  const VOICE_MAX = 16;
  const loopHandles = {};
  let suspendedLoops = [];
  const onceKeys = new Set();
  let song = null; // 現行音樂排程器
  let docListenersOn = false;

  const MUSIC_VOL = { menu: 0.30, play: 0.35, dayend: 0.35 };
  const sfxNow = () => ctx ? ctx.currentTime : 0;

  function safeDisconnect(n) { try { n.disconnect(); } catch (e) { /* ignore */ } }
  function safeStop(n) { try { if (typeof n.stop === 'function') n.stop(); } catch (e) { /* ignore */ } }

  // ===== ctx / bus =====
  function syncCtxState() {
    if (!ctx) { state.ctxState = 'none'; state.unlocked = false; return; }
    state.ctxState = ctx.state || 'suspended';
    state.unlocked = state.ctxState === 'running';
  }
  function musicTarget() {
    if (state.hidden) return 0;
    if (state.ducked) return 0.10;
    return MUSIC_VOL[state.musicMode] || 0.35;
  }
  function rampGain(param, value, sec) {
    try {
      const t = ctx.currentTime;
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(value, t + Math.max(0.005, sec));
    } catch (e) { /* ignore */ }
  }
  function createCtx() {
    if (ctx || !available) return;
    try {
      const c = new Ctor();
      master = c.createGain(); master.gain.value = 0.8;
      comp = c.createDynamicsCompressor();
      try {
        comp.threshold.value = -12; comp.knee.value = 20; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
      } catch (e) { /* ignore */ }
      sfxBus = c.createGain(); sfxBus.gain.value = state.sfxOn ? 1 : 0;
      musicBus = c.createGain(); musicBus.gain.value = 0;
      sfxBus.connect(master); musicBus.connect(master); master.connect(comp); comp.connect(c.destination);
      ctx = c;
      musicBus.gain.value = musicTarget();
      try {
        c.onstatechange = () => {
          try {
            syncCtxState();
            if (state.ctxState === 'running') { removeDocListeners(); ensureSong(); }
            else if (state.ctxState === 'suspended' || state.ctxState === 'interrupted') addDocListeners();
          } catch (e) { /* ignore */ }
        };
      } catch (e) { /* ignore */ }
      syncCtxState();
      ensureSong();
    } catch (e) { ctx = null; master = comp = sfxBus = musicBus = null; }
  }
  function unlock(evt) {
    try {
      if (!available) return false;
      if (evt && typeof evt === 'object' && ('isTrusted' in evt)) {
        if (evt.isTrusted !== true) return !!ctx;
        const ua = W.navigator && W.navigator.userActivation;
        if (ua && ua.isActive === false) return !!ctx;
      }
      if (!ctx) createCtx();
      if (!ctx) return false;
      if (ctx.state !== 'running') {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => { });
      }
      syncCtxState();
      if (state.ctxState === 'running') removeDocListeners();
      return true;
    } catch (e) { return !!ctx; }
  }
  function addDocListeners() {
    if (docListenersOn || !doc || typeof doc.addEventListener !== 'function') return;
    try {
      doc.addEventListener('pointerdown', unlock, { capture: true, passive: true });
      doc.addEventListener('keydown', unlock, { capture: true, passive: true });
      docListenersOn = true;
    } catch (e) { /* ignore */ }
  }
  function removeDocListeners() {
    if (!docListenersOn || !doc || typeof doc.removeEventListener !== 'function') return;
    try {
      doc.removeEventListener('pointerdown', unlock, { capture: true });
      doc.removeEventListener('keydown', unlock, { capture: true });
      docListenersOn = false;
    } catch (e) { /* ignore */ }
  }

  // ===== 合成原語 =====
  let collector = null; // play() 期間收集 parts
  function getNoiseBuf() {
    if (noiseBuf) return noiseBuf;
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = buf;
    return buf;
  }
  // 包絡：attack→(decay→sus)→hold→release；exp=true 時 attack 後指數衰減到 dur
  function applyEnv(param, t, peak, o) {
    const a = o.a == null ? 0.005 : o.a, r = o.r == null ? 0.03 : o.r, dur = o.dur;
    const pk = Math.max(0.0001, peak);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(pk, t + a);
    if (o.exp) { param.exponentialRampToValueAtTime(Math.max(pk * 0.001, 0.0001), t + Math.max(dur, a + 0.001)); return t + dur + 0.01; }
    let level = pk;
    if (o.d) { level = Math.max(0.0001, pk * (o.sus == null ? 1 : o.sus)); param.linearRampToValueAtTime(level, t + a + o.d); }
    const hold = Math.max(t + dur, t + a + (o.d || 0));
    param.setValueAtTime(level, hold);
    param.linearRampToValueAtTime(0.0001, hold + r);
    return hold + r + 0.01;
  }
  function mkFilter(f, t, dur) {
    const bq = ctx.createBiquadFilter();
    bq.type = f.type || 'lowpass';
    bq.frequency.setValueAtTime(Math.max(10, f.f), t);
    if (f.f1) bq.frequency.exponentialRampToValueAtTime(Math.max(10, f.f1), t + dur);
    if (f.q != null) bq.Q.value = f.q;
    return bq;
  }
  // 一次性振盪器 part；dest 預設 sfxBus；回傳 {nodes, src, end}
  function osc(o, dest, t0) {
    const t = (t0 == null ? ctx.currentTime : t0) + (o.at || 0);
    const s = ctx.createOscillator();
    s.type = o.type || 'sine';
    s.frequency.setValueAtTime(Math.max(1, o.f0), t);
    if (o.f1) s.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    if (o.detune) s.detune.value = o.detune;
    const g = ctx.createGain();
    const end = applyEnv(g.gain, t, o.gain, o);
    const nodes = [s, g];
    let last = s;
    if (o.filter) { const f = mkFilter(o.filter, t, o.dur); last.connect(f); last = f; nodes.push(f); }
    last.connect(g); g.connect(dest || sfxBus);
    if (o.vib) { nodes.push.apply(nodes, lfo(s.frequency, o.vib, t, end)); }
    s.start(t); s.stop(end);
    const part = { nodes, src: s, end };
    s.onended = () => cleanupPart(part);
    if (collector) collector.push(part);
    return part;
  }
  // 噪音 part
  function noise(o, dest, t0) {
    const t = (t0 == null ? ctx.currentTime : t0) + (o.at || 0);
    const s = ctx.createBufferSource();
    s.buffer = getNoiseBuf(); s.loop = true;
    const g = ctx.createGain();
    const end = applyEnv(g.gain, t, o.gain, o);
    const nodes = [s, g];
    let last = s;
    if (o.filter) { const f = mkFilter(o.filter, t, o.dur); last.connect(f); last = f; nodes.push(f); }
    last.connect(g); g.connect(dest || sfxBus);
    if (o.trem) { nodes.push.apply(nodes, lfo(g.gain, o.trem, t, end)); }
    s.start(t); s.stop(end);
    const part = { nodes, src: s, end };
    s.onended = () => cleanupPart(part);
    if (collector) collector.push(part);
    return part;
  }
  // LFO：Oscillator→Gain(depth)→AudioParam；回傳 nodes
  function lfo(target, o, t, stopAt) {
    const l = ctx.createOscillator(); l.type = o.type || 'sine'; l.frequency.value = o.rate;
    const g = ctx.createGain(); g.gain.value = o.depth;
    l.connect(g); g.connect(target);
    l.start(t == null ? ctx.currentTime : t);
    if (stopAt != null) l.stop(stopAt);
    return [l, g];
  }
  function cleanupPart(part) {
    if (part.done) return; part.done = true;
    part.nodes.forEach(safeDisconnect);
    if (part.voice) releaseVoice(part.voice, part);
  }
  // 語音登錄：一次性音效上限 16
  function voice(parts) {
    const v = { parts, pending: parts.length, timer: 0 };
    let end = ctx.currentTime;
    parts.forEach(p => { p.voice = v; if (p.end > end) end = p.end; });
    activeVoices.add(v);
    // fallback：ctx 若 suspended 則 onended 不會來，改用牆鐘釋放
    v.timer = setTimeout(() => finishVoice(v), Math.max(50, (end - ctx.currentTime) * 1000 + 250));
    return v;
  }
  function releaseVoice(v, part) {
    v.pending--;
    if (v.pending <= 0) finishVoice(v);
  }
  function finishVoice(v) {
    if (!activeVoices.has(v)) return;
    activeVoices.delete(v);
    clearTimeout(v.timer);
    v.parts.forEach(p => { if (!p.done) { p.done = true; p.nodes.forEach(safeDisconnect); } });
  }

  // ===== 音效表（第 3.1 節）=====
  // build(t)：t 為絕對 ctx 時間；O/N 會把 part 收進 collector
  const O = (o, t) => osc(o, sfxBus, t);
  const N = (o, t) => noise(o, sfxBus, t);
  const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
  function dumpLayer(t) {
    N({ dur: 0.3, gain: 0.25, exp: true, a: 0.01, filter: { type: 'lowpass', f: 1200, f1: 400 } }, t);
    O({ type: 'sine', f0: 300, f1: 120, dur: 0.25, gain: 0.15, exp: true }, t);
  }
  function dripLayer(t) { O({ type: 'sine', f0: 1400, f1: 900, dur: 0.04, gain: 0.15 }, t); }
  const SFX = {
    click: { rl: 40, build: t => O({ type: 'square', f0: 1200, f1: 900, dur: 0.03, a: 0.002, exp: true, gain: 0.15 }, t) },
    tab: { rl: 60, build: t => { O({ type: 'triangle', f0: 660, dur: 0.04, gain: 0.18 }, t); O({ type: 'triangle', f0: 880, dur: 0.05, at: 0.04, gain: 0.18 }, t); } },
    ui_open: { rl: 100, build: t => { O({ type: 'sine', f0: 520, f1: 780, dur: 0.08, gain: 0.18 }, t); N({ dur: 0.03, gain: 0.08, filter: { type: 'highpass', f: 4000 } }, t); } },
    accept: { rl: 100, build: t => { O({ type: 'triangle', f0: 659, dur: 0.06, gain: 0.25 }, t); O({ type: 'triangle', f0: 880, dur: 0.12, at: 0.06, gain: 0.25 }, t); N({ dur: 0.02, gain: 0.1, filter: { type: 'bandpass', f: 3000, q: 2 } }, t); } },
    customer: { rl: 300, build: t => {
      O({ type: 'sine', f0: 1318, dur: 0.4, exp: true, gain: 0.22 }, t); O({ type: 'sine', f0: 1318, detune: 7, dur: 0.4, exp: true, gain: 0.1 }, t);
      O({ type: 'sine', f0: 1046, dur: 0.45, at: 0.18, exp: true, gain: 0.22 }, t); O({ type: 'sine', f0: 1046, detune: 7, dur: 0.45, at: 0.18, exp: true, gain: 0.1 }, t);
    } },
    mount: { rl: 60, build: t => { O({ type: 'triangle', f0: 2400, dur: 0.12, exp: true, gain: 0.2 }, t); O({ type: 'sine', f0: 3600, dur: 0.06, exp: true, gain: 0.12 }, t); } },
    drip: { rl: 40, build: t => dripLayer(t) },
    tick_up: { rl: 20, build: t => O({ type: 'sine', f0: 880, dur: 0.035, gain: 0.12 }, t) },
    tick_down: { rl: 20, build: t => O({ type: 'sine', f0: 660, dur: 0.035, gain: 0.12 }, t) },
    dump: { rl: 100, build: t => dumpLayer(t) },
    pour: { rl: 80, build: t => {
      N({ dur: 0.35, gain: 0.25, a: 0.12, d: 0.23, sus: 0.001, r: 0.01, filter: { type: 'bandpass', f: 700, f1: 1100, q: 1.5 } }, t);
      O({ type: 'sine', f0: 400, f1: 650, dur: 0.25, gain: 0.08 }, t);
    } },
    scoop: { rl: 60, build: t => { N({ dur: 0.04, gain: 0.22, filter: { type: 'bandpass', f: 2500, q: 2 } }, t); O({ type: 'triangle', f0: 300, dur: 0.06, gain: 0.12, exp: true }, t); } },
    unit: { rl: 60, build: t => O({ type: 'sine', f0: 520, f1: 380, dur: 0.09, a: 0.003, gain: 0.25 }, t) },
    qty_confirm: { rl: 100, build: t => {
      N({ dur: 0.2, gain: 0.22, filter: { type: 'bandpass', f: 3000, q: 0.8 }, trem: { rate: 30, depth: 0.1 } }, t);
      O({ type: 'triangle', f0: 987, dur: 0.08, gain: 0.15 }, t);
    } },
    undo: { rl: 80, build: t => O({ type: 'triangle', f0: 700, f1: 450, dur: 0.12, gain: 0.2 }, t) },
    reset: { rl: 200, build: t => {
      dumpLayer(t);
      N({ dur: 0.1, gain: 0.15, at: 0.06, filter: { type: 'highpass', f: 3000 } }, t);
      N({ dur: 0.4, gain: 0.2, exp: true, a: 0.02, filter: { type: 'lowpass', f: 800 } }, t);
    } },
    shake_end: { rl: 0, build: t => { N({ dur: 0.08, gain: 0.22, exp: true, filter: { type: 'bandpass', f: 2500, q: 1 } }, t); O({ type: 'square', f0: 1500, dur: 0.015, gain: 0.1 }, t); } },
    ding: { rl: 0, build: t => { O({ type: 'sine', f0: 2093, dur: 0.6, exp: true, gain: 0.3 }, t); O({ type: 'sine', f0: 3136, dur: 0.3, exp: true, gain: 0.12 }, t); } },
    blend_end: { rl: 0, build: t => {
      O({ type: 'sawtooth', f0: 140, f1: 60, dur: 0.3, gain: 0.2, exp: true, filter: { type: 'lowpass', f: 900 } }, t);
      N({ dur: 0.1, gain: 0.1, filter: { type: 'highpass', f: 2000 } }, t);
    } },
    juice_end: { rl: 0, build: t => { N({ dur: 0.09, gain: 0.2, filter: { type: 'highpass', f: 1500 } }, t); dripLayer(t + 0.09); } },
    brew_end: { rl: 0, build: t => { N({ dur: 0.2, gain: 0.22, exp: true, filter: { type: 'highpass', f: 2000 } }, t); O({ type: 'sine', f0: 900, f1: 600, dur: 0.06, gain: 0.12 }, t); } },
    finish_topIce: { rl: 100, build: t => {
      [[2200, 0], [2600, 0.07], [1900, 0.15]].forEach(([f, at]) => O({ type: 'triangle', f0: f + rnd(-100, 100), dur: 0.09, at, exp: true, gain: 0.2 }, t));
      N({ dur: 0.02, gain: 0.1, filter: { type: 'highpass', f: 5000 } }, t);
    } },
    finish_topHot: { rl: 100, build: t => {
      N({ dur: 0.25, gain: 0.18, a: 0.03, r: 0.06, filter: { type: 'bandpass', f: 900, q: 1 } }, t);
      N({ dur: 0.25, gain: 0.06, a: 0.03, r: 0.06, filter: { type: 'highpass', f: 3000 } }, t);
    } },
    finish_topTea: { rl: 100, build: t => N({ dur: 0.25, gain: 0.18, a: 0.03, r: 0.06, filter: { type: 'bandpass', f: 900, q: 1 } }, t) },
    serve: { rl: 200, build: t => {
      O({ type: 'sine', f0: 1568, dur: 0.4, exp: true, gain: 0.3 }, t); O({ type: 'sine', f0: 2349, dur: 0.4, exp: true, gain: 0.15 }, t);
      N({ dur: 0.2, gain: 0.15, a: 0.03, r: 0.05, filter: { type: 'bandpass', f: 1000, f1: 3000, q: 1 } }, t);
    } },
    star1: { rl: 120, build: t => { O({ type: 'triangle', f0: 330, dur: 0.15, gain: 0.22 }, t); O({ type: 'triangle', f0: 262, dur: 0.2, at: 0.15, gain: 0.22, vib: { rate: 5, depth: 8 } }, t); } },
    star2: { rl: 120, build: t => { O({ type: 'triangle', f0: 392, dur: 0.12, gain: 0.22 }, t); O({ type: 'triangle', f0: 349, dur: 0.16, at: 0.12, gain: 0.22 }, t); } },
    star3: { rl: 120, build: t => { O({ type: 'sine', f0: 523, dur: 0.12, gain: 0.22 }, t); O({ type: 'sine', f0: 659, dur: 0.16, at: 0.12, gain: 0.22 }, t); } },
    star4: { rl: 120, build: t => {
      [523, 659, 784].forEach((f, i) => O({ type: 'triangle', f0: f, dur: 0.1, at: i * 0.1, gain: 0.25 }, t));
      O({ type: 'triangle', f0: 1046, dur: 0.25, at: 0.3, exp: true, gain: 0.25 }, t);
    } },
    star5: { rl: 120, build: t => {
      [523, 659, 784, 1046, 1318].forEach((f, i) => { O({ type: 'triangle', f0: f, dur: 0.09, at: i * 0.09, gain: 0.28 }, t); O({ type: 'square', f0: f, dur: 0.09, at: i * 0.09, gain: 0.084 }, t); });
      [1046, 1318, 1568].forEach(f => O({ type: 'triangle', f0: f, dur: 0.5, at: 0.45, exp: true, a: 0.01, gain: 0.14 }, t));
      N({ dur: 0.3, gain: 0.06, at: 0.45, exp: true, filter: { type: 'highpass', f: 6000 } }, t);
    } },
    coin: { rl: 100, build: t => {
      O({ type: 'sine', f0: 987, dur: 0.06, gain: 0.22 }, t); O({ type: 'square', f0: 987, dur: 0.06, gain: 0.018 }, t);
      O({ type: 'sine', f0: 1318, dur: 0.2, at: 0.06, exp: true, gain: 0.22 }, t); O({ type: 'square', f0: 1318, dur: 0.2, at: 0.06, exp: true, gain: 0.018 }, t);
    } },
    overtime: { rl: 300, build: t => {
      O({ type: 'square', f0: 440, dur: 0.09, gain: 0.2, filter: { type: 'lowpass', f: 2000 } }, t);
      O({ type: 'square', f0: 330, dur: 0.09, at: 0.15, gain: 0.2, filter: { type: 'lowpass', f: 2000 } }, t);
    } },
    dayend_chime: { rl: 500, build: t => [1046, 1318, 1568, 2093].forEach((f, i) => O({ type: 'triangle', f0: f, dur: 0.8, at: i * 0.12, exp: true, gain: 0.22 }, t)) },
    open: { rl: 500, build: t => { O({ type: 'sine', f0: 1760, dur: 0.5, exp: true, gain: 0.28 }, t); O({ type: 'sine', f0: 1318, dur: 0.6, at: 0.12, exp: true, gain: 0.2 }, t); } },
    error: { rl: 150, build: t => {
      O({ type: 'square', f0: 220, dur: 0.07, gain: 0.18, filter: { type: 'lowpass', f: 800 } }, t);
      O({ type: 'square', f0: 220, dur: 0.07, at: 0.12, gain: 0.18, filter: { type: 'lowpass', f: 800 } }, t);
    } },
  };
  const ALIAS = { finish_none: 'click', finish_noTop: 'click', finish_topWater: 'finish_topIce', ice: 'scoop' };

  // ===== 持續音（第 3.2 節）=====
  // 連續源 helper：回傳 [src, ...chain, gain]，最後一個節點已接到 dest
  function rawOsc(type, f, gainVal, dest, detune) {
    const s = ctx.createOscillator(); s.type = type; s.frequency.value = f; if (detune) s.detune.value = detune;
    const g = ctx.createGain(); g.gain.value = gainVal;
    s.connect(g); g.connect(dest); s.start();
    return [s, g];
  }
  function rawNoise(filters, gainVal, dest) {
    const s = ctx.createBufferSource(); s.buffer = getNoiseBuf(); s.loop = true;
    const g = ctx.createGain(); g.gain.value = gainVal;
    let last = s; const nodes = [s];
    (filters || []).forEach(f => { const bq = ctx.createBiquadFilter(); bq.type = f.type; bq.frequency.value = f.f; if (f.q != null) bq.Q.value = f.q; last.connect(bq); last = bq; nodes.push(bq); });
    last.connect(g); g.connect(dest); s.start();
    nodes.push(g);
    return nodes;
  }
  const LOOPS = {
    fill: { tail: 'drip', build: () => {
      const h = mkLoop();
      const n = rawNoise([{ type: 'bandpass', f: 900, q: 1.2 }], 1, h.g);
      const bq = n[1];
      h.add.apply(h, n);
      h.add.apply(h, lfo(bq.frequency, { rate: 6, depth: 200 }));
      h.add.apply(h, lfo(h.g.gain, { rate: 5, depth: 0.18 * 0.15 }));
      h.every(120, () => osc({ type: 'sine', f0: rnd(600, 1200), dur: 0.025, gain: 0.06 }, h.g));
      h.fadeTo(0.18, 0.06);
      return h;
    } },
    shake: { tail: 'shake_end', build: () => {
      const h = mkLoop(); let k = 0;
      const hit = () => { noise({ dur: 0.06, gain: (k++ % 2) ? 0.18 : 0.30, exp: true, filter: { type: 'bandpass', f: 1800, q: 1 } }, h.g); osc({ type: 'sine', f0: 120, dur: 0.04, gain: 0.12 }, h.g); };
      hit(); h.every(150, hit);
      h.fadeTo(1, 0.06);
      return h;
    } },
    heat: { tail: 'ding', build: () => {
      const h = mkLoop(); const t = ctx.currentTime;
      const n = rawNoise([{ type: 'lowpass', f: 3000 }], 0.10, h.g);
      n[1].frequency.setTargetAtTime(6000, t, 0.8);
      n[2].gain.linearRampToValueAtTime(0.22, t + 2);
      h.add.apply(h, n);
      h.add.apply(h, rawOsc('sine', 60, 0.06, h.g));
      h.fadeTo(1, 0.06);
      return h;
    } },
    blend: { tail: 'blend_end', build: () => {
      const h = mkLoop(); const t = ctx.currentTime;
      const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(90, t); s.frequency.exponentialRampToValueAtTime(140, t + 0.3);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = 0.22;
      s.connect(lp); lp.connect(g); g.connect(h.g); s.start();
      h.add(s, lp, g);
      h.add.apply(h, rawOsc('square', 180, 0.066, h.g, -5));
      const n = rawNoise([{ type: 'highpass', f: 2000 }], 0.05, h.g);
      h.add.apply(h, n);
      h.add.apply(h, lfo(n[n.length - 1].gain, { rate: 12, depth: 0.03 }));
      h.fadeTo(1, 0.06);
      return h;
    } },
    stir: { tail: null, build: () => {
      const h = mkLoop();
      const hit = () => { osc({ type: 'triangle', f0: 1800 + rnd(-200, 200), dur: 0.03, gain: 0.15 }, h.g); noise({ dur: 0.03, gain: 0.08, filter: { type: 'bandpass', f: 500, q: 1 } }, h.g); };
      hit(); h.every(200, hit);
      h.fadeTo(1, 0.06);
      return h;
    } },
    juice: { tail: 'juice_end', build: () => {
      const h = mkLoop();
      const n = rawNoise([{ type: 'bandpass', f: 1200, q: 3 }], 0.2, h.g);
      h.add.apply(h, n);
      h.add.apply(h, lfo(n[n.length - 1].gain, { rate: 3, depth: 0.18 }));
      const hit = () => osc({ type: 'sine', f0: 200, f1: 150, dur: 0.15, gain: 0.1 }, h.g);
      hit(); h.every(330, hit);
      h.fadeTo(1, 0.06);
      return h;
    } },
    brew: { tail: 'brew_end', build: () => {
      const h = mkLoop();
      h.add.apply(h, rawNoise([{ type: 'highpass', f: 1500 }, { type: 'lowpass', f: 5000 }], 0.12, h.g));
      const o = rawOsc('sine', 1200, 0.04, h.g);
      h.add.apply(h, o);
      h.add.apply(h, lfo(o[0].frequency, { rate: 5, depth: 8 }));
      h.every(160, () => osc({ type: 'sine', f0: rnd(500, 900), dur: 0.03, gain: 0.04 }, h.g));
      h.fadeTo(1, 0.06);
      return h;
    } },
  };
  // v2：steam → heat 聲（尾音 ding）、brew3/brew5 → brew 聲、ice（按住加冰）→ shake 聲
  const LOOP_ALIAS = { brew2: 'brew', brew3: 'brew', brew5: 'brew', steam: 'heat', ice: 'shake' };

  // ===== play / playOnce =====
  function play(name, delaySec) {
    stats.requested++;
    const key = ALIAS[name] || name;
    const def = SFX[key];
    if (!def) { stats.suppressed++; return false; }
    lastPlayTs = nowMs();
    if (!state.sfxOn || !ctx) { stats.suppressed++; return false; }
    const now = lastPlayTs;
    const rl = def.rl == null ? 60 : def.rl;
    if (rl > 0 && lastByName[key] != null && now - lastByName[key] < rl) { stats.suppressed++; return false; }
    if (activeVoices.size >= VOICE_MAX) { stats.dropped++; return false; }
    lastByName[key] = now;
    const parts = [];
    const prev = collector; collector = parts;
    try {
      def.build(ctx.currentTime + Math.max(0, Number(delaySec) || 0));
    } catch (e) {
      collector = prev;
      parts.forEach(p => { p.done = true; p.nodes.forEach(safeDisconnect); safeStop(p.src); });
      stats.suppressed++;
      return false;
    }
    collector = prev;
    if (parts.length) voice(parts);
    stats.played++;
    stats.byName[name] = (stats.byName[name] || 0) + 1;
    return true;
  }
  function playOnce(name, key) {
    const k = name + '|' + String(key);
    if (onceKeys.has(k)) return false;
    onceKeys.add(k);
    stats.onceHits++;
    return play(name);
  }

  // ===== Loop =====
  function mkLoop() {
    const h = { nodes: [], timers: [], g: ctx.createGain(), stopped: false };
    h.g.gain.value = 0.0001;
    h.g.connect(sfxBus);
    h.fadeTo = (v, sec) => rampGain(h.g.gain, v, sec);
    h.add = function () { for (let i = 0; i < arguments.length; i++) h.nodes.push(arguments[i]); return h; };
    h.every = (ms, fn) => { const id = setInterval(() => { try { if (!h.stopped) fn(); } catch (e) { /* ignore */ } }, ms); h.timers.push(id); return id; };
    h.stop = fadeMs => {
      if (h.stopped) return; h.stopped = true;
      h.timers.forEach(clearInterval); h.timers.length = 0;
      const sec = Math.max(0.02, (fadeMs || 80) / 1000);
      try {
        const t = ctx.currentTime;
        h.g.gain.cancelScheduledValues(t);
        h.g.gain.setValueAtTime(Math.max(0.0001, h.g.gain.value), t);
        h.g.gain.linearRampToValueAtTime(0.0001, t + sec);
      } catch (e) { /* ignore */ }
      setTimeout(() => { h.nodes.forEach(n => { safeStop(n); safeDisconnect(n); }); safeDisconnect(h.g); }, fadeMs + 30);
    };
    return h;
  }
  function buildLoopNodes(name) {
    if (!ctx || !state.sfxOn || loopHandles[name]) return;
    const def = LOOPS[LOOP_ALIAS[name] || name];
    if (!def) return;
    try { loopHandles[name] = def.build(); } catch (e) { /* ignore */ }
  }
  function killLoopNodes(name, fadeMs) {
    const h = loopHandles[name];
    if (!h) return null;
    delete loopHandles[name];
    try { h.stop(fadeMs == null ? 80 : fadeMs); } catch (e) { /* ignore */ }
    return h;
  }
  function startLoop(name) {
    if (typeof name !== 'string' || !name) return;
    if (state.loops.indexOf(name) >= 0) return;
    state.loops.push(name);
    stats.loopsStarted++;
    if (state.paused) { if (suspendedLoops.indexOf(name) < 0) suspendedLoops.push(name); return; }
    buildLoopNodes(name);
  }
  function stopLoop(name, silent) {
    const i = state.loops.indexOf(name);
    if (i >= 0) state.loops.splice(i, 1);
    const j = suspendedLoops.indexOf(name);
    if (j >= 0) suspendedLoops.splice(j, 1);
    const h = killLoopNodes(name, 80);
    if (h && !silent) {
      const def = LOOPS[LOOP_ALIAS[name] || name];
      if (def && def.tail) play(def.tail);
    }
  }
  function stopAllLoops(silent) {
    if (silent == null) silent = true;
    state.loops.slice().forEach(n => stopLoop(n, silent));
    Object.keys(loopHandles).forEach(n => killLoopNodes(n, 60));
    suspendedLoops = [];
  }

  // ===== 音樂（第 5 節）=====
  // 樂器：每音新建節點，onended disconnect（osc/noise 內建）
  function leadNote(s, midi, t, dur, r) {
    const f = mtof(midi), lp = state.tense ? 4000 : 2400;
    const rel = r == null ? 0.10 : r;
    osc({ type: 'triangle', f0: f, dur, a: 0.01, d: 0.08, sus: 0.6, r: rel, gain: 0.16, filter: { type: 'lowpass', f: lp } }, s.gain, t);
    osc({ type: 'square', f0: f, dur, a: 0.01, d: 0.08, sus: 0.6, r: rel, gain: 0.04, filter: { type: 'lowpass', f: lp } }, s.gain, t);
    stats.musicNotes++;
  }
  function bassNote(s, midi, t, dur) {
    const f = mtof(midi), g = state.tense ? 0.24 : 0.20;
    osc({ type: 'sine', f0: f, dur, a: 0.005, r: 0.05, gain: g }, s.gain, t);
    osc({ type: 'triangle', f0: f, dur, a: 0.005, r: 0.05, gain: g * 0.3 }, s.gain, t);
    stats.musicNotes++;
  }
  function padChord(s, midis, t, dur, r) {
    midis.forEach(m => {
      const f = mtof(m);
      osc({ type: 'triangle', f0: f, detune: 6, dur, a: 0.3, r: r == null ? 0.4 : r, gain: 0.06, filter: { type: 'lowpass', f: 1200 } }, s.gain, t);
      osc({ type: 'triangle', f0: f, detune: -6, dur, a: 0.3, r: r == null ? 0.4 : r, gain: 0.06, filter: { type: 'lowpass', f: 1200 } }, s.gain, t);
    });
    stats.musicNotes++;
  }
  function kick(s, t) { osc({ type: 'sine', f0: 150, f1: 45, dur: 0.18, a: 0.002, exp: true, gain: 0.5 }, s.gain, t); stats.musicNotes++; }
  function hat(s, t) { noise({ dur: 0.04, a: 0.002, exp: true, gain: 0.12, filter: { type: 'highpass', f: 7000, q: 0.7 } }, s.gain, t); stats.musicNotes++; }
  function snare(s, t) {
    noise({ dur: 0.10, a: 0.002, exp: true, gain: 0.25, filter: { type: 'bandpass', f: 1800, q: 0.8 } }, s.gain, t);
    osc({ type: 'sine', f0: 180, dur: 0.06, a: 0.002, exp: true, gain: 0.2 }, s.gain, t);
    stats.musicNotes++;
  }
  // 樂句（MIDI；0 = 休止）— C 大調五聲音階，和聲 C–Am–F–G
  const CH_ROOT = [48, 45, 41, 43], CH_FIFTH = [55, 52, 48, 50];
  const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
  const MENU_LEAD = [76, 79, 81, 79, 76, 74, 72, 0, 74, 76, 79, 76, 74, 72, 69, 0];
  const PLAY_LEAD_A = [72, 76, 79, 76, 81, 79, 76, 74, 69, 72, 76, 72, 74, 72, 69, 0, 65, 69, 72, 69, 74, 72, 69, 67, 67, 71, 74, 71, 76, 74, 71, 0];
  const PLAY_LEAD_B = [79, 81, 79, 76, 72, 74, 76, 0, 76, 74, 72, 69, 72, 0, 69, 0, 65, 69, 72, 74, 77, 74, 72, 69, 67, 71, 74, 76, 79, 76, 74, 0];
  const DAYEND_LEAD = [79, 81, 84, 0, 88, 0, 0, 0];
  const PATTERNS = {
    menu: {
      bpm: () => 72, spb: 1, len: 16, once: false,
      step(s, i, t, sd) {
        const m = MENU_LEAD[i]; if (m) leadNote(s, m, t, sd * 0.9);
        if (i % 4 === 0) { bassNote(s, CH_ROOT[i / 4], t, sd * 0.9); padChord(s, CHORDS[i / 4], t, sd * 4, 0.4); }
        else if (i % 4 === 2) bassNote(s, CH_FIFTH[(i - 2) / 4], t, sd * 0.9);
      },
    },
    play: {
      bpm: () => (state.tense ? 134 : 116), spb: 2, len: 32, once: false,
      step(s, i, t, sd) {
        const lead = (s.phrase % 2) ? PLAY_LEAD_B : PLAY_LEAD_A;
        const m = lead[i]; if (m) leadNote(s, m, t, sd * 0.9);
        const bar = Math.floor(i / 8), pos = i % 8;
        if (pos % 2 === 0) bassNote(s, (pos % 4 === 0 ? CH_ROOT : CH_FIFTH)[bar], t, sd * 0.9);
        if (pos === 0 || pos === 4) kick(s, t);
        if (state.tense) { hat(s, t); if (pos === 2 || pos === 6) snare(s, t); }
        else if (pos % 2 === 1) hat(s, t);
      },
    },
    dayend: {
      bpm: () => 96, spb: 1, len: 8, once: true,
      step(s, i, t, sd) {
        const m = DAYEND_LEAD[i]; if (m) leadNote(s, m, t, i === 4 ? sd * 2 : sd * 0.9, i === 4 ? 0.6 : undefined);
        if (i === 0) { bassNote(s, 41, t, sd * 2); padChord(s, [53, 57, 60], t, sd * 2, 0.8); }
        if (i === 2) { bassNote(s, 43, t, sd * 2); padChord(s, [55, 59, 62], t, sd * 2, 0.8); }
        if (i === 4) { bassNote(s, 48, t, sd * 4); padChord(s, [60, 64, 67], t, sd * 4, 0.8); }
      },
    },
  };
  function stopSong(fadeMs) {
    const s = song; song = null;
    state.bpm = 0;
    if (!s) return;
    if (s.timer) clearInterval(s.timer);
    s.timer = null;
    try {
      const t = ctx.currentTime, sec = Math.max(0.02, (fadeMs || 150) / 1000);
      s.gain.gain.cancelScheduledValues(t);
      s.gain.gain.setValueAtTime(Math.max(0.0001, s.gain.gain.value), t);
      s.gain.gain.linearRampToValueAtTime(0.0001, t + sec);
      setTimeout(() => safeDisconnect(s.gain), (fadeMs || 150) + 50);
    } catch (e) { /* ignore */ }
  }
  function startSong(mode) {
    if (!ctx || !PATTERNS[mode]) return;
    try {
      const pat = PATTERNS[mode];
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(1, t + 0.6);
      g.connect(musicBus);
      const s = { mode, pat, gain: g, step: 0, phrase: 0, next: t + 0.2, timer: null };
      s.timer = setInterval(() => scheduleTick(s), 25);
      song = s;
      state.bpm = pat.bpm(state);
      scheduleTick(s);
    } catch (e) { /* ignore */ }
  }
  function scheduleTick(s) {
    if (song !== s || !ctx) return;
    try {
      const lookahead = ctx.currentTime + 0.12;
      let guard = 0;
      while (s.next < lookahead && guard++ < 64) {
        const bpm = s.pat.bpm(state);
        state.bpm = bpm;
        const stepDur = 60 / bpm / s.pat.spb;
        s.pat.step(s, s.step, s.next, stepDur);
        s.next += stepDur;
        s.step++;
        if (s.step >= s.pat.len) {
          if (s.pat.once) { clearInterval(s.timer); s.timer = null; return; }
          s.step = 0; s.phrase++;
        }
      }
    } catch (e) { /* ignore */ }
  }
  function ensureSong() {
    if (!ctx || !state.musicOn || state.hidden) return;
    if (song && song.mode === state.musicMode) return;
    stopSong(150);
    if (PATTERNS[state.musicMode]) startSong(state.musicMode);
  }
  function music(mode) {
    const valid = mode === 'menu' || mode === 'play' || mode === 'dayend' || mode === 'none';
    mode = valid ? mode : 'none';
    if (mode === 'play') { onceKeys.clear(); state.tense = false; }
    state.musicMode = mode;
    if (ctx) {
      try { if (musicBus) rampGain(musicBus.gain, musicTarget(), 0.3); } catch (e) { /* ignore */ }
      if (state.musicOn) {
        stopSong(150);
        if (!state.hidden && PATTERNS[mode]) startSong(mode);
      }
    }
  }
  function setTense(b) {
    b = !!b;
    if (state.tense === b) return;
    state.tense = b;
  }
  function setPaused(b) {
    b = !!b;
    state.paused = b; state.ducked = b;
    if (b) {
      suspendedLoops = state.loops.slice();
      Object.keys(loopHandles).forEach(n => killLoopNodes(n, 40));
      if (ctx && musicBus) rampGain(musicBus.gain, musicTarget(), 0.25);
    } else {
      if (ctx && musicBus) rampGain(musicBus.gain, musicTarget(), 0.25);
      const names = suspendedLoops.slice(); suspendedLoops = [];
      names.forEach(n => { if (state.loops.indexOf(n) >= 0) buildLoopNodes(n); });
    }
  }

  // ===== 設定與 HUD =====
  function q(sel) { try { return doc && typeof doc.querySelector === 'function' ? doc.querySelector(sel) : null; } catch (e) { return null; } }
  function updateHud() {
    const bm = q('#btn-music'), bs = q('#btn-sfx');
    try {
      if (bm) { bm.textContent = state.musicOn ? '🎵 音樂' : '🔇 音樂'; bm.setAttribute('aria-pressed', String(state.musicOn)); bm.style.opacity = state.musicOn ? '' : '.6'; }
      if (bs) { bs.textContent = state.sfxOn ? '🔊 音效' : '🔇 音效'; bs.setAttribute('aria-pressed', String(state.sfxOn)); bs.style.opacity = state.sfxOn ? '' : '.6'; }
    } catch (e) { /* ignore */ }
  }
  function setMusicOn(v) {
    v = !!v;
    state.musicOn = v;
    savePrefs(); updateHud();
    if (!ctx) return;
    if (v) { stopSong(0); if (!state.hidden && PATTERNS[state.musicMode]) startSong(state.musicMode); }
    else stopSong(150);
  }
  function setSfxOn(v) {
    v = !!v;
    state.sfxOn = v;
    savePrefs(); updateHud();
    if (!ctx) return;
    if (!v) {
      Object.keys(loopHandles).forEach(n => killLoopNodes(n, 60));
      if (sfxBus) rampGain(sfxBus.gain, 0, 0.05);
    } else {
      if (sfxBus) rampGain(sfxBus.gain, 1, 0.05);
      if (!state.paused) state.loops.forEach(buildLoopNodes);
    }
  }
  function toggleMusic() { setMusicOn(!state.musicOn); }
  function toggleSfx() { setSfxOn(!state.sfxOn); }

  // ===== 內建自動行為 =====
  function bindDom() {
    if (!doc || typeof doc.addEventListener !== 'function') return;
    try {
      const bm = q('#btn-music'), bs = q('#btn-sfx');
      if (bm) bm.addEventListener('click', toggleMusic);
      if (bs) bs.addEventListener('click', toggleSfx);
    } catch (e) { /* ignore */ }
    updateHud();
    try {
      doc.addEventListener('click', e => {
        try {
          const t = e && e.target;
          if (!t || typeof t.closest !== 'function' || !t.closest('button')) return;
          if (nowMs() - lastPlayTs > 30) play('click');
        } catch (err) { /* ignore */ }
      });
      doc.addEventListener('visibilitychange', () => {
        try {
          state.hidden = !!doc.hidden;
          if (!ctx) return;
          if (state.hidden) { if (musicBus) rampGain(musicBus.gain, 0, 0.1); stopSong(100); }
          else { if (musicBus) rampGain(musicBus.gain, musicTarget(), 0.6); ensureSong(); }
        } catch (err) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
    try { state.hidden = !!doc.hidden; } catch (e) { /* ignore */ }
    if (available) addDocListeners();
  }
  bindDom();

  // ===== 輸出 =====
  W.GameAudio = {
    available, state, stats,
    unlock, play, playOnce, startLoop, stopLoop, stopAllLoops,
    music, setTense, setPaused, setMusicOn, setSfxOn, toggleMusic, toggleSfx,
    resetStats,
    now: () => ctx ? ctx.currentTime : 0,
  };
})();
