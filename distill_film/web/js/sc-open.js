// 开场（冷开场）与片名：万亿参数的“熔金之球” → 读尽文字 → 坍缩成奇点 → 爆裂成「蒸馏」
(function () {
  const K = C.COL, S = DIR.S, set = DIR.set;
  const L1 = 'op1', L2 = 'op2', L3 = 'op3', L4 = 'op4', LT = 'ti1';

  SH.need('title', (n) => SH.text(n, '蒸馏', '900 300px NSC', { cw: 1100, ch: 460, track: 28, edge: 0.5, depth: 0.2 }));

  const WORDS = ['维基百科', '代码', '论文', '小说', '新闻', '对话', '教科书', '网页', 'arXiv', 'GitHub', '诗歌', '法律条文',
    '菜谱', '论坛', '专利', '字幕', '邮件', '数学题', '评论', '百科全书', 'Stack Overflow', '古籍'];

  const ball = (r, o = {}) => S.ball(0, 0, 0, r, { surf: o.surf ?? 0.62, turb: o.turb ?? 0.07, freq: o.freq ?? 2.6, spin: o.spin ?? 0.16 });
  DIR.teacherBall = ball;

  // 画面里球心与半径（像素），随机位变化
  function ballScreen(F, R) {
    const z = F.cam.eye[2], pxu = 540 / (z * Math.tan((F.cam.fov * Math.PI) / 360));
    return [960 + (0 - F.cam.at[0]) * pxu, 540 - (0 - F.cam.at[1]) * pxu, R * pxu];
  }

  function warnTag(ctx, t, t0, x, y, zh, en, bx, by) {
    if (t < t0) return;
    const a = C.vis(t, t0, 15.0, 0.18, 0.5);
    const sp = C.spring(t - t0, 2.6, 0.45);
    ctx.save();
    ctx.globalAlpha = a;
    // 引线
    const k = C.p(t, t0, 0.35, C.ease.outCubic);
    ctx.strokeStyle = 'rgba(255,110,70,0.75)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 96, y); ctx.lineTo(C.lerp(x - 96, bx, k), C.lerp(y, by, k)); ctx.stroke();
    ctx.fillStyle = '#ff6a45'; ctx.beginPath(); ctx.arc(bx, by, 4 * k, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, y); ctx.scale(C.lerp(0.6, 1, sp), C.lerp(0.6, 1, sp));
    D.card(ctx, -96, -38, 192, 76, { r: 10, stroke: 'rgba(255,106,69,0.9)', glow: 16, gcol: '#ff4a2a', fillTop: 'rgba(60,14,8,0.7)', fillBot: 'rgba(24,6,4,0.75)' });
    ctx.fillStyle = '#ff6a45';
    ctx.beginPath(); ctx.moveTo(-70, 10); ctx.lineTo(-56, -14); ctx.lineTo(-42, 10); ctx.closePath(); ctx.fill();
    D.text(ctx, '!', -56, 2, { size: 18, w: 900, col: '#1a0503' });
    D.text(ctx, zh, 12, -6, { size: 34, w: 900, col: '#fff1ea' });
    D.text(ctx, en, 12, 24, { size: 13, w: 600, fam: 'Grot', col: 'rgba(255,170,150,0.9)', track: 3 });
    ctx.restore();
  }

  SCN.open = function (t, F, L, sc) {
    const gold = C.lin(K.gold), hot = C.lin(K.hot);
    const tImp = C.A(L4, 1) - 0.1, tEnd = sc.end;
    // 机位：远处诞生 → 缓推 → 拉远露出手机作比例 → 末段推近奇点
    const pull = C.p(t, 0.5, 9.5, C.ease.inOutSine), pull2 = C.p(t, C.A(L3, 0) - 0.4, 5.5, C.ease.inOutSine);
    const push = C.p(t, tImp, tEnd - tImp, C.ease.inCubic);
    const z = C.lerp(C.lerp(C.lerp(31, 19.5, pull), 27, pull2), 16, push);
    const sx = 2.3 * pull2 * (1 - push);
    F.cam.eye = [sx + Math.sin(t * 0.11) * 0.9, 0.5 * Math.sin(t * 0.07), z];
    F.cam.at = [sx, 0, 0];
    F.post.letter = 1 + 0.55 * C.p(t, tImp, tEnd - tImp - 0.2, C.ease.inOutCubic);
    F.post.bloomK = 0.85; F.post.vig = 0.6;
    // G0：老师——熔金之球（26 万颗中的 13 万）
    const born = C.p(t, C.A(L1, 0) - 0.3, 2.8, C.ease.outCubic);
    const imp = C.p(t, tImp, 2.35, C.ease.inQuart);
    const R = 4.2;
    const g0 = set(F.g[0], { from: S.ball(0, 0, 0, 0.06, { surf: 0.1 }), to: ball(R), mix: born, stag: 0.8, smode: 0,
      colA: C.lin(K.hot, 4), colB: C.mixv(gold, hot, 0.3), colC: C.lin('#fff3d6', 2.0), size: 0.02, bright: 0.52, spark: 0.004,
      twinkle: 0.3, noise: [0.035, 1.4, 0.25, 0], mb: born < 0.98 ? 2 : 1, trail: 0.01 });
    // 诞生前：黑暗中一粒随心跳明灭的火种
    if (born <= 0) { set(g0, { from: S.ball(0, 0, 0, 0.04, { surf: 0.1 }), n: 1500, bright: 0.5 + 0.5 * Math.pow(Math.max(0, Math.sin(t * Math.PI * 2)), 8), alpha: C.smooth(t / 0.8) }); }
    if (imp > 0) {
      set(g0, { from: ball(R), to: S.ball(0, 0, 0, 0.05, { surf: 0.1, turb: 0 }), mix: imp, stag: 0.35, smode: 2, arc: 1.6 * (1 - imp),
        colA: C.mixv(gold, hot, 0.3), colB: C.lin('#fff6e8', 3), bright: 0.52, alpha: 1 - 0.97 * C.smooth((imp - 0.75) / 0.25) });
      g0.rot = [0, 0, 0, imp * imp * 8.0];
      g0.mb = 3; g0.trail = 0.012;
    }
    g0.bright *= 1 + 0.4 * C.vis(t, C.A(L2, 1), C.B(L2, 1) + 0.2, 0.4, 0.9);
    g0.pulse = [0, 0, 0, C.fract(t * 0.32) * 5.2]; g0.pulseWK = [0.28, 0.45 * (1 - imp) * born];
    // 奇点：坍缩后的静默里微微颤动
    if (t > tImp + 2.35) { g0.noise = [0.015, 6, 3, 0]; g0.n = 1500; g0.alpha = 1; g0.bright = 0.6; }
    // G2：文字尘埃汇入
    const inA = C.vis(t, C.A(L2, 0) - 0.5, C.B(L2, 1) + 0.4, 0.8, 1.2);
    if (inA > 0) set(F.g[2], { from: S.inflow(0, 0, 0, 13, { rin: 4.1, speed: 0.26, swirl: 1.3 }), colA: C.lin('#ffe6bf', 1.3),
      colB: C.lin('#ffcf8a', 1.6), grad: true, size: 0.017, bright: 0.5, alpha: inA, twinkle: 0.6, spark: 0.004 });
    // G1：环绕老师的粒子环（公转）
    const ringA = C.vis(t, C.A(L1, 1) - 0.5, tImp + 0.6, 1.5, 0.8);
    if (ringA > 0) set(F.g[1], { from: S.ring(0, 0, 0, C.lerp(9, 6.4, C.p(t, C.A(L1, 1) - 0.5, 3, C.ease.outCubic)), { minor: 0.55, tiltX: 1.22, tiltZ: 0.28, rot: 0.14 }),
      to: S.ball(0, 0, 0, 0.05), mix: imp, stag: 0.3, smode: 0, colA: C.lin('#ffd9a0', 1.0), colB: C.lin('#fff6e8', 2), size: 0.016, bright: 0.3,
      alpha: ringA, twinkle: 0.6, spark: 0.01, noise: [0.12, 0.8, 0.3, 0] });
    F.bg.stars = 0.9 * C.vis(t, 0.5, tImp + 1.0, 2.5, 1.0);
    // 背景
    F.bg.neb = 0.35 * (1 - imp) * born; F.bg.nebA = [0.05, 0.02, 0.006]; F.bg.nebB = [0.01, 0.008, 0.028];
    const [bx, by, br] = ballScreen(F, R);
    F.bg.glow = [bx, by, br * 1.35, 0.09 * born * (1 - imp)]; F.bg.glowC = C.lin(K.amber);
    F.bg.glow2 = [bx, by, 26, 1.2 * C.smooth((t - tImp - 1.8) / 0.6)]; F.bg.glowC2 = C.lin('#fff0d0');

    const ctx = L.front.ctx;
    // 左侧 HUD：参数计数
    const hA = C.vis(t, C.A(L1, 1) - 0.3, C.B(L2, 0) + 0.4, 0.4, 0.6);
    if (hA > 0) {
      const k = C.p(t, C.A(L1, 1), 2.4, C.ease.outExpo);
      const v = Math.pow(10, 12 * k);
      D.brk(ctx, 110, 360, 470, 250, 18, 'rgba(255,190,110,0.8)', hA, 2);
      D.text(ctx, 'PARAMETERS · 参数', 140, 400, { size: 20, w: 600, fam: 'Grot', col: '#ffcf8a', a: hA, align: 'left', track: 5 });
      D.text(ctx, D.num(k > 0.999 ? 1e12 : v), 140, 480, { size: 60, w: 700, fam: 'Mono', col: '#fff', a: hA, align: 'left', glow: 18, gcol: '#ffb13b' });
      D.text(ctx, '万亿级 · TRILLION-SCALE', 140, 560, { size: 22, w: 500, col: 'rgba(255,220,180,0.85)', a: hA * C.p(t, C.A(L1, 1) + 1.6, 0.5), align: 'left', track: 3 });
    }
    // 海量文字飞入
    const tw0 = C.A(L2, 0) - 0.3;
    if (t > tw0 && t < C.B(L2, 1) + 1.5) {
      WORDS.forEach((w, i) => {
        const ts = tw0 + i * 0.16, dur = 2.4;
        const u = (t - ts) / dur;
        if (u < 0 || u > 1) return;
        const ang = C.hash(i * 7.1) * Math.PI * 2, r0 = 1050 + C.hash(i * 3.3) * 180;
        const e = C.ease.inCubic(u);
        const r = C.lerp(r0, br * 0.95, e);
        const x = bx + Math.cos(ang) * r * 1.15, y = by + Math.sin(ang) * r * 0.72;
        D.text(ctx, w, x, y, { size: 26 + C.hash(i) * 14, w: 500, col: '#ffe9cc', a: C.smooth(u / 0.2) * (1 - C.smooth((u - 0.7) / 0.3)) * 0.85, blur: e * 2 });
      });
    }
    // 警示标签
    const pA = C.A(L2, 2), pB = C.A(L2, 3);
    const tagX = bx + br + 250;
    warnTag(ctx, t, pA, tagX, by - 210, '庞大', 'MASSIVE', bx + br * 0.72, by - br * 0.62);
    warnTag(ctx, t, pA + 0.85, tagX + 40, by, '昂贵', 'COSTLY', bx + br * 0.98, by);
    warnTag(ctx, t, pB, tagX, by + 210, '耗电', 'POWER-HUNGRY', bx + br * 0.72, by + br * 0.62);
    // 手机：装得下吗？
    const phT = C.A(L3, 2) - 0.1;
    const phA = C.vis(t, phT, tImp + 1.2, 0.3, 0.6);
    if (phA > 0) {
      const cx = 1560, cy = 560;
      const k = C.p(t, phT, 0.7, C.ease.outCubic);
      ctx.save();
      ctx.globalAlpha = phA;
      ctx.translate(cx, cy); ctx.scale(1.55, 1.55);
      D.poly(ctx, [[-26, -50], [26, -50], [34, -42], [34, 42], [26, 50], [-26, 50], [-34, 42], [-34, -42], [-26, -50]], k, { col: '#8feaff', lw: 2.4, glow: 18, gcol: '#39d7ff' });
      ctx.restore();
      const yes = C.A(L4, 0);
      const q = C.vis(t, phT + 0.6, yes - 0.05, 0.3, 0.15);
      D.text(ctx, '?', cx, cy, { size: 84, w: 900, col: '#bff6ff', a: phA * q, glow: 20, gcol: '#39d7ff' });
      const dot = C.smooth((t - yes) / 0.12) * phA;
      if (dot > 0) {
        const pulse = 1 + 0.5 * C.hit(t, yes, 0.35);
        const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70 * pulse);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(160,240,255,0.9)'); gr.addColorStop(1, 'rgba(57,215,255,0)');
        ctx.save(); ctx.globalAlpha = dot; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, 70 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      D.text(ctx, 'YOUR PHONE', cx, cy + 118, { size: 16, w: 600, fam: 'Grot', col: '#8feaff', a: phA * k, track: 6 });
    }
  };

  // ---- 片名 ----
  SCN.title = function (t, F, L, sc) {
    const T = sc.start;
    const gold = C.lin(K.gold), hot = C.lin(K.hot);
    F.post.letter = 1.55 * (1 - C.p(t, T, 0.5, C.ease.outCubic));
    F.post.bloomK = 0.9;
    F.cam.eye = [0, 0, C.lerp(20.5, 18.6, C.p(t, T, sc.end - T, C.ease.outSine))];
    // 爆裂成字
    const k = C.p(t, T, 1.15, C.ease.outExpo);
    const g0 = set(F.g[0], { from: S.ball(0, 0, 0, 0.05, { surf: 0.1, turb: 0 }), to: S.atlas('title', 0, 1.0, 0, 1, { wave: 0.02, wfreq: 0.8 }),
      mix: k, stag: 0.45, arc: 3.2, colA: C.lin('#fff6e8', 5), colB: C.mixv(hot, gold, 0.4), colC: C.lin('#ffffff', 2.0),
      size: 0.017, bright: 0.28, spark: 0.008, twinkle: 0.55, mb: k < 0.95 ? 3 : 1, trail: 0.02 });
    g0.pulse = [0, 1.0, 0, (t - T - 1.0) * 6]; g0.pulseWK = [0.5, 1.0 * C.vis(t, T + 1.0, T + 2.6, 0.1, 0.4)];
    // 结尾：字化为液滴流下（交给 craft 场景的烧瓶）
    if (SCN.craftMelt) SCN.craftMelt(t, F);
    // G1：冲击环
    const rk = C.p(t, T, 1.5, C.ease.outCubic);
    set(F.g[1], { from: S.ring(0, 0.4, 0, C.lerp(0.3, 12, rk), { minor: 0.08 + rk * 0.5, tiltX: 1.5708, rot: 0.25 }),
      colA: C.lin('#fff1dc', 2), size: 0.02, bright: 0.28, alpha: 1 - C.smooth((rk - 0.25) / 0.75), twinkle: 0.2 });
    // G2：余烬上升
    set(F.g[2], { from: S.field(0, -1, 0, { sx: 26, sy: 14, sz: 10, drift: 0.2, rise: 0.5 }), colA: C.lin('#ffae5a', 1.2), size: 0.02, bright: 0.35,
      alpha: C.vis(t, T + 0.3, sc.end - 0.8, 0.8, 0.8), twinkle: 1.0, spark: 0.03 });
    F.bg.glow = [960, 440, 560, 0.07 * C.vis(t, T, sc.end - 1, 0.1, 1.0)]; F.bg.glowC = C.lin(K.amber);
    F.bg.neb = 0.25; F.bg.nebA = [0.05, 0.02, 0.005];
    // 清晰字形叠加
    const ctx = L.front.ctx;
    const tA = C.vis(t, T + 0.75, T + 4.4, 0.6, 0.6);
    if (tA > 0) {
      const gr = ctx.createLinearGradient(0, 300, 0, 580);
      gr.addColorStop(0, '#fff8ea'); gr.addColorStop(0.6, '#ffd08a'); gr.addColorStop(1, '#ff8f2e');
      ctx.save();
      ctx.shadowColor = 'rgba(255,140,50,0.8)'; ctx.shadowBlur = 30;
      D.text(ctx, '蒸馏', 960, 440, { size: 300, w: 900, track: 28, fill: gr, a: tA * 0.5 });
      D.text(ctx, '蒸馏', 960, 440, { size: 300, w: 900, track: 28, noFill: true, stroke: 1.6, scol: 'rgba(255,245,225,0.9)', a: tA });
      ctx.restore();
    }
    const e1 = T + 1.1;
    const out = T + 4.2;
    D.kin(ctx, 'DISTILLATION', 960, 650, t, e1, { size: 38, w: 500, fam: 'Grot', track: 30, col: '#ffe7c2', from: 1.2, blur: 10, stag: 0.03, out, glow: 14, gcol: '#ff9b3d' });
    const lk = C.p(t, e1, 0.8, C.ease.outCubic) * (1 - C.p(t, out, 0.4));
    if (lk > 0) {
      const g1 = ctx.createLinearGradient(560, 0, 1360, 0);
      g1.addColorStop(0, 'rgba(255,177,59,0)'); g1.addColorStop(0.5, 'rgba(255,200,120,0.9)'); g1.addColorStop(1, 'rgba(255,177,59,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(960 - 420 * lk, 612, 840 * lk, 2);
      ctx.fillRect(960 - 420 * lk, 688, 840 * lk, 2);
    }
    D.kin(ctx, '把大模型的智慧，浓缩成一滴', 960, 740, t, T + 1.6, { size: 34, w: 300, track: 8, col: '#f3e6d8', from: 1.1, blur: 8, stag: 0.035, out: out + 0.1, dur: 0.5 });
  };
})();
