// 02 八十八小时：机密档案（纸）→ 计数器与分组网络 → 夜：发光涡旋向内盘旋、拉长、坍缩 → 纸：166 页 + Lean 终端 → 划掉一百万
(window.SCENES = window.SCENES || []).push(function () {
  const A = C.A, S = C.S, sm = C.smooth, E = C.ease, cl = C.clamp, Wf = C.Wf;
  const sc = S('run');
  const tR1 = A('r1'), tR1b = A('r1', 1);
  const tR2 = A('r2'), tMsg = A('r2', 1), tTok = A('r2', 2);
  const tR3 = A('r3'), tCon = A('r3', 1), tIn = A('r3', 2), tLong = A('r3', 3);
  const tR4 = A('r4'), tR4b = A('r4', 1), tR4c = A('r4', 2);
  const tR5 = A('r5'), tStar = Wf('r5', '无穷', A('r5', 1) + 1.4) + 0.15;
  const tR6 = A('r6'), tLean = A('r6', 1), tChk = A('r6', 2);
  const tR7 = A('r7'), tNo = A('r7', 1);
  const N0 = tR3 - 0.35, N1 = C.L1('r5') + 0.85;
  DIR.night.push([N0, N1]);
  const HX = 700, HY = 540;

  // 坍缩参数 c: 0→1（tR3 → tStar）
  const col = (t) => E.inQuad(cl((t - tR3) / (tStar - tR3)));

  // ---- 音效 ----
  CUE.add(tR1, 'type', 0.4); for (let i = 0; i < 16; i++) CUE.add(tR1 + 0.5 + i * 0.07, 'type', 0.3, { pitch: 1 + (i % 4) * 0.05 });
  CUE.add(tR1b, 'redact', 0.8); CUE.add(tR1b + 0.35, 'redact', 0.6);
  CUE.add(tR2, 'data', 0.6, { dur: 1.6 }); CUE.add(tMsg, 'count', 0.6, { dur: 1.2 }); CUE.add(tTok, 'count', 0.7, { dur: 1.4 });
  CUE.add(tTok + 1.4, 'hit', 0.6);
  CUE.add(tCon, 'swell', 0.7, { dur: 3 }); CUE.add(tIn, 'whoosh', 0.6); CUE.add(tLong, 'whoosh', 0.5);
  CUE.add(tR4, 'drone', 0.8, { dur: tStar - tR4 });
  [tR4, tR4b, tR4c].forEach((tt, i) => CUE.add(tt + 0.1, 'blip', 0.55, { pitch: 1 + i * 0.25 }));
  CUE.add(tR5 - 0.2, 'riser', 1.0, { dur: tStar - tR5 + 0.2 }); CUE.add(tStar - 0.9, 'reverse', 0.9, { dur: 0.9 });
  CUE.add(tStar, 'hit', 1.4); CUE.add(tStar, 'boom', 1.1);
  CUE.hit(tStar, { flash: 0.6, shake: 1.5, tau: 0.16, col: '#ffd9c2', zoom: 0.04 });
  for (let i = 0; i < 14; i++) CUE.add(tR6 + 0.1 + i * 0.07, 'page', 0.35, { pitch: 0.9 + (i % 5) * 0.06 });
  CUE.add(tLean, 'type', 0.4);
  for (let i = 0; i < 26; i++) CUE.add(tLean + 0.2 + i * 0.045, 'type', 0.28, { pitch: 1 + (i % 3) * 0.08 });
  [0, 1, 2].forEach((i) => CUE.add(tChk + 0.2 + i * 0.35, 'check', 0.7, { pitch: 1 + i * 0.12 }));
  CUE.add(tChk + 1.3, 'chime', 0.6);
  CUE.add(tNo - 0.05, 'pen', 0.8, { dur: 0.5 }); CUE.add(tNo + 0.55, 'stamp', 1.0); CUE.hit(tNo + 0.55, { shake: 0.6 });

  DIR.reg('run', sc.start, sc.end, {
    resets: [N0, N1],
    sim(t, s) {
      s.p.velDiss = 0.35; s.p.dyeDiss = 0.08; s.p.vort = 24;
      if (t < N0) {
        s.p.wind = [70, 1.4, t * 0.5, 20];
        // 消息流：细墨线从网络中逸出
        if (t > tMsg && t < N0 - 1) { const k = Math.floor(t * 20); const R = C.rng(k); s.dye(200 + R() * 700, 360 + R() * 440, 5, [0, 0.12, 0, 0]); }
        return;
      }
      if (t < N1) {
        const c = col(t);
        s.p.velDiss = 0.9; s.p.dyeDiss = 0.3; s.p.vort = 30;
        s.p.field = [{ x: HX, y: HY, R: 460, swirl: 1500 + 5200 * c, radial: 250 + 900 * c, lin: 0.3 }];
        if (t < tStar) {
          const w = t * (2.4 + 12 * c), rr = 380 * (1 - 0.75 * c) + 20;
          for (let k = 0; k < 2; k++) {
            const a = w + k * Math.PI;
            s.dye(HX + Math.cos(a) * rr, HY + Math.sin(a) * rr * 0.6, 16 + 10 * c, [0.018 + 0.05 * c, 0.04 * (1 - c), 0, 0]);
            s.dye(HX + Math.cos(a + 1.2) * rr * 1.5, HY + Math.sin(a + 1.2) * rr * 0.9, 22, [0, 0.025, 0, 0]);
          }
        }
        if (s.at(tStar)) {
          s.stamp((x) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(HX, HY, 380, 0, Math.PI * 2); x.fill(); }, { vel: { k: 1, boom: 3000, cx: HX, cy: HY } });
          s.dye(HX, HY, 50, [0.5, 0, 0.35, 0]);
        }
        return;
      }
      s.p.wind = [60, 1.2, t * 0.4, 15];
      if (s.at(tNo + 0.1)) s.stamp((x) => { FX.strike(x, 620, 1300, 520, 1, 22, '#ff0000', 8); }, { dye: 0.6, vel: { k: 1, push: [400, 0] } });
    },
    draw(t, X) {
      const x = X.front, b = X.back;
      // ============ 机密档案 ============
      const da = sm((t - (tR1 - 0.3)) / 0.4) * (1 - sm((t - (tR2 + 0.2)) / 0.4));
      if (da > 0.002) {
        const lt = t - tR1;
        x.save(); x.globalAlpha = da;
        const sx = 960, sy = 520 + (1 - E.outCubic(cl(lt / 0.6))) * 60;
        FX.sheet(x, sx, sy, 980, 600, -0.012, { fill: '#fbf8f0' });
        x.translate(sx, sy); x.rotate(-0.012);
        T.draw(x, 'OPENAI  ·  INTERNAL', -440, -226, { size: 18, fam: 'geo', track: 6, col: C.col.ink2, id: 'doc' });
        T.draw(x, 'EVAL · MILLENNIUM PRIZE PROBLEMS', 440, -226, { size: 14, fam: 'mono', col: C.col.mute, align: 'right', id: 'doc' });
        D.line(x, -440, -206, 440, -206, { col: C.rgba(C.col.ink, 0.5), lw: 1.5, cap: 'butt' });
        const rows = [['基准', 'GPT-6 Astra'], ['本次模型', '▮'], ['状态', '▮'], ['训练开始', '2026-08-28'], ['启动', '2026-09-01']];
        rows.forEach(([k, v], i) => {
          const y = -140 + i * 76, q = cl((lt - 0.3 - i * 0.25) * 3);
          if (q <= 0) return;
          T.draw(x, k, -440, y, { size: 30, weight: 700, fam: 'serif', col: C.col.ink2, alpha: q, id: 'dk' + i });
          if (v === '▮') {
            const w = i === 1 ? 470 : 300, rp = E.outQuart(cl((t - tR1b - (i - 1) * 0.35) / 0.35));
            x.fillStyle = C.col.ink; x.fillRect(-160, y - 32, w * rp, 44);
            if (rp > 0.9) T.draw(x, i === 1 ? '更强 · 未公开' : 'CLASSIFIED', -160 + w + 18, y, { size: 22, weight: 700, fam: i === 1 ? 'serif' : 'mono', col: C.col.verm, alpha: cl((rp - 0.9) * 10), id: 'dr' + i });
          } else FX.type(x, v, -160, y, lt - 0.4 - i * 0.25, 22, { size: 30, fam: 'mono', col: C.col.ink, alpha: q, cursor: false, id: 'dv' + i });
        });
        // 能力条：Astra vs 内部模型
        const bp = E.outCubic(cl((t - tR1b - 0.2) / 0.9));
        x.fillStyle = C.rgba(C.col.ink, 0.25); x.fillRect(-440, 250, 520 * cl(lt * 2), 14);
        x.fillStyle = C.col.verm; x.fillRect(-440, 270, 780 * bp, 14);
        T.draw(x, 'ASTRA', -440 + 520 * cl(lt * 2) + 10, 264, { size: 13, fam: 'geo', track: 3, col: C.col.ink2, id: 'bar' });
        x.restore();
      }
      // ============ 计数器 + 分组网络 ============
      const ca = sm((t - (tR2 - 0.1)) / 0.4) * (1 - sm((t - (N0 - 0.9)) / 0.4));
      if (ca > 0.002) {
        const lt = t - tR2;
        x.save(); x.globalAlpha = ca;
        // 分组：12 个团簇，团内连线闪烁
        const R = C.rng(88);
        const grp = [];
        for (let g = 0; g < 12; g++) grp.push([230 + (g % 4) * 190 + R() * 60, 330 + Math.floor(g / 4) * 190 + R() * 50, 30 + R() * 40]);
        grp.forEach(([gx, gy, gr], g) => {
          const q = E.outBack(cl((lt - g * 0.06) / 0.5));
          if (q <= 0) return;
          const n = 22;
          x.fillStyle = C.col.ink;
          for (let i = 0; i < n; i++) {
            const a = C.hash(g * 97 + i) * 6.283, r = Math.sqrt(C.hash(g * 31 + i)) * gr * q;
            x.fillRect(gx + Math.cos(a) * r - 2, gy + Math.sin(a) * r - 2, 4, 4);
          }
          x.strokeStyle = C.rgba(C.col.blue, 0.5); x.lineWidth = 1; x.beginPath();
          for (let i = 0; i < 6; i++) {
            const k = Math.floor(t * 9 + i * 3 + g), a1 = C.hash(g * 97 + (k % n)) * 6.283, a2 = C.hash(g * 97 + ((k * 7) % n)) * 6.283;
            const r1 = Math.sqrt(C.hash(g * 31 + (k % n))) * gr, r2 = Math.sqrt(C.hash(g * 31 + ((k * 7) % n))) * gr;
            x.moveTo(gx + Math.cos(a1) * r1, gy + Math.sin(a1) * r1); x.lineTo(gx + Math.cos(a2) * r2, gy + Math.sin(a2) * r2);
          }
          x.stroke();
          D.ring(x, gx, gy, gr + 12, C.rgba(C.col.ink, 0.35), 1.2, q);
        });
        // 团间：Codex 汇总的交叉授粉（红虚线）
        if (t > tMsg) {
          const q = cl((t - tMsg) / 1.5);
          for (let g = 0; g < 11; g++) {
            const a = grp[g], bb = grp[(g * 5 + 3) % 12];
            D.line(x, a[0], a[1], bb[0], bb[1], { col: C.rgba(C.col.verm, 0.55), lw: 1.5, dash: [6, 8], dashOff: -t * 40, p: cl(q * 2 - g * 0.08) });
          }
        }
        // 计数
        const rows = [[tR2, 10000, '个智能体', 'AGENTS'], [tMsg, 2.7e6, '条消息', 'MESSAGES'], [tTok, 1.3e11, 'token', 'OUTPUT TOKENS']];
        rows.forEach(([t0, v, zh, en], i) => {
          const q = t - t0; if (q < -0.1) return;
          const y = 380 + i * 170, n = v * E.outQuart(cl(q / 1.3));
          T.draw(x, en, 1780, y - 92, { size: 15, fam: 'geo', track: 6, col: C.col.ink2, align: 'right', alpha: cl(q * 4), id: 'cn' + i });
          T.draw(x, FX.num(n), 1780 - T.width(x, zh, { size: 34, weight: 700, fam: 'serif' }) - 16, y, { size: 84, fam: 'mono', col: i === 2 ? C.col.verm : C.col.ink, align: 'right', alpha: cl(q * 4), id: 'cv' + i });
          T.draw(x, zh, 1780, y, { size: 34, weight: 700, fam: 'serif', col: C.col.ink, align: 'right', alpha: cl(q * 4), id: 'cz' + i });
        });
        x.restore();
      }
      // ============ 夜：涡旋 ============
      if (t >= N0 && t < N1) {
        const c = col(t), post = t - tStar;
        // 3D 螺旋管：8 股，沿竖轴，腰部收缩
        const strands = 8, segs = 90;
        const pinch = (yy) => 1 - 0.93 * Math.pow(Math.min(1, c * 1.02), 1.3) * Math.exp(-Math.pow((yy - HY) / (260 - 160 * c), 2));
        const rot = t * 1.4 + 26 * Math.pow(c, 2.2);
        const fadeIn = sm((t - N0 - 0.2) / 0.8), gone = post > 0 ? Math.exp(-post * 3) : 1;
        if (gone > 0.01) {
          x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
          for (let k = 0; k < strands; k++) {
            let prev = null;
            for (let i = 0; i <= segs; i++) {
              const u = i / segs, yy = 150 + u * 780;
              const r = 250 * pinch(yy) * (0.85 + 0.15 * Math.sin(u * 9 + k));
              const th = rot / Math.max(0.08, pinch(yy)) * 0.18 + u * 11 + (k / strands) * 6.283 + rot;
              const px = HX + Math.cos(th) * r, dz = Math.sin(th);
              const cur = [px, yy + dz * 18 * (1 - c), dz, pinch(yy)];
              if (prev) {
                const hot = 1 - cur[3];
                x.globalAlpha = fadeIn * gone * (0.35 + 0.65 * (cur[2] * 0.5 + 0.5)) * (0.7 + 0.3 * hot);
                x.strokeStyle = hot > 0.45 ? C.mixHex('#ff9a5c', '#fff0d8', (hot - 0.45) * 1.6) : C.mixHex('#58b4ff', '#ff9a5c', hot / 0.45);
                x.lineWidth = 2.5 + 4 * (cur[2] * 0.5 + 0.5) + hot * 3;
                x.beginPath(); x.moveTo(prev[0], prev[1]); x.lineTo(cur[0], cur[1]); x.stroke();
              }
              prev = cur;
            }
          }
          // 轴向拉伸箭头
          const sa = sm((t - tLong) / 0.5) * gone;
          if (sa > 0.01) {
            D.arrow(x, HX, 360, HX, 170 - 30 * c, { col: C.rgba('#ffe7cf', 0.8 * sa), lw: 3, head: 16 });
            D.arrow(x, HX, 720, HX, 910 + 30 * c, { col: C.rgba('#ffe7cf', 0.8 * sa), lw: 3, head: 16 });
          }
          // 向内盘旋箭头
          const ia = sm((t - tIn) / 0.4) * (1 - sm((t - tR4) / 0.5));
          if (ia > 0.01) for (let k = 0; k < 2; k++) {
            const pts = [];
            for (let i = 0; i <= 40; i++) { const u = i / 40, a = t * 2 + k * Math.PI + u * 4, r = 400 - 260 * u; pts.push([HX + Math.cos(a) * r, HY + Math.sin(a) * r * 0.35]); }
            FX.brush(x, pts, cl((t - tIn) / 0.8), 4, C.rgba('#bfe0ff', ia), 40 + k);
          }
          x.restore();
        }
        // 右侧读数
        const rx = 1240;
        const ttl = sm((t - (tCon - 0.2)) / 0.4) * (1 - sm((t - tR4 + 0.2) / 0.4));
        if (ttl > 0.01) {
          x.save(); x.globalAlpha = ttl;
          T.reveal(x, '9 月 5 日', rx, 380, t - tR3, { size: 40, weight: 700, fam: 'serif', col: '#f2ede2', stag: 0.05, id: 'sep5' });
          T.reveal(x, '一个构造', rx, 500, t - tCon, { size: 96, weight: 900, fam: 'serif', col: '#ffffff', stag: 0.08, id: 'constr' });
          T.reveal(x, '向内盘旋  ·  不断拉长', rx, 580, t - tIn, { size: 40, weight: 600, fam: 'serif', col: '#ffb58f', stag: 0.05, id: 'spiral' });
          x.restore();
        }
        const rows = [[tR4, 'r → 0', '核心越缩越小', '#bfe0ff'], [tR4b, 'ω → ∞', '转得越来越快', '#ffb58f'], [tR4c, 'E < ∞', '能量始终有限', '#ffffff']];
        const ro = 1 - sm((t - (tR5 - 0.1)) / 0.3);
        rows.forEach(([t0, m, zh, cc], i) => {
          const q = E.outCubic(cl((t - t0) / 0.5)); if (q <= 0 || ro <= 0) return;
          x.save(); x.globalAlpha = q * ro;
          const y = 360 + i * 170;
          M.draw(x, m, rx + (1 - q) * 40, y, { size: 90, col: cc, id: 'ro' + i });
          T.draw(x, zh, rx + 4, y + 52, { size: 28, weight: 700, fam: 'serif', col: 'rgba(240,235,225,0.75)', id: 'rz' + i });
          x.restore();
        });
        // 坍缩终点
        const fa = sm((t - (tR5 + 0.25)) / 0.3) * (1 - sm((t - tStar) / 0.1));
        if (fa > 0.01) {
          x.save(); x.globalAlpha = fa;
          T.draw(x, '速度', rx, 460, { size: 110, weight: 900, fam: 'serif', col: '#ffffff', id: 'spd' });
          M.draw(x, 't → T^{*}', rx, 600, { size: 70, col: '#ffb58f', id: 'tT' });
          x.restore();
        }
        if (post > 0) {
          const q = C.spring(post, 2.6, 0.45), fo = 1 - sm((t - (N1 - 0.9)) / 0.3);
          x.save(); x.globalAlpha = fo; x.translate(960, 560); x.scale(0.5 + 0.5 * q, 0.5 + 0.5 * q);
          M.draw(x, '‖u‖ → ∞', 0, 60, { size: 210, col: '#fff3e6', align: 'center', id: 'uinf' });
          x.restore();
          if (post < 1.4) {
            const r = 40 + 1600 * E.outCubic(post / 1.4);
            x.save(); x.globalAlpha = 0.9 * (1 - post / 1.4); x.strokeStyle = '#ffb58f'; x.lineWidth = 4 + 16 * (1 - post / 1.4);
            x.beginPath(); x.arc(HX, HY, r, 0, Math.PI * 2); x.stroke(); x.restore();
          }
        }
      }
      // ============ 纸：论文 + Lean ============
      if (t >= N1) {
        const pa = sm((t - (tR6 - 0.3)) / 0.4) * (1 - sm((t - (tR7 - 0.2)) / 0.4));
        if (pa > 0.002) {
          const lt = t - tR6;
          x.save(); x.globalAlpha = pa;
          // 纸堆扇开
          for (let i = 13; i >= 0; i--) {
            const q = E.outCubic(cl((lt - (13 - i) * 0.07) / 0.5));
            if (q <= 0) continue;
            FX.sheet(x, 470 + i * 2.2 * q, 560 - i * 3 * q, 540, 700, -0.04 + i * 0.012 * q, { fill: i === 0 ? '#fbf8f0' : '#f1ebdd', blur: 12, off: 5 });
          }
          x.save(); x.translate(470, 560); x.rotate(-0.04);
          T.draw(x, 'Finite time blowup', 0, -210, { size: 38, fam: 'geo', col: C.col.ink, align: 'center', id: 'ptitle' });
          T.draw(x, 'for Navier–Stokes', 0, -164, { size: 38, fam: 'geo', col: C.col.ink, align: 'center', id: 'ptitle' });
          T.draw(x, 'OpenAI', 0, -112, { size: 22, fam: 'geoi', col: C.col.ink2, align: 'center', id: 'pauth' });
          for (let k = 0; k < 11; k++) { const w = 380 - (k % 3) * 60 - (k === 10 ? 160 : 0); x.fillStyle = C.rgba(C.col.ink, 0.18); x.fillRect(-190, -50 + k * 26, w, 8); }
          M.draw(x, '∂_{t}u + (u⋅∇)u = −∇p + νΔu + f', 0, 270, { size: 26, col: C.col.ink, align: 'center', id: 'peq' });
          x.restore();
          const pn = Math.round(166 * E.outQuart(cl(lt / 1.2)));
          T.draw(x, String(pn), 820, 290, { size: 140, fam: 'geoi', col: C.col.verm, align: 'right', id: 'pages' });
          T.draw(x, '页', 834, 290, { size: 44, weight: 900, fam: 'serif', col: C.col.verm, id: 'pages' });
          // Lean 终端
          const ll = t - tLean;
          if (ll > -0.2) {
            const q = E.outCubic(cl((ll + 0.2) / 0.5));
            const tx = 1000, ty = 330, tw = 800, th = 460;
            x.save(); x.translate(0, (1 - q) * 40); x.globalAlpha = pa * q;
            x.shadowColor = 'rgba(20,10,0,0.35)'; x.shadowBlur = 30; x.shadowOffsetY = 12;
            x.fillStyle = '#15171c'; x.fillRect(tx, ty, tw, th); x.shadowBlur = 0; x.shadowOffsetY = 0;
            x.fillStyle = '#23262e'; x.fillRect(tx, ty, tw, 40);
            ['#e0674a', '#e3b24a', '#5fb36b'].forEach((cc, i) => D.disc(x, tx + 24 + i * 22, ty + 20, 7, cc));
            T.draw(x, 'openai/NavierStokesAndEuler', tx + tw / 2, ty + 27, { size: 16, fam: 'mono', col: '#9aa3b5', align: 'center', id: 'repo' });
            const lines = [['$ lake exe cache get', '#e8e3d8', 0], ['$ lake build', '#e8e3d8', 0.8]];
            lines.forEach(([s, cc, d], i) => FX.type(x, s, tx + 30, ty + 92 + i * 42, ll - d, 26, { size: 24, fam: 'mono', col: cc, cursor: false, id: 'tl' + i }));
            const ck = [['(C) Breakdown of Navier–Stokes on R³', 0.2], ['(D) Breakdown on the torus R³/Z³', 0.55], ['Euler · finite-time singularity', 0.9]];
            ck.forEach(([s, d], i) => {
              const q2 = cl((t - tChk - d) * 5); if (q2 <= 0) return;
              T.draw(x, '✓', tx + 30, ty + 214 + i * 46, { size: 28, weight: 700, fam: 'sans', col: '#7fd18b', alpha: q2, id: 'ck' + i });
              T.draw(x, s, tx + 70, ty + 214 + i * 46, { size: 22, fam: 'mono', col: '#cfd6e4', alpha: q2, id: 'cs' + i });
            });
            const done = cl((t - tChk - 1.3) * 4);
            if (done > 0) T.draw(x, 'Build completed successfully.', tx + 30, ty + 420, { size: 22, fam: 'mono', col: '#7fd18b', alpha: done, id: 'done' });
            x.restore();
            x.save(); x.globalAlpha = pa * cl((ll - 0.5) * 3);
            T.draw(x, 'LEAN 4  ·  形式化 17 小时（GPT-6 Astra）', tx, ty - 22, { size: 18, weight: 700, fam: 'serif', col: C.col.ink2, id: 'leancap' });
            x.restore();
          }
          x.restore();
        }
        // 一百万：划掉 + 印章
        const ma = sm((t - (tR7 - 0.1)) / 0.4) * (1 - sm((t - (sc.end - 0.6)) / 0.3));
        if (ma > 0.002) {
          x.save(); x.globalAlpha = ma;
          T.draw(x, 'OpenAI', 960, 330, { size: 40, fam: 'geoi', col: C.col.ink2, align: 'center', id: 'oai' });
          FX.slam(x, '$1,000,000', 960, 580, t - tR7, { size: 200, fam: 'geo', col: C.col.ink, align: 'center', stag: 0.03, from: 1.6, id: 'mil' });
          FX.strike(x, 440, 1480, 520, E.outCubic(cl((t - tNo) / 0.45)), 26, C.col.verm, 8);
          FX.stamp(x, '不申领', 1380, 720, t - tNo - 0.55, { size: 70, rot: -0.12, double: true, seed: 12, id: 'noclaim' });
          x.restore();
        }
      }
    },
  });
});
