// 2D 绘图工具：圆角框、发光线、曲线、箭头、光点、HUD 角标、扫光、胶囊标签
(function () {
  const D = (window.D = {});
  D.rr = (x, px, py, w, h, r) => {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
  };
  D.panel = (x, px, py, w, h, o = {}) => {
    if (w <= 0 || h <= 0) return;
    D.rr(x, px, py, w, h, o.r ?? 14);
    if (o.fill) { x.fillStyle = o.fill; x.fill(); }
    if (o.stroke) {
      x.lineWidth = o.lw ?? 2; x.strokeStyle = o.stroke;
      if (o.dash) x.setLineDash(o.dash);
      if (o.glow) { x.shadowColor = o.glowCol || o.stroke; x.shadowBlur = o.glow; }
      x.stroke(); x.shadowBlur = 0; x.setLineDash([]);
    }
  };
  D.line = (x, ax, ay, bx, by, o = {}) => {
    const p = o.p ?? 1, p0 = o.p0 ?? 0;
    if (p <= p0) return;
    x.beginPath(); x.moveTo(ax + (bx - ax) * p0, ay + (by - ay) * p0); x.lineTo(ax + (bx - ax) * p, ay + (by - ay) * p);
    x.lineWidth = o.lw ?? 2; x.strokeStyle = o.col || '#fff'; x.lineCap = o.cap || 'round';
    if (o.dash) x.setLineDash(o.dash);
    x.lineDashOffset = o.dashOff || 0;
    if (o.glow) { x.shadowColor = o.glowCol || o.col || '#fff'; x.shadowBlur = o.glow; }
    x.stroke(); x.shadowBlur = 0; x.setLineDash([]);
  };
  D.bez = (a, c1, c2, b, t) => {
    const u = 1 - t;
    return [u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
      u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]];
  };
  // 三次贝塞尔（部分绘制 p0..p），返回当前端点
  D.curve = (x, a, c1, c2, b, o = {}) => {
    const p = C.clamp(o.p ?? 1), p0 = C.clamp(o.p0 ?? 0);
    if (p <= p0) return null;
    const N = o.seg || 40;
    x.beginPath();
    for (let i = 0; i <= N; i++) { const q = D.bez(a, c1, c2, b, p0 + (p - p0) * (i / N)); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }
    x.lineWidth = o.lw ?? 2; x.strokeStyle = o.col || '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
    if (o.glow) { x.shadowColor = o.col || '#fff'; x.shadowBlur = o.glow; }
    x.stroke(); x.shadowBlur = 0;
    return D.bez(a, c1, c2, b, p);
  };
  D.arrowHead = (x, px, py, ang, s, col) => {
    x.save(); x.translate(px, py); x.rotate(ang);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(-s, -s * 0.55); x.lineTo(-s * 0.7, 0); x.lineTo(-s, s * 0.55); x.closePath();
    x.fillStyle = col; x.fill(); x.restore();
  };
  D.arrow = (x, ax, ay, bx, by, o = {}) => {
    const p = o.p ?? 1; if (p <= 0) return;
    const ex = ax + (bx - ax) * p, ey = ay + (by - ay) * p;
    D.line(x, ax, ay, ex, ey, o);
    D.arrowHead(x, ex, ey, Math.atan2(by - ay, bx - ax), o.head ?? 14, o.col || '#fff');
  };
  D.dot = (x, px, py, r, col, a = 1) => {
    if (a <= 0.002 || r <= 0.1) return;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, C.rgba(col, a)); g.addColorStop(0.3, C.rgba(col, a * 0.5)); g.addColorStop(1, C.rgba(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  };
  D.disc = (x, px, py, r, col, a = 1) => {
    if (a <= 0.002 || r <= 0) return;
    const a0 = x.globalAlpha; x.globalAlpha = a0 * a;
    x.fillStyle = col; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    x.globalAlpha = a0;
  };
  D.ring = (x, px, py, r, col, lw = 2, a = 1, a0r = 0, a1r = Math.PI * 2) => {
    if (a <= 0.002 || r <= 0) return;
    const g0 = x.globalAlpha; x.globalAlpha = g0 * a;
    x.beginPath(); x.arc(px, py, r, a0r, a1r); x.lineWidth = lw; x.strokeStyle = col; x.stroke();
    x.globalAlpha = g0;
  };
  D.brackets = (x, px, py, w, h, s, col, lw = 2, a = 1) => {
    if (a <= 0.002) return;
    const a0 = x.globalAlpha; x.globalAlpha = a0 * a;
    x.strokeStyle = col; x.lineWidth = lw; x.lineCap = 'square';
    x.beginPath();
    x.moveTo(px, py + s); x.lineTo(px, py); x.lineTo(px + s, py);
    x.moveTo(px + w - s, py); x.lineTo(px + w, py); x.lineTo(px + w, py + s);
    x.moveTo(px + w, py + h - s); x.lineTo(px + w, py + h); x.lineTo(px + w - s, py + h);
    x.moveTo(px + s, py + h); x.lineTo(px, py + h); x.lineTo(px, py + h - s);
    x.stroke(); x.globalAlpha = a0;
  };
  // 扫光带
  D.sweep = (x, px, py, w, h, p, col, a = 0.6, bw = 0.18) => {
    if (p <= 0 || p >= 1 || a <= 0) return;
    const cx = px + (p * (1 + 2 * bw) - bw) * w;
    const g = x.createLinearGradient(cx - bw * w, 0, cx + bw * w, 0);
    g.addColorStop(0, C.rgba(col, 0)); g.addColorStop(0.5, C.rgba(col, a)); g.addColorStop(1, C.rgba(col, 0));
    x.fillStyle = g; x.fillRect(px, py, w, h);
  };
  D.pill = (x, s, px, py, o = {}) => {
    const size = o.size || 22, fam = o.fam || 'bahn', weight = o.weight || 600, track = o.track ?? 1;
    const w = T.width(x, s, { size, weight, fam, track }) + size * 1.3, h = size * 1.75;
    const x0 = o.align === 'center' ? px - w / 2 : o.align === 'right' ? px - w : px;
    const a0 = x.globalAlpha; x.globalAlpha = a0 * (o.a ?? 1);
    D.panel(x, x0, py - h / 2, w, h, { r: h / 2, fill: o.fill, stroke: o.stroke, lw: o.lw ?? 1.5, glow: o.glow });
    T.draw(x, s, x0 + w / 2, py + size * 0.36, { size, weight, fam, col: o.col || '#fff', align: 'center', track, id: o.id });
    x.globalAlpha = a0;
    return w;
  };
  // 斜纹警示带
  D.hazard = (x, px, py, w, h, col, a, off = 0) => {
    const a0 = x.globalAlpha; x.globalAlpha = a0 * a;
    x.save(); x.beginPath(); x.rect(px, py, w, h); x.clip();
    x.fillStyle = col;
    for (let k = -h + ((off % 28) + 28) % 28 - 28; k < w + h; k += 28) {
      x.beginPath(); x.moveTo(px + k, py + h); x.lineTo(px + k + 14, py + h); x.lineTo(px + k + 14 + h, py); x.lineTo(px + k + h, py); x.closePath(); x.fill();
    }
    x.restore(); x.globalAlpha = a0;
  };
})();
