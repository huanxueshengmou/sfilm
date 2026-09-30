// 入口：字体 / 形状图集 → 初始化 → renderFrame / renderRange（WebSocket 推流给 ffmpeg）/ probe（截图）
(function () {
  window.renderFrame = function (f) {
    const F = DIR.frame(f / C.FPS);
    G.render(F, f);
  };

  window.renderRange = async function (f0, f1, port) {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    ws.binaryType = 'arraybuffer';
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('WebSocket 连接失败')); });
    const waiters = [];
    ws.onmessage = () => { const w = waiters.shift(); if (w) w(); };
    const bufs = [new Uint8Array(3110400), new Uint8Array(3110400), new Uint8Array(3110400)];
    let inflight = 0;
    const t0 = performance.now();
    for (let f = f0; f < f1; f++) {
      renderFrame(f);
      const b = bufs[f % 3];
      while (inflight >= 2) await new Promise((ok) => waiters.push(() => { inflight--; ok(); }));
      G.readYUV(f, b);
      inflight++;
      ws.send(b);
    }
    while (inflight > 0) await new Promise((ok) => waiters.push(() => { inflight--; ok(); }));
    ws.send(JSON.stringify({ done: true, frames: f1 - f0 }));
    ws.close();
    return (performance.now() - t0) / (f1 - f0);
  };

  window.probe = function (f, type = 'image/png') {
    renderFrame(f);
    G.blit();
    return G.canvas.toDataURL(type, 0.92);
  };

  (async function boot() {
    try {
      const faces = ['900 40px NSC', '700 40px NSC', '500 40px NSC', '300 40px NSC', '900 40px NSerif', '600 40px NSerif',
        '400 40px Mono', '700 40px Mono', '500 40px Grot', '700 40px Grot', '40px KMath', '40px KMain'];
      await Promise.all(faces.map((f) => document.fonts.load(f, '蒸馏AIz0Σ')));
      D.init();
      G.init();
      SH.build();
      G.atlas(SH.pack());
      window.READY = true;
    } catch (e) {
      window.BOOT_ERR = String((e && e.stack) || e);
      console.error(e);
    }
  })();
})();
