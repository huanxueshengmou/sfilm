// 通用：数学、缓动、时间锚点、确定性随机、颜色
(function () {
  const C = (window.C = {});
  C.W = 1920; C.H = 1080; C.FPS = 60;

  C.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  C.lerp = (a, b, t) => a + (b - a) * t;
  C.inv = (a, b, x) => C.clamp((x - a) / (b - a));
  C.smooth = (x) => { x = C.clamp(x); return x * x * (3 - 2 * x); };
  C.fract = (x) => x - Math.floor(x);

  const E = (C.ease = {
    lin: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
    outQuint: (x) => 1 - Math.pow(1 - x, 5),
    inOutQuint: (x) => (x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2),
    inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
    outBack: (x) => { const s = 1.70158; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
    outBackSoft: (x) => { const s = 0.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    outSine: (x) => Math.sin((x * Math.PI) / 2),
    inSine: (x) => 1 - Math.cos((x * Math.PI) / 2),
  });

  // 从 a 起、历时 d 的缓动进度
  C.p = (t, a, d, e = E.inOutCubic) => e(C.clamp((t - a) / d));
  // 可见度：a 处淡入 fi 秒，b 处淡出 fo 秒（b 为完全消失时刻）
  C.vis = (t, a, b, fi = 0.3, fo = 0.3) => {
    const u = fi > 0 ? C.smooth((t - a) / fi) : t >= a ? 1 : 0;
    const v = fo > 0 ? C.smooth((b - t) / fo) : t < b ? 1 : 0;
    return Math.min(u, v);
  };
  // 阻尼弹簧的阶跃响应：0→1 带过冲
  C.spring = (x, f = 3.2, z = 0.42) => {
    if (x <= 0) return 0;
    const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + ((z * w) / wd) * Math.sin(wd * x));
  };
  // 冲击包络：a 时刻瞬时到 1，按 tau 衰减
  C.hit = (t, a, tau = 0.25) => (t < a ? 0 : Math.exp(-(t - a) / tau));

  // ---- 时间锚点（均取自 tools/timeline.py 生成的 TL） ----
  C.A = (id, k = 0) => TL.lines[id].phrases[k].t0;
  C.Ae = (id, k = 0) => TL.lines[id].phrases[k].t1;
  C.L0 = (id) => TL.lines[id].start;
  C.L1 = (id) => TL.lines[id].end;
  C.Wd = (id, key, n = 0) => {
    const ws = TL.lines[id].words.filter((w) => w.w.includes(key));
    if (!ws[n]) throw new Error('word ' + key + ' not in ' + id);
    return ws[n].t;
  };
  C.bar = (n) => n * 4 * TL.beat;
  C.Wf = (id, key, fb) => { const w = TL.lines[id].words.find((q) => q.w.includes(key)); return w ? w.t : fb; };
  C.S = (id) => TL.scenes.find((s) => s.id === id);

  // ---- 确定性随机 ----
  C.hash = (n) => {
    let x = (n | 0) ^ 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  };
  C.h2 = (a, b) => C.hash(a * 73856093 ^ b * 19349663);
  C.rng = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // 平滑 1D 值噪声，[-1,1]
  C.noise = (x, seed = 0) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    const a = C.hash(i * 7919 + seed * 104729) * 2 - 1, b = C.hash((i + 1) * 7919 + seed * 104729) * 2 - 1;
    return a + (b - a) * u;
  };
  C.fbm = (x, seed = 0) => C.noise(x, seed) * 0.6 + C.noise(x * 2.03, seed + 7) * 0.28 + C.noise(x * 4.11, seed + 13) * 0.12;

  // ---- 颜色 ----
  C.hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  C.s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  C.lin = (h) => C.hex(h).map(C.s2l); // sRGB hex → 线性 RGB
  C.rgba = (h, a = 1) => {
    const [r, g, b] = C.hex(h);
    return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
  };
  C.mixHex = (h1, h2, t) => {
    const a = C.hex(h1), b = C.hex(h2);
    const c = a.map((v, i) => Math.round((v + (b[i] - v) * t) * 255));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };

  // 全片调色板（sRGB）：纸 / 墨 / 朱 / 普鲁士蓝
  C.col = {
    paper: '#efe8da',
    paper2: '#e4dccb',
    night: '#0b0d12',
    ink: '#16130f',
    ink2: '#4a443b',
    mute: '#8b8273',
    verm: '#d8401f',      // 朱砂
    vermGlow: '#ff6a3a',
    blue: '#1f4e8c',      // 普鲁士蓝
    blueGlow: '#4fa8ff',
    gold: '#c79a3c',
    white: '#f7f3ea',
  };
})();
