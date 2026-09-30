// 公式排版：迷你标记 → 字形序列（KaTeX 字体），支持上下标、逐字形显现、按 key 着色/发光
// 记号：'O(N×L)'；'_' 下标 '^' 上标，{...} 分组；'\\i' 切斜体数学字，'\\r' 切正体；'@key{...}' 给一段打标签
(function () {
  const M = (window.M = {});
  const FI = '"KMath", "NSerif"', FR = '"KMain", "NSerif"';

  function parse(src) {
    // 输出 [{ch, it, lvl: 0|1|-1, key}]
    const out = [];
    let i = 0;
    const walk = (lvl, it, key, stopAtBrace) => {
      while (i < src.length) {
        const c = src[i];
        if (c === '}' && stopAtBrace) { i++; return; }
        if (c === '\\') {
          const n = src[i + 1];
          if (n === 'i') { it = true; i += 2; continue; }
          if (n === 'r') { it = false; i += 2; continue; }
          out.push({ ch: n, it, lvl, key }); i += 2; continue;
        }
        if (c === '@') {
          const j = src.indexOf('{', i);
          const k = src.slice(i + 1, j); i = j + 1;
          walk(lvl, it, k, true); continue;
        }
        if (c === '_' || c === '^') {
          const l2 = c === '_' ? -1 : 1; i++;
          if (src[i] === '{') { i++; walk(l2, it, key, true); } else { out.push({ ch: src[i], it, lvl: l2, key }); i++; }
          continue;
        }
        if (c === '{') { i++; walk(lvl, it, key, true); continue; }
        out.push({ ch: c, it: it && /[A-Za-zα-ω]/.test(c), lvl, key }); i++;
      }
    };
    walk(0, true, '', false);
    return out;
  }

  const OPS = new Set(['×', '·', '⋅', '=', '+', '−', '/', ',', '≈', '→', '⇒']);
  // 布局：返回 {glyphs:[{ch,x,y,size,font,key}], w}
  M.layout = (x, src, size) => {
    const g = parse(src);
    let cx = 0;
    const res = [];
    for (let i = 0; i < g.length; i++) {
      const q = g[i];
      if (q.ch === '·') q.ch = '⋅';
      const sz = q.lvl ? size * 0.66 : size;
      const font = `${sz}px ${q.it ? FI : FR}`;
      x.font = font;
      const pad = !q.lvl && OPS.has(q.ch) && q.ch !== ',' && q.ch !== '/' ? size * 0.22 : 0;
      cx += pad;
      const w = x.measureText(q.ch).width;
      const y = q.lvl === -1 ? size * 0.24 : q.lvl === 1 ? -size * 0.42 : 0;
      res.push({ ch: q.ch, x: cx, y, size: sz, font, key: q.key, w });
      cx += w + pad + (q.ch === ',' ? size * 0.3 : 0);
      // 下标紧跟上标时回退（如 W^k_j）
      if (q.lvl && g[i + 1] && g[i + 1].lvl && g[i + 1].lvl !== q.lvl) cx -= w;
    }
    return { glyphs: res, w: cx };
  };

  // 绘制：o = {size, col, cols:{key:col}, align, alpha, p(0..1 显现进度), glow, keyGlow:{key:px}, id}
  M.draw = (x, src, px, py, o = {}) => {
    const size = o.size || 60;
    const L = M.layout(x, src, size);
    const x0 = o.align === 'center' ? px - L.w / 2 : o.align === 'right' ? px - L.w : px;
    const a0 = x.globalAlpha, n = L.glyphs.length, p = o.p ?? 1;
    x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.letterSpacing = '0px';
    L.glyphs.forEach((g, i) => {
      const q = C.clamp(p * (n + 3) - i, 0, 3) / 3;
      if (q <= 0) return;
      const col = (o.cols && o.cols[g.key]) || o.col || '#fff';
      x.globalAlpha = a0 * (o.alpha ?? 1) * C.ease.outCubic(q);
      x.font = g.font; x.fillStyle = col;
      const gl = (o.keyGlow && o.keyGlow[g.key]) || o.glow || 0;
      if (gl) { x.shadowColor = col; x.shadowBlur = gl; }
      x.fillText(g.ch, x0 + g.x, py + g.y + (1 - C.ease.outCubic(q)) * size * 0.25);
      x.shadowBlur = 0;
    });
    x.globalAlpha = a0;
    if (T.reg && p > 0) {
      const m = x.getTransform(), p0 = m.transformPoint(new DOMPoint(x0, py - size * 0.8)), p1 = m.transformPoint(new DOMPoint(x0 + L.w, py + size * 0.35));
      T.reg.push({ id: o.id || src, x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, layer: x.canvas.dataset.name, a: a0 * (o.alpha ?? 1) });
    }
    return L;
  };
  // 某 key 的中心位置（用于连线/光束定位）
  M.keyBox = (x, src, px, size, align, key) => {
    const L = M.layout(x, src, size);
    const x0 = align === 'center' ? px - L.w / 2 : align === 'right' ? px - L.w : px;
    const gs = L.glyphs.filter((g) => g.key === key);
    if (!gs.length) return null;
    const a = x0 + gs[0].x, b = x0 + gs[gs.length - 1].x + gs[gs.length - 1].w;
    return { x0: a, x1: b, cx: (a + b) / 2 };
  };
})();
