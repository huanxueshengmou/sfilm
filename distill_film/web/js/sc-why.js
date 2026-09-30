// 03 为什么要蒸馏：「大」的代价（参数、算力、电力）→ 学生更小更快更便宜，装进手机/汽车/眼镜 → DistilBERT → 今天的轻量模型
(function () {
  const K = C.COL, S = DIR.S, set = DIR.set;
  const L1 = 'wy1', L2 = 'wy2', L3 = 'wy3', L4 = 'wy4', L5 = 'wy5';

  SH.need('da', (n) => SH.text(n, '大', '900 560px NSC', { cw: 800, ch: 760, edge: 0.45, depth: 0.3 }));

  const DEV = [{ icon: 'phone', x: 560, y: 650, s: 1.6, w: [-4.0, -1.1] }, { icon: 'car', x: 960, y: 660, s: 1.9, w: [0, -1.1] }, { icon: 'glasses', x: 1360, y: 650, s: 1.7, w: [4.0, -1.1] }];
  const MODELS = [['Gemini Flash', 'Google · 蒸馏自 Gemini Pro'], ['Gemma', 'Google · 知识蒸馏训练'], ['Llama 3.2  1B / 3B', 'Meta · 以 8B / 70B 的 logits 为目标'],
    ['DistilBERT', 'Hugging Face · 2019'], ['R1-Distill', 'DeepSeek · 2025'], ['Qwen3 小模型', '阿里 · 强到弱蒸馏']];

  SCN.why = function (t, F, L, sc) {
    const T0 = sc.start, TE = sc.end;
    const ctx = L.front.ctx;
    const gold = C.lin(K.gold), hot = C.lin(K.hot), cyan = C.lin(K.cyan), ice = C.lin(K.ice), red = C.lin(K.red);
    const tDa = C.A(L1, 1), tCost = C.A(L1, 2), tQ = C.A(L2, 0), tAct = C.A(L2, 1), tPow = C.A(L2, 2), tStu = C.A(L3, 0), tTri = C.A(L3, 1),
      tDev = C.A(L3, 2), tGl = C.A(L3, 3), tDB = C.A(L4, 0) - 0.2, tNow = C.A(L5, 0) - 0.2;
    F.post.bloomK = 0.85;

    // ---------- 「大」→ 教师 ----------
    const daIn = C.p(t, tDa - 0.05, 0.7, C.ease.outExpo);
    const toBall = C.p(t, C.B(L1, 2) - 0.1, 1.3, C.ease.inOutCubic);
    const sink = C.p(t, tCost, 0.5, C.ease.outBack);
    const TB = S.ball(-1.5, 0.3, 0, 3.0, { surf: 0.6, turb: 0.07, freq: 2.6, spin: 0.16 });
    if (t < tStu + 1.6) {
      const heavy = C.vis(t, tCost, C.B(L1, 2) + 0.3, 0.2, 0.6);
      const daShape = S.atlas('da', 0, C.lerp(0.35, -0.05, sink), 0, 1);
      const g0 = F.g[0];
      if (toBall <= 0) set(g0, { from: S.field(0, 0, 0, { sx: 30, sy: 18, sz: 12 }), to: daShape, mix: daIn, stag: 0.35, arc: 2.0,
        colA: C.lin('#fff1dc', 2.5), colB: C.mixv(C.mixv(gold, hot, 0.35), C.lin('#ff5a2a'), heavy * 0.6), size: 0.018, bright: 0.34, spark: 0.008, mb: daIn < 0.97 ? 3 : 1, trail: 0.015,
        alpha: C.smooth((t - tDa + 0.3) / 0.3) });
      else set(g0, { from: daShape, to: TB, mix: toBall, stag: 0.5, arc: 1.5, colA: C.mixv(C.mixv(gold, hot, 0.35), C.lin('#ff5a2a'), 0.3), colB: C.mixv(gold, hot, 0.38),
        size: 0.02, bright: 0.52, spark: 0.004 });
      // 参数激活波纹
      const act = C.vis(t, tAct, tStu, 0.2, 0.6);
      if (act > 0) { g0.pulse = [-1.5, 0.3, 0, C.fract((t - tAct) / 1.2) * 3.4]; g0.pulseWK = [0.35, 2.4 * act]; g0.bright *= 1 + 0.35 * act; }
      const fade = C.p(t, tStu - 0.1, 1.5, C.ease.inOutCubic);
      if (fade > 0) { g0.alpha *= 1 - 0.8 * fade; }
      if (daIn > 0 && toBall < 1) {
        const a = C.vis(t, tDa + 0.2, C.B(L1, 2), 0.3, 0.4);
        D.text(ctx, '大', 960, 540 - C.lerp(35, -5, sink) * 1, { size: 560, w: 900, noFill: true, stroke: 2, scol: `rgba(255,${C.lerp(240, 150, heavy) | 0},${C.lerp(220, 110, heavy) | 0},0.85)`, a, glow: 20, gcol: K.amber });
        D.kin(ctx, '代价', 1510, 700, t, tCost + 0.1, { size: 64, w: 900, col: '#ffd0c0', glow: 24, gcol: K.red, a: C.vis(t, tCost, C.B(L1, 2) + 0.2, 0.1, 0.4) });
      }
      F.bg.glow = [810, 510, 360, 0.1 * toBall * (1 - fade)]; F.bg.glowC = C.lin(K.amber);
      // 一个问题穿进去
      const qk = C.p(t, tQ, 1.4, C.ease.inOutCubic);
      const qa = C.vis(t, tQ - 0.1, tAct + 0.2, 0.2, 0.3);
      if (qa > 0) {
        const x = C.lerp(-260, 700, qk), y = 520;
        D.card(ctx, x - 150, y - 36, 300, 72, { a: qa * (1 - C.smooth((qk - 0.8) / 0.2)), r: 36, stroke: 'rgba(255,230,190,0.7)', glow: 14, gcol: K.amber });
        D.text(ctx, '提问：明天会下雨吗？', x, y, { size: 26, w: 500, col: '#fff3e0', a: qa * (1 - C.smooth((qk - 0.8) / 0.2)) });
      }
      const hA = C.vis(t, tAct + 0.1, tStu - 0.2, 0.3, 0.5);
      if (hA > 0) {
        D.text(ctx, '每生成一个字，都要调动海量参数', 810, 880, { size: 30, w: 500, col: '#ffe6c8', a: hA });
        D.text(ctx, 'EVERY TOKEN · BILLIONS OF PARAMETERS', 810, 922, { size: 15, w: 600, fam: 'Grot', col: K.gold, track: 5, a: hA });
      }
      // 算力与电力
      const pA = C.vis(t, tPow - 0.1, tStu + 0.4, 0.3, 0.5);
      if (pA > 0) {
        D.brk(ctx, 1340, 250, 480, 560, 20, 'rgba(255,110,80,0.8)', pA, 2);
        D.text(ctx, '算力 · GPU', 1380, 290, { size: 24, w: 700, col: '#ffd6c8', a: pA, align: 'left' });
        for (let i = 0; i < 12; i++) {
          const on = C.p(t, tPow + 0.08 * i, 0.2);
          const cx = 1420 + (i % 4) * 100, cy = 370 + ((i / 4) | 0) * 100;
          D.icon(ctx, 'chip', cx, cy, 0.8, { a: pA, col: on > 0.5 ? '#ffb38a' : 'rgba(220,220,235,0.5)', glow: on * 18, gcol: K.red, lw: 2 });
        }
        D.text(ctx, '电力 · POWER', 1380, 690, { size: 24, w: 700, col: '#ffd6c8', a: pA, align: 'left' });
        D.icon(ctx, 'bolt', 1410, 750, 0.6, { a: pA, col: '#ffcf6a', glow: 16, gcol: K.amber, lw: 2.4 });
        const lv = C.p(t, tPow + 0.3, 1.4, C.ease.outCubic);
        ctx.save(); ctx.globalAlpha *= pA; ctx.strokeStyle = 'rgba(255,200,180,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(1450, 735, 330, 30);
        const g = ctx.createLinearGradient(1450, 0, 1780, 0); g.addColorStop(0, '#ffcf6a'); g.addColorStop(0.6, '#ff7a2a'); g.addColorStop(1, '#ff2a2a');
        ctx.fillStyle = g; ctx.shadowColor = K.red; ctx.shadowBlur = 20; ctx.fillRect(1452, 737, 326 * lv, 26); ctx.restore();
      }
    }

    // ---------- 学生：更小 · 更快 · 更便宜 → 装进设备 ----------
    const sIn = C.p(t, tStu - 0.1, 0.8, C.ease.outCubic);
    if (t > tStu - 0.2 && t < tDB + 0.6) {
      let x = 3.2, y = 0.6, r = 0.8;
      const legs = [[tDev - 0.1, DEV[0]], [tDev + 0.9, DEV[1]], [tGl + 0.1, DEV[2]]];
      let prev = [3.2, 0.6];
      for (const [tt, dv] of legs) {
        const k = C.p(t, tt, 0.55, C.ease.inOutCubic);
        if (k <= 0) break;
        x = C.lerp(prev[0], dv.w[0], k); y = C.lerp(prev[1], dv.w[1], k) + Math.sin(k * Math.PI) * 1.2; r = C.lerp(r, 0.34, k);
        prev = dv.w;
      }
      const out = C.p(t, tDB - 0.4, 0.6);
      set(F.g[1], { from: S.none(), to: DIR.student({ x, y, r }), mix: sIn, stag: 0.5, smode: 2, colB: C.mixv(cyan, ice, 0.5), size: 0.016, bright: 0.34 * (1 - out),
        spark: 0.01, twinkle: 0.4, mb: 2, trail: 0 });
      F.bg.glow2 = [960 + x * 100, 540 - y * 100, 200, 0.08 * sIn * (1 - out)]; F.bg.glowC2 = cyan;
      const tri = [['更小', 'SMALLER', 620], ['更快', 'FASTER', 960], ['更便宜', 'CHEAPER', 1300]];
      tri.forEach(([zh, en, xx], i) => {
        const t0 = tTri + i * 0.62;
        const a = C.vis(t, t0, tDB - 0.5, 0.1, 0.4);
        D.kin(ctx, zh, xx, 270, t, t0, { size: 84, w: 900, col: '#eaffff', glow: 26, gcol: K.cyan, a, from: 2.3, stag: 0.05 });
        D.text(ctx, en, xx, 336, { size: 18, w: 600, fam: 'Grot', col: K.cyan, track: 8, a: a * C.p(t, t0 + 0.2, 0.3) });
      });
      DEV.forEach((dv, i) => {
        const t0 = tDev - 0.25 + i * 0.35 + (i === 2 ? tGl - tDev - 0.6 : 0);
        const a = C.vis(t, t0, tDB - 0.5, 0.3, 0.4);
        if (a <= 0) return;
        const arrive = [tDev + 0.45, tDev + 1.45, tGl + 0.65][i];
        const lit = C.smooth((t - arrive) / 0.15);
        D.icon(ctx, dv.icon, dv.x, dv.y, dv.s, { a, col: lit > 0 ? '#bff6ff' : 'rgba(210,225,245,0.75)', glow: 8 + 22 * lit + 30 * C.hit(t, arrive, 0.3), gcol: K.cyan, lw: 2.6 });
        if (lit > 0) D.ico(ctx, dv.x, dv.y - (i === 1 ? 8 : 0), 12, t * 1.5 + i, { a: a * lit, lw: 1.4 });
      });
    }

    // ---------- DistilBERT ----------
    const dbA = C.vis(t, tDB, tNow - 0.1, 0.4, 0.5);
    if (dbA > 0) {
      D.text(ctx, 'DistilBERT', 960, 200, { size: 64, w: 700, fam: 'Grot', col: '#f2feff', a: dbA * C.p(t, tDB, 0.5), glow: 20, gcol: K.cyan });
      D.text(ctx, 'Hugging Face · 2019 · 蒸馏自 BERT', 960, 258, { size: 22, w: 500, col: '#bfe9ff', a: dbA * C.p(t, tDB + 0.2, 0.5), track: 3 });
      const k1 = C.p(t, tDB + 0.3, 0.7, C.ease.outCubic), shr = C.p(t, C.A(L4, 1), 0.7, C.ease.inOutCubic);
      ctx.save(); ctx.globalAlpha *= dbA;
      const bar = (y, w, c1, c2, glow) => { const g = ctx.createLinearGradient(560, 0, 560 + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
        ctx.fillStyle = g; ctx.shadowColor = glow; ctx.shadowBlur = 22; D.rrect(ctx, 560, y, Math.max(8, w), 56, 12); ctx.fill(); };
      bar(350, 800 * k1, '#ffcf8a', '#ff9b3d', K.amber);
      bar(440, 800 * k1 * C.lerp(1, 0.6, shr), '#bff6ff', '#39d7ff', K.cyan);
      ctx.restore();
      D.text(ctx, 'BERT-base', 540, 378, { size: 26, w: 600, fam: 'Grot', col: '#ffe6c8', align: 'right', a: dbA * k1 });
      D.text(ctx, 'DistilBERT', 540, 468, { size: 26, w: 600, fam: 'Grot', col: '#dffaff', align: 'right', a: dbA * k1 });
      D.text(ctx, '1.1 亿参数', 560 + 800 * k1 + 20, 378, { size: 24, w: 500, col: '#ffe6c8', align: 'left', a: dbA * k1 });
      D.text(ctx, '6600 万参数', 560 + 800 * k1 * C.lerp(1, 0.6, shr) + 20, 468, { size: 24, w: 500, col: '#dffaff', align: 'left', a: dbA * shr });
      const st = [['−40%', '体积', C.A(L4, 1), 560, K.cyan], ['+60%', '速度', C.A(L4, 2), 960, K.cyan], ['97%', '语言理解能力', C.A(L4, 3), 1360, '#ffffff']];
      st.forEach(([v, lb, t0, x, c]) => D.stat(ctx, v, x, 700, t, t0, { size: 150, w: 700, col: '#f2feff', gcol: c === '#ffffff' ? K.teal : K.cyan, glow: 36, a: dbA, label: lb, lsize: 30 }));
      const sp = C.vis(t, C.A(L4, 2), C.A(L4, 3) + 0.4, 0.1, 0.5);
      if (sp > 0) set(F.g[2], { from: S.stream([-9, -1.6, 0], [9, -1.6, 0], { w: 1.2, bulge: 0, speed: 1.1, spiral: 0 }), colA: C.lin('#8feaff', 1.2), size: 0.012, bright: 0.4, alpha: sp * 0.8 });
    }

    // ---------- 今天：轻量模型的星环 ----------
    const nA = C.vis(t, tNow, TE - 0.8, 0.5, 0.6);
    if (nA > 0) {
      set(F.g[1], { from: S.none(), to: DIR.student({ x: 0, y: 0.3, r: 0.75 }), mix: C.p(t, tNow, 0.8, C.ease.outCubic), stag: 0.5, smode: 2, colB: C.mixv(cyan, ice, 0.5),
        size: 0.016, bright: 0.34, alpha: nA, spark: 0.01 });
      set(F.g[0], { from: S.ring(0, 0.3, 0, 6.2, { minor: 0.25, tiltX: 1.32, tiltZ: -0.05, rot: 0.25 }), colA: C.lin('#ffd9a0', 0.9), colB: C.lin('#8feaff', 0.9), size: 0.014,
        bright: 0.25, alpha: nA * C.p(t, tNow, 1.0), twinkle: 0.6, spark: 0.01 });
      F.bg.glow2 = [960, 510, 260, 0.1 * nA]; F.bg.glowC2 = cyan;
      const conn = C.vis(t, C.A(L5, 3), TE - 0.8, 0.4, 0.5);
      const cards = MODELS.map((m, i) => {
        const t0 = i < 2 ? C.A(L5, 1) + i * 0.7 : i === 2 ? C.A(L5, 2) : C.A(L5, 3) + (i - 3) * 0.25;
        const th = i * (Math.PI / 3) + (t - tNow) * 0.22 - 0.5;
        return { m, t0, x: 960 + Math.cos(th) * 640, y: 510 + Math.sin(th) * 200, z: Math.sin(th) };
      }).sort((p, q) => p.z - q.z);
      for (const c of cards) {
        const a = nA * C.smooth((t - c.t0) / 0.35);
        if (a <= 0) continue;
        const sc = 0.82 + 0.22 * (c.z + 1) / 2, fa = 0.55 + 0.45 * (c.z + 1) / 2;
        if (conn > 0) D.poly(ctx, [[960, 510], [c.x, c.y]], C.p(t, C.A(L5, 3), 0.6), { a: conn * a * 0.5, col: '#8feaff', lw: 1.5, glow: 10, gcol: K.cyan });
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(sc, sc);
        D.card(ctx, -175, -48, 350, 96, { a: a * fa, r: 14, stroke: 'rgba(160,230,255,0.6)', glow: 16, gcol: K.cyan });
        D.text(ctx, c.m[0], 0, -12, { size: 30, w: 700, fam: 'Grot', col: '#f2feff', a: a * fa });
        D.text(ctx, c.m[1], 0, 24, { size: 17, w: 500, col: '#bfe9ff', a: a * fa });
        ctx.restore();
      }
      D.text(ctx, '蒸馏', 960, 640, { size: 34, w: 900, col: '#dffaff', track: 14, a: nA * C.p(t, tNow + 0.5, 0.5), glow: 20, gcol: K.cyan });
    }
    const outK = C.p(t, TE - 1.0, 0.9, C.ease.inCubic);
    if (outK > 0) for (const g of F.g) g.alpha *= 1 - outK;
  };
})();
