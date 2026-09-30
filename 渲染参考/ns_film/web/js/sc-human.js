// 03 铺路的人（纸）：12 小时时间轴 → 巴克马斯特肖像 → 一年的路 → 砖层（无穷级联）→ 科尔多瓦引语 → 数据之河与四次口径 → 故事的一部分
(window.SCENES = window.SCENES || []).push(function () {
  const A = C.A, S = C.S, sm = C.smooth, E = C.ease, cl = C.clamp, Wf = C.Wf;
  const sc = S('human');
  SUB.nosub.add('h4');
  const tH1 = A('h1'), tBk = A('h1', 1), tSt = A('h1', 2);
  const tH2 = A('h2'), tYear = A('h2', 1), tEul = A('h2', 2);
  const tH3 = A('h3'), tNames = A('h3', 1), tBrick = A('h3', 2);
  const tH4 = A('h4'), tQ1 = A('h4', 1), tQ2 = A('h4', 2);
  const tH5 = A('h5'), tAdm = A('h5', 1), tRule = A('h5', 2), tLat = A('h5', 3), tNoI = A('h5', 4);
  const tH6 = A('h6'), tMon = A('h6', 1), tRec = A('h6', 2), tPart = A('h6', 3);
  const TX0 = 260, TX1 = 1660, TY = 620;
  // 时间轴：9/7 18:00 → 9/8 18:00（24h）
  const tx = (h) => TX0 + ((h - 18) / 24) * (TX1 - TX0);
  const statements = [
    ['9 · 08', '“无法排除”', 'cannot rule out that de-identified data … helped improve our models'],
    ['9 · 09', '“绝无可能”', 'categorically impossible … to have influenced the system'],
    ['9 · 10', '“调查确认”', 'confirmed … could not have influenced the system in any way'],
    ['9 · 13', '“7 月 3 日之后”', 'no user inputs past July 3rd could have influenced this system'],
  ];
  const bricks = [['2013', 'Hou–Luo · 数值证据'], ['2021', '马丁内斯-佐罗阿 · 博士论文'], ['2023', '科尔多瓦–马丁内斯-佐罗阿 · 带外力欧拉爆破'],
    ['2024', '+ 郑凡 · 超耗散 N–S'], ['2026', '巴克马斯特–阿尔珀格 · 光滑外力']];

  // ---- 音效 ----
  CUE.add(tH1, 'tick', 0.5); CUE.add(tH1 + 0.3, 'pen', 0.6, { dur: 1.4 });
  CUE.add(tx(23.9) > 0 ? tH1 + 0.9 : tH1, 'blip', 0.6, { pitch: 1 }); CUE.add(tH1 + 1.6, 'blip', 0.6, { pitch: 1.5 });
  CUE.add(tBk, 'card', 0.7); CUE.add(tSt, 'page', 0.6);
  CUE.add(tH2 + 0.3, 'card', 0.5); CUE.add(tYear, 'pen', 0.7, { dur: 2.0 }); CUE.add(tEul + 0.9, 'stamp', 0.9); CUE.hit(tEul + 0.9, { shake: 0.4 });
  CUE.add(tH3 - 0.3, 'whoosh', 0.5);
  bricks.forEach((_, i) => CUE.add(tNames + 0.2 + i * 0.55, 'brick', 0.8, { pitch: 1 - i * 0.05 }));
  CUE.add(tBrick + 0.6, 'hit', 0.7);
  CUE.add(tH4 - 0.1, 'swell', 0.5, { dur: 3.5 }); CUE.add(tQ2 + 0.2, 'drop', 0.8, { pitch: 0.7 });
  CUE.add(tH5, 'data', 0.6, { dur: 2.5 });
  [tAdm, tRule + 0.8, tLat, tNoI + 0.4].forEach((tt, i) => CUE.add(tt, 'card', 0.6, { pitch: 1 + i * 0.08 }));
  CUE.add(tMon + 0.4, 'pen', 0.6, { dur: 0.4 }); CUE.add(tPart, 'swell', 0.8, { dur: 3 }); CUE.add(tPart + 0.2, 'pen', 0.7, { dur: 1.6 });

  DIR.reg('human', sc.start, sc.end, {
    sim(t, s) {
      s.p.velDiss = 0.3; s.p.dyeDiss = 0.06; s.p.vort = 22;
      s.p.wind = [60, 1.3, t * 0.5, 10];
      // 一年的路：笔尖处持续出墨
      if (t > tYear && t < tYear + 2.0) {
        const q = cl((t - tYear) / 2.0), px = 200 + 1520 * E.inOutSine(q), py = 700 - 60 * Math.sin(q * 3.1);
        s.dye(px, py, 14, [0, 0.14, 0, 0]);
      }
      // 砖层落下：每层墨尘
      bricks.forEach((_, i) => { if (s.at(tNames + 0.2 + i * 0.55)) { const y = 900 - i * 92; for (let k = 0; k < 6; k++) s.vel(560 + k * 160, y + 30, 40, (k - 2.5) * 160, 80); s.dye(960, y + 40, 90, [0, 0, 0.12, 0]); } });
      // 引语墨滴
      if (s.at(tQ2 + 0.2)) FX.drop(s, 1500, 760, 38, 'r', 1.2, 700, 77);
      // 数据之河：左 → 右
      if (t > tH5 + 0.4 && t < tRule + 0.6) {
        const k = Math.floor(t * 30), R = C.rng(k);
        s.vel(620, 330, 26, 900, 0); s.dye(620, 330 + (R() - 0.5) * 30, 10, [0, 0.12, 0, 0]);
        s.p.field = [{ x: 960, y: 330, R: 150, swirl: 400, radial: 0 }];
      }
      // 故事的一部分：签名出墨
      if (t > tPart + 0.2 && t < tPart + 1.8) {
        const q = cl((t - tPart - 0.2) / 1.6), px = 620 + 680 * q, py = 820 + 26 * Math.sin(q * 18);
        s.dye(px, py, 9, [0.2, 0, 0, 0]);
      }
    },
    draw(t, X) {
      const x = X.front, b = X.back;
      // ======== 12 小时 ========
      const ta = sm((t - (tH1 - 0.3)) / 0.4) * (1 - sm((t - (tH2 + 0.1)) / 0.4));
      if (ta > 0.002) {
        const lt = t - tH1;
        x.save(); x.globalAlpha = ta;
        D.line(x, TX0, TY, TX0 + (TX1 - TX0) * E.inOutCubic(cl(lt / 0.8)), TY, { col: C.col.ink, lw: 3, cap: 'butt' });
        for (let h = 18; h <= 42; h += 3) {
          const px = tx(h), q = cl((lt - 0.2 - (h - 18) * 0.02) * 4); if (q <= 0) continue;
          D.line(x, px, TY - 10, px, TY + 10, { col: C.rgba(C.col.ink, q), lw: 2, cap: 'butt' });
          T.draw(x, String(h % 24).padStart(2, '0') + ':00', px, TY + 44, { size: 18, fam: 'mono', col: C.rgba(C.col.ink2, q), align: 'center', id: 'tk' });
        }
        T.draw(x, '9 月 7 日', tx(19.5), TY + 90, { size: 22, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', alpha: cl(lt * 3), id: 'd7' });
        T.draw(x, '9 月 8 日', tx(33), TY + 90, { size: 22, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', alpha: cl(lt * 3), id: 'd8' });
        // 两个事件
        const ev = [[23.9, tH1 + 0.9, '巴克马斯特 · 声明', C.col.blue, -1], [36, tH1 + 1.6, 'OpenAI · 宣布', C.col.verm, 1]];
        ev.forEach(([h, t0, lab, col, dir]) => {
          const q = C.spring(cl(t - t0), 3, 0.5); if (t < t0) return;
          const px = tx(h);
          D.disc(x, px, TY, 14 * q, col);
          D.line(x, px, TY - 20, px, TY - 20 - 130 * q, { col, lw: 2.5, cap: 'butt' });
          T.draw(x, lab, px, TY - 170, { size: 32, weight: 900, fam: 'serif', col, align: 'center', alpha: cl((t - t0) * 4), id: 'ev' + h });
        });
        // 12 小时括弧
        const bq = E.outCubic(cl((t - tH1 - 2.1) / 0.6));
        if (bq > 0) {
          const a0 = tx(23.9), a1 = tx(36), y = TY - 290;
          FX.brush(x, [[a0, y + 30], [a0, y], [a1, y], [a1, y + 30]], bq, 6, C.col.ink, 51);
          FX.slam(x, '12 小时', (a0 + a1) / 2, y - 30, t - tH1 - 2.4, { size: 86, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', id: 'h12' });
        }
        x.restore();
      }
      // ======== 巴克马斯特肖像 ========
      const pa = sm((t - (tBk - 0.1)) / 0.5) * (1 - sm((t - (tH3 - 0.4)) / 0.5));
      if (pa > 0.002) {
        const lt = t - tBk, sh = t > tH2 ? E.inOutCubic(cl((t - tH2) / 0.7)) : 0;
        b.save(); b.globalAlpha = pa;
        const im = IMG.ht.buck, px = C.lerp(1320, 150, sh), py = 150 + (1 - E.outCubic(cl(lt / 0.6))) * 40;
        b.drawImage(im, px, py, im.width * 1.25, im.height * 1.25);
        b.restore();
        x.save(); x.globalAlpha = pa;
        const nx = C.lerp(1320, 150, sh) + 225, ny = 810;
        FX.sheet(x, nx, ny, 400, 110, 0.02, { fill: C.col.ink, blur: 10, off: 4 });
        T.draw(x, '特里斯坦 · 巴克马斯特', nx, ny - 6, { size: 30, weight: 900, fam: 'serif', col: C.col.paper, align: 'center', id: 'bkname' });
        T.draw(x, 'TRISTAN BUCKMASTER  ·  NYU COURANT', nx, ny + 32, { size: 14, fam: 'geo', track: 3, col: C.rgba(C.col.paper, 0.75), align: 'center', id: 'bkname' });
        x.restore();
        // 声明文件
        const sa = sm((t - tSt) / 0.4) * (1 - sm((t - (tH2 - 0.1)) / 0.4));
        if (sa > 0.002) {
          x.save(); x.globalAlpha = sa;
          FX.sheet(x, 700, 470, 560, 380, -0.03, { fill: '#fbf8f0' });
          x.translate(700, 470); x.rotate(-0.03);
          T.draw(x, 'Today, Levent Alpöge and I', -230, -110, { size: 28, fam: 'geoi', col: C.col.ink, id: 'stmt' });
          T.draw(x, 'have made public three results.', -230, -70, { size: 28, fam: 'geoi', col: C.col.ink, id: 'stmt' });
          for (let k = 0; k < 6; k++) { x.fillStyle = C.rgba(C.col.ink, 0.18); x.fillRect(-230, -20 + k * 28, 460 - (k % 3) * 70, 8); }
          T.draw(x, '— 2026 · 9 · 7  23:5x', 230, 150, { size: 18, fam: 'mono', col: C.col.ink2, align: 'right', id: 'stmt' });
          x.restore();
        }
      }
      // ======== 合作 + 一年的路 ========
      const ya = sm((t - (tH2 + 0.2)) / 0.4) * (1 - sm((t - (tH3 - 0.3)) / 0.4));
      if (ya > 0.002) {
        x.save(); x.globalAlpha = ya;
        const lt = t - tH2;
        // 两张身份牌
        const cards = [['巴克马斯特', 'NYU', C.col.ink], ['阿尔珀格', 'ANTHROPIC · 个人身份', C.col.blue]];
        cards.forEach(([n, org, col], i) => {
          const q = E.outBack(cl((lt - 0.3 - i * 0.3) / 0.5)); if (q <= 0) return;
          const cx = 900 + i * 520, cy = 330 - (1 - q) * 40;
          D.panel(x, cx - 200, cy - 60, 400, 120, { r: 4, stroke: col, lw: 3 });
          T.draw(x, n, cx, cy + 4, { size: 42, weight: 900, fam: 'serif', col, align: 'center', id: 'cd' + i });
          T.draw(x, org, cx, cy + 40, { size: 15, fam: 'geo', track: 3, col: C.col.ink2, align: 'center', id: 'cd' + i });
        });
        D.line(x, 1100, 330, 1220, 330, { col: C.col.verm, lw: 3, dash: [8, 6], p: cl((lt - 0.9) * 2) });
        // 路：2025.09 → 2026.08
        const yq = cl((t - tYear) / 2.0);
        if (yq > 0) {
          const pts = []; for (let i = 0; i <= 60; i++) { const u = i / 60; pts.push([200 + 1520 * E.inOutSine(u), 700 - 60 * Math.sin(u * 3.1)]); }
          FX.brush(x, pts, yq, 10, C.col.ink, 61, { dry: true });
          const months = ['2025 · 09', '2025 · 12', '2026 · 03', '2026 · 06', '2026 · 08'];
          months.forEach((m, i) => {
            const u = i / 4, q = cl((yq - u) * 6 + 0.2); if (q <= 0) return;
            const px = 200 + 1520 * E.inOutSine(u), py = 700 - 60 * Math.sin(u * 3.1);
            D.disc(x, px, py, 9, i === 4 ? C.col.verm : C.col.ink, q);
            T.draw(x, m, px, py + 52, { size: 20, fam: 'mono', col: C.col.ink2, align: 'center', alpha: q, id: 'm' + i });
          });
          T.draw(x, '秘密合作 · 一年', 200, 580, { size: 30, weight: 900, fam: 'serif', col: C.col.ink, alpha: cl((t - tYear) * 3), id: 'yr' });
        }
        FX.stamp(x, '欧拉方程 · 带外力 · 爆破', 1330, 870, t - tEul - 0.9, { size: 46, rot: -0.05, double: true, seed: 23, col: C.col.verm, id: 'euler' });
        x.restore();
      }
      // ======== 砖层 ========
      const ba = sm((t - (tH3 - 0.2)) / 0.4) * (1 - sm((t - (tH4 - 0.2)) / 0.4));
      if (ba > 0.002) {
        x.save(); x.globalAlpha = ba;
        T.reveal(x, '这条路', 150, 210, t - tH3, { size: 64, weight: 900, fam: 'serif', col: C.col.ink, stag: 0.08, id: 'road' });
        const nm = t - tNames;
        if (nm > 0) {
          T.draw(x, '迭戈 · 科尔多瓦', 150, 300, { size: 34, weight: 900, fam: 'serif', col: C.col.verm, alpha: cl(nm * 3), id: 'cor' });
          T.draw(x, '路易斯 · 马丁内斯-佐罗阿', 150, 350, { size: 34, weight: 900, fam: 'serif', col: C.col.verm, alpha: cl(nm * 3 - 0.6), id: 'mz' });
          T.draw(x, 'MADRID  ·  ICMAT / CUNEF', 150, 386, { size: 15, fam: 'geo', track: 4, col: C.col.ink2, alpha: cl(nm * 3 - 1), id: 'mad' });
        }
        bricks.forEach(([yr, lab], i) => {
          const t0 = tNames + 0.2 + i * 0.55, q = cl((t - t0 + 0.35) / 0.35);
          if (q <= 0) return;
          const e = E.inQuad(q), y = 900 - i * 92 - (1 - e) * 500;
          const w = 900 - i * 90, cx = 1180;
          x.save(); x.globalAlpha = ba * cl(q * 3);
          x.fillStyle = i === 4 ? C.col.blue : C.col.ink;
          x.fillRect(cx - w / 2, y - 76, w, 78);
          T.draw(x, yr, cx - w / 2 + 24, y - 26, { size: 34, fam: 'geoi', col: C.col.paper, id: 'b' + i });
          T.draw(x, lab, cx - w / 2 + 120, y - 26, { size: 26, weight: 700, fam: 'serif', col: C.col.paper, id: 'bl' + i });
          x.restore();
        });
        const ia = cl((t - tBrick - 0.6) * 2);
        if (ia > 0) T.draw(x, '“无穷级联”  INFINITE CASCADE', 1180, 380, { size: 22, fam: 'geo', track: 4, col: C.col.ink2, align: 'center', alpha: ia, id: 'casc' });
        x.restore();
      }
      // ======== 科尔多瓦引语 ========
      const qa = sm((t - (tH4 - 0.1)) / 0.4) * (1 - sm((t - (tH5 - 0.3)) / 0.4));
      if (qa > 0.002) {
        x.save(); x.globalAlpha = qa;
        T.draw(x, '“', 190, 470, { size: 420, fam: 'geo', col: C.col.verm, alpha: E.outCubic(cl((t - tH4) * 3)), id: 'qm' });
        T.reveal(x, '如果没有我们的工作，', 340, 470, t - tQ1, { size: 92, weight: 900, fam: 'serif', col: C.col.ink, stag: 0.05, dur: 0.35, id: 'q1' });
        const segs = [['AI ', C.col.verm], ['不可能解出这道题。', C.col.ink]];
        let cx = 340, k = 0;
        for (const [s, col] of segs) {
          T.reveal(x, s, cx, 620, t - tQ2 - k * 0.05, { size: 92, weight: 900, fam: 'serif', col, stag: 0.05, dur: 0.35, id: 'q2' });
          cx += T.width(x, s, { size: 92, weight: 900, fam: 'serif' }); k += s.length;
        }
        T.draw(x, '—— 迭戈 · 科尔多瓦', 1560, 740, { size: 32, weight: 700, fam: 'serif', col: C.col.ink2, align: 'right', alpha: cl((t - tQ2 - 0.6) * 3), id: 'qa' });
        x.restore();
      }
      // ======== 数据之河 + 口径 ========
      const ra = sm((t - (tH5 - 0.1)) / 0.4) * (1 - sm((t - (tH6 - 0.3)) / 0.4));
      if (ra > 0.002) {
        x.save(); x.globalAlpha = ra;
        const lt = t - tH5;
        const box = (cx, cy, title, sub, col, q) => {
          x.save(); x.globalAlpha *= q;
          D.panel(x, cx - 170, cy - 90, 340, 180, { r: 6, fill: '#fbf8f0', stroke: col, lw: 3 });
          T.draw(x, title, cx, cy - 6, { size: 40, weight: 900, fam: title === 'Codex' ? 'geo' : 'serif', col, align: 'center', id: 'box' + title });
          T.draw(x, sub, cx, cy + 40, { size: 18, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', id: 'box' + title });
          x.restore();
        };
        box(430, 330, 'Codex', '巴克马斯特的研究会话', C.col.blue, cl(lt * 3));
        box(1490, 330, '模型', '训练 / 改进', C.col.verm, cl(lt * 3 - 0.8));
        const qq = cl((t - tAdm) * 2);
        if (qq > 0) T.draw(x, '?', 960, 250, { size: 110, weight: 900, fam: 'geo', col: C.col.verm, align: 'center', alpha: qq, id: 'qmark' });
        // 四次口径卡
        statements.forEach(([d, zh, en], i) => {
          const t0 = [tAdm, tRule + 0.8, tLat, tNoI + 0.4][i], q = E.outBack(cl((t - t0) / 0.45));
          if (q <= 0) return;
          const cx = 300 + i * 440, cy = 740 + (1 - q) * 60;
          x.save(); x.globalAlpha *= cl(q * 2);
          FX.sheet(x, cx, cy, 400, 230, (i - 1.5) * 0.02, { fill: i === 0 ? '#fbf8f0' : '#f6f1e5', blur: 16, off: 6 });
          T.draw(x, d, cx - 176, cy - 70, { size: 24, fam: 'mono', col: C.col.verm, id: 'sd' + i });
          T.draw(x, zh, cx - 176, cy - 16, { size: 38, weight: 900, fam: 'serif', col: C.col.ink, id: 'sz' + i });
          const words = en.split(' '); let line = '', ly = cy + 30;
          for (const w of words) {
            const nl = line ? line + ' ' + w : w;
            if (T.width(x, nl, { size: 17, fam: 'geoi' }) > 350) { T.draw(x, line, cx - 176, ly, { size: 17, fam: 'geoi', col: C.col.ink2, id: 'se' + i }); line = w; ly += 24; }
            else line = nl;
          }
          T.draw(x, line, cx - 176, ly, { size: 17, fam: 'geoi', col: C.col.ink2, id: 'se' + i });
          x.restore();
        });
        x.restore();
      }
      // ======== 故事的一部分 ========
      const fa = sm((t - (tH6 - 0.1)) / 0.4) * (1 - sm((t - (sc.end - 0.6)) / 0.3));
      if (fa > 0.002) {
        x.save(); x.globalAlpha = fa;
        const ml = t - tMon;
        T.draw(x, '$1,000,000', 960, 300, { size: 80, fam: 'geo', col: C.rgba(C.col.ink, 0.35), align: 'center', alpha: cl(ml * 3), id: 'm2' });
        FX.strike(x, 720, 1200, 276, E.outCubic(cl((ml - 0.4) / 0.4)), 12, C.col.ink, 44);
        T.reveal(x, '他们也是', 960, 560, t - tPart + 0.3, { size: 110, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', stag: 0.07, id: 'part' });
        T.reveal(x, '这个故事的一部分', 960, 710, t - tPart, { size: 110, weight: 900, fam: 'serif', col: C.col.verm, align: 'center', stag: 0.07, id: 'part' });
        T.draw(x, '“ part of the story ”', 960, 800, { size: 30, fam: 'geoi', col: C.col.ink2, align: 'center', alpha: cl((t - tPart - 0.8) * 2), id: 'pos' });
        x.restore();
      }
    },
  });
});
