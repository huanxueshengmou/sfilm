// 导演层：每帧建立画面描述 F（机位 / 背景 / 三组粒子 / 后期），分派给当前场景；统一处理 cue 冲击、字幕、章节标
(function () {
  const DIR = (window.DIR = {});
  const SCN = (window.SCN = {});
  const K = C.COL;

  // ---- 粒子形状构造（参数语义见 gl.js 的 shape()）----
  const S = (window.S = {
    none: () => ({ id: 0, P: [0, 0, 0, 1], Q: [0, 0, 0, 0], R: [0, 0, 0, 0] }),
    ball: (x, y, z, r, o = {}) => ({ id: 1, P: [x, y, z, r], Q: [o.surf ?? 0.35, o.turb ?? 0.22, o.freq ?? 2.2, o.squash ?? 1], R: [o.spin ?? 0.12, 0, 0, 0] }),
    crystal: (x, y, z, r, o = {}) => ({ id: 2, P: [x, y, z, r], Q: [o.rot ?? 0.5, o.rotx ?? 0.15, o.core ?? 0.16, o.jit ?? 0.018], R: [0, 0, 0, 0] }),
    atlas: (name, x, y, z, s = 1, o = {}) => ({ id: 3, P: [x, y, z, s], Q: [SH.slot(name), SH.count(name), o.zj ?? 0.06, o.xyj ?? 0.012], R: [o.rotY ?? 0, o.wave ?? 0, o.wfreq ?? 1, 0] }),
    stream: (a, b, o = {}) => ({ id: 4, P: [a[0], a[1], a[2] ?? 0, o.w ?? 0.25], Q: [b[0], b[1], b[2] ?? 0, o.bulge ?? 1], R: [o.speed ?? 0.25, o.spiral ?? 1.5, 0, 0] }),
    path: (name, o = {}) => ({ id: 5, P: [o.x ?? 0, o.y ?? 0, o.z ?? 0, o.s ?? 1], Q: [SH.slot(name), SH.count(name), o.w ?? 0.08, o.speed ?? 0.2], R: [o.spiral ?? 3, 0, 0, 0] }),
    galaxy: (x, y, z, r, o = {}) => ({ id: 6, P: [x, y, z, r], Q: [o.arms ?? 3, o.twist ?? 4, o.thick ?? 0.15, o.rot ?? 0.1], R: [o.tiltX ?? 0.9, o.tiltZ ?? 0.2, 0, 0] }),
    butterfly: (x, y, z, s, o = {}) => ({ id: 7, P: [x, y, z, s], Q: [o.flap ?? 1.4, o.amp ?? 0.9, o.yaw ?? 0, o.pitch ?? 0], R: [0, 0, 0, 0] }),
    field: (x, y, z, o = {}) => ({ id: 8, P: [x, y, z, 1], Q: [o.sx ?? 24, o.sy ?? 14, o.sz ?? 12, o.drift ?? 0.15], R: [o.rise ?? 0, 0, 0, 0] }),
    ring: (x, y, z, r, o = {}) => ({ id: 9, P: [x, y, z, r], Q: [o.minor ?? 0.1, o.tiltX ?? 1.2, o.tiltZ ?? 0, o.rot ?? 0.2], R: [0, 0, 0, 0] }),
    inflow: (x, y, z, rOut, o = {}) => ({ id: 10, P: [x, y, z, rOut], Q: [o.rin ?? 0.5, o.speed ?? 0.3, o.swirl ?? 2, o.out ? 1 : 0], R: [0, 0, 0, 0] }),
    swarm: (x, y, z, r, o = {}) => ({ id: 11, P: [x, y, z, r], Q: [o.n ?? 400, o.cr ?? 0.08, o.speed ?? 0.25, 0], R: [0, 0, 0, 0] }),
    larva: (x, y, z, len, o = {}) => ({ id: 12, P: [x, y, z, len], Q: [o.segs ?? 9, o.rad ?? 0.45, o.crawl ?? 0.45, o.hump ?? 0.5], R: [0, 0, 0, 0] }),
  });
  DIR.S = S;

  function grp() {
    return { on: false, A: S.none(), B: S.none(), mix: 0, stag: 0, smode: 0, arc: 0, noise: [0, 1, 0.2, 0], rot: [0, 0, 0, 0], rotx: [0, 0],
      burst: [0, 0, 0, 0], colA: C.lin(K.gold), colB: C.lin(K.gold), colC: C.lin(K.hot, 2), size: 0.022, bright: 0.5, alpha: 1, reveal: 1,
      twinkle: 0.3, grad: false, spark: 0.012, pulse: [0, 0, 0, 0], pulseWK: [0.3, 0], mb: 1, trail: 0, shutter: 0.5, n: 0 };
  }
  // 设置一组粒子：from → to，k 为形变进度
  DIR.set = (g, o) => {
    g.on = true;
    if (o.from) g.A = o.from;
    g.B = o.to || g.A;
    for (const k in o) if (k !== 'from' && k !== 'to') g[k] = o[k];
    if (!o.to) g.mix = 0;
    return g;
  };

  function frame(t) {
    return {
      t,
      cam: { eye: [0, 0, 20], at: [0, 0, 0], fov: 30.23, roll: 0 },
      bg: { top: C.lin('#07080f'), bot: C.lin('#020205'), nebA: [0.06, 0.03, 0.012], nebB: [0.01, 0.025, 0.06], neb: 0, stars: 0, drift: [0, 0],
        glow: [960, 540, 500, 0], glowC: [1.0, 0.45, 0.12], glow2: [960, 540, 400, 0], glowC2: [0.15, 0.6, 1.0], gridK: 0, gridC: [0.25, 0.35, 0.5] },
      g: [grp(), grp(), grp()],
      post: { bloomK: 0.8, thr: 0.85, knee: 0.55, exp: 1.0, ca: 0.0, grain: 0.032, vig: 0.4, flash: 0, flashCol: '#ffffff', fade: 0, sat: 1.08,
        letter: 0, glitch: 0, haze: 0, hazeR: [0.5, 0.5, 0, 0], tint: [1, 1, 1], lift: [0, 0, 0], contrast: 1.03, shocks: [], frontGain: 1.0, backGain: 1.0 },
      shake: 0,
    };
  }

  // 世界坐标（z=0 平面，默认机位）↔ 画面像素
  DIR.px = (x, y) => [960 + x * 100, 540 - y * 100];
  DIR.wd = (px, py) => [(px - 960) / 100, (540 - py) / 100];

  function cueFX(t, F) {
    for (const c of C.cues) {
      const dt = t - c.t;
      if (dt < -0.001 || dt > 1.8) continue;
      if (c.flash) { const k = c.flash * Math.exp(-dt / 0.13); if (k > F.post.flash) { F.post.flash = k; F.post.flashCol = c.flashCol || '#ffffff'; } }
      if (c.shock) F.post.shocks.push([c.sx ?? 0.5, c.sy ?? 0.5, dt * 0.95, c.shock * Math.exp(-dt / 0.55)]);
      if (c.shake) F.shake += c.shake * Math.exp(-dt / 0.3);
      if (c.ca) F.post.ca += c.ca * Math.exp(-dt / 0.3) * 3.5;
    }
  }

  // ---- 字幕（UI 层，不受后期影响）----
  const SUBS = [];
  for (const id in TL.lines) {
    const ph = TL.lines[id].phrases;
    ph.forEach((p, i) => {
      const next = ph[i + 1];
      const end = next ? Math.min(next.a - 0.04, p.b + 0.5) : p.b + 0.55;
      SUBS.push({ a: p.a - 0.05, b: Math.max(end, p.a + 0.5), s: p.sub });
    });
  }
  SUBS.sort((x, y) => x.a - y.a);
  function subtitles(t, ui) {
    for (const s of SUBS) {
      if (t < s.a - 0.2 || t > s.b + 0.2) continue;
      const a = C.vis(t, s.a, s.b, 0.1, 0.12);
      if (a <= 0.01) continue;
      const ctx = ui.ctx;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 2;
      D.text(ctx, s.s, 960, 1012, { size: 38, w: 500, col: '#f4f6fb', a, track: 1 });
      ctx.restore();
    }
  }

  // ---- 章节标：先在中央闪现，再收到左上角 ----
  function chapter(t, S0, F, L) {
    if (!S0.chapter) return;
    const first = TL.lines[S0.lines[0]].start;
    const a0 = S0.start + 0.05, mv = first - 0.35;
    const inK = C.p(t, a0, 0.55, C.ease.outCubic);
    const mvK = C.p(t, mv, 0.6, C.ease.inOutCubic);
    const outA = C.vis(t, a0, S0.end - 0.5, 0.2, 0.4);
    if (outA <= 0) return;
    const ctx = L.ui.ctx;
    const x = C.lerp(960, 110, mvK), y = C.lerp(520, 92, mvK), s = C.lerp(1, 0.34, mvK);
    ctx.save();
    ctx.globalAlpha = outA;
    ctx.translate(x, y); ctx.scale(s, s);
    const title = S0.title;
    const tw = D.width(title, D.F(900, 92), 10);
    const ox = mvK > 0.5 ? tw / 2 + 120 : 0;
    ctx.translate(ox * C.smooth((mvK - 0.5) * 2), 0);
    // 光条
    const sweep = C.p(t, a0, 0.9, C.ease.outExpo);
    const gr = ctx.createLinearGradient(-700, 0, 700, 0);
    gr.addColorStop(0, 'rgba(255,177,59,0)'); gr.addColorStop(0.5, 'rgba(255,210,140,0.95)'); gr.addColorStop(1, 'rgba(57,215,255,0)');
    ctx.fillStyle = gr;
    ctx.globalAlpha = outA * (1 - mvK) * (1 - sweep * 0.6);
    ctx.fillRect(-700 * sweep, 62, 1400 * sweep, 3);
    ctx.globalAlpha = outA;
    D.text(ctx, S0.chapter, -tw / 2 - 90, 0, { size: 64, w: 700, fam: 'Mono', col: K.gold, a: inK, glow: 18, gcol: K.amber });
    D.kin(ctx, title, 0, 0, t, a0, { size: 92, w: 900, track: 10, stag: 0.05, from: 1.35, blur: 18, col: '#ffffff', glow: mvK > 0.5 ? 0 : 24, gcol: 'rgba(255,190,110,0.8)' });
    ctx.restore();
  }

  DIR.frame = function (t) {
    G.beginLayers();
    const F = frame(t);
    const L = G.layers;
    const sc = TL.scenes.find((s) => t >= s.start && t < s.end) || TL.scenes[TL.scenes.length - 1];
    const fn = SCN[sc.id];
    cueFX(t, F);
    if (fn) fn(t, F, L, sc);
    chapter(t, sc, F, L);
    subtitles(t, L.ui);
    // 抖动：确定性噪声驱动机位
    if (F.shake > 0.001) {
      const s = F.shake * 0.16;
      const n = [C.noise1(t * 31 + 1.3), C.noise1(t * 29 + 7.1), C.noise1(t * 23 + 4.4)];
      F.cam.eye = F.cam.eye.map((v, i) => v + n[i] * s);
      F.cam.at = F.cam.at.map((v, i) => v + n[i] * s * 0.6);
      F.cam.roll += C.noise1(t * 17 + 2.2) * s * 0.05;
    }
    return F;
  };
})();
