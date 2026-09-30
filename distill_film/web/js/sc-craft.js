// 01 什么是蒸馏：古法蒸馏器（加热 → 汽化 → 冷凝 → 一滴精华）→ 教师与学生 → 2015 论文 → 幼虫与成虫
(function () {
  const K = C.COL, S = DIR.S, set = DIR.set, W2 = DIR.wd;
  const L1 = 'cr1', L2 = 'cr2', L3 = 'cr3', L4 = 'cr4', L5 = 'cr5', L6 = 'cr6';

  // ---- 蒸馏器几何（屏幕像素）----
  const FL = { cx: 420, cy: 700, r: 150 };
  const SWAN = D.bez([420, 470], [420, 380], [520, 318], [640, 330], 18);
  const TUBE = [[640, 330], [1250, 515]];
  const TIP = D.bez([1250, 515], [1275, 522], [1289, 540], [1290, 578], 8);
  const RCV = [[1278, 640], [1278, 705], [1192, 896], [1408, 896], [1322, 705], [1322, 640]];
  const tubeAt = (s, off = 0) => { const [a, b] = TUBE; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return [a[0] + dx * s - (dy / l) * off, a[1] + dy * s + (dx / l) * off]; };
  const FLASK = (() => { const pts = []; const a0 = -Math.PI / 2 + 0.34, a1 = Math.PI * 1.5 - 0.34;
    for (let i = 0; i <= 60; i++) { const a = C.lerp(a0, a1, i / 60); pts.push([FL.cx + Math.cos(a) * FL.r, FL.cy + Math.sin(a) * FL.r]); } return pts; })();
  const NECK_L = [[FL.cx - 26, FL.cy - FL.r * 0.94], [FL.cx - 26, 470], ...D.bez([FL.cx - 26, 470], [394, 360], [510, 292], [640, 304], 16)];
  const NECK_R = [[FL.cx + 26, FL.cy - FL.r * 0.94], [FL.cx + 26, 478], ...D.bez([FL.cx + 26, 478], [446, 392], [530, 346], [640, 356], 16)];
  const vaporPx = [[420, 668], [420, 556], [420, 470], ...SWAN.slice(1), ...[0.1, 0.3, 0.5, 0.7, 0.9, 1].map((s) => tubeAt(s)), ...TIP.slice(1)];

  SH.need('flask', (n) => SH.fromCanvas(n, 1920, 1080, (ctx) => {
    ctx.beginPath(); ctx.arc(FL.cx, FL.cy, FL.r - 12, 0, Math.PI * 2); ctx.clip();
    ctx.fillRect(FL.cx - FL.r, FL.cy - 6, FL.r * 2, FL.r * 2);
  }, { edge: 0.25, depth: 0.5 }));
  SH.need('distill', (n) => SH.fromCanvas(n, 1920, 1080, (ctx) => {
    ctx.beginPath(); ctx.moveTo(1212, 860); ctx.lineTo(1388, 860); ctx.lineTo(1400, 888); ctx.lineTo(1200, 888); ctx.closePath(); ctx.fill();
  }, { edge: 0.2, depth: 0.3 }));
  SH.need('vapor', (n) => SH.path(n, vaporPx.map(([x, y]) => [...W2(x, y), 0]), 1024));

  // 教师与学生的标准站位（世界坐标）
  const TP = [-4.3, 0.4, 0], TR = 2.5, SP = [4.5, 0.4, 0], SR = 0.8;
  DIR.TP = TP; DIR.SP = SP;
  const teacher = (o = {}) => S.ball(o.x ?? TP[0], o.y ?? TP[1], 0, o.r ?? TR, { surf: 0.6, turb: 0.07, freq: 2.6, spin: 0.16 });
  const student = (o = {}) => S.crystal(o.x ?? SP[0], o.y ?? SP[1], 0, o.r ?? SR, { rot: 0.6, rotx: 0.18 });
  DIR.teacher = teacher; DIR.student = student;

  // 片名结尾：「蒸馏」化作液体流进烧瓶（title 与 craft 共用，保证衔接连续）
  SCN.craftMelt = function (t, F) {
    const T0 = C.SC.title.start + 4.4;
    const k = C.p(t, T0, 3.2, C.ease.inOutCubic);
    if (k <= 0) return;
    const g0 = F.g[0];
    set(g0, { from: S.atlas('title', 0, 1.0, 0, 1, { wave: 0.02, wfreq: 0.8 }), to: S.atlas('flask', 0, 0, 0, 1), mix: k, stag: 0.6, smode: 6,
      arc: -1.2, colA: C.mixv(C.lin(K.hot), C.lin(K.gold), 0.4), colB: C.mixv(C.lin(K.gold), C.lin(K.hot), 0.3), size: 0.017, bright: 0.28 + 0.1 * k,
      mb: k > 0.02 && k < 0.98 ? 2 : 1, trail: 0.01 });
  };

  function label(ctx, t, t0, x, y, zh, en, col, o = {}) {
    if (t < t0) return;
    const a = C.vis(t, t0, o.end ?? 1e9, 0.2, 0.4);
    D.kin(ctx, zh, x, y, t, t0, { size: o.size ?? 46, w: 900, col: '#fff', from: 1.6, blur: 12, stag: 0.06, glow: 18, gcol: col, a });
    D.text(ctx, en, x, y + (o.size ?? 46) * 0.8, { size: 16, w: 600, fam: 'Grot', col, track: 6, a: a * C.p(t, t0 + 0.2, 0.4) });
  }

  function apparatus(ctx, t, a, heat) {
    if (a <= 0.003) return;
    const T = C.SC.craft.start;
    const draw = (pts, t0, dur, o) => D.poly(ctx, pts, C.p(t, t0, dur, C.ease.inOutCubic), { a, lw: 2.2, col: 'rgba(210,235,255,0.85)', glow: 10, gcol: 'rgba(150,210,255,0.8)', ...o });
    draw(FLASK, T + 0.1, 1.2);
    draw(NECK_L, T + 0.4, 1.0); draw(NECK_R, T + 0.45, 1.0);
    const j0 = tubeAt(0.1, -24), j1 = tubeAt(0.92, -24), j2 = tubeAt(0.1, 24), j3 = tubeAt(0.92, 24);
    draw([tubeAt(0, -9), tubeAt(1, -9)], T + 0.7, 1.0); draw([tubeAt(0, 9), tubeAt(1, 9)], T + 0.7, 1.0);
    draw([j0, j1], T + 0.9, 1.0, { col: 'rgba(120,220,255,0.9)' }); draw([j2, j3], T + 0.9, 1.0, { col: 'rgba(120,220,255,0.9)' });
    draw([j0, j2], T + 1.5, 0.3, { col: 'rgba(120,220,255,0.9)' }); draw([j1, j3], T + 1.6, 0.3, { col: 'rgba(120,220,255,0.9)' });
    draw([j2, [j2[0] - 8, j2[1] + 46]], T + 1.7, 0.4, { col: 'rgba(120,220,255,0.9)' });
    draw([j1, [j1[0] + 8, j1[1] - 46]], T + 1.7, 0.4, { col: 'rgba(120,220,255,0.9)' });
    // 冷凝盘管
    const coil = [];
    for (let i = 0; i <= 220; i++) { const s = 0.12 + (0.78 * i) / 220; coil.push(tubeAt(s, Math.sin(s * Math.PI * 2 * 11) * 19)); }
    const cool = C.vis(t, C.A(L1, 3) - 0.1, 1e9, 0.4, 0.4);
    draw(coil, T + 1.2, 1.4, { col: `rgba(${C.lerp(150, 90, cool) | 0},${C.lerp(200, 240, cool) | 0},255,${0.55 + 0.4 * cool})`, lw: 1.6, glow: 8 + 16 * cool, gcol: '#39d7ff' });
    draw(TIP, T + 1.4, 0.5);
    draw(RCV, T + 1.0, 1.3);
    // 火焰
    if (heat > 0) {
      const fl = 1 + 0.12 * C.noise1(t * 9) + 0.08 * C.noise1(t * 17 + 3);
      ctx.save(); ctx.globalAlpha *= a * heat;
      const g = ctx.createRadialGradient(420, 885, 2, 420, 870, 60 * fl);
      g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(255,170,60,0.9)'); g.addColorStop(0.7, 'rgba(255,80,20,0.35)'); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(420, 905); ctx.quadraticCurveTo(378, 888, 410, 842 - 18 * fl); ctx.quadraticCurveTo(420, 810 - 26 * fl, 430, 842 - 18 * fl);
      ctx.quadraticCurveTo(462, 888, 420, 905); ctx.fill();
      ctx.restore();
      D.poly(ctx, [[372, 912], [468, 912]], 1, { a: a * 0.7, col: 'rgba(210,235,255,0.8)', lw: 3 });
    }
  }

  SCN.craft = function (t, F, L, sc) {
    const T = sc.start, TE = sc.end;
    const gold = C.lin(K.gold), hot = C.lin(K.hot), cyan = C.lin(K.cyan), ice = C.lin(K.ice);
    const ctx = L.front.ctx;
    const tB = C.A(L2, 0);                 // 进入 AI 语境
    const tPaper = C.A(L4, 0) - 0.2, tLarva = C.A(L5, 0), tFly = C.A(L6, 0);
    const heat = C.p(t, C.A(L1, 1) - 0.1, 0.6);
    const appA = C.vis(t, T, tB + 0.6, 0.01, 0.8);
    F.post.bloomK = 0.85;

    // ---------- A：蒸馏器 ----------
    if (t < tB + 2.0) {
      if (t < T + 1.6) SCN.craftMelt(t, F);
      else set(F.g[0], { from: S.atlas('flask', 0, 0, 0, 1), colA: C.mixv(gold, hot, 0.3 + 0.4 * heat), size: 0.017, bright: 0.3 + 0.2 * heat,
        noise: [0.02 + 0.09 * heat, 3.0, 1.2 + 2.0 * heat, 0], twinkle: 0.5, spark: 0.006 });
      const vap = C.vis(t, C.A(L1, 2) - 0.15, tB + 0.3, 0.8, 0.8);
      if (vap > 0) set(F.g[2], { from: S.path('vapor', { w: 0.1, speed: 0.22, spiral: 2 }), grad: true, colA: C.lin('#ffcf8a', 1.4), colB: C.lin('#8feaff', 1.8),
        size: 0.016, bright: 0.45, alpha: vap, reveal: C.p(t, C.A(L1, 2) - 0.15, 1.6, C.ease.outCubic), twinkle: 0.5 });
      const dist = C.vis(t, C.B(L1, 4) + 0.2, tB + 0.3, 0.6, 0.6);
      if (dist > 0) set(F.g[1], { from: S.atlas('distill', 0, 0, 0, 1), colA: ice, size: 0.018, bright: 0.35, alpha: dist, noise: [0.01, 4, 1, 0] });
      F.post.haze = 0.9 * heat * appA; F.post.hazeR = [420 / 1920, 1 - 830 / 1080, 0.14, 0];
      F.bg.glow = [420, 860, 260, 0.12 * heat * appA]; F.bg.glowC = C.lin(K.amber);
      F.bg.glow2 = [1300, 870, 160, 0.08 * dist]; F.bg.glowC2 = cyan;
      apparatus(ctx, t, appA, heat);
      label(ctx, t, C.A(L1, 1), 230, 830, '加热', 'HEAT', K.amber, { end: tB - 0.3 });
      label(ctx, t, C.A(L1, 2), 330, 330, '汽化', 'VAPORIZE', '#ffcf8a', { end: tB - 0.3 });
      label(ctx, t, C.A(L1, 3), 900, 300, '冷凝', 'CONDENSE', K.cyan, { end: tB - 0.3 });
      label(ctx, t, C.A(L1, 4) + 0.3, 1590, 760, '精华', 'ESSENCE', '#bff6ff', { end: tB - 0.3 });
      // 那一滴：在管口凝结，慢速坠落
      const dt0 = C.A(L1, 4) + 0.2, dHit = C.B(L1, 4) + 0.2;
      if (t > dt0 && t < dHit + 1.4) {
        const fall = C.p(t, dHit - 0.55, 0.55, C.ease.inQuad);
        const grow = C.p(t, dt0, dHit - 0.55 - dt0, C.ease.outCubic);
        const y = C.lerp(588, 858, fall), r = 6 + 6 * grow;
        if (t < dHit) {
          ctx.save(); ctx.globalAlpha *= appA;
          const g = ctx.createRadialGradient(1290, y, 0, 1290, y, r * 4);
          g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(160,240,255,0.95)'); g.addColorStop(1, 'rgba(57,215,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(1290, y, r * 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.moveTo(1290, y - r * 1.9); ctx.quadraticCurveTo(1290 + r, y - r * 0.2, 1290, y + r); ctx.quadraticCurveTo(1290 - r, y - r * 0.2, 1290, y - r * 1.9); ctx.fill();
          ctx.restore();
        }
        const rip = C.p(t, dHit, 1.2, C.ease.outCubic);
        if (rip > 0 && rip < 1) {
          ctx.save(); ctx.globalAlpha *= appA * (1 - rip); ctx.strokeStyle = '#bff6ff'; ctx.lineWidth = 2; ctx.shadowColor = K.cyan; ctx.shadowBlur = 12;
          for (let i = 0; i < 3; i++) { const q = C.clamp(rip * 1.3 - i * 0.15); ctx.beginPath(); ctx.ellipse(1300, 862, 20 + 110 * q, 5 + 14 * q, 0, 0, Math.PI * 2); ctx.stroke(); }
          ctx.restore();
        }
      }
      D.text(ctx, '古法蒸馏 · ALEMBIC', 1650, 190, { size: 18, w: 600, fam: 'Grot', col: 'rgba(200,225,255,0.7)', track: 6, a: appA * C.p(t, T + 1.2, 0.8) });
    }

    // ---------- B：教师与学生 ----------
    const kB = C.p(t, tB, 1.8, C.ease.inOutCubic);
    if (t >= tB && t < tLarva + 1.6) {
      const dim = 1 - 0.55 * C.vis(t, tPaper, tLarva - 0.3, 0.6, 0.6);
      const hiT = C.vis(t, C.A(L2, 3), C.B(L2, 3) + 0.4, 0.3, 0.6), hiS = C.vis(t, C.A(L2, 2), C.B(L2, 2) + 0.3, 0.3, 0.6);
      const g0 = set(F.g[0], { from: S.atlas('flask', 0, 0, 0, 1), to: teacher(), mix: kB, stag: 0.5, arc: 1.6, colA: C.mixv(gold, hot, 0.5),
        colB: C.mixv(gold, hot, 0.38), size: 0.019, bright: (0.55 + 0.25 * hiT) * dim, spark: 0.004, twinkle: 0.3, mb: kB < 0.98 ? 2 : 1, trail: 0.01 });
      g0.pulse = [TP[0], TP[1], 0, C.fract(t * 0.4) * 3.2]; g0.pulseWK = [0.25, 0.5];
      set(F.g[1], { from: S.atlas('distill', 0, 0, 0, 1), to: student(), mix: kB, stag: 0.4, arc: 2.5, colA: ice, colB: C.mixv(cyan, ice, 0.5),
        size: 0.016, bright: (0.26 + 0.25 * hiS) * dim, spark: 0.01, twinkle: 0.4 });
      const sA = C.p(t, tB + 1.0, 1.2) * dim;
      set(F.g[2], { from: S.stream([TP[0] + 2.2, TP[1], 0], [SP[0] - 0.6, SP[1], 0], { w: 0.35, bulge: 1.0, speed: 0.22, spiral: 1.2 }), grad: true,
        colA: C.lin('#ffc978', 1.2), colB: C.lin('#8feaff', 1.5), size: 0.015, bright: 0.4, alpha: sA * (1 - C.p(t, tLarva - 0.2, 0.8)), twinkle: 0.6 });
      F.bg.glow = [530, 500, 330, 0.12 * kB * dim]; F.bg.glowC = C.lin(K.amber);
      F.bg.glow2 = [1410, 500, 200, 0.06 * kB * dim]; F.bg.glowC2 = cyan;
      const lA = C.vis(t, C.A(L3, 0), tPaper + 0.2, 0.2, 0.4);
      if (lA > 0) {
        D.kin(ctx, '教师', 530, 820, t, C.A(L3, 0), { size: 70, w: 900, col: '#fff3dc', glow: 24, gcol: K.amber, a: lA, from: 2.0 });
        D.text(ctx, 'TEACHER · 大模型', 530, 880, { size: 20, w: 600, fam: 'Grot', col: K.gold, track: 6, a: lA * C.p(t, C.A(L3, 0) + 0.2, 0.4) });
        D.kin(ctx, '学生', 1410, 820, t, C.A(L3, 1), { size: 70, w: 900, col: '#eaffff', glow: 24, gcol: K.cyan, a: lA, from: 2.0 });
        D.text(ctx, 'STUDENT · 小模型', 1410, 880, { size: 20, w: 600, fam: 'Grot', col: K.cyan, track: 6, a: lA * C.p(t, C.A(L3, 1) + 0.2, 0.4) });
      }
    }

    // ---------- C：2015 论文 ----------
    const cA = C.vis(t, tPaper, tLarva - 0.2, 0.5, 0.5);
    if (cA > 0) {
      const pk = C.p(t, tPaper, 0.9, C.ease.outBack);
      ctx.save(); ctx.globalAlpha *= cA;
      D.text(ctx, '2015', 960, 232, { size: 190, w: 700, fam: 'Grot', noFill: true, stroke: 2, scol: 'rgba(255,190,110,0.55)', a: C.p(t, tPaper, 1.0), track: 30, glow: 16, gcol: 'rgba(255,150,60,0.6)' });
      ctx.translate(960, 540); ctx.scale(C.lerp(0.85, 1, pk), C.lerp(0.85, 1, pk)); ctx.translate(-960, -540);
      D.card(ctx, 420, 360, 1080, 340, { r: 20, glow: 26, gcol: 'rgba(255,190,110,0.5)', stroke: 'rgba(255,220,170,0.55)', fillTop: 'rgba(28,24,30,0.86)', fillBot: 'rgba(12,10,16,0.9)' });
      D.text(ctx, 'arXiv:1503.02531  [stat.ML]', 470, 410, { size: 20, w: 500, fam: 'Mono', col: 'rgba(200,200,215,0.8)', align: 'left' });
      const hl = C.p(t, C.A(L4, 2) + 0.1, 0.5, C.ease.outCubic);
      D.type(ctx, 'Distilling the Knowledge in a Neural Network', 470, 490, t, C.A(L4, 1) - 0.2, 34, { size: 46, w: 400, fam: 'KMain', col: '#fbf3e6' });
      if (hl > 0) {
        const w = D.width('Distilling', D.F(400, 46, 'KMain'));
        ctx.save(); ctx.fillStyle = K.gold; ctx.shadowColor = K.amber; ctx.shadowBlur = 16; ctx.fillRect(470, 520, w * hl, 4); ctx.restore();
        D.text(ctx, 'Distilling', 470, 490, { size: 46, w: 400, fam: 'KMain', col: '#ffd08a', a: hl, align: 'left', glow: 20, gcol: K.amber });
      }
      D.text(ctx, 'Geoffrey Hinton  ·  Oriol Vinyals  ·  Jeff Dean', 470, 575, { size: 30, w: 500, fam: 'Grot', col: '#e8e4ee', align: 'left', a: C.p(t, C.A(L4, 1), 0.6) });
      D.text(ctx, 'Google Inc.  ·  NIPS 2014 Deep Learning Workshop', 470, 628, { size: 20, w: 400, fam: 'Grot', col: 'rgba(200,200,215,0.7)', align: 'left', a: C.p(t, C.A(L4, 1) + 0.5, 0.6) });
      // 印章
      const st = C.A(L4, 2) + 0.35;
      if (t > st) {
        const k = C.spring(t - st, 3.0, 0.45);
        ctx.save(); ctx.translate(1370, 640); ctx.rotate(-0.16); ctx.scale(C.lerp(2.2, 1, k), C.lerp(2.2, 1, k));
        ctx.globalAlpha *= C.smooth((t - st) / 0.12);
        ctx.strokeStyle = '#ff9b3d'; ctx.lineWidth = 4; ctx.shadowColor = K.amber; ctx.shadowBlur = 18;
        D.rrect(ctx, -110, -56, 220, 112, 14); ctx.stroke();
        D.text(ctx, '蒸馏', 0, -4, { size: 70, w: 900, col: '#ffb13b', track: 8 });
        D.text(ctx, 'DISTILLATION', 0, 40, { size: 13, w: 700, fam: 'Grot', col: '#ffb13b', track: 5 });
        ctx.restore();
      }
      ctx.restore();
    }

    // ---------- D：幼虫 → 蛹 → 成虫 ----------
    if (t >= tLarva - 0.4) {
      const kL = C.p(t, tLarva - 0.2, 1.6, C.ease.inOutCubic);
      const tCry = C.A(L5, 3) - 0.1, tBut = C.A(L5, 4);
      const kC = C.p(t, tCry, tBut - tCry, C.ease.inOutQuad), kF = C.p(t, tBut, 0.9, C.ease.outExpo);
      const larva = S.larva(0, -0.9, 0, 8.2, { segs: 10, rad: 0.5, crawl: 0.5, hump: 0.55 });
      const cocoon = S.ball(0, -0.3, 0, 0.75, { surf: 0.5, turb: 0.05, squash: 1.6, spin: 0.6 });
      const fx = C.p(t, tFly, 2.6, C.ease.inOutCubic);
      const bfly = S.butterfly(C.lerp(0, SP[0], fx), C.lerp(0.35, 1.2, fx), 0, C.lerp(2.5, 1.0, fx), { flap: C.lerp(0.9, 1.6, fx), amp: 0.85, yaw: -0.35 + 0.2 * Math.sin(t * 0.7), pitch: 0.25 });
      const g0 = F.g[0];
      const teal = C.lin(K.teal), vio = C.lin(K.violet);
      if (t < tCry) set(g0, { from: teacher(), to: larva, mix: kL, stag: 0.5, arc: 1.4, colA: C.mixv(gold, hot, 0.3), colB: C.mixv(gold, C.lin('#c8ff6a'), 0.3),
        size: 0.018, bright: 0.42, spark: 0.004, twinkle: 0.3, mb: kL < 0.98 ? 2 : 1, trail: 0.01 });
      else if (t < tBut) set(g0, { from: larva, to: cocoon, mix: kC, stag: 0.3, smode: 1, colA: C.mixv(gold, C.lin('#c8ff6a'), 0.3), colB: C.lin('#ffe9b0', 1.2), size: 0.018, bright: 0.42 + 0.3 * kC });
      else set(g0, { from: cocoon, to: bfly, mix: kF, stag: 0.5, smode: 2, arc: 2.2, colA: C.lin('#ffe9b0', 1.4), colB: C.mixv(cyan, vio, 0.35 + 0.25 * Math.sin(t * 1.3)),
        colC: C.lin('#eaffff', 2), size: 0.017, bright: 0.4, spark: 0.012, twinkle: 0.5, mb: kF < 0.98 ? 3 : 1, trail: 0.02 });
      if (t > tFly + 2.2) set(g0, { from: bfly, to: student(), mix: C.p(t, tFly + 2.2, 0.9, C.ease.inOutCubic), stag: 0.3, colA: C.mixv(cyan, vio, 0.4), colB: C.mixv(cyan, ice, 0.5), size: 0.016, bright: 0.3 });
      // 养分汇入幼虫
      const nut = C.vis(t, C.A(L5, 2) - 0.3, tCry + 0.3, 0.6, 0.5);
      if (nut > 0) set(F.g[2], { from: S.inflow(0, -0.9, 0, 8.5, { rin: 0.8, speed: 0.35, swirl: 0.6 }), grad: true, colA: C.lin('#d8ff9a', 0.8), colB: C.lin('#ffd27a', 1.4),
        size: 0.015, bright: 0.45, alpha: nut, twinkle: 0.6 });
      // 成虫周围的光尘
      const dust = C.vis(t, tBut, TE - 1.0, 0.3, 0.8);
      if (dust > 0) set(F.g[1], { from: S.field(C.lerp(0, SP[0], fx), 0.4, 0, { sx: C.lerp(9, 4, fx), sy: 6, sz: 5, drift: 0.4 }), colA: C.mixv(cyan, vio, 0.5),
        size: 0.014, bright: 0.35, alpha: dust * 0.8, twinkle: 1.2, spark: 0.02 });
      // 左侧重新凝出的教师（训练形态）
      const tk = C.p(t, tFly + 0.3, 1.4, C.ease.outCubic);
      if (tk > 0) set(F.g[2], { from: S.none(), to: teacher(), mix: tk, stag: 0.6, smode: 2, colB: C.mixv(gold, hot, 0.3), size: 0.02, bright: 0.55, spark: 0.004 });
      F.bg.glow = [960, 560, 520, 0.06 * C.vis(t, tBut, tFly + 1, 0.2, 1)]; F.bg.glowC = C.mixv(cyan, vio, 0.4);
      const la = C.vis(t, C.A(L5, 1), tCry - 0.1, 0.3, 0.4);
      if (la > 0) {
        D.kin(ctx, '幼虫', 960, 300, t, C.A(L5, 1), { size: 64, w: 900, col: '#fff', glow: 20, gcol: '#c8ff6a', a: la });
        D.text(ctx, 'LARVA · 汲取养分', 960, 358, { size: 20, w: 600, fam: 'Grot', col: '#d8ff9a', track: 6, a: la * C.p(t, C.A(L5, 1) + 0.3, 0.4) });
      }
      const ba = C.vis(t, tBut + 0.25, tFly - 0.2, 0.3, 0.4);
      if (ba > 0) {
        D.kin(ctx, '成虫', 960, 170, t, tBut + 0.25, { size: 64, w: 900, col: '#fff', glow: 22, gcol: K.cyan, a: ba });
        D.text(ctx, 'ADULT · 远行与繁衍', 960, 228, { size: 20, w: 600, fam: 'Grot', col: '#8feaff', track: 6, a: ba * C.p(t, tBut + 0.5, 0.4) });
      }
      const ea = C.vis(t, tFly + 0.1, TE - 0.9, 0.3, 0.5);
      if (ea > 0) {
        D.kin(ctx, '训练', 530, 830, t, tFly + 0.1, { size: 72, w: 900, col: '#fff3dc', glow: 24, gcol: K.amber, a: ea });
        D.text(ctx, '大而全 · 吸收知识', 530, 892, { size: 24, w: 500, col: K.gold, track: 4, a: ea * C.p(t, tFly + 0.4, 0.4) });
        D.kin(ctx, '部署', 1410, 830, t, tFly + 0.5, { size: 72, w: 900, col: '#eaffff', glow: 24, gcol: K.cyan, a: ea });
        D.text(ctx, '小而快 · 轻装上阵', 1410, 892, { size: 24, w: 500, col: K.cyan, track: 4, a: ea * C.p(t, tFly + 0.8, 0.4) });
      }
    }
    // 场景收尾：粒子散开淡出
    const outK = C.p(t, TE - 1.3, 1.2, C.ease.inCubic);
    if (outK > 0) for (const g of F.g) { g.alpha *= 1 - outK; g.burst = [g.A.P[0], g.A.P[1], 0, outK * 1.5]; }
  };
})();
