// 2D 画布工具：字体、字距排版、动感文字、玻璃卡片、HUD 角标、线稿描边动画、图标
(function () {
  const D = (window.D = {});
  D.F = (w, px, fam = 'NSC') => `${w} ${px}px ${fam}`;
  const lay = new Map();
  let mctx;
  D.init = () => { mctx = document.createElement('canvas').getContext('2d'); };

  // 逐字排版（缓存）：返回每个字的中心 x 与总宽
  D.layout = (s, font, track = 0) => {
    const key = font + '|' + track + '|' + s;
    let L = lay.get(key);
    if (L) return L;
    mctx.font = font;
    const chars = [];
    let x = 0;
    for (const ch of Array.from(s)) {
      const w = mctx.measureText(ch).width;
      chars.push({ c: ch, x: x + w / 2, w });
      x += w + track;
    }
    L = { chars, width: Math.max(0, x - track) };
    lay.set(key, L);
    return L;
  };
  D.width = (s, font, track = 0) => D.layout(s, font, track).width;

  function shadow(ctx, o) {
    if (o.glow) { ctx.shadowColor = o.gcol || o.col || '#fff'; ctx.shadowBlur = o.glow; }
    else { ctx.shadowBlur = 0; }
  }

  // 普通文字（支持字距、发光、描边、渐变填充）
  D.text = (ctx, s, x, y, o = {}) => {
    const a = o.a ?? 1;
    if (a <= 0.002 || !s) return 0;
    const font = D.F(o.w ?? 500, o.size ?? 32, o.fam ?? 'NSC');
    const L = D.layout(s, font, o.track ?? 0);
    const align = o.align ?? 'center';
    const x0 = align === 'center' ? x - L.width / 2 : align === 'right' ? x - L.width : x;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.font = font;
    ctx.textBaseline = o.base ?? 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = o.fill || o.col || '#fff';
    shadow(ctx, o);
    if (o.blur) ctx.filter = `blur(${o.blur.toFixed(1)}px)`;
    for (const c of L.chars) {
      if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = o.scol || o.col || '#fff'; ctx.strokeText(c.c, x0 + c.x, y); }
      if (!o.noFill) ctx.fillText(c.c, x0 + c.x, y);
    }
    ctx.restore();
    return L.width;
  };

  // 动感文字：逐字弹入（弹簧缩放 + 模糊聚焦 + 上浮），可选逐字退场
  D.kin = (ctx, s, x, y, t, t0, o = {}) => {
    if (t < t0 || !s) return;
    const font = D.F(o.w ?? 900, o.size ?? 80, o.fam ?? 'NSC');
    const L = D.layout(s, font, o.track ?? 0);
    const align = o.align ?? 'center';
    const x0 = align === 'center' ? x - L.width / 2 : align === 'right' ? x - L.width : x;
    const stag = o.stag ?? 0.045, dur = o.dur ?? 0.45, from = o.from ?? 1.8, bl = o.blur ?? 14, rise = o.rise ?? 0;
    ctx.save();
    const base = ctx.globalAlpha;
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = o.fill || o.col || '#fff';
    shadow(ctx, o);
    const n = L.chars.length;
    for (let i = 0; i < n; i++) {
      const c = L.chars[i];
      const ti = t0 + (o.rev ? n - 1 - i : i) * stag;
      if (t < ti) continue;
      const k = C.clamp((t - ti) / dur);
      const e = C.ease.outCubic(k);
      const sp = C.spring(t - ti, o.freq ?? 2.2, o.damp ?? 0.55);
      let sc = C.lerp(from, 1, sp), al = e * (o.a ?? 1), b = (1 - e) * bl, dy = (1 - e) * rise;
      if (o.out != null) {
        const q = C.clamp((t - o.out - i * (o.ostag ?? 0.02)) / (o.odur ?? 0.35));
        if (q > 0) { al *= 1 - q; b += q * bl; sc *= 1 + q * (o.oscale ?? 0.25); dy -= q * (o.orise ?? 20); }
      }
      if (al <= 0.003) continue;
      ctx.globalAlpha = base * al;
      ctx.filter = b > 0.6 ? `blur(${b.toFixed(1)}px)` : 'none';
      ctx.save();
      ctx.translate(x0 + c.x, y + dy);
      ctx.scale(sc, sc);
      if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = o.scol || '#fff'; ctx.strokeText(c.c, 0, 0); }
      if (!o.noFill) ctx.fillText(c.c, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  // 打字机
  D.type = (ctx, s, x, y, t, t0, cps, o = {}) => {
    if (t < t0) return 0;
    const arr = Array.from(s);
    const n = Math.min(arr.length, Math.floor((t - t0) * cps));
    const part = arr.slice(0, n).join('');
    const w = D.text(ctx, part, x, y, { ...o, align: 'left' });
    if (o.cursor !== false && n < arr.length && Math.floor(t * 3) % 2 === 0) {
      ctx.save(); ctx.globalAlpha *= o.a ?? 1; ctx.fillStyle = o.col || '#fff';
      ctx.fillRect(x + w + 4, y - (o.size ?? 32) * 0.45, (o.size ?? 32) * 0.08, (o.size ?? 32) * 0.9); ctx.restore();
    }
    return n / arr.length;
  };

  D.num = (v, dec = 0) => {
    const s = Math.abs(v).toFixed(dec).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (v < 0 ? '-' : '') + s.join('.');
  };

  D.rrect = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };

  // 玻璃卡片
  D.card = (ctx, x, y, w, h, o = {}) => {
    const a = o.a ?? 1;
    if (a <= 0.002) return;
    ctx.save();
    ctx.globalAlpha *= a;
    D.rrect(ctx, x, y, w, h, o.r ?? 18);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, o.fillTop || 'rgba(40,52,80,0.55)');
    g.addColorStop(1, o.fillBot || 'rgba(10,14,26,0.62)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = o.lw ?? 1.5;
    ctx.strokeStyle = o.stroke || 'rgba(190,220,255,0.35)';
    if (o.glow) { ctx.shadowColor = o.gcol || o.stroke || '#9ff'; ctx.shadowBlur = o.glow; }
    ctx.stroke();
    ctx.restore();
  };

  // HUD 角标
  D.brk = (ctx, x, y, w, h, len, col, a = 1, lw = 2) => {
    if (a <= 0.002) return;
    ctx.save();
    ctx.globalAlpha *= a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
    ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
    ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h);
    ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len);
    ctx.stroke();
    ctx.restore();
  };

  // 折线/曲线的“描边生长”动画：pts 为 [[x,y],...]，prog 0..1
  D.poly = (ctx, pts, prog, o = {}) => {
    if (prog <= 0 || pts.length < 2) return;
    let total = 0;
    const seg = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
    let left = total * C.clamp(prog);
    ctx.save();
    ctx.globalAlpha *= o.a ?? 1;
    ctx.strokeStyle = o.col || '#fff'; ctx.lineWidth = o.lw ?? 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.glow) { ctx.shadowColor = o.gcol || o.col || '#fff'; ctx.shadowBlur = o.glow; }
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const l = seg[i - 1];
      if (left >= l) ctx.lineTo(pts[i][0], pts[i][1]);
      else { const k = left / l; ctx.lineTo(C.lerp(pts[i - 1][0], pts[i][0], k), C.lerp(pts[i - 1][1], pts[i][1], k)); }
      left -= l;
    }
    if (o.close && prog >= 1) ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };
  // 采样三次贝塞尔 / 圆弧 → 点列
  D.bez = (p0, p1, p2, p3, n = 24) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, v = 1 - u;
      out.push([v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
        v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]);
    }
    return out;
  };
  D.arc = (cx, cy, r, a0, a1, n = 48) => {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = C.lerp(a0, a1, i / n); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return out;
  };

  // ---- 线稿图标（以 cx,cy 为中心，s 为尺度，约 100px 见方）----
  const ICON = {};
  ICON.car = (c) => { // 轿车侧视
    c.moveTo(-58, 14); c.lineTo(-58, 2); c.quadraticCurveTo(-56, -6, -44, -8); c.lineTo(-28, -10);
    c.quadraticCurveTo(-18, -26, 2, -27); c.quadraticCurveTo(22, -27, 32, -12); c.lineTo(50, -8);
    c.quadraticCurveTo(60, -5, 60, 6); c.lineTo(60, 14); c.lineTo(-58, 14);
    c.moveTo(-22, -11); c.lineTo(28, -11); c.moveTo(3, -26); c.lineTo(3, -11);
    c.moveTo(-26, 14); c.arc(-36, 14, 10, 0, Math.PI * 2); c.moveTo(48, 14); c.arc(38, 14, 10, 0, Math.PI * 2);
  };
  ICON.truck = (c) => { // 垃圾车
    c.moveTo(-60, 16); c.lineTo(-60, -22); c.lineTo(22, -22); c.lineTo(22, 16);
    c.moveTo(22, -8); c.lineTo(44, -8); c.lineTo(58, 4); c.lineTo(58, 16); c.lineTo(-60, 16);
    c.moveTo(-48, -22); c.lineTo(-40, -32); c.lineTo(-8, -32); c.lineTo(-2, -22);
    c.moveTo(-26, 16); c.arc(-36, 16, 9, 0, Math.PI * 2); c.moveTo(47, 16); c.arc(38, 16, 9, 0, Math.PI * 2);
    c.moveTo(-44, -12); c.lineTo(-44, 6); c.moveTo(-30, -12); c.lineTo(-30, 6); c.moveTo(-16, -12); c.lineTo(-16, 6);
  };
  ICON.bus = (c) => {
    c.moveTo(-60, 16); c.lineTo(-60, -24); c.quadraticCurveTo(-60, -30, -54, -30); c.lineTo(54, -30);
    c.quadraticCurveTo(60, -30, 60, -22); c.lineTo(60, 16); c.lineTo(-60, 16);
    for (let i = 0; i < 5; i++) { const x = -52 + i * 22; c.moveTo(x, -22); c.lineTo(x + 16, -22); c.lineTo(x + 16, -6); c.lineTo(x, -6); c.lineTo(x, -22); }
    c.moveTo(-28, 16); c.arc(-38, 16, 9, 0, Math.PI * 2); c.moveTo(48, 16); c.arc(39, 16, 9, 0, Math.PI * 2);
  };
  ICON.cat = (c) => {
    c.moveTo(34, 4); c.arc(0, 4, 34, 0, Math.PI * 2);
    c.moveTo(-30, -12); c.lineTo(-26, -42); c.lineTo(-8, -28); c.moveTo(30, -12); c.lineTo(26, -42); c.lineTo(8, -28);
    c.moveTo(-10, -2); c.arc(-12, -2, 2, 0, Math.PI * 2); c.moveTo(14, -2); c.arc(12, -2, 2, 0, Math.PI * 2);
    c.moveTo(-4, 10); c.lineTo(0, 14); c.lineTo(4, 10);
    c.moveTo(-8, 14); c.lineTo(-40, 8); c.moveTo(-8, 17); c.lineTo(-40, 20); c.moveTo(8, 14); c.lineTo(40, 8); c.moveTo(8, 17); c.lineTo(40, 20);
  };
  ICON.carrot = (c) => {
    c.moveTo(-10, -18); c.quadraticCurveTo(-18, 10, -2, 44); c.quadraticCurveTo(2, 48, 6, 42); c.quadraticCurveTo(18, 8, 12, -18); c.quadraticCurveTo(1, -24, -10, -18);
    c.moveTo(-6, -2); c.lineTo(2, -4); c.moveTo(-4, 14); c.lineTo(6, 12); c.moveTo(-1, 28); c.lineTo(5, 27);
    c.moveTo(0, -20); c.quadraticCurveTo(-18, -38, -22, -52); c.moveTo(2, -20); c.quadraticCurveTo(4, -42, 0, -56); c.moveTo(4, -20); c.quadraticCurveTo(20, -36, 26, -48);
  };
  ICON.phone = (c) => { c.moveTo(-26, -50); c.lineTo(26, -50); c.arcTo(34, -50, 34, -42, 8); c.lineTo(34, 42); c.arcTo(34, 50, 26, 50, 8);
    c.lineTo(-26, 50); c.arcTo(-34, 50, -34, 42, 8); c.lineTo(-34, -42); c.arcTo(-34, -50, -26, -50, 8); c.moveTo(-8, -43); c.lineTo(8, -43); };
  ICON.glasses = (c) => {
    c.moveTo(-8, -4); c.quadraticCurveTo(0, -12, 8, -4);
    c.moveTo(-8, -6); c.lineTo(-10, 12); c.quadraticCurveTo(-12, 20, -24, 20); c.lineTo(-44, 20); c.quadraticCurveTo(-54, 20, -54, 10); c.lineTo(-56, -6); c.lineTo(-8, -6);
    c.moveTo(8, -6); c.lineTo(10, 12); c.quadraticCurveTo(12, 20, 24, 20); c.lineTo(44, 20); c.quadraticCurveTo(54, 20, 54, 10); c.lineTo(56, -6); c.lineTo(8, -6);
    c.moveTo(-56, -6); c.lineTo(-64, -10); c.moveTo(56, -6); c.lineTo(64, -10);
  };
  ICON.chip = (c) => {
    c.moveTo(-30, -30); c.lineTo(30, -30); c.lineTo(30, 30); c.lineTo(-30, 30); c.lineTo(-30, -30);
    c.moveTo(-16, -16); c.lineTo(16, -16); c.lineTo(16, 16); c.lineTo(-16, 16); c.lineTo(-16, -16);
    for (let i = -2; i <= 2; i++) { const k = i * 11; c.moveTo(k, -30); c.lineTo(k, -40); c.moveTo(k, 30); c.lineTo(k, 40); c.moveTo(-30, k); c.lineTo(-40, k); c.moveTo(30, k); c.lineTo(40, k); }
  };
  ICON.bolt = (c) => { c.moveTo(8, -48); c.lineTo(-22, 6); c.lineTo(0, 6); c.lineTo(-8, 48); c.lineTo(24, -8); c.lineTo(2, -8); c.lineTo(8, -48); };
  ICON.shield = (c) => { c.moveTo(0, -46); c.lineTo(38, -32); c.quadraticCurveTo(38, 22, 0, 48); c.quadraticCurveTo(-38, 22, -38, -32); c.lineTo(0, -46); };
  ICON.lock = (c) => { c.moveTo(-26, -4); c.lineTo(26, -4); c.lineTo(26, 36); c.lineTo(-26, 36); c.lineTo(-26, -4);
    c.moveTo(-16, -4); c.lineTo(-16, -18); c.arc(0, -18, 16, Math.PI, 0); c.lineTo(16, -4); c.moveTo(4, 14); c.arc(0, 14, 4, 0, Math.PI * 2); };
  ICON.user = (c) => { c.moveTo(12, -18); c.arc(0, -18, 12, 0, Math.PI * 2); c.moveTo(-24, 26); c.quadraticCurveTo(-22, 2, 0, 2); c.quadraticCurveTo(22, 2, 24, 26); };
  ICON.doc = (c) => { c.moveTo(-30, -42); c.lineTo(14, -42); c.lineTo(30, -26); c.lineTo(30, 42); c.lineTo(-30, 42); c.lineTo(-30, -42); c.moveTo(14, -42); c.lineTo(14, -26); c.lineTo(30, -26);
    for (let i = 0; i < 4; i++) { c.moveTo(-20, -14 + i * 14); c.lineTo(20, -14 + i * 14); } };
  D.ICON = ICON;
  D.icon = (ctx, name, cx, cy, s, o = {}) => {
    const a = o.a ?? 1;
    if (a <= 0.002) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(cx, cy); ctx.scale(s, s); if (o.rot) ctx.rotate(o.rot);
    ctx.beginPath(); ICON[name](ctx);
    ctx.lineWidth = (o.lw ?? 2.2) / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = o.col || '#fff';
    if (o.glow) { ctx.shadowColor = o.gcol || o.col || '#fff'; ctx.shadowBlur = o.glow; }
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    ctx.stroke();
    ctx.restore();
  };

  // 公式：p_i = exp(z_i / T) / Σ_j exp(z_j / T)（KaTeX 字体手工排版）
  D.softmax = (ctx, x, y, s, o = {}) => {
    const a = o.a ?? 1;
    if (a <= 0.002) return;
    const col = o.col || '#fff', hi = o.hi || '#ffb13b';
    ctx.save();
    ctx.globalAlpha *= a; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = col;
    if (o.glow) { ctx.shadowColor = o.gcol || col; ctx.shadowBlur = o.glow; }
    const f = (fam, k) => `${(s * k).toFixed(1)}px ${fam}`;
    let cx = x;
    const put = (str, fam, k, dx = 0, dy = 0, c = col) => { ctx.font = f(fam, k); ctx.fillStyle = c; ctx.fillText(str, cx + dx, y + dy); const w = ctx.measureText(str).width; return w; };
    cx += put('p', 'KMath', 1); cx += put('i', 'KMath', 0.62, 1, s * 0.22) + 6;
    cx += 14; cx += put('=', 'KMain', 1) + 16;
    // 分子 / 分母
    const numW = (() => { ctx.font = f('KMain', 1); let w = ctx.measureText('exp(').width; ctx.font = f('KMath', 1); w += ctx.measureText('z').width;
      ctx.font = f('KMath', 0.62); w += ctx.measureText('i').width; ctx.font = f('KMain', 1); w += ctx.measureText(' / ').width + ctx.measureText(')').width; ctx.font = f('KMath', 1); w += ctx.measureText('T').width; return w + 4; })();
    const denW = numW + s * 1.1;
    const W = Math.max(numW, denW);
    const ny = y - s * 0.62, dy = y + s * 0.98;
    const row = (yy, sub, withSum) => {
      let xx = cx + (W - (withSum ? denW : numW)) / 2;
      const p = (str, fam, k, ox = 0, oy = 0, c = col) => { ctx.font = f(fam, k); ctx.fillStyle = c; ctx.fillText(str, xx + ox, yy + oy); xx += ctx.measureText(str).width; };
      if (withSum) { p('Σ', 'KMain', 1.05); p(sub, 'KMath', 0.55, 1, s * 0.34); xx += 8; }
      p('exp(', 'KMain', 1); p('z', 'KMath', 1); p(sub, 'KMath', 0.62, 1, s * 0.22); xx += 3; p(' / ', 'KMain', 1); p('T', 'KMath', 1, 0, 0, hi); p(')', 'KMain', 1);
    };
    row(ny, 'i', false);
    row(dy, 'j', true);
    ctx.fillStyle = col; ctx.fillRect(cx, y - s * 0.3, W, Math.max(2, s * 0.045));
    ctx.restore();
    return cx + W - x;
  };

  // ---- 手写数字（单笔画骨架 + 随机抖动：倾斜、旋转、笔粗）----
  const DG = {};
  const ell = (cx, cy, rx, ry, a0, a1, n = 28) => { const o = []; for (let i = 0; i <= n; i++) { const a = C.lerp(a0, a1, i / n); o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; };
  DG[0] = [ell(0.5, 0.5, 0.3, 0.42, -Math.PI / 2, Math.PI * 1.55, 36)];
  DG[1] = [[[0.36, 0.24], [0.54, 0.08], [0.5, 0.92]]];
  DG[2] = [[...ell(0.5, 0.33, 0.27, 0.24, Math.PI * 1.05, Math.PI * 2.2, 18), [0.22, 0.9], [0.82, 0.88]]];
  DG[3] = [[...ell(0.48, 0.28, 0.27, 0.2, Math.PI * 1.1, Math.PI * 2.45, 16), ...ell(0.48, 0.7, 0.3, 0.22, -Math.PI * 0.45, Math.PI * 0.85, 18)]];
  DG[4] = [[[0.64, 0.92], [0.62, 0.08], [0.16, 0.64], [0.86, 0.64]]];
  DG[5] = [[[0.8, 0.1], [0.32, 0.1], [0.26, 0.46], ...ell(0.5, 0.66, 0.29, 0.26, -Math.PI * 0.75, Math.PI * 0.85, 18)]];
  DG[6] = [[[0.72, 0.1], ...ell(0.64, 0.62, 0.42, 0.52, Math.PI * 1.35, Math.PI * 1.02, 6).slice(1), ...ell(0.5, 0.68, 0.26, 0.24, Math.PI, Math.PI * 2.95, 22)]];
  DG[7] = [[[0.18, 0.12], [0.82, 0.12], [0.42, 0.92]]];
  DG[8] = [(() => { const o = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; o.push([0.5 + 0.24 * Math.sin(2 * a), 0.5 - 0.42 * Math.cos(a)]); } return o; })()];
  DG[9] = [[...ell(0.5, 0.32, 0.24, 0.23, 0, Math.PI * 2, 24), [0.72, 0.4], [0.6, 0.92]]];
  D.digit = (ctx, d, cx, cy, size, seed, o = {}) => {
    const a = o.a ?? 1;
    if (a <= 0.003) return;
    const R = C.rng(seed * 7919 + 13);
    const rot = (R() - 0.5) * 0.28, slant = (R() - 0.5) * 0.35 + 0.08, sc = 0.88 + R() * 0.2, lw = size * (0.085 + R() * 0.05);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(cx, cy); ctx.rotate(rot); ctx.transform(1, 0, -slant, 1, 0, 0); ctx.scale(size * sc * 0.72, size * sc);
    ctx.lineWidth = lw / (size * sc * 0.85); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = o.col || '#fff';
    if (o.glow) { ctx.shadowColor = o.gcol || o.col || '#fff'; ctx.shadowBlur = o.glow; }
    for (const st of DG[d]) {
      ctx.beginPath();
      st.forEach(([x, y], i) => { const jx = (R() - 0.5) * 0.03, jy = (R() - 0.5) * 0.03; if (i === 0) ctx.moveTo(x - 0.5 + jx, y - 0.5 + jy); else ctx.lineTo(x - 0.5 + jx, y - 0.5 + jy); });
      ctx.stroke();
    }
    ctx.restore();
  };

  // ---- 2D 二十面体晶体（小尺寸、多个同屏时用）----
  const IV = [[-1, 1.618, 0], [1, 1.618, 0], [-1, -1.618, 0], [1, -1.618, 0], [0, -1, 1.618], [0, 1, 1.618], [0, -1, -1.618], [0, 1, -1.618], [1.618, 0, -1], [1.618, 0, 1], [-1.618, 0, -1], [-1.618, 0, 1]].map((v) => v.map((c) => c / 1.902));
  const IE = [0, 11, 0, 5, 0, 1, 0, 7, 0, 10, 1, 5, 5, 11, 11, 10, 10, 7, 7, 1, 3, 9, 3, 4, 3, 2, 3, 6, 3, 8, 4, 9, 2, 4, 6, 2, 8, 6, 9, 8, 4, 5, 2, 11, 6, 10, 8, 7, 9, 1, 5, 9, 11, 4, 10, 2, 7, 6, 1, 8];
  D.ico = (ctx, cx, cy, r, ang, o = {}) => {
    const a = o.a ?? 1;
    if (a <= 0.003 || r <= 0.5) return;
    const cy1 = Math.cos(ang), sy1 = Math.sin(ang), cx1 = Math.cos(0.45), sx1 = Math.sin(0.45);
    const P = IV.map(([x, y, z]) => { const X = cy1 * x + sy1 * z, Z = -sy1 * x + cy1 * z; const Y = cx1 * y - sx1 * Z, Z2 = sx1 * y + cx1 * Z; return [cx + X * r, cy - Y * r, Z2]; });
    const col = o.col || '#8feaff';
    ctx.save();
    ctx.globalAlpha *= a;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.6);
    g.addColorStop(0, o.core || 'rgba(220,250,255,0.9)'); g.addColorStop(0.35, o.mid || 'rgba(57,215,255,0.35)'); g.addColorStop(1, 'rgba(57,215,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = o.lw ?? Math.max(1, r * 0.06); ctx.lineCap = 'round';
    ctx.shadowColor = o.gcol || col; ctx.shadowBlur = o.glow ?? r * 0.5;
    for (let i = 0; i < IE.length; i += 2) {
      const p = P[IE[i]], q = P[IE[i + 1]];
      ctx.globalAlpha = a * (0.45 + 0.55 * C.clamp(((p[2] + q[2]) / 2 + 1) / 2));
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    ctx.restore();
  };

  // 大号数字 / 结论弹出（弹簧缩放 + 模糊聚焦 + 可选说明）
  D.stat = (ctx, s, x, y, t, t0, o = {}) => {
    if (t < t0) return;
    const a = (o.a ?? 1) * C.smooth((t - t0) / 0.12);
    const k = C.spring(t - t0, o.freq ?? 2.2, o.damp ?? 0.42);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x, y); const sc = C.lerp(o.from ?? 2.4, 1, k); ctx.scale(sc, sc);
    D.text(ctx, s, 0, 0, { size: o.size ?? 160, w: o.w ?? 800, fam: o.fam ?? 'Grot', col: o.col || '#fff', glow: o.glow ?? 30, gcol: o.gcol || o.col, track: o.track ?? 0,
      blur: Math.max(0, (1 - C.clamp((t - t0) / 0.25)) * 10) });
    ctx.restore();
    if (o.label) D.text(ctx, o.label, x, y + (o.size ?? 160) * 0.62, { size: o.lsize ?? 30, w: 500, col: o.lcol || 'rgba(235,240,250,0.9)', track: 3, a: a * C.p(t, t0 + 0.15, 0.4) });
  };
})();
