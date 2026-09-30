// 06 章程（纸）：菲尔兹奖章程文档 → 放大第二条 → 圈注「一位数学家个人」「40 岁生日」→ AI 没有生日（生日栏打叉）
// → 真正的答案不在条文里（文档化墨冲散）→ 2026 四位得主半色调合影 → 「未来成就的希望」
(window.SCENES = window.SCENES || []).push(function () {
  const A = C.A, S = C.S, sm = C.smooth, E = C.ease, cl = C.clamp, Wf = C.Wf;
  const sc = S('rule');
  SUB.nosub.add('a3');
  const tA1 = A('a1'), tQ = A('a1', 1);
  const tA2 = A('a2'), tArt = A('a2', 1), tInd = A('a2', 2), tBirth = A('a2', 3), tJan = A('a2', 4);
  const tNoB = A('a3');
  const tA4 = A('a4'), tNot = A('a4', 1);
  const tA5 = A('a5'), tFour = A('a5', 1), tNames = A('a5', 2);
  const tA6 = A('a6'), tExist = A('a6', 1), tHope = A('a6', 2);
  const tMelt = tA4 - 0.05;
  // 文档布局（缩放前坐标）
  const DOC = { x: 960, y: 560, w: 1180, h: 820 }; // 在 lines 定义后按实测文字宽度重算
  const lines = [
    ['1.', 'The Fields Medal is awarded every four years on the occasion of the'],
    ['', 'International Congress of Mathematicians to recognize outstanding'],
    ['', 'mathematical achievement for existing work and for the promise of future achievement.'],
    ['2.', 'The Fields Medal is awarded to an individual mathematician whose 40th'],
    ['', 'birthday must not occur before January 1st of the year of the ICM'],
    ['', 'at which the Fields Medals are awarded.'],
    ['3.', 'No more than four Fields Medals are awarded at one ICM.'],
    ['4.', 'The award consists of gold medal bearing the profile of Archimedes'],
    ['', 'and a cash amount of CAD 15,000.'],
  ];
  // 纸张按实测排版包住所有文字：编号列 lx=250，正文从 lx=310 起，标题行在 ly=230/290，末行 LY(8)
  {
    const mx = G.layers.stamp.ctx; mx.save();
    let right = 0;
    for (const [, l] of lines) right = Math.max(right, 310 + T.width(mx, l, { size: 30, fam: 'geo' }));
    right = Math.max(right, 310 + T.width(mx, 'Statutes for the Fields Medal', { size: 44, weight: 700, fam: 'geo' }));
    mx.restore();
    const L0 = 250 - 80, R0 = right + 80, T0 = 230 - 22 - 70, B0 = 380 + 8 * 58 + 12 + 70;
    DOC.x = (L0 + R0) / 2; DOC.y = (T0 + B0) / 2; DOC.w = R0 - L0; DOC.h = B0 - T0;
  }
  const zoomAt = (t) => E.inOutCubic(cl((t - tArt) / 0.9));
  const LY = (i) => 380 + i * 58;
  // 缩放锚点：第 2 条正文左缘 → 屏幕 (240, 470)；编号列落在 x≈150，纸边在 x≈60
  const ZK = 0.45, AX = 310, AY = LY(4);
  const docX = (lx, ly, z) => [AX + (lx - AX) * (1 + ZK * z) + z * (240 - AX), AY + (ly - AY) * (1 + ZK * z) + z * (470 - AY)];
  const FOUR = [['邓煜', 'Yu Deng'], ['约翰 · 帕登', 'John Pardon'], ['雅各布 · 齐默尔曼', 'Jacob Tsimerman'], ['王虹', 'Hong Wang']];

  // ---- 音效 ----
  CUE.add(tQ, 'hit', 0.6); CUE.add(tA2, 'page', 0.8); CUE.add(tArt, 'whoosh', 0.5);
  CUE.add(tInd + 0.1, 'pen', 0.8, { dur: 0.7 }); CUE.add(tBirth + 0.1, 'pen', 0.8, { dur: 0.7 });
  CUE.add(tNoB - 0.4, 'type', 0.3); CUE.add(tNoB, 'stamp', 1.1); CUE.add(tNoB + 0.02, 'hit', 1.0);
  CUE.hit(tNoB, { shake: 1.0, zoom: 0.02 });
  CUE.add(tMelt, 'melt', 1.0, { dur: 2 });
  CUE.add(tA5, 'swell', 0.6, { dur: 3 }); FOUR.forEach((_, i) => CUE.add(tNames + i * 0.55, 'chime', 0.5, { pitch: 1 + i * 0.12 }));
  CUE.add(tExist, 'blip', 0.5); CUE.add(tHope, 'shimmer', 0.9);

  DIR.reg('rule', sc.start, sc.end, {
    sim(t, s) {
      s.p.velDiss = 0.3; s.p.dyeDiss = 0.06; s.p.vort = 26;
      if (s.at(tMelt)) {
        const z = zoomAt(tMelt);
        s.stamp((x) => {
          lines.forEach(([n, l], i) => { if (i < 3 || i > 5) return; const [px, py] = docX(250, LY(i), z); T.draw(x, l, px + 60 * (1 + ZK * z), py, { size: 30 * (1 + ZK * z), fam: 'geo', col: '#0000ff' }); });
        }, { dye: 0.9, vel: { k: 1, push: [0, -180], boom: 700, cx: 960, cy: 560 } });
      }
      if (t > tMelt) s.p.wind = [240, 1.8, t * 0.7, 20];
      if (t > tHope && t < tHope + 2.5) { const q = (t - tHope) / 2.5; for (let k = 0; k < 2; k++) s.dye(560 + 800 * q, 900 - 6 * k, 8, [0.1, 0, 0, 0]); }
    },
    draw(t, X) {
      const x = X.front, b = X.back;
      // ======== 问题 ========
      const qa = sm((t - (tA1 - 0.2)) / 0.3) * (1 - sm((t - (tA2 + 0.1)) / 0.3));
      if (qa > 0.002) {
        x.save(); x.globalAlpha = qa;
        FX.slam(x, '菲尔兹奖会颁给 AI 吗？', 960, 560, t - tQ, { size: 120, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', stag: 0.05, id: 'rq' });
        x.restore();
      }
      // ======== 章程文档 ========
      const da = sm((t - (tA2 - 0.1)) / 0.4) * (1 - sm((t - tMelt) / 0.05));
      if (da > 0.002) {
        const z = zoomAt(t), lt = t - tA2;
        x.save(); x.globalAlpha = da;
        const [dx, dy] = docX(DOC.x, DOC.y, z);
        FX.sheet(x, dx, dy + (1 - E.outCubic(cl(lt / 0.5))) * 80, DOC.w * (1 + ZK * z), DOC.h * (1 + ZK * z), 0, { fill: '#fbf8f0' });
        const sz = 30 * (1 + ZK * z);
        const [hx, hy] = docX(250, 230, z);
        x.globalAlpha = da * (1 - z);
        T.draw(x, 'International Mathematical Union', hx + 60, hy, { size: 22 * (1 + ZK * z), fam: 'geo', track: 2, col: C.col.ink2, id: 'imu' });
        const [h2x, h2y] = docX(250, 290, z);
        T.draw(x, 'Statutes for the Fields Medal', h2x + 60, h2y, { size: 44 * (1 + ZK * z), weight: 700, fam: 'geo', col: C.col.ink, id: 'stat' });
        x.globalAlpha = da;
        lines.forEach(([n, l], i) => {
          const [px, py] = docX(250, LY(i), z);
          const hl = i >= 3 && i <= 5 ? 1 : 1 - z;
          x.save(); x.globalAlpha *= hl;
          if (n) T.draw(x, n, px, py, { size: sz, weight: 700, fam: 'geo', col: i === 3 ? C.col.verm : C.col.ink, id: 'ln' + i });
          T.draw(x, l, px + 60 * (1 + ZK * z), py, { size: sz, fam: 'geo', col: C.col.ink, id: 'll' + i });
          x.restore();
        });
        // 圈注：individual mathematician / 40th birthday
        const mark = (li, before, word, t0, seed) => {
          const [px, py] = docX(250, LY(li), z);
          const x0 = px + 60 * (1 + ZK * z) + T.width(x, before, { size: sz, fam: 'geo' });
          const w = T.width(x, word, { size: sz, fam: 'geo' });
          FX.circle(x, x0 + w / 2, py - sz * 0.32, w / 2 + 22, sz * 0.85, E.outCubic(cl((t - t0) / 0.6)), 6, C.col.verm, seed);
          return [x0, x0 + w, py];
        };
        if (t > tInd) {
          const [a0, a1, py] = mark(3, 'The Fields Medal is awarded to an ', 'individual mathematician', tInd, 5);
          const q = cl((t - tInd - 0.5) * 3);
          if (q > 0) T.draw(x, '一位数学家个人', (a0 + a1) / 2, py - 70, { size: 38, weight: 900, fam: 'serif', col: C.col.verm, align: 'center', alpha: q, id: 'ind' });
        }
        if (t > tBirth) {
          const [a0, a1, py] = mark(3, 'The Fields Medal is awarded to an individual mathematician whose ', '40th', tBirth, 6);
          const [px2, py2] = docX(250, LY(4), z);
          FX.under(x, px2 + 60 * (1 + ZK * z), px2 + 60 * (1 + ZK * z) + T.width(x, 'birthday', { size: sz, fam: 'geo' }), py2 + 12, E.outCubic(cl((t - tBirth - 0.2) / 0.4)), 6, C.col.verm, 7);
          const q = cl((t - tBirth - 0.5) * 3);
          if (q > 0) T.draw(x, '40 岁生日', a1 + 30, py - 70, { size: 38, weight: 900, fam: 'serif', col: C.col.verm, alpha: q, id: 'b40' });
        }
        x.restore();
        // AI 没有生日：表单卡片
        const na = sm((t - (tNoB - 0.5)) / 0.3);
        if (na > 0.002) {
          x.save(); x.globalAlpha = na * da;
          const cx = 1420, cy = 830;
          FX.sheet(x, cx, cy, 560, 250, -0.04, { fill: '#fffdf6', blur: 30, off: 14 });
          x.translate(cx, cy); x.rotate(-0.04);
          T.draw(x, 'NOMINATION · 提名表', -250, -80, { size: 18, fam: 'geo', track: 3, col: C.col.ink2, id: 'nom' });
          T.draw(x, '候选人', -250, -20, { size: 26, weight: 700, fam: 'serif', col: C.col.ink2, id: 'nom1' });
          T.draw(x, 'AI', -120, -18, { size: 40, weight: 700, fam: 'geo', col: C.col.ink, id: 'nom1v' });
          T.draw(x, '出生日期', -250, 60, { size: 26, weight: 700, fam: 'serif', col: C.col.ink2, id: 'nom2' });
          D.line(x, -110, 66, 240, 66, { col: C.col.ink, lw: 1.5, cap: 'butt' });
          FX.type(x, '— — / — — / — — — —', -100, 58, t - (tNoB - 0.4), 30, { size: 28, fam: 'mono', col: C.col.mute, cursor: false, id: 'nom2v' });
          x.restore();
          FX.stamp(x, 'AI 没有生日', 1420, 820, t - tNoB, { size: 72, rot: -0.1, double: true, seed: 41, col: C.col.verm, id: 'nob' });
        }
      }
      // ======== 答案不在条文里 ========
      const ea = sm((t - (tA4 - 0.1)) / 0.3) * (1 - sm((t - (tA5 - 0.3)) / 0.4));
      if (ea > 0.002) {
        x.save(); x.globalAlpha = ea;
        T.reveal(x, '但真正的答案', 960, 480, t - tA4, { size: 84, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', stag: 0.06, id: 'ans' });
        FX.slam(x, '不在条文里', 960, 640, t - tNot, { size: 120, weight: 900, fam: 'serif', col: C.col.verm, align: 'center', stag: 0.06, id: 'ans2' });
        x.restore();
      }
      // ======== 四位得主 ========
      const fa = sm((t - (tA5 - 0.2)) / 0.5) * (1 - sm((t - (sc.end - 0.6)) / 0.3));
      if (fa > 0.002) {
        const lt = t - tA5;
        b.save(); b.globalAlpha = fa * 0.9;
        const im = IMG.ht.fields26, s = 0.94 + 0.03 * cl(lt / 8);
        b.drawImage(im, 960 - im.width * s / 2, 460 - im.height * s / 2, im.width * s, im.height * s);
        b.restore();
        x.save(); x.globalAlpha = fa;
        T.draw(x, 'FIELDS MEDAL 2026  ·  ICM PHILADELPHIA  ·  JULY', 960, 170, { size: 18, fam: 'geo', track: 5, col: C.col.ink2, align: 'center', id: 'f26' });
        // 得主名单：照片下方一行字幕式排列（按姓氏字母序，不逐一对应头像）
        let cx = 960 - 700;
        FOUR.forEach(([zh, en], i) => {
          const q = E.outCubic(cl((t - tNames - i * 0.55) / 0.4)); if (q <= 0) return;
          const px = 960 + (i - 1.5) * 350;
          x.save(); x.globalAlpha *= q;
          T.draw(x, zh, px, 870 - (1 - q) * 14, { size: 38, weight: 900, fam: 'serif', col: C.col.ink, align: 'center', id: 'fz' + i });
          T.draw(x, en, px, 910, { size: 20, fam: 'geoi', col: C.col.ink2, align: 'center', id: 'fe' + i });
          if (i < 3) D.disc(x, px + 175, 858, 4, C.col.verm);
          x.restore();
        });
        const ha = cl((t - tA6) * 3) * (1 - sm((t - (sc.end - 0.6)) / 0.3));
        if (ha > 0) {
          
        }
        x.restore();
      }
      // 章程说：已有的成就 + 未来成就的希望（覆盖在合影下方）
      const ha = sm((t - (tA6 - 0.1)) / 0.3) * (1 - sm((t - (sc.end - 0.6)) / 0.3));
      if (ha > 0.002) {
        x.save(); x.globalAlpha = ha;
        x.fillStyle = C.rgba(C.col.paper, 0.94); x.fillRect(0, 300, 1920, 420);
        T.reveal(x, '奖励已有的成就', 960, 440, t - tExist, { size: 60, weight: 700, fam: 'serif', col: C.col.ink2, align: 'center', stag: 0.05, id: 'ex' });
        T.reveal(x, '也奖励“未来成就的希望”', 960, 590, t - tHope, { size: 92, weight: 900, fam: 'serif', col: C.col.verm, align: 'center', stag: 0.06, id: 'hope' });
        T.draw(x, 'the promise of future achievement', 960, 670, { size: 32, fam: 'geoi', col: C.col.ink2, align: 'center', alpha: cl((t - tHope - 0.8) * 2), id: 'hope2' });
        x.restore();
      }
    },
  });
});
