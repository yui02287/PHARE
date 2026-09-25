// 樂法斗六店 配方表 → 遊戲資料 v3（v2 ＋ 容器標記）
// 來源：Desktop/樂法/樂法斗六店 - 配方表.csv（完整版，取代先前照片辨識的 v1）
// 修正（2026-09-10）：CSV 欄位寫「果糖」，但店員確認實際全品項只使用「蔗糖」，故遊戲一律顯示蔗糖（素材 id 仍為 sugar）。
// v3（2026-09-11）：雪克杯與紙杯分開。每個素材標記應放入的容器：c 紙杯（杯底）、s 雪克杯、b 果汁機、t 萃茶機。
// 規則：冰量由客人指定：正常 = 杯子 8~9 成冰、少冰 = 1/2、微冰 = 1/3（熱飲無冰）。
(function (global) {
  const ING = {
    // 液體（量杯 ml）— group tea / water / fridge / juice
    green:      { name: '綠茶',       unit: 'ml', group: 'tea',    color: '#9ccc65' },
    black:      { name: '紅茶',       unit: 'ml', group: 'tea',    color: '#8d4a2b' },
    qing:       { name: '青茶(四季青)', unit: 'ml', group: 'tea',  color: '#c5d98b' },
    tgy:        { name: '鐵觀音',     unit: 'ml', group: 'tea',    color: '#b98b3d' },
    black_cold: { name: '冷縮紅茶',   unit: 'ml', group: 'tea',    color: '#7a3d20' },
    qing_cold:  { name: '冷縮青茶',   unit: 'ml', group: 'tea',    color: '#b7cf6e' },
    tgy_cold:   { name: '冷縮鐵觀音', unit: 'ml', group: 'tea',    color: '#a67c3a' },
    ro:         { name: '水(RO)',     unit: 'ml', group: 'water',  color: '#bde0fe' },
    hot:        { name: '熱水',       unit: 'ml', group: 'water',  color: '#ffd6a5' },
    milk:       { name: '牛奶',       unit: 'ml', group: 'fridge', color: '#fffaf0' },
    yogurt:     { name: '優酪乳',     unit: 'ml', group: 'fridge', color: '#fff3e0' },
    peach:      { name: '蜜桃汁',     unit: 'ml', group: 'juice',  color: '#ffb4a2' },
    lemon:      { name: '檸檬汁',     unit: 'ml', group: 'juice',  color: '#fff59d' },
    orange:     { name: '柳橙汁',     unit: 'ml', group: 'juice',  color: '#ffa726' },
    grape:      { name: '葡萄汁',     unit: 'ml', group: 'juice',  color: '#9c6bb5' },
    watermelon: { name: '西瓜汁',     unit: 'ml', group: 'juice',  color: '#ff6b6b' },
    guava:      { name: '芭樂泥',     unit: 'ml', group: 'juice',  color: '#f8bbd0' },
    guava_jam:  { name: '芭樂醬',     unit: 'ml', group: 'juice',  color: '#f48fb1' },
    // 秤重／調量（g）
    sugar:      { name: '蔗糖',       unit: 'g',  group: 'dial',   color: '#fbe7a1', presets: [15, 30, 40, 50, 60, 80] },
    honey:      { name: '蜂蜜',       unit: 'g',  group: 'dial',   color: '#f4b942', presets: [25, 40, 50, 60] },
    mango_jam:  { name: '芒果醬',     unit: 'g',  group: 'dial',   color: '#ffb300', presets: [25, 35] },
    straw_jam:  { name: '草莓醬',     unit: 'g',  group: 'dial',   color: '#e53950', presets: [20, 25, 35] },
    plum:       { name: '梅子粉',     unit: 'g',  group: 'dial',   color: '#c9a7c7', presets: [3, 5], tol: 1 },
    icecream:   { name: '冰淇淋',     unit: 'g',  group: 'dial',   color: '#fff8e1', presets: [100] },
    mango:      { name: '芒果丁',     unit: 'g',  group: 'dial',   color: '#ffb300', presets: [50, 75] },
    straw:      { name: '草莓丁',     unit: 'g',  group: 'dial',   color: '#e53950', presets: [50, 75] },
    blueberry:  { name: '藍莓',       unit: 'g',  group: 'dial',   color: '#5c6bc0', presets: [60] },
    ice_g:      { name: '冰塊(果汁機)', unit: 'g', group: 'dial',  color: '#e0f7fa', presets: [100, 200, 250] },
    // 杯內冰量（% 杯高）— 由客人指定冰量
    ice:        { name: '冰塊(杯)',   unit: '%',  group: 'ice',    color: '#e0f7fa' },
    // 勺類（qty = 勺數）
    grapefruit: { name: '葡萄柚',     unit: '勺', group: 'spoon',  color: '#ff8a65' },
    creamer:    { name: '奶精',       unit: '勺', group: 'spoon',  color: '#f5f5dc' },
    pearl:      { name: '珍珠',       unit: '勺', group: 'spoon',  color: '#3e2723' },
    coconut:    { name: '椰果',       unit: '勺', group: 'spoon',  color: '#f5f5f5' },
    gjelly:     { name: '綠茶凍',     unit: '勺', group: 'spoon',  color: '#a5d6a7' },
    grass:      { name: '仙草凍',     unit: '勺', group: 'spoon',  color: '#212121' },
    agar:       { name: '寒天',       unit: '勺', group: 'spoon',  color: '#b3e5fc' },
    // 顆／件
    apple:      { name: '蘋果',       unit: '顆', group: 'count',  color: '#e57373', max: 3 },
    teabag:     { name: '茶包',       unit: '個', group: 'count',  color: '#a1887f', max: 1 },
    yakult:     { name: '多多',       unit: '罐', group: 'count',  color: '#ffe0b2', max: 1 },
  };

  // 容器：c 紙杯（成品杯，杯底料直接放這裡）、s 雪克杯、b 果汁機、t 萃茶機
  const VESSELS = {
    c: { name: '紙杯',   emoji: '🥤', actions: ['stir', 'juice'] },
    s: { name: '雪克杯', emoji: '🫗', actions: ['shake', 'steam', 'stir', 'juice'] },
    b: { name: '果汁機', emoji: '🌀', actions: ['blend'] },
    t: { name: '萃茶機', emoji: '☕', actions: ['brew3', 'brew5'] },
  };

  const ACTIONS = {
    juice: '榨蘋果', shake: '搖茶(雪克)', stir: '攪拌', steam: '蒸汽機加熱',
    blend: '果汁機打至無塊狀', brew3: '萃茶機 鍵3', brew5: '萃茶機 鍵5',
  };
  const FINISH = { topWater: '剩餘補水', topTea: '剩餘補茶', none: '不補' };

  // 冰量：客人指定；值為杯高百分比。正常 80~90 為滿分區間，少冰 50、微冰 33。
  const ICE_LEVELS = {
    normal: { name: '正常冰', min: 80, max: 90 },
    less:   { name: '少冰',   min: 50, max: 50 },
    light:  { name: '微冰',   min: 33, max: 33 },
  };

  // 簡寫：R(名, 尺寸 'L'|'M'|'M-熱', 系列, "items", "actions", finish, steps, extra)
  // items 語法 "ing:qty[@v]"：v = c/s/b/t 容器，省略 = c 紙杯。qty -1 = 「適量」（任意 >0 皆可）；qty 0 = 「不加」（例如無糖）。
  // extra.ice = 'cup' 表示客人可指定冰量；extra.iceV = 冰塊該放的容器（預設 c；搖茶類為 s）。
  // extra.pour = { t:'s' } 表示萃茶機的茶要倒入雪克杯（預設非紙杯容器都倒入紙杯 c）。
  // extra.sv = { ing, opts:{甜度名: 數量} } 甜度變體；extra.sweet = 固定甜度標籤。
  const list = [];
  let idn = 0;
  function R(name, sizeStr, cat, items, actions, finish, steps, extra = {}) {
    const hot = /熱/.test(sizeStr);
    const size = sizeStr.replace(/-?熱/, '') || 'L';
    const it = items.trim() ? items.trim().split(/\s+/).map(s => {
      const m = s.match(/^([a-z_]+):(-?\d+)(?:@([csbt]))?$/);
      if (!m || !ING[m[1]]) throw new Error('bad item ' + s);
      return { ing: m[1], qty: Number(m[2]), v: m[3] || 'c' };
    }) : [];
    const ac = actions.trim() ? actions.trim().split(/\s+/) : [];
    ac.forEach(a => { if (!ACTIONS[a]) throw new Error('unknown action ' + a); });
    if (!FINISH[finish]) throw new Error('unknown finish ' + finish);
    const ice = hot ? 'none' : (extra.ice || 'none');
    const pour = Object.assign({}, extra.pour || {});
    // 使用到的非紙杯容器，預設倒入紙杯
    it.forEach(i => { if (i.v !== 'c' && !pour[i.v]) pour[i.v] = 'c'; });
    list.push({
      id: 'r' + (++idn), name, size, temp: hot ? '熱' : '冰', cat, items: it, actions: ac, finish, steps,
      ice, iceV: ice === 'cup' ? (extra.iceV || 'c') : null, pour,
      sv: extra.sv || null, sweet: extra.sweet || '正常', rec: extra.rec || null,
      full: `${name} ${size}-${hot ? '熱' : '冰'}`,
    });
  }
  const CUP = { ice: 'cup', iceV: 'c' };          // 冰塊直接加在紙杯（杯底料類）
  const SHK = { ice: 'cup', iceV: 's' };          // 冰塊加在雪克杯一起搖
  // 西瓜新品規格（2026-09）：克數沿用舊表 三分40／五分60／七分80，只改可點範圍與建議甜度
  const WM_TEA  = { ice: 'cup', iceV: 's', sv: { ing: 'sugar', opts: { '五分': 60, '七分': 80 } }, rec: '五分' };   // 西瓜四季青：最低五分
  const WM_YK   = { ice: 'cup', iceV: 'c', sv: { ing: 'sugar', opts: { '五分': 60, '七分': 80 } }, rec: '五分' };   // 西瓜多多：最低五分
  const WM_MILK = { ice: 'cup', iceV: 'c', sv: { ing: 'sugar', opts: { '三分': 40, '五分': 60 } }, rec: '三分' };   // 西瓜牛奶：最高五分

  // ===== 老饕蘋果系列 =====
  const C1 = '老饕蘋果系列';
  R('蘋果鮮紅', 'L', C1, 'black:100 sugar:40 apple:3', 'juice', 'topWater', '杯底加入紅茶（不搖茶）-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果鮮紅', 'M', C1, 'black:60 sugar:30 apple:2', 'juice', 'topWater', '杯底加入紅茶（不搖茶）-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果鮮紅', 'M-熱', C1, 'black:100@s sugar:30@s apple:2@s', 'juice steam', 'topWater', '雪克杯加紅茶（不搖茶）-加蔗糖-榨蘋果-蒸汽機加熱-倒回紙杯-剩餘補水');
  R('蘋果鮮綠', 'L', C1, 'green:100 sugar:40 apple:3', 'juice', 'topWater', '杯底加入綠茶（不搖茶）-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果鮮綠', 'M', C1, 'green:60 sugar:30 apple:2', 'juice', 'topWater', '杯底加入綠茶（不搖茶）-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果鮮綠', 'M-熱', C1, 'green:100@s sugar:30@s apple:2@s', 'juice steam', 'topWater', '雪克杯加綠茶（不搖茶）-加蔗糖-榨蘋果-蒸汽機加熱-倒回紙杯-剩餘補水');
  R('蘋果優利卡', 'L', C1, 'lemon:30 sugar:40 apple:3', 'juice', 'topWater', '杯底加入檸檬-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果優利卡', 'M', C1, 'lemon:15 sugar:30 apple:2', 'juice', 'topWater', '杯底加入檸檬-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果優利卡', 'M-熱', C1, 'lemon:15@s sugar:30@s apple:2@s', 'juice steam', 'topWater', '雪克杯加檸檬-加蔗糖-榨蘋果-蒸汽機加熱-倒回紙杯-剩餘補水');
  R('蘋果柳橙', 'L', C1, 'orange:60 sugar:40 apple:3', 'juice', 'topWater', '杯底加入柳橙-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果柳橙', 'M', C1, 'orange:40 sugar:30 apple:2', 'juice', 'topWater', '杯底加入柳橙-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果那堤', 'L', C1, 'milk:150 sugar:15 apple:3', 'juice', 'topWater', '杯底加入牛奶-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果那堤', 'M', C1, 'milk:120 sugar:15 apple:2', 'juice', 'topWater', '杯底加入牛奶-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果舞動', 'L', C1, 'gjelly:2 green:80 sugar:40 apple:2', 'juice', 'topWater', '杯底加入綠茶凍-加入綠茶（不搖茶）-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果多多', 'L', C1, 'yakult:1 sugar:40 apple:2', 'juice', 'topWater', '杯底加入多多一罐-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果葡萄', 'L', C1, 'grape:30 sugar:40 apple:3', 'juice', 'topWater', '杯底加入葡萄汁-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);
  R('蘋果葡萄', 'M', C1, 'grape:20 sugar:30 apple:2', 'juice', 'topWater', '杯底加入葡萄汁-加入蔗糖-加入冰塊-榨蘋果-剩餘補水', CUP);

  // ===== 蘋果系列 =====
  const C2 = '蘋果系列';
  R('蘋果芭樂綠', 'L', C2, 'guava:100 green:150@s sugar:40@s apple:1', 'shake juice', 'topWater', '1.杯底加入芭樂泥 2.雪克杯盛150綠茶-加入蔗糖-加入冰塊-搖茶-倒入杯中 3.榨蘋果 4.剩餘補水', SHK);
  R('蘋果柳橙青', 'L', C2, 'orange:100 qing:150@s sugar:40@s apple:1', 'shake juice', 'topWater', '1.杯底加入柳橙汁 2.雪克杯盛150青茶-加入蔗糖-加入冰塊-搖茶-倒入杯中 3.榨蘋果 4.剩餘補水', SHK);
  R('蘋果紅茶舞凍', 'L', C2, 'gjelly:2 black:120@s sugar:40@s apple:1', 'shake juice', 'topWater', '1.杯底加入綠茶凍 2.雪克杯盛120紅茶-加入蔗糖-加入冰塊-搖茶-倒入杯中 3.榨蘋果 4.剩餘補水', SHK);
  R('蘋果蜂蜜綠', 'L', C2, 'green:150@s honey:60@s apple:1', 'stir shake juice', 'topWater', '1.雪克杯盛150綠茶-加入蜂蜜-攪拌-加入冰塊-搖茶-倒入杯中 2.榨蘋果 3.剩餘補水（蜂蜜：七分40g、正常60g）', { ice: 'cup', iceV: 's', sv: { ing: 'honey', opts: { '七分': 40, '正常': 60 } } });

  // ===== 蜜桃系列 =====
  const C3 = '蜜桃系列';
  R('蜜桃鮮奶（含椰果）', 'L', C3, 'coconut:1 milk:150 peach:80 sugar:40', '', 'topWater', '杯底加入椰果-牛奶-蜜桃-蔗糖-冰塊-剩餘補水', CUP);
  R('蜜桃四季青', 'L', C3, 'peach:80 qing:150@s sugar:40@s', 'shake', 'topWater', '1.杯底加入蜜桃 2.雪克杯盛150青茶-加入蔗糖-加入冰塊-搖茶-倒入紙杯 3.剩餘補水', SHK);
  R('冰淇淋蜜桃', 'L', C3, 'icecream:100 peach:80 qing:150@s sugar:40@s', 'shake', 'topWater', '1.杯底加入冰淇淋-蜜桃 2.雪克杯盛150青茶-加入蔗糖-加入冰塊-搖茶-倒回紙杯 3.剩餘補水', SHK);
  R('蜜桃青檸酪酪', 'L', C3, 'gjelly:2 yogurt:100 peach:80 lemon:5 sugar:40', '', 'topWater', '杯底加入綠茶凍-優酪乳-蜜桃-檸檬-蔗糖-冰塊-剩餘補水', CUP);

  // ===== 芒果系列 =====
  const C4 = '芒果系列';
  R('冰淇淋芒果', 'L', C4, 'icecream:100 mango:75@b mango_jam:25@b sugar:40@b ice_g:250@b ro:150@b', 'blend', 'none', '1.杯底加入冰淇淋 2.果汁機裡加入芒果丁、醬、蔗糖、冰塊250g、水150ml-打至無塊狀-倒入紙杯');
  R('芒果多多', 'L', C4, 'yakult:1 mango:75@b mango_jam:25@b sugar:40@b ro:-1@b', 'blend', 'topWater', '1.杯底加入多多 2.果汁機加入芒果丁、醬、蔗糖、水-打至無塊狀-倒入紙杯 3.剩餘補水');
  R('芒果鮮奶（含椰果）', 'L', C4, 'coconut:1 milk:150 mango:75@b mango_jam:35@b sugar:40@b ro:-1@b', 'blend', 'topWater', '1.杯底加入椰果、牛奶 2.果汁機加入芒果丁、醬、蔗糖、水-打至無塊狀-倒入紙杯 3.剩餘補水');
  R('芒果楊枝酪酪2.0', 'L', C4, 'gjelly:2 grapefruit:2 yogurt:100 mango:75@b mango_jam:35@b sugar:40@b ice_g:200@b ro:100@b', 'blend', 'none', '1.杯底加入綠茶凍、葡萄柚、優酪乳 2.果汁機裡加入芒果丁、醬、蔗糖、冰塊200g、水100ml-打至無塊狀-倒入紙杯');
  R('芒果綠茶', 'L', C4, 'mango:75@b mango_jam:25@b green:150@b sugar:40@b', 'blend', 'topWater', '果汁機加入芒果丁、醬、綠茶-打至無塊狀-倒入紙杯-剩餘補水');

  // ===== 草莓系列 =====
  const C5 = '草莓系列';
  R('草莓鮮奶（含椰果）', 'L', C5, 'coconut:1 milk:150 straw:75@b straw_jam:35@b sugar:40@b ro:-1@b', 'blend', 'topWater', '1.杯底加入椰果、牛奶 2.果汁機加入草莓丁、醬、蔗糖、水-打至無塊狀-倒入紙杯 3.剩餘補水');
  R('草莓柳橙酪酪', 'L', C5, 'gjelly:2 orange:40 yogurt:100 straw:75@b straw_jam:25@b sugar:40@b ro:75@b', 'blend', 'topWater', '1.杯底加入綠茶凍、柳橙汁、優酪乳 2.果汁機裡加入草莓丁、醬、蔗糖、水75ml-打至無塊狀-倒入紙杯 3.剩餘補水');
  R('草莓多多', 'L', C5, 'yakult:1 straw:75@b straw_jam:25@b sugar:40@b ro:-1@b', 'blend', 'topWater', '1.杯底加入多多 2.果汁機加入草莓丁、醬、蔗糖、水-打至無塊狀-倒入紙杯 3.剩餘補水');
  R('草莓奶昔', 'L', C5, 'straw:50@b straw_jam:35@b sugar:30@b milk:150@b icecream:100@b ice_g:100@b ro:150@b', 'blend', 'none', '果汁機加入草莓丁、醬、蔗糖、牛奶、冰淇淋、冰塊100g、水150ml-打至無塊狀-倒入紙杯（蔗糖固定30不可調）', { sweet: '固定' });

  // ===== 藍莓系列 =====
  R('藍莓奶昔', 'L', '藍莓系列', 'blueberry:60@b straw_jam:20@b sugar:30@b milk:150@b icecream:100@b ice_g:100@b ro:150@b', 'blend', 'none', '果汁機加入藍莓、草莓醬、蔗糖、牛奶、冰淇淋、冰塊100g、水150ml-打至無塊狀-倒入紙杯（蔗糖固定30不可調）', { sweet: '固定' });

  // ===== 芭樂系列 =====
  const C6 = '芭樂系列';
  R('芭樂多多', 'L', C6, 'yakult:1 guava:75 guava_jam:25 sugar:40', '', 'topWater', '杯底加入多多一罐、芭樂泥、醬、蔗糖、冰塊-剩餘補水', CUP);
  R('芭樂芒果', 'L', C6, 'guava:100 guava_jam:50 mango:50@b mango_jam:25@b sugar:40@b ro:-1@b', 'blend', 'topWater', '1.杯底加入芭樂泥、醬 2.果汁機加入芒果丁、醬、蔗糖、水-打至無塊狀-倒入紙杯 3.剩餘補水');
  R('芭樂柳橙', 'L', C6, 'orange:100 guava:100 guava_jam:50 sugar:40', '', 'topWater', '杯底加入芭樂泥、醬、柳橙汁、蔗糖、冰塊-剩餘補水', CUP);
  R('芭樂檸檬綠', 'L', C6, 'lemon:20 guava:100 guava_jam:50 green:150@s sugar:40@s', 'shake', 'topWater', '1.杯底加入芭樂泥、醬、檸檬汁 2.雪克杯盛綠茶、蔗糖、冰塊-搖茶-倒入紙杯 3.剩餘補水', SHK);
  R('芭樂梅', 'L', C6, 'guava:100 guava_jam:50 plum:3 sugar:40', '', 'topWater', '杯底加入芭樂泥、醬、梅子粉、蔗糖、冰塊-剩餘補水', CUP);
  R('芭樂紅茶', 'L', C6, 'guava:100 guava_jam:50 black:150@s sugar:40@s', 'shake', 'topWater', '1.杯底加入芭樂泥、醬 2.雪克杯盛紅茶、蔗糖、冰塊-搖茶-倒入紙杯 3.剩餘補水', SHK);

  // ===== 水果系列 =====
  const C7 = '水果系列';
  R('橙柚青', 'L', C7, 'orange:100 grapefruit:3 qing:150@s sugar:60@s', 'shake', 'topWater', '1.杯底加入柳橙、葡萄柚 2.雪克杯盛青茶、蔗糖、冰塊-搖茶-倒入紙杯 3.剩餘補水', SHK);
  R('橙柚青', 'M-熱', C7, 'orange:100 grapefruit:3 qing:150@s sugar:50@s', 'steam', 'topWater', '1.杯底加入柳橙、葡萄柚 2.雪克杯盛青茶、蔗糖-蒸汽機加熱-倒入紙杯 3.剩餘補水');
  R('梅好橙柚青', 'L', C7, 'orange:100 grapefruit:3 plum:3 qing:150@s sugar:60@s', 'shake', 'topWater', '1.杯底加入柳橙、葡萄柚、梅子粉 2.雪克杯盛青茶、蔗糖、冰塊-搖茶-倒入紙杯 3.剩餘補水', SHK);
  R('柳橙鮮綠', 'L', C7, 'orange:150 green:150@s sugar:60@s', 'shake', 'topWater', '1.杯底加入柳橙汁 2.雪克杯盛綠茶、蔗糖、冰塊-搖茶-倒入紙杯 3.剩餘補水', SHK);

  // ===== 西瓜系列（蔗糖最低三分40g、最高七分80g；五分取 60g）=====
  const C8 = '西瓜系列';
  R('西瓜四季青', 'L', C8, 'watermelon:160 qing:200@s sugar:60@s', 'shake', 'topWater', '1.杯中加入西瓜汁 2.雪克杯中加入茶、糖、冰-搖茶 3.將雪克後的茶倒入杯中-剩餘補水（最低五分糖、微冰；建議五分糖）', WM_TEA);
  R('西瓜多多', 'L', C8, 'yakult:1 watermelon:140 sugar:60', 'stir', 'topWater', '1.杯中加入多多、糖、冰後攪拌 2.加入西瓜汁-剩餘補水（最低五分糖、微冰；建議五分糖）', WM_YK);
  R('西瓜牛奶', 'L', C8, 'milk:150 watermelon:200 sugar:60', 'stir', 'topWater', '1.杯中加入西瓜汁、牛奶、糖 2.攪拌均勻 3.加入冰塊-不足補冰/水（最高五分、最低三分；建議三分；最低微冰）', WM_MILK);

  // ===== 多多系列 =====
  const C9 = '多多系列';
  R('多多綠茶', 'L', C9, 'yakult:1 green:150@s sugar:60@s', 'shake', 'topWater', '1.杯底加入多多一罐 2.雪克杯盛綠茶、蔗糖、冰塊-搖茶-倒入紙杯 3.剩餘補水', SHK);
  R('檸檬多多', 'L', C9, 'yakult:1 lemon:25 sugar:60', '', 'topWater', '杯底加入多多一罐、檸檬、蔗糖、冰塊、剩餘補水', CUP);
  // 新品（2026-09）：甜度只有 無糖 0／全糖 30，建議無糖。規格寫「葡萄醬50g」，店員確認葡萄醬＝葡萄汁，用量杯 50ml
  R('葡萄多多', 'L', C9, 'grape:50 sugar:30 yakult:1', 'stir', 'topWater', '1.杯中依序加入葡萄汁（葡萄醬）、糖、多多 2.攪拌均勻後加入冰塊即完成-不足補水（建議無糖）', { ice: 'cup', iceV: 'c', sv: { ing: 'sugar', opts: { '無糖': 0, '全糖': 30 } }, rec: '無糖' });

  // ===== 台灣茶系列（茶包＋萃茶機）=====
  const C10 = '台灣茶系列';
  ['琥珀高山青', '大葉烏龍', '東方美人', '紅韻紅茶'].forEach(t => {
    R(t, 'L', C10, 'teabag:1@t hot:350@t sugar:60@s', 'brew3 shake', 'topWater', '1.萃茶機盛熱水-加茶包-萃茶鍵3至停止 2.雪克杯加入適量冰塊-倒入萃好的茶、蔗糖-搖茶-倒入紙杯-剩餘補水', { ice: 'cup', iceV: 's', pour: { t: 's' } });
    R(t, 'M-熱', C10, 'teabag:1@t hot:350@t sugar:50', 'brew3 stir', 'topWater', '1.萃茶機盛熱水-加茶包-萃茶鍵3至停止 2.萃好後倒入紙杯-加入蔗糖-攪拌 3.剩餘補水');
  });
  ['琥珀高山青歐蕾', '大葉烏龍歐蕾', '東方美人歐蕾', '紅韻紅茶歐蕾'].forEach(t => {
    R(t, 'M', C10, 'milk:150 teabag:1@t hot:150@t sugar:40@s', 'brew5 shake', 'topWater', '1.杯底加入牛奶 2.萃茶機盛熱水-加茶包-萃茶鍵5至停止 3.雪克杯加入適當冰塊-加糖-倒入萃好的茶和茶包-搖茶-倒入紙杯-剩餘補水', { ice: 'cup', iceV: 's', pour: { t: 's' } });
    R(t, 'M-熱', C10, 'teabag:1@t hot:150@t milk:150@s sugar:40', 'brew5 steam', 'topWater', '1.萃茶機盛熱水-加茶包-萃茶鍵5至停止 2.蒸汽機打熱牛奶後倒入紙杯 3.萃好的茶和茶包倒入紙杯、加糖-剩餘補水');
  });

  // ===== 純茶系列 =====
  const C11 = '純茶系列';
  [['阿薩姆熟成紅茶', 'black'], ['茉莉綠茶', 'green'], ['林華泰四季青', 'qing'], ['林華泰鐵觀音', 'tgy']].forEach(([t, tea]) => {
    R(t, 'L', C11, `${tea}:200@s sugar:60@s`, 'shake', 'topWater', `雪克杯盛${ING[tea].name}-加入蔗糖、冰塊-搖茶-倒入紙杯-剩餘補水`, SHK);
    R(t, 'M-熱', C11, `${tea}:200@s sugar:50@s`, 'steam stir', 'topWater', `雪克杯盛${ING[tea].name}-蒸汽機加熱-加入蔗糖-攪拌-倒入紙杯-剩餘補水`);
  });

  // ===== 紅茶／四季青／鐵觀音 系列（奶茶、珍奶、歐蕾）=====
  const milkTea = (cat, mt, pmt, ol, tea, teaCold, olHotMilk) => {
    const tn = ING[tea].name;
    R(mt, 'L', cat, `${tea}:250@s creamer:5@s sugar:60@s`, 'steam stir shake', 'topWater', `雪克杯盛${tn}-蒸汽機加熱-加奶精-攪拌-加蔗糖、冰塊-搖茶-倒入紙杯-剩餘補水`, SHK);
    R(mt, 'M-熱', cat, `${tea}:200@s creamer:4@s sugar:50@s`, 'steam stir', 'topWater', `雪克杯盛${tn}-蒸汽機加熱-加奶精-加蔗糖-攪拌-倒入紙杯-剩餘補水`);
    R(pmt, 'L', cat, `pearl:2 ${tea}:200@s creamer:4@s sugar:60@s`, 'steam stir shake', 'topWater', `雪克杯盛${tn}-蒸汽機加熱-加奶精-攪拌-加蔗糖、冰塊-搖茶-倒入紙杯-剩餘補水（杯底珍珠2勺）`, SHK);
    R(pmt, 'M-熱', cat, `pearl:2 ${tea}:200@s creamer:4@s sugar:50@s`, 'steam stir', 'topWater', `雪克杯盛${tn}-蒸汽機加熱-加奶精-加蔗糖-攪拌-倒入紙杯-剩餘補水（杯底珍珠2勺）`);
    R(ol, 'L', cat, `${teaCold}:200 milk:200 sugar:50`, 'stir', 'topTea', `杯底加入冷縮茶、牛奶、蔗糖、冰塊、攪拌、剩餘補${tn}`, CUP);
    R(ol, 'M', cat, `${teaCold}:150 milk:150 sugar:40`, 'stir', 'topTea', `杯底加入冷縮茶、牛奶、蔗糖、冰塊、攪拌、剩餘補${tn}`, CUP);
    R(ol, 'M-熱', cat, `${teaCold}:200@s milk:${olHotMilk}@s sugar:40@s`, 'stir steam', 'topTea', `雪克杯加入冷縮茶、牛奶、蔗糖-攪拌-蒸汽機加熱-倒入紙杯-剩餘補${tn}`);
  };
  milkTea('紅茶系列', '熟成奶茶', '熟成珍奶', '熟成紅茶歐蕾', 'black', 'black_cold', 150);
  milkTea('四季青系列', '四季青奶茶', '四季青珍奶', '四季青歐蕾', 'qing', 'qing_cold', 150);
  const C13 = '四季青系列';
  R('四季青寒天波椰', 'L', C13, 'pearl:1 coconut:1 agar:1 qing:150@s sugar:60@s', 'shake', 'topWater', '1.杯底加入三種料（珍珠1勺、椰果1勺、寒天1勺）2.雪克杯盛青茶、蔗糖、冰塊-搖茶-倒入紙杯 3.剩餘補水', SHK);
  R('四季青寒天波椰', 'M-熱', C13, 'pearl:1 coconut:1 agar:1 qing:150@s sugar:50@s', 'stir steam', 'topWater', '1.杯底加入三種料 2.雪克杯盛青茶、蔗糖-攪拌-蒸汽機加熱-倒入紙杯 3.剩餘補水');
  R('蜂蜜四季青', 'L', C13, 'qing:200@s honey:50@s sugar:15@s', 'stir shake', 'topWater', '雪克杯盛青茶-加入蜂蜜-攪拌-加入蔗糖、冰塊-搖茶-倒入紙杯-剩餘補水', SHK);
  R('蜂蜜四季青', 'M-熱', C13, 'qing:200@s honey:25@s sugar:15@s', 'stir steam', 'topWater', '雪克杯盛青茶-加入蜂蜜、蔗糖-攪拌-蒸汽機加熱-倒入紙杯-剩餘補水');
  milkTea('鐵觀音系列', '鐵觀音奶茶', '鐵觀音珍奶', '鐵觀音歐蕾', 'tgy', 'tgy_cold', 200);
  const C14 = '鐵觀音系列';
  R('梅子鐵觀音', 'L', C14, 'plum:5 tgy:150@s sugar:60@s', 'shake', 'topWater', '1.杯底加入梅粉 2.雪克杯盛鐵觀音-加入蔗糖、冰塊-搖茶-倒入紙杯 3.剩餘補水', SHK);
  R('梅子鐵觀音', 'M-熱', C14, 'plum:5 tgy:150@s sugar:50@s', 'stir steam', 'topWater', '1.杯底加入梅粉 2.雪克杯盛鐵觀音-加入蔗糖-攪拌-蒸汽機加熱-倒入紙杯 3.剩餘補水');

  // ===== 仙草系列 =====
  const C15 = '仙草系列';
  R('仙草鐵觀音', 'L', C15, 'grass:3 tgy:150@s sugar:60@s', 'shake', 'topWater', '1.杯底加入仙草凍 2.雪克杯盛鐵觀音-加入蔗糖、冰塊-搖茶-倒入紙杯 3.剩餘補水', SHK);
  R('仙草鐵觀音', 'M-熱', C15, 'grass:2 tgy:150@s sugar:50@s', 'stir steam', 'topWater', '1.杯底加入仙草凍 2.雪克杯盛鐵觀音-加蔗糖-攪拌-蒸汽機加熱-倒入紙杯 3.剩餘補水');
  R('仙草鮮奶', 'L', C15, 'grass:3 milk:200 sugar:50', '', 'topWater', '杯底加入仙草凍、牛奶、蔗糖、冰塊-剩餘補水', CUP);
  R('仙草鮮奶', 'M-熱', C15, 'grass:2 milk:200@s sugar:40@s', 'stir steam', 'topWater', '1.杯底加入仙草凍 2.雪克杯盛牛奶-加入蔗糖-攪拌-蒸汽機加熱-倒入紙杯 3.剩餘補水');
  R('仙草蜂蜜', 'L', C15, 'grass:3 honey:40@s sugar:15@s hot:-1@s', 'stir shake', 'topWater', '1.杯底加入仙草凍 2.雪克杯盛蜂蜜-加入適量熱水-攪拌-搖茶-倒入紙杯 3.剩餘補水', SHK);
  R('仙草蜂蜜', 'M-熱', C15, 'grass:2 honey:25@s sugar:15@s hot:-1@s', 'stir', 'topWater', '1.杯底加入仙草凍 2.雪克杯盛蜂蜜-加入適量熱水-攪拌-倒入紙杯 3.剩餘補（熱）水');

  const CATEGORIES = [...new Set(list.map(r => r.cat))];
  const DATA = { ING, VESSELS, ACTIONS, FINISH, ICE_LEVELS, RECIPES: list, CATEGORIES, VERSION: '斗六店 v3' };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  global.RECIPE_DATA = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
