// 开场（夜）：9 月 1 日 → 一万个智能体点阵 → 88 小时时钟加速 → 点阵卷入涡旋坍缩成一点 → 爆开
// 标题（纸）：「AI 解决了千禧年难题」砸字 → 化墨被冲散 → 「以后的菲尔兹奖，真的只能颁给 AI 了吗？」
(window.SCENES = window.SCENES || []).push(function () {
  const A = C.A, S = C.S, sm = C.smooth, E = C.ease, cl = C.clamp;
  const sc = S('open'), ti = S('title');
  DIR.night.push([0, ti.start]);
  SUB.nosub.add('t1'); SUB.nosub.add('t2');

  const tDate = A('o1'), tAg = A('o1', 1), tWork = A('o1', 2), tEq = A('o2', 1);
  const tClock0 = C.L1('o2') + 0.25, tBoom = A('o3', 1);
  const NX = 125, NY = 80, N = NX * NY;
  const gx = new Float32Array(N), gy = new Float32Array(N), ord = new Float32Array(N), ph = new Float32Array(N), sp = new Float32Array(N);
  const R = C.rng(20260901);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i;
    gx[k] = 110 + i * (1700 / (NX - 1)); gy[k] = 190 + j * (720 / (NY - 1));
    ord[k] = R(); ph[k] = R() * 100; sp[k] = 0.4 + R() * 1.2;
  }
  const swirl = (t) => E.inCubic(cl((t - tClock0) / (tBoom - tClock0)));
  const CX = 960, CY = 560;
  const DATE = '2026 · 09 · 01';
  const NSEQ = '∂_{t}u + (u⋅∇)u = −∇p + νΔu + f';

  // ---- 音效 ----
  Array.from(DATE).forEach((c, i) => { if (c.trim()) CUE.add(tDate + 0.05 + i / 13, 'type', 0.55, { pitch: 1 + (i % 3) * 0.07 }); });
  CUE.add(tAg - 0.05, 'data', 0.7, { dur: 1.3 });
  CUE.add(tWork, 'glitch', 0.5);
  CUE.add(tEq - 0.2, 'swell', 0.6, { dur: 2.4 });
  let last = -1;
  for (let h = 1; h <= 88; h++) {
    // 时钟到 h 小时的时刻：h/88 = u^2.2
    const u = Math.pow(h / 88, 1 / 2.2), tt = tClock0 + u * (tBoom - tClock0);
    if (tt - last > 0.075) { CUE.add(tt, 'clock', 0.35 + 0.35 * u, { pitch: 1 + u * 0.5 }); last = tt; }
  }
  CUE.add(tClock0 + 0.3, 'riser', 0.9, { dur: tBoom - tClock0 - 0.3 });
  CUE.add(tBoom - 1.2, 'reverse', 0.8, { dur: 1.2 });
  CUE.add(tBoom, 'hit', 1.3); CUE.add(tBoom, 'boom', 1.0);
  CUE.hit(tBoom, { flash: 0.7, shake: 1.2, tau: 0.16, col: '#fff4e6', zoom: 0.035 });

  DIR.reg('open', sc.start, sc.end, {
    sim(t, s) {
      const q = swirl(t);
      s.p.velDiss = 1.2; s.p.dyeDiss = 0.35; s.p.vort = 26;
      if (t > tClock0 && t < tBoom) {
        s.p.field = [{ x: CX, y: CY, R: 620, swirl: 2600 * (0.25 + 1.6 * q), radial: 700 * q, lin: 0.4 }];
        const a = t * (3 + 9 * q), rr = 560 * (1 - q) + 30;
        for (let k = 0; k < 3; k++) {
          const b = a + (k * Math.PI * 2) / 3;
          const warm = q > 0.45 ? 1 : 0;
          s.dye(CX + Math.cos(b) * rr * 1.2, CY + Math.sin(b) * rr * 0.75, 20 + 20 * q, [warm * 0.04, (1 - warm) * 0.04, 0, 0]);
        }
      }
      if (s.at(tBoom)) {
        s.stamp((x) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(CX, CY, 420, 0, Math.PI * 2); x.fill(); }, { vel: { k: 1, boom: 2600, cx: CX, cy: CY } });
        s.dye(CX, CY, 60, [0.22, 0, 0.5, 0]);
        s.dye(CX, CY, 240, [0.07, 0.05, 0, 0]);
      }
      if (t > tBoom) { s.p.velDiss = 0.9; s.p.dyeDiss = 0.55; }
    },
    draw(t, X) {
      const x = X.front, q = swirl(t);
      // 日期
      const dl = t - tDate;
      if (dl > -0.2) {
        const up = E.inOutCubic(cl((t - (tAg - 0.3)) / 0.8));
        const a = sm(dl / 0.2) * (1 - sm((t - (tClock0 - 0.1)) / 0.5));
        if (a > 0.002) {
          x.save(); x.globalAlpha = a;
          const size = C.lerp(120, 34, up), y = C.lerp(560, 108, up);
          FX.type(x, DATE, C.lerp(960 - T.width(x, DATE, { size: 120, fam: 'mono' }) / 2, 110, up), y, dl, 13,
            { size, fam: 'mono', weight: 400, col: '#f4efe4', id: 'date', cursorOff: tAg - tDate });
          x.restore();
        }
      }
      // 智能体点阵
      if (t > tAg - 0.1 && t < tBoom + 2.4) {
        const appear = (t - tAg) / 1.1;
        const work = sm((t - tWork) / 0.6);
        const post = t - tBoom;
        x.save();
        for (let k = 0; k < N; k++) {
          const ap = cl((appear - ord[k]) * 6);
          if (ap <= 0) continue;
          let px = gx[k], py = gy[k], al = 0.55 * ap;
          if (q > 0) {
            const dx = px - CX, dy = py - CY, dd = Math.hypot(dx, dy);
            const th = (7 + 5 * (1 - dd / 1100)) * q * q, sc2 = Math.pow(1 - q, 1.15);
            const c = Math.cos(th), s = Math.sin(th);
            px = CX + (dx * c - dy * s) * sc2; py = CY + (dx * s + dy * c) * sc2 * (1 - 0.25 * q);
          }
          if (post > 0) {
            const a2 = ph[k] * 6.283, v = 300 + 1300 * ord[k];
            const r = v * (1 - Math.exp(-post * 2.4)) / 2.4;
            px = CX + Math.cos(a2) * r; py = CY + Math.sin(a2) * r * 0.7;
            al = 0.9 * Math.exp(-post * 1.6) * ap;
          }
          const tw = work * (0.5 + 0.5 * Math.sin(t * 7 * sp[k] + ph[k])) ** 6;
          al = Math.min(1, al + tw * 0.45 + q * 0.4);
          const hot = q > 0.55 || (tw > 0.7);
          x.globalAlpha = al;
          x.fillStyle = hot ? (k % 3 === 0 ? '#ff8a4c' : '#9fe2ff') : '#dfe8ff';
          const sz = 2.2 + tw * 1.6 + q * 0.8;
          x.fillRect(px - sz / 2, py - sz / 2, sz, sz);
        }
        // 消息连线：短暂闪现的近邻连线
        if (t > tWork && q < 0.9 && t < tBoom) {
          const bucket = Math.floor(t * 12), Rb = C.rng(bucket * 977 + 3);
          x.globalAlpha = 0.5 * work * (1 - q); x.strokeStyle = '#7fd4ff'; x.lineWidth = 1;
          x.beginPath();
          for (let m = 0; m < 90; m++) {
            const i = Math.floor(Rb() * NX), j = Math.floor(Rb() * NY), k = j * NX + i;
            const i2 = C.clamp(i + Math.floor((Rb() - 0.5) * 16), 0, NX - 1), j2 = C.clamp(j + Math.floor((Rb() - 0.5) * 12), 0, NY - 1);
            const k2 = j2 * NX + i2;
            const f = (kk) => { const dx = gx[kk] - CX, dy = gy[kk] - CY, dd = Math.hypot(dx, dy), th = (7 + 5 * (1 - dd / 1100)) * q * q, s2 = Math.pow(1 - q, 1.15);
              return [CX + (dx * Math.cos(th) - dy * Math.sin(th)) * s2, CY + (dx * Math.sin(th) + dy * Math.cos(th)) * s2 * (1 - 0.25 * q)]; };
            const p1 = f(k), p2 = f(k2);
            x.moveTo(p1[0], p1[1]); x.lineTo(p2[0], p2[1]);
          }
          x.stroke();
        }
        x.restore();
        // 智能体计数
        const ca = sm((t - tAg) / 0.3) * (1 - sm((t - tClock0) / 0.4));
        if (ca > 0.002) {
          x.save(); x.globalAlpha = ca;
          T.draw(x, 'AGENTS', 1810, 96, { size: 16, fam: 'geo', track: 6, col: 'rgba(230,236,255,0.6)', align: 'right', id: 'hud' });
          T.draw(x, FX.num(10000 * E.outCubic(cl((t - tAg) / 1.1))), 1810, 146, { size: 46, fam: 'mono', col: '#f4efe4', align: 'right', id: 'agents' });
          x.restore();
        }
      }
      // 方程淡现
      const ea = sm((t - tEq) / 0.9) * (1 - sm((t - tClock0 - 0.6) / 0.8));
      if (ea > 0.002) {
        x.save(); x.globalAlpha = ea;
        x.fillStyle = 'rgba(5,6,10,0.7)'; x.fillRect(360, 470, 1200, 170);
        M.draw(x, NSEQ, 960, 578, { size: 76, col: '#fff6e8', align: 'center', p: cl((t - tEq) / 1.6), id: 'eq' });
        T.draw(x, '1934  →  2026', 960, 626, { size: 22, fam: 'geo', track: 5, col: 'rgba(240,230,210,0.6)', align: 'center', id: 'years' });
        x.restore();
      }
      // 88 小时时钟
      const cl0 = t - tClock0;
      if (cl0 > -0.3 && t < sc.end) {
        const h = 88 * Math.pow(cl(cl0 / (tBoom - tClock0)), 2.2);
        const hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = Math.floor(((h - hh) * 60 - mm) * 60);
        const s = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
        const post = t - tBoom;
        const a = sm((cl0 + 0.3) / 0.3) * (1 - sm((t - (sc.end - 1.0)) / 0.4));
        const pulse = post > 0 ? 1 + 0.25 * Math.exp(-post * 5) : 1;
        const y = post > 0 ? C.lerp(150, 560, E.outQuart(cl(post / 0.5))) : 150;
        const size = (post > 0 ? C.lerp(64, 170, E.outQuart(cl(post / 0.5))) : 64) * pulse;
        x.save(); x.globalAlpha = a;
        T.draw(x, 'T +', 960 - T.width(x, s, { size, fam: 'mono' }) / 2 - 20, y, { size: size * 0.42, fam: 'mono', col: 'rgba(255,200,160,0.8)', align: 'right', id: 'clock' });
        T.draw(x, s, 960, y, { size, fam: 'mono', col: post > 0 ? '#fff1dc' : '#f4efe4', align: 'center', id: 'clock' });
        if (post < 0) T.draw(x, 'HOURS', 960, y + 34, { size: 14, fam: 'geo', track: 8, col: 'rgba(230,236,255,0.55)', align: 'center', id: 'hud' });
        x.restore();
        // 冲击波环
        if (post > 0 && post < 1.4) {
          const r = 60 + 1500 * E.outCubic(post / 1.4);
          x.save(); x.globalAlpha = 0.8 * (1 - post / 1.4); x.strokeStyle = '#ffd7b0'; x.lineWidth = 3 + 14 * (1 - post / 1.4);
          x.beginPath(); x.ellipse(CX, CY, r, r * 0.72, 0, 0, Math.PI * 2); x.stroke(); x.restore();
        }
      }
    },
  });

  // ================= 标题 =================
  const t1 = A('t1'), t2 = A('t2'), t2b = A('t2', 1);
  const tMelt = t2 - 0.55;
  const L1a = 'AI 解决了', L1b = '千禧年难题';
  const f1 = { size: 176, weight: 900, fam: 'serif', align: 'center' };
  FX.slamTimes(L1a, t1, 0.05).forEach((tt, i) => CUE.add(tt, 'slam', 0.55 + 0.05 * i));
  FX.slamTimes(L1b, t1 + 0.42, 0.06).forEach((tt, i) => CUE.add(tt, 'slam', 0.7 + 0.06 * i));
  CUE.hit(t1 + 0.42 + 4 * 0.06 + 0.28, { flash: 0.0, shake: 0.9, zoom: 0.015 });
  CUE.add(t1 + 0.42 + 4 * 0.06 + 0.28, 'hit', 0.9);
  CUE.add(tMelt, 'melt', 0.9, { dur: 1.8 });
  FX.slamTimes('以后的菲尔兹奖，', t2, 0.045).forEach((tt, i) => CUE.add(tt, 'slam', 0.45));
  FX.slamTimes('真的只能颁给 AI 了吗？', t2b, 0.045).forEach((tt, i) => CUE.add(tt, 'slam', 0.5 + 0.03 * i));
  const tQ = t2b + 12 * 0.045 + 0.28;
  CUE.add(tQ, 'hit', 1.1); CUE.hit(tQ, { shake: 1.0, zoom: 0.02 });

  DIR.reg('title', ti.start, ti.end, {
    sim(t, s) {
      s.p.velDiss = 0.5; s.p.dyeDiss = 0.12; s.p.vort = 34;
      if (s.at(tMelt)) {
        // 标题文字 → 墨，并给一股向左上的冲散 + 外爆
        s.stamp((x) => {
          T.draw(x, L1a, 960, 440, Object.assign({}, f1, { col: '#0000ff' }));
          T.draw(x, L1b, 960, 650, Object.assign({}, f1, { col: '#0000ff' }));
          FX.under(x, 560, 1360, 700, 1, 16, '#ff0000', 7);
        }, { dye: 1.25, vel: { k: 1, push: [-260, -120], boom: 520, cx: 960, cy: 540 } });
      }
      if (t > tMelt) s.p.wind = [260, 2.2, t, -40];
    },
    draw(t, X) {
      const x = X.front, b = X.back;
      // 眉题
      const ka = sm((t - (ti.start + 0.5)) / 0.4) * (1 - sm((t - tMelt) / 0.3));
      if (ka > 0.002) {
        x.save(); x.globalAlpha = ka;
        T.reveal(x, 'NAVIER–STOKES  ·  MILLENNIUM PRIZE  ·  2026', 960, 238, t - ti.start - 0.5, { size: 20, fam: 'geo', track: 8, col: C.col.ink2, align: 'center', stag: 0.012, dur: 0.3, rise: 6, id: 'kicker' });
        x.restore();
      }
      if (t < tMelt) {
        FX.slam(x, L1a, 960, 440, t - t1, Object.assign({}, f1, { col: C.col.ink, stag: 0.05, id: 'title1' }));
        FX.slam(x, L1b, 960, 650, t - t1 - 0.42, Object.assign({}, f1, { col: C.col.ink, stag: 0.06, id: 'title1' }));
        FX.under(x, 560, 1360, 700, E.outCubic(cl((t - t1 - 1.0) / 0.5)), 16, C.col.verm, 7);
      }
      // 菲尔兹奖章（背景半色调，缓转）
      const ma = sm((t - t2) / 1.0) * (1 - sm((t - (ti.end - 0.8)) / 0.5));
      if (ma > 0.002) {
        b.save(); b.globalAlpha = ma * 0.22; b.translate(1480, 560); b.rotate((t - t2) * 0.03);
        const im = IMG.ht.medal; b.drawImage(im, -im.width * 0.62, -im.height * 0.62, im.width * 1.24, im.height * 1.24); b.restore();
      }
      if (t > t2 - 0.1) {
        const fa = 1 - sm((t - (ti.end - 0.6)) / 0.4);
        x.save(); x.globalAlpha = fa;
        const o2 = { size: 104, weight: 900, fam: 'serif', align: 'left', col: C.col.ink };
        FX.slam(x, '以后的菲尔兹奖，', 250, 470, t - t2, Object.assign({}, o2, { stag: 0.045, id: 'title2' }));
        const lt = t - t2b;
        // 第二行分段着色：AI 用朱砂
        const segs = [['真的只能颁给 ', C.col.ink], ['AI', C.col.verm], [' 了吗', C.col.ink]];
        let cx = 250, k = 0;
        for (const [s, col] of segs) {
          const w = T.width(x, s, o2);
          FX.slam(x, s, cx, 640, lt - k * 0.045, Object.assign({}, o2, { col, stag: 0.045, id: 'title2' }));
          cx += w; k += Array.from(s).length;
        }
        // 巨大问号
        const ql = t - tQ;
        if (ql > -0.3) {
          const qq = C.spring(cl(ql + 0.3), 2.2, 0.5);
          x.save(); x.translate(cx + 90, 610); x.scale(0.4 + 0.6 * qq, 0.4 + 0.6 * qq); x.rotate(0.08 * (1 - qq));
          T.draw(x, '？', 0, 150, { size: 420, weight: 900, fam: 'serif', col: C.col.verm, align: 'center', alpha: cl((ql + 0.3) * 4), id: 'q' });
          x.restore();
        }
        x.restore();
      }
    },
  });
});
