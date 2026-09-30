// 入口：字体/图片加载 → 初始化 → renderFrame / renderRange（WebSocket 推流）/ probeFrame
(function () {
  window.renderFrame = function (f) {
    const t = f / C.FPS;
    SIM.to(f);
    G.beginLayers();
    DIR.draw2D(t, G.layers);
    G.frame(f, DIR.post(t));
  };

  window.renderRange = async function (f0, f1, port) {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    ws.binaryType = 'arraybuffer';
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
    const waiters = [];
    ws.onmessage = () => { const w = waiters.shift(); if (w) w(); };
    const bufs = [new Uint8Array(3110400), new Uint8Array(3110400)];
    let inflight = 0; const t0 = performance.now();
    for (let f = f0; f < f1; f++) {
      renderFrame(f);
      const b = bufs[f & 1];
      G.readYUV(f, b);
      while (inflight >= 2) await new Promise((ok) => waiters.push(() => { inflight--; ok(); }));
      inflight++;
      ws.send(b);
      if ((f - f0) % 300 === 299) console.log(`frame ${f + 1}/${f1}  ${((performance.now() - t0) / (f - f0 + 1)).toFixed(1)} ms/f`);
    }
    while (inflight > 0) await new Promise((ok) => waiters.push(() => { inflight--; ok(); }));
    ws.send(JSON.stringify({ done: true, frames: f1 - f0, ms: performance.now() - t0 }));
    ws.close();
    return (performance.now() - t0) / (f1 - f0);
  };

  window.probeFrame = function (f) {
    T.reg = [];
    renderFrame(f);
    const reg = T.reg; T.reg = null;
    reg.push({ id: '#tower', x0: 0, y0: 0, x1: 0, y1: 0, a: 0, box: [], bg: 0 });
    const b = new Uint8Array(3110400);
    G.readYUV(f, b);
    return { reg, b };
  };

  (async function boot() {
    const faces = ['900 40px NSerif', '700 40px NSerif', '600 40px NSerif', '400 40px NSerif', '300 40px NSerif', '200 40px NSerif',
      '700 40px NSC', '500 40px NSC', '400 40px Geo', '700 40px Geo', 'italic 400 40px Geo', 'italic 700 40px Geo', '400 40px Mono', '700 40px Mono',
      '40px KMath', '40px KMain'];
    await Promise.all(faces.map((f) => document.fonts.load(f, '纳维AkQ(∂ν∇')));
    await IMG.load();
    G.init(); IMG.prep();
    for (const fn of window.SCENES || []) fn();
    DIR.init(); SIM.build();
    window.READY = true;
  })().catch((e) => { window.BOOT_ERR = String(e.stack || e); console.error(e); });
})();
