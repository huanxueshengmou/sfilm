// 总导演：场景注册、纸/夜两态与墨迹转场、章节卡、冲击(闪/震)、字幕、后期参数
(function () {
  const DIR = (window.DIR = {});
  const CUE = (window.CUE = { ev: [], hits: [] });
  const sm = C.smooth, S = C.S;
  DIR.scenes = [];
  // o = {draw(t, X), sim(t, S), resets:[t]}
  DIR.reg = (id, t0, t1, o) => DIR.scenes.push(Object.assign({ id, t0, t1 }, o));

  // 音效时刻表（与画面同源，导出给音频合成）
  CUE.add = (t, type, gain = 1, extra = {}) => CUE.ev.push(Object.assign({ t: +(+t).toFixed(4), type, gain }, extra));
  // 冲击：flash 闪光强度、shake 镜头震动、col 闪光色
  CUE.hit = (t, o = {}) => CUE.hits.push(Object.assign({ t, flash: 0, shake: 0, tau: 0.18, col: null, zoom: 0 }, o));

  // ---- 纸 / 夜 ----
  // 夜段：[起, 止]；边界处以墨迹（进夜）或纸光（出夜）铺满全屏后切换
  DIR.night = [];
  DIR.dark = (t) => (DIR.night.some(([a, b]) => t >= a && t < b) ? 1 : 0);
  const WIPE = 0.62;
  // 转场的中心与种子
  DIR.wipes = [];
  DIR.buildWipes = function () {
    DIR.wipes = [];
    DIR.night.forEach(([a, b], i) => {
      if (a > 0.01) DIR.wipes.push({ t: a, toNight: true, x: 960 + 420 * Math.sin(i * 2.1), y: 540 + 160 * Math.cos(i * 1.3), seed: i * 7 + 1 });
      if (b < TL.duration - 0.01) DIR.wipes.push({ t: b, toNight: false, x: 960 - 380 * Math.sin(i * 1.7), y: 540, seed: i * 7 + 4 });
    });
  };
  // 有机墨团：半径 r，边缘噪声
  DIR.blob = function (x, cx, cy, r, seed, col, a = 1) {
    if (r <= 0 || a <= 0) return;
    x.save(); x.globalAlpha = a; x.fillStyle = col;
    x.beginPath();
    const N = 96;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2;
      const n = C.fbm(th * 1.6 + seed, seed) * 0.16 + C.noise(th * 7 + seed * 3, seed + 5) * 0.05;
      const rr = r * (1 + n);
      const px = cx + Math.cos(th) * rr, py = cy + Math.sin(th) * rr;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath(); x.fill();
    // 飞溅墨点
    const R = C.rng(seed * 131 + 7);
    for (let k = 0; k < 26; k++) {
      const th = R() * Math.PI * 2, d = r * (1.02 + R() * 0.5), s = (4 + R() * 26) * Math.min(1, r / 400);
      x.beginPath(); x.arc(cx + Math.cos(th) * d, cy + Math.sin(th) * d, s, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  };
  // 纸→纸 转场：朱砂色斜带横扫
  DIR.bands = [];
  DIR.drawBands = function (t, x) {
    for (const tb of DIR.bands) {
      if (t < tb - 0.45 || t > tb + 0.5) continue;
      const lead = -300 + 2600 * C.ease.inOutQuart(C.clamp((t - (tb - 0.42)) / 0.42));
      const trail = -300 + 2600 * C.ease.inOutQuart(C.clamp((t - tb) / 0.46));
      if (lead - trail < 2) continue;
      x.save(); x.fillStyle = C.col.verm;
      x.beginPath();
      const sk = 260;
      for (let i = 0; i <= 24; i++) { const y = (i / 24) * 1080; x.lineTo(lead - sk * (1 - y / 1080) + C.noise(y * 0.02, tb) * 18, y); }
      for (let i = 24; i >= 0; i--) { const y = (i / 24) * 1080; x.lineTo(trail - sk * (1 - y / 1080) + C.noise(y * 0.02, tb + 5) * 18, y); }
      x.closePath(); x.fill(); x.restore();
    }
  };
  DIR.drawWipes = function (t, x) {
    for (const w of DIR.wipes) {
      const q = (t - (w.t - WIPE)) / WIPE;
      if (q < 0 || q >= 1) continue;
      const r = 2300 * C.ease.inCubic(q) + 30 * q;
      DIR.blob(x, w.x, w.y, r, w.seed, w.toNight ? C.col.night : C.col.paper, 1);
    }
  };

  // ---- 章节卡 ----
  DIR.CH = [
    ['eq', '01', '方程', 'THE EQUATION'],
    ['run', '02', '八十八小时', 'EIGHTY-EIGHT HOURS'],
    ['human', '03', '铺路的人', 'THE PATHMAKERS'],
    ['loop', '04', '外力', 'THE FORCE'],
    ['medal', '05', '错位', 'MISALIGNMENT'],
    ['rule', '06', '章程', 'THE STATUTE'],
    ['final', '07', '奖章', 'THE MEDAL'],
  ];
  DIR.card = function (t, x) {
    for (const [id, num, zh, en] of DIR.CH) {
      const sc = S(id), t0 = sc.start, lt = t - t0;
      const first = TL.scenes.find((s) => s.id === id).lines[0].start;
      const hold = first - t0; // 首句开口前是章节卡
      if (lt < -0.1 || t > sc.end) continue;
      const night = DIR.dark(t0 + 0.05) > 0.5;
      const ink = night ? '#f2ede2' : C.col.ink;
      // 大卡：开场 hold 秒
      const out = sm((lt - (hold - 0.55)) / 0.5);
      const a = sm(lt / 0.25) * (1 - out);
      if (a > 0.002) {
        x.save(); x.globalAlpha = a;
        const cx = 960, cy = 520 - out * 40;
        const nq = C.ease.outQuart(C.clamp(lt / 0.7));
        T.draw(x, num, cx - 40 + (1 - nq) * -60, cy + 110, { size: 330, weight: 400, fam: 'geoi', col: C.rgba(C.col.verm, 0.95), align: 'right', id: 'card' });
        T.reveal(x, zh, cx + 10, cy + 30, lt - 0.15, { size: 118, weight: 900, fam: 'serif', col: ink, stag: 0.07, dur: 0.45, rise: 30, id: 'card' });
        D.line(x, cx + 12, cy + 64, cx + 12 + 560 * C.ease.inOutCubic(C.clamp((lt - 0.3) / 0.6)), cy + 64, { col: C.col.verm, lw: 4, cap: 'butt' });
        T.reveal(x, en, cx + 14, cy + 108, lt - 0.45, { size: 26, weight: 400, fam: 'geo', track: 9, col: C.rgba(ink, 0.7), stag: 0.02, dur: 0.3, rise: 8, id: 'card' });
        x.restore();
      }
      // 角标：卡片结束后常驻左上
      const b = sm((lt - hold) / 0.5) * (1 - sm((t - sc.end + 0.5) / 0.4));
      if (b > 0.002) {
        x.save(); x.globalAlpha = b * 0.9;
        T.draw(x, num, 70, 96, { size: 44, weight: 400, fam: 'geoi', col: C.col.verm, id: 'hud' });
        D.line(x, 128, 66, 128, 102, { col: C.rgba(ink, 0.4), lw: 1.5, cap: 'butt' });
        T.draw(x, zh, 142, 82, { size: 22, weight: 700, fam: 'serif', col: ink, id: 'hud' });
        T.draw(x, en, 142, 102, { size: 12, weight: 400, fam: 'geo', track: 4, col: C.rgba(ink, 0.6), id: 'hud' });
        x.restore();
      }
    }
  };

  // ---- 字幕 ----
  const SUB = (window.SUB = { units: [], nosub: new Set() });
  const TERMS = [['纳维–斯托克斯方程', 1], ['千禧年难题', 1], ['菲尔兹奖', 1], ['爆破', 1], ['Lean', 2], ['OpenAI', 2], ['Anthropic', 2],
    ['巴克马斯特', 2], ['阿尔珀格', 2], ['科尔多瓦', 2], ['马丁内斯-佐罗阿', 2], ['外力', 1], ['理解', 1], ['一百万美元', 1], ['88 小时', 1]];
  function runs(s) {
    const out = []; let i = 0;
    while (i < s.length) {
      let hit = null;
      for (const [w, c] of TERMS) if (s.startsWith(w, i) && (!hit || w.length > hit[0].length)) hit = [w, c];
      if (hit) { out.push([hit[0], hit[1]]); i += hit[0].length; }
      else { const last = out[out.length - 1]; if (last && last[1] === 0) last[0] += s[i]; else out.push([s[i], 0]); i++; }
    }
    return out;
  }
  SUB.build = function () {
    const ls = Object.values(TL.lines).sort((a, b) => a.start - b.start);
    for (const l of ls) {
      if (SUB.nosub.has(l.id)) continue;
      l.phrases.forEach((p, k) => {
        const nx = l.phrases[k + 1];
        let t1 = p.t1 + 0.28;
        if (nx && nx.t0 - p.t1 < 0.7) t1 = nx.t0 - 0.02;
        SUB.units.push({ t0: p.t0 - 0.06, t1, text: p.sub.trim() });
      });
    }
  };
  // 字幕区段存在度：相邻字幕间隔 < 0.7s 时底衬不断开，避免一闪一闪
  SUB.band = function (t) {
    let v = 0;
    for (const u of SUB.units) {
      if (t < u.t0 - 0.4 || t > u.t1 + 0.4) continue;
      v = Math.max(v, Math.min(1, (t - (u.t0 - 0.35)) / 0.35, ((u.t1 + 0.35) - t) / 0.35));
    }
    return C.smooth(v);
  };
  SUB.draw = function (t, x) {
    if (!SUB.units.length) SUB.build();
    const night = DIR.dark(t) > 0.5;
    // 全宽底衬：纯竖向渐变，左右无边
    const ba = SUB.band(t);
    if (ba > 0.002) {
      const bc = night ? '#000000' : C.col.paper;
      const g = x.createLinearGradient(0, 900, 0, 1080);
      g.addColorStop(0, C.rgba(bc, 0)); g.addColorStop(0.55, C.rgba(bc, (night ? 0.45 : 0.6) * ba)); g.addColorStop(1, C.rgba(bc, (night ? 0.6 : 0.75) * ba));
      x.fillStyle = g; x.fillRect(0, 900, 1920, 180);
    }
    const u = SUB.units.find((q) => t >= q.t0 && t < q.t1);
    if (!u) return;
    const a = sm((t - u.t0) / 0.1) * sm((u.t1 - t) / 0.12);
    const rs = runs(u.text), size = 40;
    const ws = rs.map((r) => T.width(x, r[0], { size, weight: 600, fam: 'serif' }));
    const tw = ws.reduce((p, q) => p + q, 0);
    let cx = 960 - tw / 2;
    const y = 1018 + (1 - C.ease.outCubic(C.clamp((t - u.t0) / 0.22))) * 6;
    const base = night ? '#f3efe6' : C.col.ink;
    const cols = [base, night ? '#ff8a5e' : C.col.verm, night ? '#9ccbff' : C.col.blue];
    x.save();
    // 描边式阴影：只保证可读，不做光晕
    x.shadowColor = night ? 'rgba(0,0,0,0.9)' : 'rgba(239,232,218,0.9)'; x.shadowBlur = night ? 6 : 5; x.shadowOffsetY = night ? 1 : 0;
    rs.forEach((r, i) => { T.draw(x, r[0], cx, y, { size, weight: 600, fam: 'serif', col: cols[r[1]], alpha: a, id: 'sub' }); cx += ws[i]; });
    x.restore();
  };

  DIR.init = function () {
    DIR.buildWipes();
    DIR.bands = TL.scenes.slice(1).map((s) => s.start).filter((tb) => DIR.dark(tb - 0.05) < 0.5 && DIR.dark(tb + 0.05) < 0.5);
    CUE.hits.sort((a, b) => a.t - b.t);
  };

  DIR.hitAt = function (t) {
    let fl = 0, sh = 0, zm = 0, col = null, best = 0;
    for (const h of CUE.hits) {
      if (t < h.t || t > h.t + 3) continue;
      const e = Math.exp(-(t - h.t) / h.tau);
      const f = h.flash * e; if (f > best) { best = f; col = h.col; }
      fl += f; sh += h.shake * Math.exp(-(t - h.t) / 0.28); zm += h.zoom * Math.exp(-(t - h.t) / 0.5);
    }
    return { fl, sh, zm, col };
  };

  DIR.post = function (t) {
    const dark = DIR.dark(t);
    const H = DIR.hitAt(t);
    const n1 = C.noise(t * 31, 3), n2 = C.noise(t * 29, 9);
    const P = {
      dark, ht: 0, frontGain: 1.0, inkK: 1, glowK: dark ? 1.05 : 1.6, zoom: 1 + H.zm, misreg: dark ? 0.4 : 1.2,
      shake: [n1 * H.sh * 22, n2 * H.sh * 16],
      bloomK: dark ? 0.2 : 0.08, bloomThr: dark ? 0.62 : 0.95, grain: 0.028, vign: 0.5,
      fade: 1, flash: C.clamp(H.fl), flashCol: H.col || (dark ? '#ffffff' : '#fffaf0'), fadeCol: '#000000',
    };
    for (const s of DIR.scenes) if (s.post && t >= s.t0 && t < s.t1) s.post(t, P);
    // 出夜墨迹：避免亮纸在夜态泛光/增益下跳变
    for (const w of DIR.wipes) {
      const q = (t - (w.t - WIPE)) / WIPE;
      if (q >= 0 && q < 1 && !w.toNight) { P.frontGain = 1; P.bloomK *= 1 - C.smooth(q * 1.6); }
    }
    P.fade = sm((t - 0.2) / 1.2) * (1 - sm((t - (TL.duration - 2.2)) / 2.0));
    return P;
  };

  let LAY = null;
  DIR.draw2D = function (t, L) {
    LAY = L;
    const X = { get back() { L.back.used = true; return L.back.ctx; }, get front() { L.front.used = true; return L.front.ctx; }, get ui() { L.ui.used = true; return L.ui.ctx; } };
    for (const s of DIR.scenes) if (s.draw && t >= s.t0 && t < s.t1) {
      L.back.ctx.save(); L.front.ctx.save();
      s.draw(t, X);
      L.back.ctx.restore(); L.front.ctx.restore();
    }
    DIR.card(t, X.front);
    DIR.drawBands(t, X.front);
    DIR.drawWipes(t, X.front);
    SUB.draw(t, X.ui);
  };
})();
