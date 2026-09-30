// 07 奖章（纸→夜）：铺路人的名字 → 巨大奖章（阿基米德 + 拉丁铭文逐字刻出）→ 夜：答案交给机器 / 理解只能由我们自己完成 → 片尾
(window.SCENES = window.SCENES || []).push(function () {
  const A = C.A, S = C.S, sm = C.smooth, E = C.ease, cl = C.clamp, Wf = C.Wf;
  const sc = S('final');
  SUB.nosub.add('f3'); SUB.nosub.add('f4');
  const tF1 = A('f1'), tBk = A('f1', 1), tWorth = A('f1', 2), tPath = A('f1', 3), tName = A('f1', 4);
  const tF2 = A('f2'), tL1 = A('f2', 1), tL2 = A('f2', 2);
  const tF3 = A('f3'), tMach = A('f3', 1);
  const tF4 = A('f4'), tUs = A('f4', 1);
  const N0 = tF3 - 0.7;
  DIR.night.push([N0, TL.duration + 1]);
  const LAT = 'TRANSIRE SVVM PECTVS MVNDOQVE POTIRI';
  const MX = 960, MY = 520, MR = 330;
  const tCred = C.L1('f4') + 1.2;

  // ---- 音效 ----
  CUE.add(tF1, 'swell', 0.6, { dur: 4 }); CUE.add(tWorth, 'pen', 0.5, { dur: 1 });
  CUE.add(tName - 0.1, 'riser', 0.8, { dur: 0.6 }); CUE.add(tName + 0.5, 'hit', 1.2); CUE.hit(tName + 0.5, { flash: 0.15, shake: 0.9, zoom: 0.02 });
  CUE.add(tF2 - 0.4, 'medal', 1.0);
  Array.from(LAT).forEach((c, i) => { if (c.trim()) CUE.add(tL1 - 0.3 + i * 0.075, 'engrave', 0.35, { pitch: 1 + (i % 5) * 0.04 }); });
  CUE.add(tL2 + 0.6, 'shimmer', 1.0);
  CUE.add(N0 + 0.6, 'hit', 0.9);
  CUE.add(tMach, 'data', 0.6, { dur: 1.6 }); CUE.add(tMach + 0.1, 'hit', 0.9);
  CUE.add(tF4 - 0.5, 'reverse', 0.8, { dur: 0.5 }); CUE.add(tUs, 'hit', 1.4); CUE.add(tUs, 'boom', 1.1); CUE.add(tUs + 0.05, 'shimmer', 1.0);
  CUE.hit(tUs, { flash: 0.5, shake: 1.0, tau: 0.16, col: '#ffe0c8', zoom: 0.025 });
  CUE.add(tCred, 'swell', 0.6, { dur: 5 });

  DIR.reg('final', sc.start, sc.end, {
    resets: [N0],
    sim(t, s) {
      if (t < N0) {
        s.p.velDiss = 0.3; s.p.dyeDiss = 0.05; s.p.vort = 24; s.p.wind = [70, 1.3, t * 0.5, 0];
        if (s.at(tName + 0.5)) {
          s.stamp((x) => T.draw(x, '马丁内斯-佐罗阿', 960, 640, { size: 150, weight: 900, fam: 'serif', col: '#ff0000', align: 'center' }), { dye: 0.35, vel: { k: 1, boom: 260, cx: 960, cy: 600 } });
        }
        // 奖章铭文：刻字飞屑
        if (t > tL1 - 0.3 && t < tL1 - 0.3 + LAT.length * 0.075) {
          const i = Math.floor((t - tL1 + 0.3) / 0.075), a = -Math.PI * 0.95 + (i / LAT.length) * Math.PI * 0.9;
          s.dye(MX + Math.cos(a) * (MR + 70), MY + Math.sin(a) * (MR + 70), 12, [0, 0, 0.12, 0]);
        }
        return;
      }
      s.p.velDiss = 0.6; s.p.dyeDiss = 0.12; s.p.vort = 28;
      s.p.wind = [120, 1.2, t * 0.4, 0];
      // 机器：蓝色数据流
      if (t > tMach && t < tF4 - 0.5) { const k = Math.floor(t * 40), R = C.rng(k); s.dye(1200 + R() * 500, 300 + R() * 300, 6, [0, 0.2, 0, 0]); s.vel(1200 + R() * 500, 450, 40, 200, 0); }
      // 理解：暖色墨从文字中心绽开
      if (s.at(tUs)) {
        s.stamp((x) => T.draw(x, '理解', 960, 560, { size: 300, weight: 900, fam: 'serif', col: '#ff0000', align: 'center' }), { dye: 0.5, vel: { k: 1, boom: 1100, cx: 960, cy: 480 } });
        s.dye(960, 460, 200, [0.1, 0, 0, 0]);
      }
      if (t > tUs) s.p.field = [{ x: 960, y: 480, R: 700, swirl: 260, radial: -80 }];
    },
    draw(t, X) {
      const x = X.front, b = X.back;
      // ======== 铺路人 ========
      const pa = sm((t - (tF1 - 0.2)) / 0.4) * (1 - sm((t - (tF2 - 0.6)) / 0.5));
      if (pa > 0.002) {
        x.save(); x.globalAlpha = pa;
        T.reveal(x, '巴克马斯特公开说', 960, 300, t - tBk, { size: 40, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', stag: 0.04, id: 'fb' });
        T.reveal(x, '真正值得一枚菲尔兹奖的', 960, 390, t - tWorth, { size: 56, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', stag: 0.05, id: 'fw' });
        T.reveal(x, '是那位铺路的人', 960, 470, t - tPath, { size: 44, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', stag: 0.05, id: 'fp' });
        FX.slam(x, '马丁内斯-佐罗阿', 960, 640, t - tName, { size: 150, weight: 900, fam: 'serif', col: C.col.verm, align: 'center', stag: 0.06, id: 'mz' });
        T.draw(x, 'LUIS MARTÍNEZ-ZOROA', 960, 720, { size: 26, fam: 'geo', track: 10, col: C.col.ink2, align: 'center', alpha: cl((t - tName - 0.7) * 2), id: 'mzen' });
        T.draw(x, '“ I believe Luis Martínez-Zoroa deserves a Fields Medal. ”', 960, 800, { size: 28, fam: 'geoi', col: C.col.ink2, align: 'center', alpha: cl((t - tName - 1.1) * 2), id: 'mzq' });
        x.restore();
      }
      // ======== 奖章 ========
      const ma = sm((t - (tF2 - 0.5)) / 0.6) * (1 - sm((t - (N0 - 0.1)) / 0.1));
      if (ma > 0.002) {
        const lt = t - (tF2 - 0.5), rot = (1 - E.outCubic(cl(lt / 1.4))) * -0.8 + lt * 0.01;
        const sc2 = 0.7 + 0.3 * E.outCubic(cl(lt / 1.2)) + 0.02 * lt;
        x.save(); x.globalAlpha = ma; x.translate(MX, MY); x.scale(sc2, sc2); x.rotate(rot);
        // 金属圆盘：多层环
        const g = x.createRadialGradient(-80, -120, 40, 0, 0, MR * 1.05);
        g.addColorStop(0, '#f3dfa3'); g.addColorStop(0.55, '#c79a3c'); g.addColorStop(1, '#7a5418');
        x.fillStyle = g; x.beginPath(); x.arc(0, 0, MR, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(80,50,10,0.55)'; x.lineWidth = 4; x.beginPath(); x.arc(0, 0, MR - 14, 0, Math.PI * 2); x.stroke();
        x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, MR - 88, 0, Math.PI * 2); x.stroke();
        // 阿基米德像：半色调奖章图案以"乘"混合压在金面上
        x.save(); x.beginPath(); x.arc(0, 0, MR - 92, 0, Math.PI * 2); x.clip();
        x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.75;
        const im = IMG.ht.medal; x.drawImage(im, -im.width * 0.44, -im.height * 0.44, im.width * 0.88, im.height * 0.88);
        x.restore();
        // 拉丁铭文：沿弧逐字刻出
        const chars = Array.from(LAT), n = chars.length;
        x.font = T.font(34, 700, 'geo'); x.textAlign = 'center'; x.textBaseline = 'middle';
        chars.forEach((c, i) => {
          const q = cl((t - (tL1 - 0.3) - i * 0.075) / 0.12); if (q <= 0) return;
          const a = -Math.PI * 0.95 + (i / (n - 1)) * Math.PI * 1.9 - Math.PI / 2 + Math.PI;
          x.save(); x.rotate(a); x.translate(0, -(MR - 50)); x.globalAlpha = ma * q;
          x.fillStyle = 'rgba(70,40,5,0.9)'; x.fillText(c, 1, 2);
          x.fillStyle = '#fff1c4'; x.fillText(c, 0, 0);
          x.restore();
        });
        // 高光扫过
        const sw = cl((t - tL2 - 0.4) / 1.2);
        if (sw > 0 && sw < 1) {
          x.save(); x.beginPath(); x.arc(0, 0, MR, 0, Math.PI * 2); x.clip();
          x.globalCompositeOperation = 'lighter';
          const gx = -MR * 1.6 + sw * MR * 3.2, gg = x.createLinearGradient(gx - 120, 0, gx + 120, 0);
          gg.addColorStop(0, 'rgba(255,240,200,0)'); gg.addColorStop(0.5, 'rgba(255,240,200,0.55)'); gg.addColorStop(1, 'rgba(255,240,200,0)');
          x.rotate(-0.5); x.fillStyle = gg; x.fillRect(-MR * 2, -MR * 2, MR * 4, MR * 4);
          x.restore();
        }
        x.restore();
        // 译文
        x.save(); x.globalAlpha = ma;
        T.reveal(x, '超越自身的局限', 960, 930, t - tL1, { size: 52, weight: 900, fam: 'serif', col: C.col.ink, align: 'right', stag: 0.06, id: 'lat1' });
        x.restore();
        x.save(); x.globalAlpha = ma;
        T.reveal(x, '，掌握世界', 960, 930, t - tL2, { size: 52, weight: 900, fam: 'serif', col: C.col.verm, align: 'left', stag: 0.06, id: 'lat2' });
        x.restore();
      }
      // ======== 夜：结语 ========
      if (t >= N0) {
        const oa = 1 - sm((t - (tCred - 0.8)) / 0.6);
        // 答案 → 机器
        const aa = sm((t - (tF3 - 0.1)) / 0.3) * (1 - sm((t - (tF4 - 0.4)) / 0.3));
        if (aa > 0.002) {
          x.save(); x.globalAlpha = aa;
          FX.slam(x, '答案', 560, 600, t - tF3, { size: 200, weight: 900, fam: 'serif', col: '#f3efe6', align: 'center', stag: 0.08, id: 'ans' });
          D.arrow(x, 780, 540, 1080, 540, { col: 'rgba(160,210,255,0.9)', lw: 5, p: E.outCubic(cl((t - tMach) / 0.4)), head: 22 });
          FX.type(x, '可以交给机器', 1120, 580, t - tMach, 14, { size: 96, weight: 900, fam: 'serif', col: '#9fd0ff', cursor: true, curCol: '#9fd0ff', id: 'mach' });
          x.restore();
        }
        // 理解
        const ua = sm((t - (tF4 - 0.1)) / 0.3) * oa;
        if (ua > 0.002) {
          x.save(); x.globalAlpha = ua;
          const q = C.spring(cl(t - tUs + 0.02), 2.4, 0.5);
          x.save(); x.translate(960, 460); x.scale(0.6 + 0.4 * q, 0.6 + 0.4 * q);
          T.draw(x, '理解', 0, 100, { size: 300, weight: 900, fam: 'serif', col: '#ffffff', align: 'center', id: 'und' });
          x.restore();
          T.reveal(x, '只能由我们自己完成', 960, 760, t - tUs - 0.2, { size: 72, weight: 700, fam: 'serif', col: '#ffb58f', align: 'center', stag: 0.06, id: 'self' });
          x.restore();
        }
        // 片尾
        const ca = sm((t - tCred) / 0.8);
        if (ca > 0.002) {
          x.save(); x.globalAlpha = ca;
          T.reveal(x, 'AI 解决了千禧年难题', 960, 420, t - tCred, { size: 58, weight: 900, fam: 'serif', col: '#f3efe6', align: 'center', stag: 0.04, id: 'ct' });
          T.reveal(x, '以后的菲尔兹奖，真的只能颁给 AI 了吗？', 960, 500, t - tCred - 0.4, { size: 40, weight: 700, fam: 'serif', col: '#ffb58f', align: 'center', stag: 0.03, id: 'ct2' });
          D.line(x, 760, 560, 760 + 400 * E.inOutCubic(cl((t - tCred - 1) / 0.8)), 560, { col: 'rgba(243,239,230,0.4)', lw: 1.5, cap: 'butt' });
          const src = '资料：OpenAI · Clay Mathematics Institute · IMU · Quanta · Scientific American · Nature · BBC · 陶哲轩 · 高尔斯 · 每日经济新闻 · 知识分子 · Wikipedia';
          T.draw(x, src, 960, 620, { size: 20, weight: 500, fam: 'serif', col: 'rgba(230,225,215,0.7)', align: 'center', alpha: cl((t - tCred - 1.4) * 1.5), id: 'src' });
          T.draw(x, '非官方科普动画 · 事件仍在进展，以各方最新公开信息为准', 960, 664, { size: 18, weight: 500, fam: 'serif', col: 'rgba(230,225,215,0.5)', align: 'center', alpha: cl((t - tCred - 1.8) * 1.5), id: 'disc' });
          x.restore();
        }
      }
    },
  });
});
