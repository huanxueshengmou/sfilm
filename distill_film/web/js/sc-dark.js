// 02 暗知识：硬标签 → 宝马照片 → 教师的软答案 → 暗知识 → 加热（温度 T 下的 softmax 实时计算）→ 学生模仿 → 没见过「3」却认出 98.6%
(function () {
  const K = C.COL, S = DIR.S, set = DIR.set;
  const L1 = 'dk1', L2 = 'dk2', L3 = 'dk3', L4 = 'dk4', L5 = 'dk5',
    L6 = 'dk6', L7 = 'dk7', L8 = 'dk8', L9 = 'dk9', L10 = 'dk10';

  // 示意用 logits（汽车 ≫ 垃圾车 > 公交车 ≫ 猫 ≫ 胡萝卜）
  const CAT = [
    { zh: '汽车', icon: 'car', z: 10.0 }, { zh: '垃圾车', icon: 'truck', z: 6.1 }, { zh: '公交车', icon: 'bus', z: 5.2 },
    { zh: '猫', icon: 'cat', z: 1.5 }, { zh: '胡萝卜', icon: 'carrot', z: -3.8 }];
  const soft = (T) => { const e = CAT.map((c) => Math.exp(c.z / T)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };
  const fmt = (p) => { const pc = p * 100; if (pc >= 9.5) return pc.toFixed(0) + '%'; if (pc >= 0.95) return pc.toFixed(1) + '%'; return pc.toPrecision(1) + '%'; };
  const BX = [880, 1080, 1280, 1480, 1680], BASE = 770, BH = 470, BW = 110;

  SH.need('three', (n) => SH.text(n, '3', '900 760px NSerif', { cw: 900, ch: 900, edge: 0.45, depth: 0.6 }));

  // MNIST 网格：18 × 6，约 10% 是 3
  const GC = 18, GR = 6, CELL = 78, GX = 960 - (GC * CELL) / 2 + CELL / 2, GY = 262;
  const DIGS = (() => { const R = C.rng(2015); const a = []; for (let i = 0; i < GC * GR; i++) { let d = (R() * 10) | 0; if (R() < 0.06) d = 3; a.push(d); } return a; })();
  const ORDER = DIGS.map((_, i) => i).sort((p, q) => C.hash(p * 3.7) - C.hash(q * 3.7));

  function chart(ctx, t, P, o) {
    const a = o.a;
    if (a <= 0.003) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.strokeStyle = 'rgba(200,215,240,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(BX[0] - 110, BASE); ctx.lineTo(BX[4] + 110, BASE); ctx.stroke();
    CAT.forEach((c, i) => {
      const p = P[i], h = Math.max(2, p * BH), x = BX[i] - BW / 2;
      const dk = i > 0 ? o.dark : 0;
      const col = o.hard ? '#f4f7ff' : i === 0 ? o.mainCol : dk > 0.01 ? `rgba(${C.lerp(255, 170, dk) | 0},${C.lerp(170, 120, dk) | 0},${C.lerp(80, 255, dk) | 0},1)` : o.sideCol;
      const g = ctx.createLinearGradient(0, BASE - h, 0, BASE);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.save();
      ctx.shadowColor = dk > 0.01 ? K.violet : i === 0 ? o.glowCol : o.glowCol; ctx.shadowBlur = 18 + 20 * dk;
      ctx.fillStyle = g; ctx.fillRect(x, BASE - h, BW, h);
      ctx.fillStyle = col; ctx.fillRect(x, BASE - h, BW, 3);
      ctx.restore();
      D.icon(ctx, c.icon, BX[i], BASE + 54, 0.58, { col: dk > 0.01 ? '#c9b6ff' : 'rgba(225,232,248,0.9)', lw: 2, glow: dk > 0.01 ? 12 : 0, gcol: K.violet });
      D.text(ctx, c.zh, BX[i], BASE + 112, { size: 26, w: 500, col: '#e8ecf6' });
      if (o.values) D.text(ctx, fmt(p), BX[i], BASE - h - 26, { size: 26, w: 700, fam: 'Mono', col: dk > 0.01 ? '#d9ccff' : '#fff', a: o.values, glow: dk > 0.01 ? 14 : 0, gcol: K.violet });
    });
    ctx.restore();
  }

  function thermo(ctx, x, T, a) {
    if (a <= 0.003) return;
    ctx.save();
    ctx.globalAlpha *= a;
    const top = 250, bot = 740, lev = C.lerp(bot, top + 20, C.clamp((T - 1) / 7));
    ctx.strokeStyle = 'rgba(230,236,250,0.8)'; ctx.lineWidth = 2.5; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 8;
    D.rrect(ctx, x - 22, top, 44, bot - top + 20, 22); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, bot + 52, 44, 0, Math.PI * 2); ctx.stroke();
    const g = ctx.createLinearGradient(0, top, 0, bot + 90);
    g.addColorStop(0, '#fff2c8'); g.addColorStop(0.5, '#ff8a2a'); g.addColorStop(1, '#ff3b1a');
    ctx.fillStyle = g; ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 30;
    D.rrect(ctx, x - 11, lev, 22, bot + 40 - lev, 11); ctx.fill();
    ctx.beginPath(); ctx.arc(x, bot + 52, 32, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(230,236,250,0.5)'; ctx.lineWidth = 1.5;
    for (let i = 0; i <= 7; i++) { const y = C.lerp(bot, top + 20, i / 7); ctx.beginPath(); ctx.moveTo(x + 30, y); ctx.lineTo(x + (i % 7 === 0 ? 52 : 42), y); ctx.stroke(); }
    ctx.restore();
    D.text(ctx, 'T = ' + T.toFixed(1), x + 70, lev, { size: 46, w: 700, fam: 'Mono', col: '#fff4df', align: 'left', a, glow: 18, gcol: '#ff8a2a' });
    D.text(ctx, 'TEMPERATURE · 温度', x, top - 40, { size: 18, w: 600, fam: 'Grot', col: '#ffb37a', track: 5, a });
  }

  SCN.dark = function (t, F, L, sc) {
    const T0 = sc.start, TE = sc.end;
    const ctx = L.front.ctx;
    const gold = C.lin(K.gold), hot = C.lin(K.hot), vio = C.lin(K.violet), cyan = C.lin(K.cyan), ice = C.lin(K.ice);
    const tHard = C.A(L1, 0), tPhoto = C.A(L2, 0), tSoft = C.A(L2, 2), tDark = C.A(L4, 0), tWord = C.A(L4, 2), tWeak = C.A(L5, 0);
    const tHeat = C.A(L6, 1), tForm = C.A(L7, 0), tRise = C.A(L7, 1) - 0.1, tUp = C.A(L7, 4), tStu = C.A(L8, 0), tGrid = C.A(L9, 0) - 0.3;
    const t3 = C.A(L9, 1), tGone = C.A(L9, 2), tLeg = C.A(L9, 4), tCal = C.A(L10, 1), tDrop = C.A(L10, 2);
    F.post.bloomK = 0.8;

    // ---------- 柱状图段（硬标签 → 软答案 → 升温 → 学生模仿）----------
    const chA = C.vis(t, tHard - 0.2, tGrid - 0.2, 0.4, 0.6);
    const Tt = 1 + 7 * C.p(t, tRise, tUp - tRise - 0.1, C.ease.inOutCubic);
    const toSoft = C.p(t, tSoft, 0.6, C.ease.outCubic);
    const P = soft(Tt).map((p, i) => C.lerp(i === 0 ? 1 : 0, p, toSoft));
    const dark = Math.max(C.vis(t, tDark + 0.3, tWeak + 0.2, 0.6, 0.8), C.vis(t, tUp - 0.1, tGrid - 0.4, 0.4, 0.4));
    const heat = C.vis(t, tHeat, tGrid - 0.4, 0.4, 0.6);
    if (chA > 0) {
      const hot2 = C.clamp((Tt - 1) / 7);
      chart(ctx, t, P, { a: chA, hard: toSoft <= 0.001, values: C.p(t, tSoft + 0.2, 0.4), dark,
        mainCol: hot2 > 0 ? `rgb(255,${C.lerp(190, 140, hot2) | 0},${C.lerp(90, 60, hot2) | 0})` : '#ffcf8a', sideCol: '#ffcf8a', glowCol: K.amber });
      const head = toSoft <= 0.001 ? ['标准答案', 'HARD LABEL · 非此即彼'] : Tt < 1.05 ? ['教师的回答', 'TEACHER · T = 1'] : ['教师的软化回答', 'SOFT TARGETS · T = ' + Tt.toFixed(1)];
      const hA = chA * (1 - C.vis(t, tWord - 0.3, tWeak + 0.3, 0.2, 0.4)) * (1 - C.vis(t, tForm - 0.2, 1e9, 0.3, 0.3));
      D.text(ctx, head[0], 1280, 196, { size: 40, w: 900, col: '#fff', a: hA });
      D.text(ctx, head[1], 1280, 244, { size: 18, w: 600, fam: 'Grot', col: toSoft > 0 ? '#ffcf8a' : '#dfe6f5', track: 5, a: hA });
      D.text(ctx, '示意 · ILLUSTRATIVE', BX[4] + 70, BASE + 150, { size: 14, w: 500, fam: 'Grot', col: 'rgba(200,210,230,0.5)', align: 'right', track: 3, a: chA * toSoft });
    }
    // 宝马照片（被教师“看见”）
    const phA = C.vis(t, tPhoto - 0.1, tHeat - 0.6, 0.4, 0.5);
    if (phA > 0) {
      D.card(ctx, 150, 330, 480, 360, { a: phA, r: 14, stroke: 'rgba(255,210,150,0.5)', fillTop: 'rgba(30,26,24,0.72)', fillBot: 'rgba(12,10,10,0.8)' });
      D.brk(ctx, 138, 318, 504, 384, 26, '#ffcf8a', phA, 2);
      const dk = C.p(t, tPhoto, 1.4, C.ease.inOutCubic);
      ctx.save(); ctx.globalAlpha *= phA; ctx.translate(390, 520); ctx.scale(3.1, 3.1);
      ctx.beginPath(); D.ICON.car(ctx); ctx.restore();
      ctx.save(); ctx.globalAlpha *= phA; ctx.setLineDash([2400]); ctx.lineDashOffset = 2400 * (1 - dk);
      ctx.translate(390, 520); ctx.scale(3.1, 3.1); ctx.lineWidth = 2.4 / 3.1; ctx.strokeStyle = '#ffd9a0'; ctx.shadowColor = K.amber; ctx.shadowBlur = 14;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); D.ICON.car(ctx); ctx.stroke(); ctx.restore();
      const sy = C.lerp(340, 680, C.fract((t - tPhoto) * 0.7));
      ctx.save(); ctx.globalAlpha *= phA * 0.8; const sg = ctx.createLinearGradient(0, sy - 30, 0, sy + 2);
      sg.addColorStop(0, 'rgba(255,200,120,0)'); sg.addColorStop(1, 'rgba(255,220,160,0.55)'); ctx.fillStyle = sg; ctx.fillRect(160, sy - 30, 460, 32); ctx.restore();
      D.text(ctx, 'IMG · 宝马 BMW', 390, 660, { size: 18, w: 600, fam: 'Grot', col: '#ffcf8a', track: 4, a: phA });
    }
    // 教师（照片背后）
    const tA = C.vis(t, tPhoto - 0.3, tHeat - 0.7, 0.6, 0.5);
    if (tA > 0) set(F.g[0], { from: DIR.teacher({ x: -5.7, y: 0.2, r: 2.3 }), colA: C.mixv(gold, hot, 0.3 + 0.4 * heat), size: 0.018, bright: 0.26 + 0.1 * heat,
      alpha: tA, spark: 0.004, noise: [0.03 + 0.06 * heat, 2.2, 0.6 + heat, 0] });
    // 输出流：照片 → 柱状图
    const flA = C.vis(t, C.A(L2, 1), tDark, 0.4, 0.6);
    if (flA > 0) set(F.g[2], { from: S.stream([-3.2, 0.1, 0], [-0.7, -0.6, 0], { w: 0.3, bulge: 0.6, speed: 0.5, spiral: 1 }), grad: true,
      colA: C.lin('#ffcf8a', 1.2), colB: C.lin('#ffe6bf', 1.6), size: 0.014, bright: 0.45, alpha: flA });
    // 放大镜：垃圾车 → 胡萝卜
    const lensA = C.vis(t, C.A(L3, 1) - 0.3, tDark - 0.1, 0.3, 0.4);
    if (lensA > 0) {
      const mv = C.p(t, C.A(L3, 2) - 0.2, 0.7, C.ease.inOutCubic);
      const lx = C.lerp(BX[1], BX[4], mv), ly = BASE - 30;
      const idx = mv < 0.5 ? 1 : 4;
      ctx.save(); ctx.globalAlpha *= lensA;
      ctx.beginPath(); ctx.arc(lx, ly, 96, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10,12,20,0.75)'; ctx.fill();
      ctx.save(); ctx.clip();
      const mh = Math.min(170, 12 + Math.log10(P[idx] * 1e7) * 22);
      ctx.fillStyle = '#ffcf8a'; ctx.shadowColor = K.amber; ctx.shadowBlur = 16; ctx.fillRect(lx - 30, ly + 80 - mh, 60, mh);
      ctx.restore();
      ctx.strokeStyle = '#f4f7ff'; ctx.lineWidth = 3; ctx.shadowColor = '#fff'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(lx, ly, 96, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx + 68, ly + 68); ctx.lineTo(lx + 120, ly + 120); ctx.lineWidth = 7; ctx.stroke();
      ctx.restore();
      D.text(ctx, fmt(P[1]), BX[1], 440, { size: 64, w: 700, fam: 'Mono', col: '#ffe0b0', a: lensA * C.vis(t, C.A(L3, 1), 1e9, 0.2, 0.2), glow: 20, gcol: K.amber });
      D.text(ctx, '有一点点像', BX[1], 500, { size: 24, w: 500, col: '#ffd9a8', a: lensA * C.p(t, C.A(L3, 1) + 0.2, 0.3) });
      const ca = lensA * C.vis(t, C.A(L3, 2), 1e9, 0.2, 0.2);
      D.text(ctx, fmt(P[4]), BX[4] - 40, 440, { size: 64, w: 700, fam: 'Mono', col: '#ffe0b0', a: ca, glow: 20, gcol: K.amber });
      D.text(ctx, '几乎不可能', BX[4] - 40, 500, { size: 24, w: 500, col: '#ffd9a8', a: ca * C.p(t, C.A(L3, 2) + 0.2, 0.3) });
    }
    // 暗知识
    const dW = C.vis(t, tWord - 0.02, tWeak + 0.2, 0.05, 0.6);
    if (dW > 0) {
      D.stat(ctx, '暗知识', 1280, 250, t, tWord - 0.02, { size: 150, w: 900, fam: 'NSC', col: '#efe7ff', glow: 44, gcol: K.violet, a: dW, from: 2.2, track: 16 });
      D.text(ctx, 'DARK KNOWLEDGE', 1280, 345, { size: 24, w: 600, fam: 'Grot', col: '#c9b6ff', track: 14, a: dW * C.p(t, tWord + 0.2, 0.5) });
    }
    const vA = Math.max(C.vis(t, tDark + 0.2, tWeak + 0.4, 0.8, 0.8), 0.8 * C.vis(t, tUp, tGrid - 0.5, 0.5, 0.5));
    if (vA > 0) set(F.g[1], { from: S.field(1.8, -1.4, 0, { sx: 8.5, sy: 5, sz: 3, drift: 0.2, rise: 0.45 }), colA: vio, size: 0.016, bright: 0.45, alpha: vA, twinkle: 1.0, spark: 0.02 });
    F.bg.glow2 = [1280, 600, 700, 0.07 * dark]; F.bg.glowC2 = vio;
    // 加热
    const thA = C.vis(t, tHeat - 0.15, tStu - 0.2, 0.3, 0.5);
    thermo(ctx, 300, Tt, thA);
    if (heat > 0) {
      F.post.haze = 0.75 * heat; F.post.hazeR = [0.66, 0.36, 0.42, 0];
      F.bg.glow = [1280, 1080, 900, 0.1 * heat]; F.bg.glowC = C.lin(K.amber);
      if (t < tStu - 0.2) set(F.g[2], { from: S.field(1.8, -0.8, 0, { sx: 9, sy: 7, sz: 3, drift: 0.2, rise: 1.1 }), colA: C.lin('#ffb060', 1.4), size: 0.014, bright: 0.45,
        alpha: heat * C.vis(t, tHeat, tStu - 0.4, 0.3, 0.4), twinkle: 1.2, spark: 0.03 });
    }
    const fA = C.vis(t, tForm - 0.1, tStu - 0.3, 0.4, 0.4);
    if (fA > 0) {
      const k = C.p(t, tForm - 0.1, 0.6, C.ease.outCubic);
      D.softmax(ctx, 900, 205, 56, { a: fA * k, col: '#f6f1ff', hi: Tt > 1.05 ? '#ffb13b' : '#ffd08a', glow: 12, gcol: 'rgba(255,190,120,0.7)' });
      D.text(ctx, '温度 T 越高 → 分布越柔和', 1560, 205, { size: 24, w: 500, col: '#ffd08a', a: fA * C.p(t, C.A(L7, 2), 0.5), align: 'left' });
    }
    // 学生模仿软答案
    const sA = C.vis(t, tStu - 0.2, tGrid - 0.3, 0.5, 0.5);
    if (sA > 0) {
      const conv = C.p(t, tStu + 0.4, 2.2, C.ease.inOutCubic);
      set(F.g[1], { from: S.none(), to: DIR.student({ x: -6.3, y: 1.6, r: 0.62 }), mix: C.p(t, tStu - 0.2, 0.8, C.ease.outCubic), stag: 0.5, smode: 2, colB: C.mixv(cyan, ice, 0.5),
        size: 0.016, bright: 0.3, spark: 0.01, twinkle: 0.4 });
      set(F.g[2], { from: S.stream([1.8, -0.2, 0], [-5.6, 1.4, 0], { w: 0.3, bulge: 1.6, speed: 0.45, spiral: 1.4 }), grad: true, colA: C.lin('#d9ccff', 1.4),
        colB: C.lin('#8feaff', 1.6), size: 0.014, bright: 0.45, alpha: sA * (1 - conv * 0.6) });
      const R = C.rng(99);
      const rand = CAT.map(() => 0.1 + R() * 0.5);
      ctx.save(); ctx.globalAlpha *= sA;
      ctx.strokeStyle = 'rgba(160,230,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(170, 800); ctx.lineTo(500, 800); ctx.stroke();
      CAT.forEach((c, i) => {
        const p = C.lerp(rand[i], P[i], conv), h = Math.max(2, p * 230), x = 190 + i * 64;
        ctx.fillStyle = i === 0 ? '#bff6ff' : '#9fd9ff'; ctx.shadowColor = K.cyan; ctx.shadowBlur = 14; ctx.fillRect(x, 800 - h, 44, h);
      });
      ctx.restore();
      D.text(ctx, '学生的答案', 335, 850, { size: 26, w: 700, col: '#dffaff', a: sA });
      D.text(ctx, 'STUDENT · 模仿软答案', 335, 886, { size: 15, w: 600, fam: 'Grot', col: K.cyan, track: 4, a: sA });
      const w1 = C.vis(t, C.A(L8, 1), tGrid - 0.4, 0.3, 0.4), w2 = C.vis(t, C.A(L8, 2), tGrid - 0.4, 0.3, 0.4);
      if (w1 > 0) { D.brk(ctx, BX[0] - 70, 250, 140, 30, 14, '#ffffff', w1, 2); D.kin(ctx, '是什么', BX[0], 215, t, C.A(L8, 1), { size: 40, w: 900, col: '#fff', a: w1 }); }
      if (w2 > 0) { D.brk(ctx, BX[1] - 70, 420, BX[3] - BX[1] + 140, 30, 14, '#c9b6ff', w2, 2);
        D.kin(ctx, '像什么', (BX[1] + BX[3]) / 2, 385, t, C.A(L8, 2), { size: 40, w: 900, col: '#efe7ff', glow: 26, gcol: K.violet, a: w2 }); }
    }

    // ---------- MNIST：拿走所有的 3 ----------
    const gA = C.vis(t, tGrid, TE - 0.6, 0.3, 0.5);
    if (gA > 0) {
      const dim = 1 - 0.6 * C.vis(t, C.A(L9, 3), tDrop - 0.05, 0.8, 0.1);
      const fill = (i) => { const x = i % GC, y = (i / GC) | 0; const d = Math.hypot(x - GC / 2, (y - GR / 2) * 1.4); return tDrop + d * 0.035; };
      ctx.save(); ctx.globalAlpha *= gA;
      D.text(ctx, 'MNIST 手写数字 · 迁移集', 960, 170, { size: 30, w: 700, col: '#eef2fb', a: C.p(t, tGrid, 0.5) * dim });
      D.text(ctx, '所有的「3」都被拿走', 960, 212, { size: 22, w: 500, col: '#ff8f8f', a: C.p(t, tGone, 0.4) * dim * (1 - C.p(t, tDrop, 0.3)) });
      DIGS.forEach((d, i) => {
        const cx = GX + (i % GC) * CELL, cy = GY + ((i / GC) | 0) * CELL;
        const ap = C.p(t, tGrid + ORDER.indexOf(i) * 0.012, 0.3);
        if (d !== 3) { D.digit(ctx, d, cx, cy, 52, i, { col: '#e9eef8', a: ap * dim * 0.9 }); return; }
        const red = C.vis(t, t3, tGone + 0.3, 0.2, 0.3);
        const gone = C.p(t, tGone, 0.6, C.ease.inCubic);
        if (gone < 1) D.digit(ctx, 3, cx, cy - gone * 30, 52, i, { col: red > 0 ? '#ffb0b0' : '#e9eef8', a: ap * (1 - gone), glow: red * 18, gcol: K.red, });
        if (red > 0) { ctx.save(); ctx.strokeStyle = K.red; ctx.lineWidth = 2; ctx.globalAlpha *= red; ctx.shadowColor = K.red; ctx.shadowBlur = 12; D.rrect(ctx, cx - 33, cy - 33, 66, 66, 10); ctx.stroke(); ctx.restore(); }
        const empty = C.p(t, tGone + 0.3, 0.4) * (1 - C.p(t, fill(i), 0.15));
        if (empty > 0) { ctx.save(); ctx.globalAlpha *= empty * dim; ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(220,230,250,0.55)'; ctx.lineWidth = 1.5; D.rrect(ctx, cx - 30, cy - 30, 60, 60, 10); ctx.stroke(); ctx.restore(); }
        const got = C.p(t, fill(i), 0.25, C.ease.outCubic);
        if (got > 0) { const pop = 1 + 0.5 * C.hit(t, fill(i), 0.2); D.digit(ctx, 3, cx, cy, 52 * pop, i, { col: '#dffcff', a: got, glow: 26, gcol: K.cyan }); }
      });
      ctx.restore();
      // 传说中的数字
      const lg = C.vis(t, C.A(L9, 3), tDrop - 0.05, 1.2, 0.05);
      if (lg > 0) {
        D.text(ctx, '3', 960, 520, { size: 760, w: 900, fam: 'NSerif', col: '#b69cff', a: lg * 0.22, blur: 16 });
        D.text(ctx, '传说中的数字', 960, 900, { size: 34, w: 300, col: '#d9ccff', track: 12, a: lg * C.p(t, tLeg, 0.8), glow: 18, gcol: K.violet });
      }
      const g3 = C.vis(t, C.A(L9, 3) + 0.3, tDrop, 1.4, 0.02);
      if (g3 > 0) {
        const charge = C.p(t, C.A(L10, 0), tDrop - C.A(L10, 0), C.ease.inQuad);
        set(F.g[0], { from: S.atlas('three', 0, 0.2, 0, 1, { zj: 0.4 }), colA: C.mixv(vio, cyan, charge), colB: C.mixv(vio, cyan, charge), size: 0.017, bright: 0.18 + 0.3 * charge,
          alpha: g3, twinkle: 0.8, noise: [0.04 + 0.12 * charge, 1.5, 0.6 + 2 * charge, 0], spark: 0.01 });
      }
      if (t >= tDrop) set(F.g[0], { from: S.atlas('three', 0, 0.2, 0, 1, { zj: 0.4 }), colA: cyan, size: 0.017, bright: 0.5, alpha: 1 - C.p(t, tDrop, 1.2),
        burst: [0, 0.2, 0, C.p(t, tDrop, 1.3, C.ease.outCubic) * 9], spark: 0.02 });
      // 校准偏置
      const cA = C.vis(t, tCal - 0.1, tDrop + 0.2, 0.3, 0.3);
      if (cA > 0) {
        const v = 3.5 * C.p(t, tCal + 0.1, 0.8, C.ease.inOutCubic);
        ctx.save(); ctx.globalAlpha *= cA;
        ctx.strokeStyle = 'rgba(220,230,250,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(760, 820); ctx.lineTo(1160, 820); ctx.stroke();
        const kx = C.lerp(960, 1160, v / 3.5 * 0.9);
        ctx.fillStyle = '#8feaff'; ctx.shadowColor = K.cyan; ctx.shadowBlur = 16; ctx.fillRect(960, 818, kx - 960, 4);
        ctx.beginPath(); ctx.arc(kx, 820, 10, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        D.text(ctx, '「3」的偏置  +' + v.toFixed(1), 960, 780, { size: 26, w: 600, fam: 'NSC', col: '#dffaff', a: cA });
      }
      if (t >= tDrop) {
        const hA = C.vis(t, tDrop, TE - 0.7, 0.02, 0.5);
        ctx.save(); ctx.globalAlpha *= hA; ctx.fillStyle = 'rgba(2,4,10,0.55)'; ctx.fillRect(0, 380, 1920, 330); ctx.restore();
        D.stat(ctx, '98.6%', 960, 520, t, tDrop, { size: 230, w: 700, col: '#f2feff', gcol: K.cyan, glow: 50, a: hA });
        D.text(ctx, '的「3」被认了出来', 960, 660, { size: 36, w: 500, col: '#dffaff', track: 6, a: hA * C.p(t, tDrop + 0.3, 0.4) });
      }
      F.bg.glow = [960, 520, 720, 0.08 * C.vis(t, tDrop, TE - 1, 0.05, 1)]; F.bg.glowC = cyan;
    }
  };
})();
