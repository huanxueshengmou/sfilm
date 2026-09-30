// 常用动效：笔刷描线/圈注/删除线、砸字、打字机、计数器、纸片文档、流体印字
(function () {
  const FX = (window.FX = {});
  const E = C.ease;

  // 笔刷：沿折线 pts 画出宽度起伏的墨线，p 为绘制进度
  FX.brush = function (x, pts, p, w, col, seed = 1, o = {}) {
    if (p <= 0 || pts.length < 2) return;
    // 累计长度
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[L.length - 1], end = tot * C.clamp(p);
    const step = 3;
    x.save(); x.fillStyle = col; x.globalAlpha *= o.alpha ?? 1;
    let seg = 0;
    for (let d = 0; d <= end; d += step) {
      while (seg < L.length - 2 && L[seg + 1] < d) seg++;
      const q = (d - L[seg]) / Math.max(1e-6, L[seg + 1] - L[seg]);
      const px = pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * q, py = pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * q;
      const u = d / tot;
      const taper = Math.min(1, u * 9, (1 - u) * 5 + 0.25);
      const r = w * 0.5 * taper * (0.82 + 0.3 * C.noise(d * 0.03, seed)) ;
      const dry = o.dry ? 0.55 + 0.45 * C.noise(d * 0.21, seed + 3) : 1;
      x.globalAlpha = (o.alpha ?? 1) * dry;
      x.beginPath(); x.arc(px, py, Math.max(0.6, r), 0, Math.PI * 2); x.fill();
    }
    x.restore();
  };
  // 手绘圈注：椭圆（略不闭合）
  FX.circle = function (x, cx, cy, rx, ry, p, w, col, seed = 2) {
    const pts = [];
    const a0 = -2.2 + C.noise(seed, 1) * 0.3, turn = Math.PI * 2 * 1.08;
    for (let i = 0; i <= 80; i++) {
      const a = a0 + turn * (i / 80), j = 1 + 0.05 * C.noise(i * 0.2, seed) + 0.03 * (i / 80);
      pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
    }
    FX.brush(x, pts, p, w, col, seed);
  };
  FX.under = function (x, x0, x1, y, p, w, col, seed = 3) {
    const pts = [];
    for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([x0 + (x1 - x0) * u, y + C.noise(u * 3, seed) * 4 - u * 3]); }
    FX.brush(x, pts, p, w, col, seed);
  };
  FX.strike = function (x, x0, x1, y, p, w, col, seed = 4) {
    const pts = [];
    for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([x0 + (x1 - x0) * u, y + (u - 0.5) * -10 + C.noise(u * 4, seed) * 3]); }
    FX.brush(x, pts, p, w, col, seed);
  };

  // 砸字：逐字从放大+透明砸到原位，o 同 T.draw 选项，外加 stag, dur, from
  FX.slam = function (x, s, px, py, lt, o = {}) {
    const cs = T.chars(x, s, o);
    const w = cs.reduce((a, b) => a + b.w, 0) - (o.track || 0);
    let cx = o.align === 'center' ? px - w / 2 : o.align === 'right' ? px - w : px;
    const stag = o.stag ?? 0.05, dur = o.dur ?? 0.28, from = o.from ?? 2.2;
    x.save(); x.fillStyle = o.col || C.col.ink;
    cs.forEach((ch, i) => {
      const q = C.clamp((lt - i * stag) / dur);
      if (q <= 0) { cx += ch.w; return; }
      const e = E.inQuad(q);
      const sc = from + (1 - from) * e;
      x.globalAlpha = (o.alpha ?? 1) * Math.min(1, q * 2.2);
      x.save(); x.translate(cx + ch.w / 2, py - (o.size || 40) * 0.36); x.scale(sc, sc);
      x.fillText(ch.c, -ch.w / 2 + (o.track || 0) / 2, (o.size || 40) * 0.36);
      x.restore();
      cx += ch.w;
    });
    x.restore();
    if (T.reg && lt > 0) T.reg.push({ id: o.id || '', x0: px - (o.align === 'center' ? w / 2 : 0), y0: py - (o.size || 40) * 0.86, x1: px + (o.align === 'center' ? w / 2 : w), y1: py + (o.size || 40) * 0.24, layer: x.canvas.dataset.name, a: x.globalAlpha * (o.alpha ?? 1) });
    return w;
  };
  // 每个字的砸落时刻（给音效）
  FX.slamTimes = (s, t0, stag = 0.05, dur = 0.28) => Array.from(s).map((c, i) => t0 + i * stag + dur).filter((_, i) => Array.from(s)[i].trim());

  // 打字机：cps 字/秒，带光标
  FX.type = function (x, s, px, py, lt, cps, o = {}) {
    const n = Math.floor(C.clamp(lt * cps, 0, s.length));
    const sub = Array.from(s).slice(0, n).join('');
    const w = T.draw(x, sub, px, py, o);
    const blink = (Math.floor(lt * 2.2) % 2 === 0) || n < s.length;
    if (lt > 0 && blink && (o.cursor ?? true) && lt < (o.cursorOff ?? 1e9)) {
      const sz = o.size || 30;
      x.save(); x.globalAlpha *= o.alpha ?? 1; x.fillStyle = o.curCol || o.col || '#fff';
      x.fillRect(px + w + 4, py - sz * 0.78, sz * 0.5, sz * 0.92); x.restore();
    }
    return w;
  };

  // 纸片文档：带投影与轻微旋转的纸
  FX.sheet = function (x, cx, cy, w, h, rot, o = {}) {
    x.save(); x.translate(cx, cy); x.rotate(rot);
    x.shadowColor = 'rgba(40,25,10,0.28)'; x.shadowBlur = o.blur ?? 30; x.shadowOffsetY = o.off ?? 14;
    x.fillStyle = o.fill || '#f8f4ea'; x.fillRect(-w / 2, -h / 2, w, h);
    x.shadowBlur = 0; x.shadowOffsetY = 0;
    if (o.edge) { x.strokeStyle = o.edge; x.lineWidth = 1; x.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1); }
    x.restore();
  };

  // 印章：矩形框 + 文字，砸落，略旋转，带斑驳
  FX.stamp = function (x, s, cx, cy, lt, o = {}) {
    if (lt <= 0) return;
    const q = C.clamp(lt / 0.16), sc = 1.8 - 0.8 * E.inQuad(q);
    const size = o.size || 60, col = o.col || C.col.verm;
    x.save(); x.translate(cx, cy); x.rotate(o.rot ?? -0.08); x.scale(sc, sc);
    x.globalAlpha = (o.alpha ?? 1) * Math.min(1, q * 3);
    T.set(x, { size, weight: o.weight || 900, fam: o.fam || 'serif' });
    const w = T.width(x, s, { size, weight: o.weight || 900, fam: o.fam || 'serif', track: o.track || 0 });
    const pw = w + size * 0.9, ph = size * 1.5;
    x.strokeStyle = col; x.lineWidth = size * 0.09; x.strokeRect(-pw / 2, -ph / 2, pw, ph);
    if (o.double) { x.lineWidth = size * 0.03; x.strokeRect(-pw / 2 + size * 0.14, -ph / 2 + size * 0.14, pw - size * 0.28, ph - size * 0.28); }
    T.draw(x, s, 0, size * 0.36, { size, weight: o.weight || 900, fam: o.fam || 'serif', col, align: 'center', track: o.track || 0, id: o.id || 'stamp' });
    // 斑驳：用纸色小点擦掉一些
    x.globalCompositeOperation = 'destination-out';
    const R = C.rng(o.seed || 9);
    for (let i = 0; i < 90; i++) { x.beginPath(); x.arc((R() - 0.5) * pw, (R() - 0.5) * ph, 1 + R() * size * 0.05, 0, Math.PI * 2); x.fillStyle = 'rgba(0,0,0,0.8)'; x.fill(); }
    x.restore();
  };

  // 计数器（等宽数字，千分位）
  FX.num = (v) => Math.round(v).toLocaleString('en-US');

  // 流体印字：把文字画进印模注入墨（ch: 'r' 朱 / 'g' 蓝 / 'b' 黑）
  const CHC = { r: '#ff0000', g: '#00ff00', b: '#0000ff', w: '#ffffff' };
  FX.inkText = function (S, s, px, py, o, ch = 'b', k = 1, vel) {
    S.stamp((x) => { T.draw(x, s, px, py, Object.assign({}, o, { col: CHC[ch], alpha: 1, id: null })); }, { dye: k, vel });
  };
  FX.inkDraw = function (S, fn, ch = 'b', k = 1, vel) {
    S.stamp((x) => { x.fillStyle = CHC[ch]; x.strokeStyle = CHC[ch]; fn(x, CHC[ch]); }, { dye: k, vel });
  };
  FX.CH = CHC;

  // 墨滴：在 (x,y) 注入一团墨 + 外扩速度
  FX.drop = function (S, x, y, r, ch, amt, burst, seed = 1) {
    const c = [ch === 'r' ? amt : 0, ch === 'g' ? amt : 0, ch === 'b' ? amt : 0, 0];
    S.dye(x, y, r, c);
    const R = C.rng(seed);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + R() * 0.5, d = r * 0.55;
      S.vel(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.5, Math.cos(a) * burst * (0.6 + R() * 0.8), Math.sin(a) * burst * (0.6 + R() * 0.8));
    }
  };
})();
