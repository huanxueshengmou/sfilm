// 文字排版：字体、字距、逐字显现、解码乱码、公式排版、布局登记（供数值验收）
(function () {
  const T = (window.T = {});
  const FAM = {
    sans: '"NSC"', serif: '"NSerif"', geo: '"Geo", "NSerif"', geoi: '"Geo", "NSerif"', mono: '"Mono", "NSC"', math: '"KMath", "NSerif"',
  };
  T.reg = null; // 调试时设为 []，记录每段文字的包围盒
  T.font = (size, weight = 500, fam = 'sans') => `${fam === 'geoi' ? 'italic ' : ''}${weight} ${size}px ${FAM[fam] || FAM.sans}`;

  T.set = (x, o) => {
    x.font = T.font(o.size || 40, o.weight || 500, o.fam || 'sans');
    x.textAlign = 'left';
    x.textBaseline = o.base || 'alphabetic';
    x.letterSpacing = '0px';
    x.fontStretch = o.stretch || 'normal';
  };
  // 逐字宽度（含字距）
  T.chars = (x, s, o) => {
    T.set(x, o);
    const tr = o.track || 0;
    return Array.from(s).map((c) => ({ c, w: x.measureText(c).width + tr }));
  };
  T.width = (x, s, o) => {
    const cs = T.chars(x, s, o);
    return cs.reduce((a, b) => a + b.w, 0) - (o.track || 0);
  };
  const startX = (px, w, align) => (align === 'center' ? px - w / 2 : align === 'right' ? px - w : px);

  function record(x, id, x0, y0, w, size, o) {
    if (!T.reg) return;
    const asc = o.base === 'middle' ? size * 0.5 : o.base === 'top' ? 0 : size * 0.86;
    const m = x.getTransform();
    const p0 = m.transformPoint(new DOMPoint(x0, y0 - asc)), p1 = m.transformPoint(new DOMPoint(x0 + w, y0 - asc + size * 1.1));
    T.reg.push({ id: id || '', x0: Math.min(p0.x, p1.x), y0: Math.min(p0.y, p1.y), x1: Math.max(p0.x, p1.x), y1: Math.max(p0.y, p1.y), layer: x.canvas.dataset.name, a: x.globalAlpha * (o.alpha ?? 1) });
  }

  // 基础绘制：o = {size, weight, fam, col, alpha, align, base, track, glow, glowCol, stroke, id}
  T.draw = (x, s, px, py, o = {}) => {
    const cs = T.chars(x, s, o);
    const w = cs.reduce((a, b) => a + b.w, 0) - (o.track || 0);
    let cx = startX(px, w, o.align);
    const a0 = x.globalAlpha;
    x.globalAlpha = a0 * (o.alpha ?? 1);
    if (x.globalAlpha <= 0.002) { x.globalAlpha = a0; return w; }
    x.fillStyle = o.col || '#fff';
    if (o.glow) { x.shadowColor = o.glowCol || o.col || '#fff'; x.shadowBlur = o.glow; }
    if (!o.track) x.fillText(s, cx, py);
    else for (const ch of cs) { x.fillText(ch.c, cx, py); cx += ch.w; }
    x.shadowBlur = 0;
    x.globalAlpha = a0;
    record(x, o.id, startX(px, w, o.align), py, w, o.size || 40, o);
    return w;
  };

  // 逐字显现：lt 为相对起始时刻的秒数；o.stag 每字间隔，o.dur 单字时长，o.rise 上浮像素，o.out 可选淡出进度
  T.reveal = (x, s, px, py, lt, o = {}) => {
    const cs = T.chars(x, s, o);
    const w = cs.reduce((a, b) => a + b.w, 0) - (o.track || 0);
    let cx = startX(px, w, o.align);
    const stag = o.stag ?? 0.035, dur = o.dur ?? 0.5, rise = o.rise ?? 18, ease = o.ease || C.ease.outCubic;
    const a0 = x.globalAlpha, base = o.alpha ?? 1;
    x.fillStyle = o.col || '#fff';
    if (o.glow) { x.shadowColor = o.glowCol || o.col || '#fff'; x.shadowBlur = o.glow; }
    const n = cs.length;
    cs.forEach((ch, i) => {
      const k = o.fromCenter ? Math.abs(i - (n - 1) / 2) : o.reverse ? n - 1 - i : i;
      const q = ease(C.clamp((lt - k * stag) / dur));
      if (q > 0.001) {
        x.globalAlpha = a0 * base * q;
        const sc = o.pop ? 0.6 + 0.4 * C.ease.outBack(q) : 1;
        if (sc !== 1) {
          x.save(); x.translate(cx + ch.w / 2, py); x.scale(sc, sc);
          x.fillText(ch.c, -ch.w / 2 + (o.track || 0) / 2, (1 - q) * rise); x.restore();
        } else x.fillText(ch.c, cx, py + (1 - q) * rise);
      }
      cx += ch.w;
    });
    x.shadowBlur = 0;
    x.globalAlpha = a0;
    if (lt > 0) record(x, o.id, startX(px, w, o.align), py, w, o.size || 40, o);
    return w;
  };

  // 解码乱码效果（适合英文/数字）：p 0→1，已解码部分为正文，前沿后若干字为随机字符
  const GL = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=<>/';
  T.scramble = (x, s, px, py, p, t, o = {}) => {
    const arr = Array.from(s), n = arr.length;
    const front = p * (n + 4);
    let out = '';
    for (let i = 0; i < n; i++) {
      if (arr[i] === ' ') { out += ' '; continue; }
      if (i < front - 4) out += arr[i];
      else if (i < front) out += GL[Math.floor(C.hash(i * 131 + Math.floor(t * 24) * 7) * GL.length)];
      else out += o.keep ? ' ' : '';
    }
    if (!out.trim()) return 0;
    return T.draw(x, out.padEnd(o.keep ? n : 0, ' '), px, py, o);
  };

  // 数字滚动：从 a 到 b，p 0→1，fmt 格式化
  T.count = (x, a, b, p, px, py, o = {}, fmt = (v) => Math.round(v).toLocaleString('en-US')) =>
    T.draw(x, (o.pre || '') + fmt(C.lerp(a, b, p)) + (o.post || ''), px, py, o);
})();
