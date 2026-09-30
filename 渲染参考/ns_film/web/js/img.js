// 图片：预加载 + 半色调网点化（印刷感），输出透明底墨点画布
(function () {
  const IMG = (window.IMG = { raw: {}, ht: {} });
  const LIST = {
    stokes: 'img/04_gabriel_stokes.jpg', buck: 'img/23_tristan_buckmaster.jpg', medal: 'img/06_fields_p1_0.png',
    jet: 'img/02_turbulent_jet_farfield.jpg', fields26: 'img/21_nature_fields_2026.jpg',
  };
  IMG.load = () => Promise.all(Object.entries(LIST).map(([k, src]) => new Promise((ok, no) => {
    const im = new Image(); im.onload = () => { IMG.raw[k] = im; ok(); }; im.onerror = () => no(new Error('img ' + src)); im.src = src;
  })));

  // 半色调：o = {w, h, cell, col, angle, gamma, crop:[sx,sy,sw,sh], invert, vign}
  IMG.halftone = function (key, o) {
    const im = IMG.raw[key];
    const w = o.w, h = o.h, cell = o.cell || 7;
    const [sx, sy, sw, sh] = o.crop || [0, 0, im.width, im.height];
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    const sx2 = src.getContext('2d'); sx2.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
    const px = sx2.getImageData(0, 0, w, h).data;
    const lum = (x, y) => {
      x = C.clamp(Math.round(x), 0, w - 1); y = C.clamp(Math.round(y), 0, h - 1);
      const i = (y * w + x) * 4; return (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    };
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const x = out.getContext('2d');
    x.fillStyle = o.col || C.col.ink;
    const a = o.angle ?? 0.26, ca = Math.cos(a), sa = Math.sin(a);
    const R = Math.hypot(w, h);
    for (let v = -R; v < R; v += cell) for (let u = -R; u < R; u += cell) {
      const X = w / 2 + u * ca - v * sa, Y = h / 2 + u * sa + v * ca;
      if (X < -cell || Y < -cell || X > w + cell || Y > h + cell) continue;
      let d = 1 - lum(X, Y);
      if (o.invert) d = 1 - d;
      d = Math.pow(C.clamp((d - (o.floor || 0)) / (1 - (o.floor || 0))), o.gamma || 1);
      if (o.vign) { const q = Math.hypot((X - w / 2) / (w / 2), (Y - h / 2) / (h / 2)); d *= 1 - C.smooth((q - o.vign) / 0.35); }
      const r = Math.sqrt(d) * cell * 0.62;
      if (r < 0.35) continue;
      x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); x.fill();
    }
    return out;
  };

  IMG.prep = function () {
    IMG.ht.stokes = IMG.halftone('stokes', { w: 460, h: 520, cell: 7, crop: [60, 10, 205, 232], gamma: 1.1, floor: 0.12, vign: 0.72 });
    IMG.ht.buck = IMG.halftone('buck', { w: 360, h: 480, cell: 6, crop: [0, 0, 162, 216], gamma: 1.0, floor: 0.1, vign: 0.75 });
    IMG.ht.medal = IMG.halftone('medal', { w: 620, h: 600, cell: 6, gamma: 0.95, floor: 0.05 });
    IMG.ht.fields26 = IMG.halftone('fields26', { w: 1280, h: 720, cell: 7, gamma: 1.05, floor: 0.08 });
    IMG.ht.jet = IMG.halftone('jet', { w: 700, h: 700, cell: 8, invert: true, gamma: 1.3, floor: 0.1, col: C.col.blue });
  };
})();
