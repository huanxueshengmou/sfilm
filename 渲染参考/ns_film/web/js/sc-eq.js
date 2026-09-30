// 01 方程（纸）：水流/气流/血液/天气 → 方程凝结 → F=ma 与各项释义 → 爆破曲线 → 「爆破」炸墨 → 克雷 2000 与七道难题
(window.SCENES = window.SCENES || []).push(function () {
  const A = C.A, S = C.S, sm = C.smooth, E = C.ease, cl = C.clamp, Wf = C.Wf;
  const sc = S('eq');
  SUB.nosub.add('e4');
  const EQ = '@a{∂_{t}u + (u⋅∇)u} = @p{−∇p} + @v{νΔu} + @f{f}';
  const EQS = 78;
  const words = [['水流', 'g', 440, 360], ['气流', 'b', 820, 300], ['血液', 'r', 1180, 380], ['天气', 'g', 1520, 320]];
  const tw = words.map((w, i) => Wf('e1', w[0], A('e1') + i * 0.6));
  const tEqIn = A('e1', 2), tF = A('e2'), tLab = A('e2', 1);
  const tG = A('e3'), tSmooth = A('e3', 1), tFin = A('e3', 2), tLose = A('e3', 3), tInf = A('e3', 4);
  const tBoom = C.Wd('e4', '爆破');
  const tClay = A('e5'), tClay2 = A('e5', 1), tPrize = A('e5', 2), tSix = A('e6'), tOne = A('e6', 1);
  const EQY = 520;
  const PROBS = [
    ['P 对 NP', 'P vs NP'], ['霍奇猜想', 'Hodge'], ['庞加莱猜想', 'Poincaré'], ['黎曼猜想', 'Riemann'],
    ['杨–米尔斯', 'Yang–Mills'], ['纳维–斯托克斯', 'Navier–Stokes'], ['BSD 猜想', 'Birch–Swinnerton-Dyer'],
  ];

  // 曲线：|u|max(t) = 1/(T*-t)^0.8，T* 在屏幕 x=1380
  const GX0 = 420, GX1 = 1500, GY0 = 880, GY1 = 300, TS = 1380;
  const curveY = (px) => { const d = Math.max(4, TS - px); return GY0 - 5200 / Math.pow(d, 0.72) + 5200 / Math.pow(TS - GX0, 0.72); };
  const curvePts = (p) => { const pts = []; const xe = GX0 + (TS - 6 - GX0) * p; for (let px = GX0; px <= xe; px += 4) { const y = curveY(px); if (y < 150) break; pts.push([px, y]); } return pts; };
  const gp = (t) => {
    // 曲线推进：光滑段 → 有限时间 → 失控
    if (t < tSmooth) return 0;
    if (t < tLose) return 0.62 * E.inOutSine(cl((t - tSmooth) / (tLose - tSmooth)));
    return 0.62 + 0.38 * E.inCubic(cl((t - tLose) / (tInf - tLose + 0.3)));
  };

  // ---- 音效 ----
  words.forEach((w, i) => { CUE.add(tw[i], 'drop', 0.7, { pitch: 1 + i * 0.12 }); });
  CUE.add(tEqIn - 0.1, 'pen', 0.5, { dur: 1.3 }); CUE.add(tEqIn + 1.3, 'chime', 0.5);
  CUE.add(tF, 'slam', 0.6); CUE.add(tLab, 'pen', 0.4, { dur: 0.9 });
  ['a', 'p', 'v', 'f'].forEach((k, i) => CUE.add(tLab + 0.12 + i * 0.22, 'tick', 0.5, { pitch: 1.2 + i * 0.1 }));
  CUE.add(tG, 'whoosh', 0.45); CUE.add(tSmooth, 'pen', 0.45, { dur: tLose - tSmooth });
  CUE.add(tLose, 'riser', 0.8, { dur: tBoom - tLose }); CUE.add(tInf + 0.3, 'tick', 0.6, { pitch: 2 });
  CUE.add(tBoom, 'hit', 1.3); CUE.add(tBoom, 'boom', 0.9); CUE.add(tBoom + 0.02, 'splash', 1.0);
  CUE.hit(tBoom, { flash: 0.25, shake: 1.6, tau: 0.12, col: '#fff3e0', zoom: 0.03 });
  CUE.add(tClay, 'type', 0.5); CUE.add(tClay2, 'whoosh', 0.5);
  PROBS.forEach((_, i) => CUE.add(tClay2 + 0.3 + i * 0.16, 'card', 0.45, { pitch: 1 + i * 0.05 }));
  CUE.add(tPrize, 'coin', 0.8); CUE.add(tPrize + 0.9, 'chime', 0.4);
  const tStamp = Wf('e6', '一道', tOne + 0.5);
  CUE.add(tStamp, 'stamp', 1.0); CUE.hit(tStamp, { shake: 0.5 });

  DIR.reg('eq', sc.start, sc.end, {
    sim(t, s) {
      s.p.velDiss = 0.35; s.p.dyeDiss = 0.07; s.p.vort = 30;
      s.p.wind = [110, 1.6, t * 0.6, 30];
      words.forEach((w, i) => {
        if (s.at(tw[i])) FX.drop(s, w[2], w[3] + 60, 42, w[1], 0.9, 520, 11 + i);
        if (t > tw[i] && t < tw[i] + 1.2) s.dye(w[2] + Math.sin(t * 5 + i) * 30, w[3] + 60, 16, [w[1] === 'r' ? 0.03 : 0, w[1] === 'g' ? 0.03 : 0, w[1] === 'b' ? 0.02 : 0, 0]);
      });
      if (s.at(tEqIn + 1.4)) {
        // 方程墨影：印一次淡墨，风把它吹成烟
        s.stamp((x) => M.draw(x, EQ, 960, EQY, { size: EQS, col: '#0000ff', align: 'center' }), { dye: 0.22 });
      }
      if (s.at(tBoom)) {
        FX.drop(s, TS, 300, 90, 'b', 1.6, 1400, 91);
        FX.drop(s, TS - 30, 330, 50, 'r', 1.5, 1100, 92);
        s.stamp((x) => { x.lineWidth = 10; x.strokeStyle = '#fff'; x.beginPath(); curvePts(1).forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); },
          { vel: { k: 1, boom: 900, cx: TS, cy: 320 } });
        s.stamp((x) => { x.lineWidth = 9; x.strokeStyle = '#ff0000'; x.beginPath(); curvePts(1).forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); }, { dye: 0.9 });
      }
      if (t > tBoom && t < tBoom + 2.5) s.p.wind = [260, 1.6, t * 0.6, 60];
    },
    draw(t, X) {
      const x = X.front, b = X.back;
      // ---- 四个词 ----
      const wa = 1 - sm((t - (tEqIn - 0.3)) / 0.5);
      if (wa > 0.002) words.forEach((w, i) => {
        const lt = t - tw[i];
        if (lt < 0) return;
        x.save(); x.globalAlpha = wa;
        const col = w[1] === 'r' ? C.col.verm : w[1] === 'g' ? C.col.blue : C.col.ink;
        FX.slam(x, w[0], w[2], w[3], lt, { size: 96, weight: 900, fam: 'serif', col, align: 'center', stag: 0.06, id: 'w' + i });
        T.draw(x, ['WATER', 'AIR', 'BLOOD', 'WEATHER'][i], w[2], w[3] + 42, { size: 16, fam: 'geo', track: 6, col: C.rgba(C.col.ink2, 0.8 * cl(lt * 3)), align: 'center', id: 'we' + i });
        x.restore();
      });
      // ---- 方程主体 ----
      const toTop = E.inOutCubic(cl((t - (tG - 0.2)) / 0.7));
      const eqOut = sm((t - (tBoom - 0.1)) / 0.2);
      if (t > tEqIn - 0.1 && eqOut < 1) {
        const size = C.lerp(EQS, 44, toTop), y = C.lerp(EQY, 176, toTop), cx = C.lerp(960, 960, toTop);
        const lab = cl((t - tLab) / 0.5) * (1 - sm((t - (tG - 0.3)) / 0.3));
        x.save(); x.globalAlpha = 1 - eqOut;
        const fcol = C.mixHex(C.col.ink, C.col.verm, lab);
        M.draw(x, EQ, cx, y, { size, col: C.col.ink, cols: { f: fcol }, align: 'center', p: cl((t - tEqIn) / 1.3), id: 'eq' });
        // 名称
        const na = sm((t - tEqIn - 0.4) / 0.4) * (1 - toTop);
        if (na > 0.002) T.reveal(x, 'NAVIER – STOKES', 960, y + 90, t - tEqIn - 0.4, { size: 24, fam: 'geo', track: 12, col: C.rgba(C.col.ink2, na), align: 'center', stag: 0.02, id: 'nsname' });
        // F = ma
        const fa = sm((t - tF) / 0.3) * (1 - sm((t - (tG - 0.3)) / 0.3));
        if (fa > 0.002) {
          x.globalAlpha = fa * (1 - eqOut);
          FX.slam(x, 'F = ma', 960, 330, t - tF, { size: 92, fam: 'geoi', col: C.col.ink, align: 'center', stag: 0.06, id: 'fma' });
          D.arrow(x, 960, 356, 960, 430, { col: C.col.ink2, lw: 2.5, p: E.outCubic(cl((t - tF - 0.4) / 0.4)), head: 12 });
          T.draw(x, '牛顿第二定律', 1110, 318, { size: 26, weight: 700, fam: 'serif', col: C.col.ink2, alpha: cl((t - tF - 0.3) * 3), id: 'newton' });
        }
        // 各项释义
        if (lab > 0.002) {
          const labels = [['a', '加速度', C.col.ink], ['p', '压力', C.col.ink], ['v', '黏性', C.col.blue], ['f', '外力', C.col.verm]];
          labels.forEach(([k, zh, col], i) => {
            const bx = M.keyBox(x, EQ, cx, size, 'center', k); if (!bx) return;
            const q = E.outCubic(cl((t - tLab - 0.1 - i * 0.22) / 0.4));
            if (q <= 0) return;
            x.globalAlpha = lab * (1 - eqOut);
            FX.brush(x, [[bx.x0, y + 26], [bx.x1, y + 26]], q, 5, col, 20 + i);
            T.draw(x, zh, bx.cx, y + 78, { size: 34, weight: 700, fam: 'serif', col, align: 'center', alpha: q, id: 'lab' + k });
          });
        }
        x.restore();
      }
      // Stokes 肖像
      const pa = sm((t - (tF - 0.2)) / 0.5) * (1 - sm((t - (tG - 0.2)) / 0.4));
      if (pa > 0.002) {
        b.save(); b.globalAlpha = pa * 0.85;
        const im = IMG.ht.stokes; b.drawImage(im, 70, 280, im.width * 0.8, im.height * 0.8);
        b.restore();
        x.save(); x.globalAlpha = pa;
        T.draw(x, 'G. G. STOKES', 254, 740, { size: 18, fam: 'geo', track: 5, col: C.col.ink2, align: 'center', id: 'stokes' });
        T.draw(x, '1819 – 1903', 254, 766, { size: 16, fam: 'geoi', col: C.col.mute, align: 'center', id: 'stokes' });
        x.restore();
      }
      // ---- 爆破曲线 ----
      const ga = sm((t - tG) / 0.4) * (1 - sm((t - tBoom) / 0.06));
      if (ga > 0.002) {
        x.save(); x.globalAlpha = ga;
        const ax = E.outCubic(cl((t - tG) / 0.6));
        D.line(x, GX0, GY0, GX0 + (GX1 - GX0) * ax, GY0, { col: C.col.ink, lw: 2.5, cap: 'butt' });
        D.line(x, GX0, GY0, GX0, GY0 - (GY0 - 200) * ax, { col: C.col.ink, lw: 2.5, cap: 'butt' });
        T.draw(x, 't', GX1 + 18, GY0 + 10, { size: 40, fam: 'math', col: C.col.ink, id: 'axt' });
        M.draw(x, 'max |u|', GX0 - 20, 190, { size: 34, col: C.col.ink, align: 'right', id: 'axu' });
        // T* 虚线
        const ts = sm((t - tFin) / 0.4);
        if (ts > 0.002) {
          D.line(x, TS, GY0, TS, GY0 - (GY0 - 180) * E.outCubic(cl((t - tFin) / 0.6)), { col: C.rgba(C.col.verm, 0.8 * ts), lw: 2, dash: [10, 10], cap: 'butt' });
          M.draw(x, 'T^{*}', TS, GY0 + 52, { size: 40, col: C.col.verm, align: 'center', alpha: ts, id: 'tstar' });
          T.draw(x, '有限时间', TS, GY0 + 94, { size: 24, weight: 700, fam: 'serif', col: C.col.verm, align: 'center', alpha: ts, id: 'finite' });
        }
        const pts = curvePts(gp(t));
        FX.brush(x, pts, 1, 7, C.col.ink, 33);
        // 光滑区标注
        const sa = sm((t - tSmooth - 0.2) / 0.4) * (1 - sm((t - tLose) / 0.4));
        if (sa > 0.002) T.draw(x, '光滑', 640, GY0 - 60, { size: 30, weight: 700, fam: 'serif', col: C.col.blue, alpha: sa, id: 'smooth' });
        if (t > tInf) {
          const ia = C.spring(t - tInf, 2.5, 0.45);
          x.save(); x.translate(TS + 80, 250); x.scale(ia, ia);
          T.draw(x, '∞', 0, 40, { size: 140, fam: 'geo', col: C.col.verm, align: 'center', id: 'inf' });
          x.restore();
        }
        // 屏幕抖动感：接近 T* 的颤线
        if (t > tLose) {
          const e = cl((t - tLose) / (tBoom - tLose));
          for (let k = 0; k < 3; k++) {
            const px = TS - 30 - k * 24, py = curveY(px);
            if (py > 150) D.line(x, px - 14 + C.noise(t * 40 + k, 3) * 6 * e, py, px + 14, py, { col: C.rgba(C.col.verm, 0.6 * e), lw: 2 });
          }
        }
        x.restore();
      }
      // ---- 爆破 ----
      const bl = t - tBoom;
      if (bl > -0.05 && t < tClay - 0.4) {
        const a = 1 - sm((t - (tClay - 1.0)) / 0.5);
        x.save(); x.globalAlpha = a;
        const q = C.spring(cl(bl + 0.05), 3.4, 0.35);
        x.translate(960, 560); x.scale(0.3 + 0.7 * q, 0.3 + 0.7 * q); x.rotate(-0.04 * (1 - q));
        T.draw(x, '爆破', 0, 110, { size: 330, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', id: 'blow' });
        x.restore();
        x.save(); x.globalAlpha = a * cl((bl - 0.25) * 3);
        T.draw(x, 'B L O W – U P', 960, 760, { size: 34, fam: 'geoi', track: 10, col: C.col.verm, align: 'center', id: 'blowen' });
        x.restore();
      }
      // ---- 克雷 2000 ----
      const cla = sm((t - (tClay - 0.2)) / 0.3);
      if (cla > 0.002) {
        const lt = t - tClay;
        x.save(); x.globalAlpha = cla;
        FX.slam(x, '2000', 150, 250, lt, { size: 150, fam: 'geoi', col: C.col.verm, stag: 0.06, id: 'y2000' });
        T.reveal(x, 'PARIS  ·  CLAY MATHEMATICS INSTITUTE', 540, 222, lt - 0.3, { size: 20, fam: 'geo', track: 6, col: C.col.ink2, stag: 0.012, id: 'clay' });
        T.reveal(x, '七大千禧年难题', 540, 262, t - tClay2, { size: 34, weight: 900, fam: 'serif', col: C.col.ink, stag: 0.05, id: 'seven' });
        // 七张卡
        const cw = 216, ch = 300, gap = 22, x0 = 960 - (7 * cw + 6 * gap) / 2, y0 = 360;
        PROBS.forEach(([zh, en], i) => {
          const q = E.outBackSoft(cl((t - tClay2 - 0.3 - i * 0.16) / 0.45));
          if (q <= 0) return;
          const isNS = i === 5, isP = i === 2;
          const lift = isNS ? E.inOutCubic(cl((t - (tOne + 1.1)) / 0.7)) : 0;
          const dim = (t > tOne + 1.1 && !isNS) ? 0.35 * sm((t - tOne - 1.1) / 0.6) : 0;
          const cx = x0 + i * (cw + gap) + cw / 2, cy = y0 + ch / 2 + (1 - q) * 80 - lift * 30;
          x.save(); x.globalAlpha = cla * cl(q * 2) * (1 - dim);
          FX.sheet(x, cx, cy, cw, ch, (C.hash(i * 7) - 0.5) * 0.04, { fill: '#faf6ec', blur: 18 + lift * 20, off: 8 + lift * 10 });
          if (isNS) { x.strokeStyle = C.rgba(C.col.verm, lift); x.lineWidth = 5; x.strokeRect(cx - cw / 2 + 4, cy - ch / 2 + 4, cw - 8, ch - 8); }
          T.draw(x, String(i + 1).padStart(2, '0'), cx - cw / 2 + 18, cy - ch / 2 + 56, { size: 44, fam: 'geoi', col: isNS ? C.col.verm : C.col.mute, id: 'pn' });
          const zs = zh.length > 5 ? 30 : 34;
          T.draw(x, zh, cx, cy + 30, { size: zs, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', id: 'pz' + i });
          T.draw(x, en, cx, cy + 66, { size: en.length > 14 ? 12 : 15, fam: 'geoi', col: C.col.ink2, align: 'center', id: 'pe' + i });
          D.line(x, cx - 40, cy + 100, cx + 40, cy + 100, { col: C.rgba(C.col.ink, 0.25), lw: 1, cap: 'butt' });
          T.draw(x, '$1,000,000', cx, cy + 128, { size: 16, fam: 'mono', col: C.rgba(C.col.ink2, cl((t - tPrize) * 2)), align: 'center', id: 'pm' + i });
          x.restore();
          if (isP) {
            FX.stamp(x, '已解决', cx, cy - 20, t - tStamp, { size: 44, rot: -0.14, double: true, seed: 5, id: 'solved' });
            x.save(); x.globalAlpha = cl((t - tStamp - 0.3) * 3) * cla;
            T.draw(x, '2003 · 佩雷尔曼', cx, cy + ch / 2 + 34, { size: 18, weight: 700, fam: 'serif', col: C.col.verm, align: 'center', id: 'perelman' });
            x.restore();
          }
        });
        // 奖金
        const pl = t - tPrize;
        if (pl > 0) {
          const v = 1e6 * E.outQuart(cl(pl / 0.9));
          T.draw(x, '$' + FX.num(v), 1790, 250, { size: 64, fam: 'mono', col: C.col.ink, align: 'right', alpha: cl(pl * 4), id: 'prize' });
          T.draw(x, '每题悬赏', 1790, 196, { size: 22, weight: 700, fam: 'serif', col: C.col.ink2, align: 'right', alpha: cl(pl * 4), id: 'prize' });
        }
        // 26 年
        const sl = t - tSix;
        if (sl > 0) {
          x.globalAlpha = cla * cl(sl * 3) * (1 - sm((t - (sc.end - 0.5)) / 0.3));
          T.draw(x, '26 年 · 7 题 · 1 解', 960, 830, { size: 40, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', id: 'tally' });
        }
        x.restore();
      }
    },
  });
});
