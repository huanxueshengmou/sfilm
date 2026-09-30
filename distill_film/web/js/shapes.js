// 粒子形状图集：把文字 / 填充区域 / 路径采样成点云，写入 RGBA32F 纹理（每槽 1024×64 = 65536 点）
// 世界坐标约定：默认机位下 z=0 平面 1 单位 = 100 像素，原点在画面中心，y 向上
(function () {
  const SH = (window.SH = {});
  const WIDTH = 1024, ROWS = 64, PER = WIDTH * ROWS;
  SH.PER = PER;
  const slots = {};
  const data = [];
  const builders = [];
  SH.need = (name, fn) => builders.push([name, fn]);
  SH.slot = (name) => { if (!(name in slots)) throw new Error('未知形状 ' + name); return slots[name].i; };
  SH.count = (name) => slots[name].n;
  SH.add = (name, pts, n) => { slots[name] = { i: data.length, n }; data.push(pts); };
  SH.build = () => { for (const [name, fn] of builders) fn(name); };
  SH.pack = () => {
    const out = new Float32Array(WIDTH * ROWS * Math.max(1, data.length) * 4);
    data.forEach((d, i) => out.set(d.subarray(0, Math.min(d.length, PER * 4)), i * PER * 4));
    return { data: out, w: WIDTH, h: ROWS * Math.max(1, data.length) };
  };

  // 从画布像素采样：draw(ctx) 在 cw×ch 画布上绘制（白色），中心 (cx,cy) 映射到世界原点
  SH.fromCanvas = (name, cw, ch, draw, o = {}) => {
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
    draw(ctx);
    const img = ctx.getImageData(0, 0, cw, ch).data;
    const cx = o.cx ?? cw / 2, cy = o.cy ?? ch / 2, unit = o.unit ?? 100;
    const inside = [];
    for (let y = 1; y < ch - 1; y++) {
      for (let x = 1; x < cw - 1; x++) {
        const a = img[(y * cw + x) * 4 + 3];
        if (a < 110) continue;
        const edge = img[(y * cw + x - 1) * 4 + 3] < 110 || img[(y * cw + x + 1) * 4 + 3] < 110 ||
          img[((y - 1) * cw + x) * 4 + 3] < 110 || img[((y + 1) * cw + x) * 4 + 3] < 110;
        inside.push(x, y, edge ? 1 : 0);
      }
    }
    const m = inside.length / 3;
    if (m === 0) throw new Error('形状为空 ' + name);
    const rnd = C.rng(o.seed ?? 1234);
    const n = Math.min(PER, o.max ?? PER);
    const pts = new Float32Array(PER * 4);
    const edgeBias = o.edge ?? 0.35;   // 边缘点优先，轮廓更锐利
    const edges = [];
    for (let i = 0; i < m; i++) if (inside[i * 3 + 2]) edges.push(i);
    for (let k = 0; k < n; k++) {
      const i = edges.length && rnd() < edgeBias ? edges[(rnd() * edges.length) | 0] : (rnd() * m) | 0;
      const px = inside[i * 3] + rnd() - 0.5, py = inside[i * 3 + 1] + rnd() - 0.5;
      pts[k * 4] = (px - cx) / unit;
      pts[k * 4 + 1] = -(py - cy) / unit;
      pts[k * 4 + 2] = (rnd() - 0.5) * (o.depth ?? 0.12);
      pts[k * 4 + 3] = inside[i * 3 + 2] ? 1 : 0.45 + 0.2 * rnd();
    }
    SH.add(name, pts, n);
  };

  SH.text = (name, str, font, o = {}) => {
    const cw = o.cw ?? 1800, ch = o.ch ?? 700;
    SH.fromCanvas(name, cw, ch, (ctx) => {
      ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (o.track) ctx.letterSpacing = o.track + 'px';
      const lines = str.split('\n');
      const lh = o.lh ?? 0;
      lines.forEach((l, i) => ctx.fillText(l, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * lh));
    }, o);
  };

  // 折线路径（按弧长重采样为 n 个有序点），用于粒子沿路径流动
  SH.path = (name, pts, n = 1024) => {
    const L = [0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0)));
    }
    const tot = L[L.length - 1];
    const out = new Float32Array(PER * 4);
    let j = 0;
    for (let k = 0; k < n; k++) {
      const s = (k / (n - 1)) * tot;
      while (j < L.length - 2 && L[j + 1] < s) j++;
      const u = (s - L[j]) / Math.max(1e-6, L[j + 1] - L[j]);
      const a = pts[j], b = pts[j + 1];
      out[k * 4] = C.lerp(a[0], b[0], u); out[k * 4 + 1] = C.lerp(a[1], b[1], u);
      out[k * 4 + 2] = C.lerp(a[2] || 0, b[2] || 0, u); out[k * 4 + 3] = k / (n - 1);
    }
    SH.add(name, out, n);
  };
})();
