// 通用：常量、缓动、确定性随机、时间锚点（全部取自 tools/timeline.py 生成的 TL）、颜色
(function () {
  const C = (window.C = {});
  C.W = 1920; C.H = 1080; C.FPS = TL.fps;

  C.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  C.lerp = (a, b, t) => a + (b - a) * t;
  C.inv = (a, b, x) => C.clamp((x - a) / (b - a));
  C.smooth = (x) => { x = C.clamp(x); return x * x * (3 - 2 * x); };
  C.fract = (x) => x - Math.floor(x);
  C.mixv = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  const E = (C.ease = {
    lin: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    inQuart: (x) => x * x * x * x,
    inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
    outQuint: (x) => 1 - Math.pow(1 - x, 5),
    inOutQuint: (x) => (x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2),
    inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
    outBack: (x) => { const s = 1.70158; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    outSine: (x) => Math.sin((x * Math.PI) / 2),
    inSine: (x) => 1 - Math.cos((x * Math.PI) / 2),
  });

  // 从 a 起、历时 d 的缓动进度
  C.p = (t, a, d, e = E.inOutCubic) => e(C.clamp((t - a) / d));
  // 可见度：a 处淡入 fi 秒，b 处开始淡出、历时 fo 秒
  C.vis = (t, a, b, fi = 0.3, fo = 0.3) => {
    const u = fi > 0 ? C.smooth((t - a) / fi) : t >= a ? 1 : 0;
    const v = fo > 0 ? C.smooth((b + fo - t) / fo) : t < b ? 1 : 0;
    return Math.min(u, v);
  };
  // 阻尼弹簧阶跃响应（0→1，带过冲）
  C.spring = (x, f = 2.4, z = 0.5) => {
    if (x <= 0) return 0;
    const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + ((z * w) / wd) * Math.sin(wd * x));
  };
  C.hit = (t, a, tau = 0.25) => (t < a ? 0 : Math.exp(-(t - a) / tau));

  // 确定性随机
  C.hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
  C.rng = (seed) => {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  C.noise1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return C.lerp(C.hash(i), C.hash(i + 1), u) * 2 - 1; };

  // ---- 时间锚点 ----
  const L = TL.lines;
  C.A = (id, k = 0) => L[id].phrases[k].a;       // 第 k 个短语开始
  C.B = (id, k = 0) => L[id].phrases[k].b;       // 第 k 个短语结束
  C.LS = (id) => L[id].start;
  C.LE = (id) => L[id].end;
  C.SC = {};
  for (const s of TL.scenes) C.SC[s.id] = s;
  C.cues = TL.cues;
  C.cue = (scene, type, k = 0) => {
    const xs = TL.cues.filter((c) => c.scene === scene && c.type === type);
    return xs[Math.min(k, xs.length - 1)].t;
  };

  // ---- 颜色 ----
  C.hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  C.s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  C.lin = (h, k = 1) => C.hex(h).map((v) => C.s2l(v) * k);
  C.rgba = (h, a = 1) => { const [r, g, b] = C.hex(h); return `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},${a})`; };
  C.COL = {
    gold: '#ffb13b', amber: '#ff7a1a', hot: '#ffe2a8', ice: '#bff6ff', cyan: '#39d7ff', teal: '#27f0d0',
    violet: '#9b6bff', magenta: '#ff3d9a', red: '#ff3b3b', white: '#ffffff', dim: '#8791a8', ink: '#05060b',
  };
})();
