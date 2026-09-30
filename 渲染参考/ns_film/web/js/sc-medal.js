// 05 错位（夜→纸）：25 个名字瀑布 → 四人高亮 → 「解题只是工具」天平 → 杰曼诺夫「那又怎样」→ 高尔斯：两种数学家 → 洪水
(window.SCENES = window.SCENES || []).push(function () {
  const A = C.A, S = C.S, sm = C.smooth, E = C.ease, cl = C.clamp, Wf = C.Wf;
  const sc = S('medal');
  const tM1 = A('m1'), tDecl = A('m1', 1), tTitle = A('m1', 2);
  const tM2 = A('m2'), tDeng = A('m2', 1), tList = A('m2', 2);
  const tM3 = A('m3'), tTool = A('m3', 1), tGoal = A('m3', 2), tUnd = A('m3', 3);
  const tM4 = A('m4'), tCorr = A('m4', 1), tSo = A('m4', 2), tEss = A('m4', 3), tUnd2 = A('m4', 4);
  const tM5 = A('m5'), tGow = A('m5', 1), tTwo = A('m5', 2), tC1 = A('m5', 3), tC2 = A('m5', 4);
  const tM6 = A('m6'), tFlood = A('m6', 1), tCome = A('m6', 2);
  const N1 = C.L1('m2') + 0.9;
  DIR.night.push([sc.start, N1]);
  SUB.nosub.add('m3');
  const NAMES = [['Artur Avila', 2014], ['Manjul Bhargava', 2014], ['Caucher Birkar', 2018], ['Pierre Deligne', 1978], ['Yu Deng', 2026], ['Simon Donaldson', 1986],
    ['Hugo Duminil-Copin', 2022], ['Alessio Figalli', 2018], ['Martin Hairer', 2014], ['June Huh', 2022], ['Maxim Kontsevich', 1998], ['Elon Lindenstrauss', 2010],
    ['Pierre-Louis Lions', 1994], ['James Maynard', 2022], ['Curt McMullen', 1998], ['Shigefumi Mori', 1990], ['Ngô Bảo Châu', 2010], ['Andrei Okounkov', 2006],
    ['Peter Scholze', 2018], ['Stanislav Smirnov', 2010], ['Terence Tao', 2006], ['Maryna Viazovska', 2022], ['Cédric Villani', 2010], ['Wendelin Werner', 2006], ['Efim Zelmanov', 1994]];
  const HL = { 'Terence Tao': [tM2, '陶哲轩'], 'Peter Scholze': [tM2 + 0.9, '舒尔策'], 'Maryna Viazovska': [tM2 + 1.8, '维亚佐夫斯卡'], 'Yu Deng': [tDeng + 0.5, '邓煜'] };
  const col5 = (i) => [240 + (i % 5) * 360, 330 + Math.floor(i / 5) * 118];

  // ---- 音效 ----
  CUE.add(tM1, 'type', 0.5); CUE.add(tDecl, 'swell', 0.7, { dur: 3 });
  NAMES.forEach((_, i) => CUE.add(tDecl + 0.25 + i * 0.1, 'sign', 0.45, { pitch: 0.9 + (i % 7) * 0.05 }));
  CUE.add(tTitle, 'hit', 0.9); CUE.hit(tTitle, { flash: 0.2, shake: 0.5, col: '#ffe7d0' });
  Object.values(HL).forEach(([tt], i) => CUE.add(tt, 'chime', 0.55, { pitch: 1 + i * 0.1 }));
  CUE.add(tM3 - 0.1, 'whoosh', 0.6);
  CUE.add(tTool + 0.2, 'weight', 0.7); CUE.add(tUnd + 0.3, 'weight', 1.0); CUE.add(tUnd + 0.35, 'hit', 0.8); CUE.hit(tUnd + 0.35, { shake: 0.6 });
  CUE.add(tCorr + 0.4, 'check', 0.6); CUE.add(tSo, 'hit', 1.0); CUE.hit(tSo, { shake: 0.8, zoom: 0.02 });
  CUE.add(tUnd2, 'swell', 0.7, { dur: 2 });
  CUE.add(tM5, 'page', 0.6); CUE.add(tTwo, 'blip', 0.5); CUE.add(tC1, 'blip', 0.55, { pitch: 1.3 }); CUE.add(tC2, 'blip', 0.55, { pitch: 1.6 });
  CUE.add(tFlood - 0.2, 'wave', 1.0, { dur: 3.2 }); CUE.add(tCome, 'hit', 0.8);

  DIR.reg('medal', sc.start, sc.end, {
    resets: [N1],
    sim(t, s) {
      if (t < N1) {
        s.p.velDiss = 0.8; s.p.dyeDiss = 0.25; s.p.vort = 18; s.p.wind = [70, 1.2, t * 0.4, 0];
        NAMES.forEach(([n], i) => { if (s.at(tDecl + 0.25 + i * 0.1)) { const [px, py] = col5(i); s.dye(px, py - 12, 26, [0, 0.14, 0, 0]); s.vel(px, py, 30, 0, -120); } });
        Object.entries(HL).forEach(([n, [tt]]) => { if (s.at(tt)) { const i = NAMES.findIndex((q) => q[0] === n); const [px, py] = col5(i); s.dye(px, py - 12, 60, [0.3, 0, 0, 0]); } });
        return;
      }
      s.p.velDiss = 0.3; s.p.dyeDiss = 0.05; s.p.vort = 22; s.p.wind = [80, 1.3, t * 0.5, 10];
      if (s.at(tSo)) FX.drop(s, 960, 520, 80, 'b', 0.9, 900, 51);
      // 洪水：从左侧推入大量墨
      if (t > tFlood - 0.2 && t < sc.end - 0.6) {
        const q = cl((t - tFlood + 0.2) / 1.5);
        for (let k = 0; k < 8; k++) {
          const y = 140 + k * 115 + Math.sin(t * 3 + k) * 20;
          s.vel(40, y, 70, 1200 + 600 * q, Math.sin(t * 2 + k) * 200);
          s.dye(40, y, 40, [k % 3 === 0 ? 0.25 : 0, k % 3 === 1 ? 0.3 : 0, k % 3 === 2 ? 0.25 : 0, 0].map((v) => v * (0.5 + q)));
        }
      }
    },
    draw(t, X) {
      const x = X.front;
      // ======== 夜：声明与名字 ========
      if (t < N1) {
        x.save();
        T.reveal(x, '2026 · 9 · 11', 960, 170, t - tM1, { size: 26, fam: 'mono', col: 'rgba(240,235,225,0.7)', align: 'center', stag: 0.03, id: 'dd' });
        const ta = sm((t - tTitle) / 0.4);
        if (t > tDecl - 0.1) {
          const q = E.outCubic(cl((t - tTitle) / 0.6));
          x.globalAlpha = cl((t - tDecl) * 3);
          T.draw(x, '25 位菲尔兹奖得主 · 联名声明', 960, 240 - q * 0, { size: 30, weight: 700, fam: 'serif', col: '#ffb58f', align: 'center', id: 'decl' });
          x.globalAlpha = 1;
        }
        NAMES.forEach(([n, y], i) => {
          const t0 = tDecl + 0.25 + i * 0.1, q = cl((t - t0) / 0.35); if (q <= 0) return;
          const [px, py] = col5(i);
          const h = HL[n], hq = h ? sm((t - h[0]) / 0.3) : 0;
          const dim = t > tM2 - 0.2 && !h ? 0.4 : 0;
          const under = py > 420 && py < 700 ? 0.75 * ta * (1 - sm((t - (tM2 - 0.3)) / 0.4)) : 0;
          x.globalAlpha = q * (1 - dim) * (1 - under) * (1 - sm((t - (N1 - 0.8)) / 0.3));
          T.draw(x, n, px, py - (1 - E.outCubic(q)) * 16, { size: 30 + 8 * hq, fam: 'geoi', col: hq > 0 ? C.mixHex('#e8e2d6', '#ffffff', hq) : '#e8e2d6', align: 'center', id: 'nm' + i });
          T.draw(x, 'FIELDS ' + y, px, py + 30, { size: 13, fam: 'geo', track: 4, col: y === 2026 ? '#ff9a6a' : 'rgba(220,215,205,0.55)', align: 'center', id: 'ny' + i });
          if (hq > 0) {
            T.draw(x, h[1], px, py - 46, { size: 34, weight: 900, fam: 'serif', col: '#ff9a6a', align: 'center', alpha: hq, id: 'hz' + i });
            D.ring(x, px, py - 10, 150 * (1 + 0.1 * (1 - hq)), 'rgba(255,154,106,0.6)', 2, hq * 0.8);
          }
        });
        // 标题
        if (ta > 0.002) {
          x.globalAlpha = ta * (1 - sm((t - (tM2 - 0.3)) / 0.4));
          x.fillStyle = 'rgba(11,13,18,0.82)'; x.fillRect(0, 440, 1920, 240);
          FX.slam(x, 'A Severe Misalignment of AI in Mathematics', 960, 555, t - tTitle, { size: 66, fam: 'geoi', col: '#ffffff', align: 'center', stag: 0.012, from: 1.5, id: 'dt' });
          T.draw(x, '《人工智能在数学中的严重错位》', 960, 630, { size: 38, weight: 900, fam: 'serif', col: '#ff9a6a', align: 'center', alpha: cl((t - tTitle - 0.5) * 3), id: 'dtz' });
        }
        x.restore();
        return;
      }
      // ======== 纸：工具 vs 理解 ========
      const ba = sm((t - (tM3 - 0.2)) / 0.4) * (1 - sm((t - (tM4 - 0.2)) / 0.4));
      if (ba > 0.002) {
        x.save(); x.globalAlpha = ba;
        T.reveal(x, '他们写道', 960, 220, t - tM3, { size: 32, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', stag: 0.05, id: 'wrote' });
        // 天平
        const tilt = 0.22 * E.outBack(cl((t - tUnd - 0.3) / 0.6));
        const cx = 960, cy = 520, L = 520;
        D.line(x, cx, cy, cx, 900, { col: C.col.ink, lw: 8, cap: 'butt' });
        x.fillStyle = C.col.ink; x.beginPath(); x.moveTo(cx - 90, 900); x.lineTo(cx + 90, 900); x.lineTo(cx, 850); x.fill();
        x.save(); x.translate(cx, cy); x.rotate(-tilt);
        D.line(x, -L, 0, L, 0, { col: C.col.ink, lw: 7, cap: 'round' });
        D.disc(x, 0, 0, 14, C.col.verm);
        x.restore();
        const end = (s) => [cx + Math.cos(-tilt) * L * s, cy + Math.sin(-tilt) * L * s];
        const pan = (s, t0, big, small, col) => {
          const [px, py] = end(s), q = E.outBack(cl((t - t0) / 0.5)); if (q <= 0) return;
          D.line(x, px, py, px, py + 120, { col: C.rgba(C.col.ink, 0.6), lw: 2 });
          x.save(); x.globalAlpha *= cl(q * 2);
          D.panel(x, px - 190, py + 120, 380, 22, { r: 4, fill: C.col.ink });
          T.draw(x, big, px, py + 96 - (1 - q) * 40, { size: 74, weight: 900, fam: 'serif', col, align: 'center', id: 'pan' + s });
          T.draw(x, small, px, py + 184, { size: 24, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', id: 'pans' + s });
          x.restore();
        };
        pan(-1, tTool, '解题', '只是工具', C.col.ink);
        pan(1, tGoal, '理解', '概念上的理解与洞见', C.col.verm);
        x.restore();
      }
      // ======== 杰曼诺夫 ========
      const za = sm((t - (tM4 - 0.1)) / 0.4) * (1 - sm((t - (tM5 - 0.2)) / 0.4));
      if (za > 0.002) {
        x.save(); x.globalAlpha = za;
        T.draw(x, '埃菲 · 杰曼诺夫  ·  1994 菲尔兹奖', 150, 220, { size: 28, weight: 700, fam: 'serif', col: C.col.ink2, alpha: cl((t - tM4) * 3), id: 'zel' });
        T.reveal(x, '如果一个证明', 150, 360, t - tCorr, { size: 64, weight: 900, fam: 'serif', col: C.col.ink, stag: 0.04, id: 'z1' });
        T.reveal(x, '仅仅是“正确”的', 150, 450, t - tCorr - 0.35, { size: 64, weight: 900, fam: 'serif', col: C.col.ink, stag: 0.04, id: 'z1' });
        const ck = E.outCubic(cl((t - tCorr - 0.5) / 0.4));
        if (ck > 0) FX.brush(x, [[640, 430], [668, 462], [720, 396]], ck, 12, C.col.blue, 71);
        const sl = t - tSo;
        if (sl > -0.1) {
          const q = C.spring(cl(sl + 0.1), 3, 0.4);
          x.save(); x.translate(1260, 520); x.scale(0.3 + 0.7 * q, 0.3 + 0.7 * q); x.rotate(0.05 * (1 - q));
          T.draw(x, '那又怎样？', 0, 70, { size: 170, weight: 900, fam: 'serif', col: C.col.verm, align: 'center', id: 'sowhat' });
          x.restore();
          T.draw(x, 'Then what?', 1260, 690, { size: 40, fam: 'geoi', col: C.col.ink2, align: 'center', alpha: cl((sl - 0.3) * 3), id: 'thenwhat' });
        }
        const el = t - tEss;
        if (el > 0) {
          T.reveal(x, '数学的本质，', 150, 850, el, { size: 56, weight: 700, fam: 'serif', col: C.col.ink, stag: 0.05, id: 'z3' });
          FX.slam(x, '就是理解。', 560, 850, t - tUnd2, { size: 56, weight: 900, fam: 'serif', col: C.col.verm, stag: 0.07, id: 'z4' });
        }
        x.restore();
      }
      // ======== 高尔斯 ========
      const ga = sm((t - (tM5 - 0.1)) / 0.4) * (1 - sm((t - (tFlood + 0.2)) / 0.5));
      if (ga > 0.002) {
        x.save(); x.globalAlpha = ga;
        FX.stamp(x, '未签名', 1600, 250, t - tM5 - 0.2, { size: 50, rot: 0.1, double: false, seed: 31, col: C.col.blue, id: 'nosign' });
        T.draw(x, '蒂莫西 · 高尔斯  ·  1998 菲尔兹奖', 150, 220, { size: 28, weight: 700, fam: 'serif', col: C.col.ink2, alpha: cl((t - tGow) * 3), id: 'gow' });
        T.reveal(x, '数学家本来就有两种', 150, 320, t - tTwo, { size: 56, weight: 900, fam: 'serif', col: C.col.ink, stag: 0.04, id: 'two' });
        // 光谱：左 解题 ←→ 理解 右
        const sp = E.inOutCubic(cl((t - tC1 + 0.2) / 0.8));
        if (sp > 0) {
          const y = 600;
          const g = x.createLinearGradient(240, 0, 1680, 0); g.addColorStop(0, C.col.ink); g.addColorStop(1, C.col.verm);
          x.fillStyle = g; x.fillRect(960 - 720 * sp, y - 6, 1440 * sp, 12);
          const lab = (px, t0, a, b2, col, al) => {
            const q = E.outCubic(cl((t - t0) / 0.4)); if (q <= 0) return;
            x.save(); x.globalAlpha *= q;
            T.draw(x, a, px, y - 60, { size: 40, weight: 900, fam: 'serif', col, align: al, id: 'sp' + a });
            T.draw(x, b2, px, y + 76, { size: 28, weight: 700, fam: 'serif', col: C.col.ink2, align: al, id: 'spb' + a });
            x.restore();
          };
          lab(240, tC1, '为了解题去理解', 'PROBLEM SOLVERS', C.col.ink, 'left');
          lab(1680, tC2, '为了理解去解题', 'THEORY BUILDERS', C.col.verm, 'right');
          // 人群点
          for (let i = 0; i < 70; i++) {
            const u = C.hash(i * 17), q = cl((t - tC1 - u * 1.2) * 3); if (q <= 0) continue;
            D.disc(x, 260 + u * 1400, y + 150 + (C.hash(i * 3) - 0.5) * 90, 7, C.mixHex(C.col.ink, C.col.verm, u), q * 0.8);
          }
          T.draw(x, '“THE TWO CULTURES OF MATHEMATICS”', 960, 880, { size: 18, fam: 'geo', track: 5, col: C.col.ink2, align: 'center', alpha: cl((t - tC2 - 0.5) * 2), id: 'tc' });
        }
        x.restore();
      }
      // ======== 洪水 ========
      const fa = sm((t - (tFlood - 0.1)) / 0.4) * (1 - sm((t - (sc.end - 0.6)) / 0.3));
      if (fa > 0.002) {
        x.save(); x.globalAlpha = fa;
        // 飞过的定理卡片
        for (let i = 0; i < 26; i++) {
          const t0 = tFlood + C.hash(i * 5) * 2.2, q = (t - t0) / 1.6; if (q < 0 || q > 1) continue;
          const px = -300 + 2500 * E.inQuad(q), py = 180 + C.hash(i * 11) * 640, s = 0.6 + C.hash(i * 13) * 0.6;
          x.save(); x.translate(px, py); x.rotate((C.hash(i * 7) - 0.5) * 0.4); x.scale(s, s);
          FX.sheet(x, 0, 0, 220, 130, 0, { fill: '#fbf8f0', blur: 10, off: 4 });
          T.draw(x, ['THEOREM', 'LEMMA', 'PROOF', 'Q.E.D.', 'CONJ.'][i % 5], -90, -24, { size: 22, fam: 'geo', track: 3, col: C.col.ink, id: null });
          M.draw(x, ['∂_{t}u', '∫|∇u|^{2}', 'ζ(s)=0', 'P ≠ NP', 'H^{k}(X)'][i % 5], -90, 32, { size: 34, col: i % 3 ? C.col.ink : C.col.verm, id: null });
          x.restore();
        }
        T.reveal(x, '新结果的洪水', 960, 520, t - tFlood, { size: 140, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', stag: 0.07, id: 'flood' });
        FX.slam(x, '无论如何都会到来', 960, 680, t - tCome, { size: 72, weight: 900, fam: 'serif', col: C.col.verm, align: 'center', stag: 0.05, id: 'come' });
        x.restore();
      }
    },
  });
});
