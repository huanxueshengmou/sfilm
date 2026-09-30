// 04 外力（纸）：解对题了吗 → Fefferman 题面 A/B/C/D，C 带外力 → 实时流体：外力开 → 涡旋被推向爆破 → 撤掉外力 → 平息
// → 西尔维斯特：两个勾选框 → 克雷：似乎已解决 / 刻意不急 / 两年
(window.SCENES = window.SCENES || []).push(function () {
  const A = C.A, S = C.S, sm = C.smooth, E = C.ease, cl = C.clamp, Wf = C.Wf;
  const sc = S('loop');
  const tL1 = A('l1'), tQ = A('l1', 1);
  const tL2 = A('l2'), tAllow = A('l2', 1), tOAI = A('l2', 2), tDesign = A('l2', 3), tPush = A('l2', 4);
  const tL3 = A('l3'), tOff = A('l3', 1), tGone = A('l3', 2);
  const tL4 = A('l4'), tSolved = A('l4', 1), tCore = A('l4', 2), tNot = A('l4', 3);
  const tL5 = A('l5'), tApp = A('l5', 1), tSlow = A('l5', 2), tRule = A('l5', 3), tTwo = A('l5', 4);
  const FX0 = 1260, FY0 = 560; // 流体演示中心
  const forceOn = (t) => sm((t - tDesign) / 0.4) * (1 - sm((t - (tOff + 0.4)) / 0.25));
  const OPTS = [['A', '无外力 · 全空间', '光滑解永远存在'], ['B', '无外力 · 周期', '光滑解永远存在'], ['C', '光滑外力 · 全空间', '解会破裂'], ['D', '光滑外力 · 周期', '解会破裂']];

  // ---- 音效 ----
  CUE.add(tQ, 'hit', 0.6); CUE.add(tQ + 0.05, 'tick', 0.6, { pitch: 0.7 });
  OPTS.forEach((_, i) => CUE.add(tL2 + 0.2 + i * 0.18, 'card', 0.5, { pitch: 1 + i * 0.06 }));
  CUE.add(tAllow + 0.4, 'pen', 0.6, { dur: 0.7 });
  CUE.add(tDesign, 'motor', 0.9, { dur: tOff + 0.4 - tDesign }); CUE.add(tPush, 'riser', 0.7, { dur: tOff - tPush });
  CUE.add(tOff + 0.4, 'powerDown', 1.0); CUE.add(tOff + 0.42, 'hit', 0.7); CUE.hit(tOff + 0.42, { shake: 0.5 });
  CUE.add(tGone + 0.2, 'sweepDown', 0.6, { dur: 1.6 });
  CUE.add(tSolved + 0.3, 'check', 0.8); CUE.add(tNot + 0.1, 'error', 0.8);
  CUE.add(tApp, 'type', 0.4); CUE.add(tSlow, 'type', 0.4); CUE.add(tTwo + 0.2, 'clock', 0.5);
  for (let i = 0; i < 8; i++) CUE.add(tTwo + 0.4 + i * 0.12, 'tick', 0.35, { pitch: 1 + i * 0.03 });

  DIR.reg('loop', sc.start, sc.end, {
    resets: [tL2 - 0.05, tL4 - 0.2],
    sim(t, s) {
      s.p.velDiss = 0.25; s.p.dyeDiss = 0.03; s.p.vort = 20;
      if (t < tL2) { s.p.wind = [80, 1.4, t * 0.5, 0]; return; }
      if (t < tL4 - 0.2) {
        // 初始：一圈蓝墨环
        if (s.at(tL2)) for (let k = 0; k < 24; k++) { const a = (k / 24) * 6.283; s.dye(FX0 + Math.cos(a) * 170, FY0 + Math.sin(a) * 170, 30, [0, 0.55, 0, 0]); }
        const f = forceOn(t);
        s.p.velDiss = 0.4 + 2.6 * (1 - f) * (t > tOff ? 1 : 0);
        if (f > 0) {
          const q = cl((t - tDesign) / (tOff - tDesign + 0.4));
          s.p.field = [{ x: FX0, y: FY0, R: 300, swirl: (900 + 3600 * q * q) * f, radial: (200 + 900 * q) * f, lin: 0.5 }];
          // 外力注入点：红墨从四个"推手"进入
          for (let k = 0; k < 4; k++) { const a = (k / 4) * 6.283 + t * 0.8; s.dye(FX0 + Math.cos(a) * 330, FY0 + Math.sin(a) * 330, 14, [0.05 * f, 0, 0, 0]); }
        }
        return;
      }
      s.p.wind = [70, 1.2, t * 0.4, 10];
    },
    draw(t, X) {
      const x = X.front;
      // ======== 它解对题了吗 ========
      const qa = sm((t - (tL1 - 0.2)) / 0.3) * (1 - sm((t - (tL2 - 0.2)) / 0.3));
      if (qa > 0.002) {
        x.save(); x.globalAlpha = qa;
        T.reveal(x, '还有一个更微妙的问题', 960, 400, t - tL1, { size: 44, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', stag: 0.03, id: 'lq0' });
        FX.slam(x, '它解对题了吗？', 960, 600, t - tQ, { size: 150, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', stag: 0.06, id: 'lq' });
        FX.under(x, 780, 1160, 640, E.outCubic(cl((t - tQ - 0.6) / 0.4)), 12, C.col.verm, 81);
        x.restore();
      }
      // ======== 题面 ========
      const pa = sm((t - (tL2 - 0.2)) / 0.4) * (1 - sm((t - (tL4 - 0.3)) / 0.3));
      if (pa > 0.002) {
        x.save(); x.globalAlpha = pa;
        const lt = t - tL2;
        const sx = 120 + (1 - E.outCubic(cl(lt / 0.6))) * -60;
        T.draw(x, 'FEFFERMAN · CLAY OFFICIAL PROBLEM DESCRIPTION', sx, 214, { size: 15, fam: 'geo', track: 4, col: C.col.ink2, id: 'fef' });
        T.draw(x, '官方题面：证明以下任一', sx, 262, { size: 32, weight: 900, fam: 'serif', col: C.col.ink, id: 'fef2' });
        OPTS.forEach(([k, a, b2], i) => {
          const q = E.outCubic(cl((lt - 0.2 - i * 0.18) / 0.4)); if (q <= 0) return;
          const y = 360 + i * 138, isC = i >= 2, hl = isC ? sm((t - tAllow) / 0.4) : 0;
          const dim = !isC ? 0.45 * sm((t - tAllow) / 0.4) : 0;
          x.save(); x.globalAlpha *= q * (1 - dim);
          D.panel(x, sx, y - 50, 720, 112, { r: 4, fill: hl > 0 ? C.rgba(C.col.verm, 0.08 * hl) : 'rgba(0,0,0,0)', stroke: isC ? C.mixHex(C.col.ink, C.col.verm, hl) : C.rgba(C.col.ink, 0.5), lw: 2 + hl });
          T.draw(x, '(' + k + ')', sx + 24, y + 22, { size: 54, fam: 'geoi', col: isC ? C.mixHex(C.col.ink, C.col.verm, hl) : C.col.ink, id: 'opt' + k });
          T.draw(x, a, sx + 140, y - 2, { size: 32, weight: 900, fam: 'serif', col: C.col.ink, id: 'oa' + k });
          T.draw(x, b2, sx + 140, y + 38, { size: 22, weight: 600, fam: 'serif', col: C.col.ink2, id: 'ob' + k });
          if (isC) M.draw(x, '+ f', sx + 640, y + 18, { size: 50, col: C.col.verm, alpha: hl, id: 'of' + k });
          x.restore();
        });
        // OpenAI 标签：指向 C/D
        const oa = E.outBack(cl((t - tOAI) / 0.5));
        if (oa > 0) {
          x.save(); x.globalAlpha *= cl(oa * 2);
          D.pill(x, 'OpenAI', sx + 860 - (1 - oa) * 60, 710, { size: 26, fam: 'geo', weight: 700, fill: C.col.ink, col: C.col.paper, lw: 0, id: 'oaip' });
          D.arrow(x, sx + 800, 710, sx + 735, 710, { col: C.col.ink, lw: 3, p: oa, head: 14 });
          x.restore();
        }
        // 流体演示：外力箭头与读数
        const f = forceOn(t);
        if (t > tDesign - 0.2) {
          const q = cl((t - tDesign) / (tOff - tDesign + 0.4));
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * 6.283 + t * (0.8 + 3 * q), r0 = 330, r1 = 230;
            const p0 = [FX0 + Math.cos(a) * r0, FY0 + Math.sin(a) * r0], p1 = [FX0 + Math.cos(a + 0.5) * r1, FY0 + Math.sin(a + 0.5) * r1];
            D.arrow(x, p0[0], p0[1], p1[0], p1[1], { col: C.rgba(C.col.verm, 0.9 * f), lw: 4, head: 14 });
          }
          T.draw(x, '外力  f', FX0, FY0 - 380, { size: 40, weight: 900, fam: 'serif', col: C.col.verm, align: 'center', alpha: f, id: 'fl' });
          T.draw(x, '精心设计 · 恰好把流体推向爆破', FX0, FY0 + 400, { size: 24, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', alpha: f * sm((t - tDesign - 0.3) / 0.4), id: 'fl2' });
          // 开关
          const sw = t > tOff + 0.4 ? 0 : 1, sx2 = 1640, sy2 = 250;
          const swa = sm((t - tDesign) / 0.4) * (1 - sm((t - (tL4 - 0.5)) / 0.3));
          x.save(); x.globalAlpha *= swa;
          D.panel(x, sx2 - 60, sy2 - 26, 120, 52, { r: 26, fill: sw ? C.col.verm : C.rgba(C.col.ink, 0.25) });
          D.disc(x, sx2 + (sw ? 32 : -32), sy2, 20, '#fbf8f0');
          T.draw(x, sw ? 'FORCE ON' : 'FORCE OFF', sx2, sy2 + 60, { size: 16, fam: 'geo', track: 4, col: sw ? C.col.verm : C.col.ink2, align: 'center', id: 'sw' });
          x.restore();
        }
        // 撤掉外力后
        const ga = sm((t - (tGone - 0.1)) / 0.4) * (1 - sm((t - (tL4 - 0.4)) / 0.3));
        if (ga > 0.002) {
          x.save(); x.globalAlpha *= ga;
          T.draw(x, '爆破消失', FX0, FY0 + 20, { size: 90, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', id: 'gone' });
          T.draw(x, '三位数学家的新证明 · 9 月', FX0, FY0 + 80, { size: 22, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', id: 'gone2' });
          x.restore();
        }
        x.restore();
      }
      // ======== 西尔维斯特：两个勾选框 ========
      const ca = sm((t - (tL4 - 0.1)) / 0.4) * (1 - sm((t - (tL5 - 0.3)) / 0.4));
      if (ca > 0.002) {
        x.save(); x.globalAlpha = ca;
        T.draw(x, '路易斯 · 西尔维斯特  ·  芝加哥大学', 960, 250, { size: 28, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', alpha: cl((t - tL4) * 3), id: 'silv' });
        const row = (y, t0, label, ok, big) => {
          const q = E.outCubic(cl((t - t0) / 0.4)); if (q <= 0) return;
          x.save(); x.globalAlpha *= q;
          D.panel(x, 380, y - 58, 100, 100, { r: 6, stroke: C.col.ink, lw: 5 });
          T.draw(x, label, 540, y + 14, { size: big, weight: 900, fam: 'serif', col: C.col.ink, id: 'row' + y });
          const m = cl((t - t0 - 0.3) / 0.3);
          if (ok) FX.brush(x, [[398, y - 6], [424, y + 24], [470, y - 48]], m, 14, C.col.blue, 91);
          else { FX.brush(x, [[396, y - 44], [466, y + 26]], m, 14, C.col.verm, 92); FX.brush(x, [[466, y - 44], [396, y + 26]], cl(m * 2 - 1), 14, C.col.verm, 93); }
          x.restore();
        };
        row(470, tSolved, '克雷的题', true, 76);
        row(690, tCore, '纳维–斯托克斯的核心问题', false, 76);
        const na = cl((t - tNot) * 3);
        if (na > 0) T.draw(x, '还没有', 1540, 790, { size: 64, weight: 900, fam: 'serif', col: C.col.verm, align: 'right', alpha: na, id: 'not' });
        x.restore();
      }
      // ======== 克雷：两年 ========
      const ka = sm((t - (tL5 - 0.1)) / 0.4) * (1 - sm((t - (sc.end - 0.6)) / 0.3));
      if (ka > 0.002) {
        x.save(); x.globalAlpha = ka;
        T.draw(x, 'CLAY MATHEMATICS INSTITUTE  ·  2026 · 9 · 11', 960, 220, { size: 18, fam: 'geo', track: 5, col: C.col.ink2, align: 'center', id: 'cmi' });
        FX.type(x, '“ apparently settled ”', 300, 380, t - tApp, 18, { size: 60, fam: 'geoi', col: C.col.ink, cursor: false, id: 'app' });
        T.draw(x, '似乎已被解决', 300, 440, { size: 30, weight: 700, fam: 'serif', col: C.col.ink2, alpha: cl((t - tApp - 0.6) * 3), id: 'app2' });
        FX.type(x, '“ deliberately unhurried ”', 1000, 380, t - tSlow, 18, { size: 60, fam: 'geoi', col: C.col.blue, cursor: false, id: 'slow' });
        T.draw(x, '刻意不急', 1000, 440, { size: 30, weight: 700, fam: 'serif', col: C.col.ink2, alpha: cl((t - tSlow - 0.6) * 3), id: 'slow2' });
        // 流程：发表 → 2 年 → 学界公认 → 评审
        const fl = t - tRule;
        if (fl > 0) {
          const steps = [['发表', 380], ['≥ 2 年', 860], ['学界公认', 1340], ['评审', 1640]];
          D.line(x, 380, 690, 380 + 1260 * E.inOutCubic(cl(fl / 1.4)), 690, { col: C.col.ink, lw: 4, cap: 'butt' });
          steps.forEach(([s, px], i) => {
            const q = cl((fl - i * 0.35) * 3); if (q <= 0) return;
            D.disc(x, px, 690, i === 1 ? 20 : 12, i === 1 ? C.col.verm : C.col.ink, q);
            T.draw(x, s, px, i === 1 ? 640 : 760, { size: i === 1 ? 56 : 32, weight: 900, fam: 'serif', col: i === 1 ? C.col.verm : C.col.ink, align: 'center', alpha: q, id: 'st' + i });
          });
          // 两年沙漏进度
          const tp = cl((t - tTwo) / 1.2);
          if (tp > 0) {
            x.fillStyle = C.rgba(C.col.verm, 0.2); x.fillRect(380, 712, 480, 12);
            x.fillStyle = C.col.verm; x.fillRect(380, 712, 480 * 0.03 * tp, 12);
            T.draw(x, '2026 · 09', 380, 812, { size: 18, fam: 'mono', col: C.col.ink2, align: 'center', alpha: tp, id: 'd0' });
            T.draw(x, '2028 · 09 +', 860, 812, { size: 18, fam: 'mono', col: C.col.ink2, align: 'center', alpha: tp, id: 'd1' });
          }
        }
        x.restore();
      }
    },
  });
});
