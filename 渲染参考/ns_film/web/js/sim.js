// 流体时间线：按"纪元"（场景起点）重置；任意帧可确定性重放到位（分段渲染/探针与整片连续渲染结果一致）
(function () {
  const SIM = (window.SIM = { f: null, epoch: null });
  const DT = 1 / 60;
  SIM.epochs = []; // 起始帧（升序）
  SIM.build = function () {
    const s = new Set([0]);
    for (const sc of DIR.scenes) {
      s.add(Math.round(sc.t0 * 60));
      for (const r of sc.resets || []) s.add(Math.round(r * 60));
    }
    SIM.epochs = [...s].sort((a, b) => a - b);
  };
  const epochOf = (f) => { let e = 0; for (const q of SIM.epochs) if (q <= f) e = q; return e; };
  const nextEpoch = (f) => SIM.epochs.find((q) => q > f) ?? 1e9;

  // 每步给场景的上下文：注入接口 + 当步参数
  function ctx(g) {
    const t = g / 60;
    const S = {
      t, dt: DT, g,
      // 某时刻 T 是否落在本步（最近帧）
      at: (T) => Math.round(T * 60) === g,
      in: (a, b) => t >= a && t < b,
      p: { velDiss: 0.25, dyeDiss: 0.04, vort: 18, iters: 22, field: [], wind: null },
      dye: (x, y, r, c, hard) => G.splatDye(x, y, r, c, hard),
      vel: (x, y, r, vx, vy) => G.splatVel(x, y, r, vx, vy),
      // 用画布画一张印模：draw(ctx)；dye=k 注入墨（按 rgb 通道）；vel={k,push:[vx,vy],cx,cy,boom}
      stamp: (draw, o = {}) => {
        const L = G.layers.stamp;
        G.clearLayer(L);
        L.ctx.save(); draw(L.ctx); L.ctx.restore();
        let up = true;
        if (o.dye) { G.stampDye(L, o.dye); up = false; }
        if (o.vel) { const v = o.vel; G.stampVel(L, v.k ?? 1, v.push || [0, 0], v.cx ?? 960, v.cy ?? 540, v.boom || 0, up); }
      },
      fade: (k) => G.scaleDye(k),
    };
    return S;
  }

  function stepAt(g) {
    const t = g / 60;
    const S = ctx(g);
    for (const sc of DIR.scenes) if (sc.sim && t >= sc.t0 && t < sc.t1) sc.sim(t, S);
    // 纪元末尾自动褪墨，重置点在视觉上不可见
    const ne = nextEpoch(g) / 60;
    if (ne - t < 0.75) S.p.dyeDiss += 7 * C.smooth((0.75 - (ne - t)) / 0.75);
    G.fluidStep({ dt: DT, velDiss: S.p.velDiss, dyeDiss: S.p.dyeDiss, vort: S.p.vort, iters: S.p.iters, field: S.p.field, wind: S.p.wind });
  }

  SIM.to = function (f) {
    if (SIM.f === f) return;
    const e = epochOf(f);
    if (SIM.f === null || SIM.epoch !== e || SIM.f > f) {
      G.fluidReset(); SIM.f = e - 1; SIM.epoch = e;
    }
    const reg = T.reg; T.reg = null;
    while (SIM.f < f) { SIM.f++; stepAt(SIM.f); }
    T.reg = reg;
  };
})();
