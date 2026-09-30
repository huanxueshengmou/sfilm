// WebGL2 管线：GPU 流体（纳维–斯托克斯稳定流体解算）→ 纸/墨合成（减色墨水 / 发光）→ 泛光 → 胶片后期 → YUV420p 打包
(function () {
  const G = (window.G = {});
  const W = 1920, H = 1080;
  const SW = 384, SH = 216;       // 速度/压力网格
  const DW = 1920, DH = 1080;     // 染料（墨）网格
  G.SW = SW; G.SH = SH;
  let gl;

  const VS = `#version 300 es
    in vec2 aPos; out vec2 vUv;
    void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const HDR = `#version 300 es
    precision highp float; precision highp sampler2D;
    in vec2 vUv; out vec4 o;
    vec3 s2l(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(0.04045, c)); }
    vec3 l2s(vec3 c){ c = max(c, 0.0); return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h12(i), h12(i+vec2(1,0)), f.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), f.x), f.y); }
  `;

  const FS = {};
  FS.copy = `uniform sampler2D src; void main(){ o = texture(src, vUv); }`;
  FS.clear = `uniform vec4 val; void main(){ o = val; }`;
  FS.scale = `uniform sampler2D src; uniform float k; void main(){ o = texture(src, vUv) * k; }`;
  // 高斯墨点 / 速度注入（aspect 修正；r 为半径平方，单位：屏幕高度）
  FS.splat = `uniform sampler2D src; uniform vec2 pt; uniform vec4 val; uniform float r, aspect, hard;
    void main(){ vec2 p = vUv - pt; p.x *= aspect; float d = dot(p,p) / r;
      float w = hard > 0.5 ? smoothstep(1.0, 0.7, d) : exp(-d);
      o = texture(src, vUv) + val * w; }`;
  // 画布印模：把 2D 画布（预乘）注入染料或速度
  FS.stamp = `uniform sampler2D src, stamp; uniform float k, mode; uniform vec2 push, ctr; uniform float boom, aspect;
    void main(){ vec4 s = texture(stamp, vUv); vec4 b = texture(src, vUv);
      if (mode < 0.5) { o = b + vec4(s.rgb, 0.0) * k; return; }
      vec2 d = vUv - ctr; d.x *= aspect; float l = max(length(d), 1e-3);
      vec2 n = vec2(vn(vUv*vec2(48.0,27.0)), vn(vUv*vec2(48.0,27.0)+17.0)) - 0.5;
      o = b + vec4((push + boom * d / l + n * boom * 1.6) * s.a * k, 0.0, 0.0); }`;
  FS.advect = `uniform sampler2D vel, src; uniform vec2 vt; uniform float dt, diss;
    void main(){ vec2 c = vUv - dt * texture(vel, vUv).xy * vt; o = texture(src, c) / (1.0 + diss * dt); }`;
  FS.curl = `uniform sampler2D vel; uniform vec2 vt;
    void main(){ float L = texture(vel, vUv - vec2(vt.x,0)).y, R = texture(vel, vUv + vec2(vt.x,0)).y;
      float T = texture(vel, vUv + vec2(0,vt.y)).x, B = texture(vel, vUv - vec2(0,vt.y)).x;
      o = vec4(0.5 * (R - L - T + B), 0, 0, 1); }`;
  FS.vort = `uniform sampler2D vel, cu; uniform vec2 vt; uniform float k, dt;
    void main(){ float L = texture(cu, vUv - vec2(vt.x,0)).x, R = texture(cu, vUv + vec2(vt.x,0)).x;
      float T = texture(cu, vUv + vec2(0,vt.y)).x, B = texture(cu, vUv - vec2(0,vt.y)).x, C = texture(cu, vUv).x;
      vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 1e-4; f *= k * C; f.y *= -1.0;
      vec2 v = texture(vel, vUv).xy + f * dt; o = vec4(clamp(v, -2000.0, 2000.0), 0, 1); }`;
  FS.div = `uniform sampler2D vel; uniform vec2 vt;
    void main(){ float L = texture(vel, vUv - vec2(vt.x,0)).x, R = texture(vel, vUv + vec2(vt.x,0)).x;
      float T = texture(vel, vUv + vec2(0,vt.y)).y, B = texture(vel, vUv - vec2(0,vt.y)).y;
      vec2 C = texture(vel, vUv).xy;
      if (vUv.x - vt.x < 0.0) L = -C.x; if (vUv.x + vt.x > 1.0) R = -C.x;
      if (vUv.y + vt.y > 1.0) T = -C.y; if (vUv.y - vt.y < 0.0) B = -C.y;
      o = vec4(0.5 * (R - L + T - B), 0, 0, 1); }`;
  FS.press = `uniform sampler2D pr, dv; uniform vec2 vt;
    void main(){ float L = texture(pr, vUv - vec2(vt.x,0)).x, R = texture(pr, vUv + vec2(vt.x,0)).x;
      float T = texture(pr, vUv + vec2(0,vt.y)).x, B = texture(pr, vUv - vec2(0,vt.y)).x;
      o = vec4((L + R + B + T - texture(dv, vUv).x) * 0.25, 0, 0, 1); }`;
  FS.grad = `uniform sampler2D pr, vel; uniform vec2 vt;
    void main(){ float L = texture(pr, vUv - vec2(vt.x,0)).x, R = texture(pr, vUv + vec2(vt.x,0)).x;
      float T = texture(pr, vUv + vec2(0,vt.y)).x, B = texture(pr, vUv - vec2(0,vt.y)).x;
      o = vec4(texture(vel, vUv).xy - vec2(R - L, T - B), 0, 1); }`;
  // 解析力场：涡旋（切向 swirl + 径向 sink）与旋度噪声风
  FS.field = `uniform sampler2D vel; uniform vec4 P[6]; uniform vec4 Q[6]; uniform int n; uniform vec4 wind; uniform float dt, aspect;
    float psi(vec2 p){ return vn(p) * 0.6 + vn(p * 2.1 + 5.0) * 0.3; }
    void main(){ vec2 v = texture(vel, vUv).xy;
      for (int i = 0; i < 6; i++) { if (i >= n) break;
        vec2 d = vUv - P[i].xy; d.x *= aspect; float r = length(d) + 1e-4, R = P[i].z;
        float w = exp(-(r*r)/(R*R));
        vec2 tg = vec2(-d.y, d.x) / r, rd = d / r;
        vec2 f = (Q[i].x * tg + Q[i].y * rd) * w * mix(1.0, r / R, P[i].w);
        f.x /= aspect; v += f * dt * vec2(${SW.toFixed(1)}, ${SH.toFixed(1)}); }
      if (wind.x > 0.0) { vec2 p = vUv * vec2(aspect, 1.0) * wind.y + vec2(wind.z * 0.3, wind.z * 0.17); float e = 0.01;
        vec2 c = vec2(psi(p + vec2(0, e)) - psi(p - vec2(0, e)), -(psi(p + vec2(e, 0)) - psi(p - vec2(e, 0)))) / (2.0 * e);
        v += c * wind.x * dt + vec2(wind.w, 0.0) * dt; }
      o = vec4(v, 0, 1); }`;

  // 合成：底色 → 背层画布 → 墨（纸：减色吸收；夜：发光）→ 前层画布
  FS.comp = `uniform sampler2D dye, back, front, vel; uniform float dark, backOn, frontOn, ht, frontGain, inkK, glowK, zoom, misreg;
    uniform vec2 shake; uniform vec3 paper, night, absV, absB, absK, glV, glB, glW;
    void main(){
      vec2 uv = (vUv - 0.5) / zoom + 0.5 + shake;
      vec2 px = uv * vec2(1920.0, 1080.0);
      vec3 paperL = s2l(paper) * (0.965 + 0.05 * vn(px / 380.0) + 0.018 * vn(px / 23.0) + 0.012 * (h12(floor(px / 2.0)) - 0.5));
      vec3 base = mix(paperL, s2l(night) * (0.8 + 0.4 * vn(px / 500.0)), dark);
      if (backOn > 0.5) { vec4 b = texture(back, uv); base = base * (1.0 - b.a) + s2l(b.rgb / max(b.a, 1e-4)) * b.a; }
      vec4 d = max(texture(dye, uv), 0.0);
      d.r = max(texture(dye, uv + vec2(misreg, -misreg * 0.6) / vec2(1920.0, 1080.0)).r, 0.0);
      // 半色调网点（旋转 15°）
      if (ht > 0.001) {
        float a = 0.2618; mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
        vec2 q = R * px / 9.0; vec2 cc = fract(q) - 0.5;
        float tot = d.r + d.g + d.b; float rr = sqrt(clamp(tot, 0.0, 1.2)) * 0.62;
        float m = smoothstep(rr + 0.07, rr - 0.07, length(cc));
        d.rgb = mix(d.rgb, d.rgb / max(tot, 1e-3) * m * 1.25, ht);
      }
      vec3 absorb = (d.r * absV + d.g * absB + d.b * absK) * inkK;
      vec3 inked = base * exp(-absorb);
      vec3 emit = (d.r * glV + d.g * glB + d.b * glW) * glowK;
      vec3 col = mix(inked, base + emit, dark);
      if (frontOn > 0.5) { vec4 f = texture(front, uv); col = col * (1.0 - f.a) + s2l(f.rgb / max(f.a, 1e-4)) * f.a * mix(1.0, frontGain, dark); }
      o = vec4(col, 1.0);
    }`;
  FS.down = `uniform sampler2D src; uniform vec2 tx; uniform float first, thr;
    void main(){ vec3 c = vec3(0);
      c += texture(src, vUv + tx * vec2(-1,-1)).rgb + texture(src, vUv + tx * vec2(1,-1)).rgb + texture(src, vUv + tx * vec2(-1,1)).rgb + texture(src, vUv + tx * vec2(1,1)).rgb;
      c *= 0.25;
      if (first > 0.5) { float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c *= max(l - thr, 0.0) / max(l, 1e-4); }
      o = vec4(c, 1); }`;
  FS.up = `uniform sampler2D src, base; uniform vec2 tx; uniform float bk;
    void main(){ vec3 c = texture(src, vUv + tx * vec2(-1,-1)).rgb + texture(src, vUv + tx * vec2(1,-1)).rgb + texture(src, vUv + tx * vec2(-1,1)).rgb + texture(src, vUv + tx * vec2(1,1)).rgb;
      o = vec4(c * 0.25 + texture(base, vUv).rgb * bk, 1); }`;
  FS.fin = `uniform sampler2D hdr, bloom, ui; uniform float bloomK, grain, vign, fade, flash, time, dark, lift, uiOn;
    uniform vec3 flashCol, fadeCol;
    void main(){
      vec3 c = texture(hdr, vUv).rgb + texture(bloom, vUv).rgb * bloomK;
      // 柔肩：只压高光
      vec3 sh = 0.82 + 0.18 * (1.0 - exp(-(c - 0.82) / 0.18));
      c = mix(c, sh, step(0.82, c));
      vec2 q = vUv - 0.5; q.x *= 1.3;
      c *= 1.0 - vign * smoothstep(0.35, 0.95, length(q)) * mix(0.55, 1.0, dark);
      // UI 层（字幕）：泛光与暗角之后合成，不发光、不随镜头震动
      if (uiOn > 0.5) { vec4 u = texture(ui, vUv); c = c * (1.0 - u.a) + s2l(u.rgb / max(u.a, 1e-4)) * u.a; }
      c = mix(c, s2l(flashCol), clamp(flash, 0.0, 1.0));
      c = mix(s2l(fadeCol), c, fade);
      vec3 s = l2s(c);
      float g = h12(gl_FragCoord.xy + time * 17.13) + h12(gl_FragCoord.yx * 1.37 + time * 3.1) - 1.0;
      s += g * grain * mix(0.7, 1.3, dark);
      o = vec4(s, 1.0);
    }`;
  FS.pack = `uniform sampler2D src; uniform float frame;
    float dth(vec2 p){ return h12(p + frame * 1.618) + h12(p.yx + frame * 3.14159) - 1.0; }
    void main(){
      float ox = floor(gl_FragCoord.x), oy = floor(gl_FragCoord.y);
      vec4 r;
      if (oy < 1080.0) {
        for (int k = 0; k < 4; k++) {
          float x = ox * 4.0 + float(k);
          vec3 c = texture(src, vec2((x + 0.5) / 1920.0, 1.0 - (oy + 0.5) / 1080.0)).rgb;
          float y = 16.0 + 219.0 * dot(clamp(c, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
          r[k] = floor(y + 0.5 + dth(vec2(x, oy)) * 0.5) / 255.0;
        }
      } else {
        float rr = oy - 1080.0; bool isV = rr >= 270.0; if (isV) rr -= 270.0;
        float uy = rr * 2.0 + (ox >= 240.0 ? 1.0 : 0.0);
        for (int k = 0; k < 4; k++) {
          float ux = mod(ox, 240.0) * 4.0 + float(k);
          vec3 c = clamp(texture(src, vec2((ux * 2.0 + 1.0) / 1920.0, 1.0 - (uy * 2.0 + 1.0) / 1080.0)).rgb, 0.0, 1.0);
          float yn = dot(c, vec3(0.2126, 0.7152, 0.0722));
          float v = isV ? 128.0 + 224.0 * (c.r - yn) / 1.5748 : 128.0 + 224.0 * (c.b - yn) / 1.8556;
          r[k] = floor(v + 0.5 + dth(vec2(ux + (isV ? 977.0 : 0.0), uy)) * 0.5) / 255.0;
        }
      }
      o = r;
    }`;

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + src.slice(0, 300));
    return s;
  }
  let VSO;
  function program(name, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, VSO); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, HDR + fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link ' + name + ': ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace('[0]', '')] = { loc: gl.getUniformLocation(p, info.name), type: info.type };
    }
    return { p, u, name };
  }
  function tex(w, h, fmt) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (fmt === 'u8') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    return t;
  }
  function fbo(w, h, fmt) {
    const t = tex(w, h, fmt), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo incomplete ' + st);
    return { tex: t, fb, w, h };
  }
  function dbl(w, h) {
    const o = { a: fbo(w, h), b: fbo(w, h) };
    o.swap = () => { const t = o.a; o.a = o.b; o.b = t; };
    return o; // 读 a 写 b
  }
  // 绘制：uniforms 值为数字/数组/Float32Array/纹理(WebGLTexture 或 fbo)
  function draw(P, target, U = {}) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : W, target ? target.h : H);
    gl.useProgram(P.p);
    let unit = 0;
    for (const k in U) {
      const e = P.u[k]; if (!e) continue;
      let v = U[k];
      if (e.type === gl.SAMPLER_2D) {
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex || v); gl.uniform1i(e.loc, unit); unit++;
      } else if (e.type === gl.FLOAT) gl.uniform1f(e.loc, v);
      else if (e.type === gl.INT) gl.uniform1i(e.loc, v);
      else if (e.type === gl.FLOAT_VEC2) gl.uniform2fv(e.loc, v);
      else if (e.type === gl.FLOAT_VEC3) gl.uniform3fv(e.loc, v);
      else if (e.type === gl.FLOAT_VEC4) gl.uniform4fv(e.loc, v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  G.draw = draw;

  G.init = function () {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; document.body.appendChild(cv);
    gl = G.gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('no webgl2');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    VSO = compile(gl.VERTEX_SHADER, VS);
    G.P = {};
    for (const k in FS) G.P[k] = program(k, FS[k]);
    G.vel = dbl(SW, SH); G.prs = dbl(SW, SH); G.dye = dbl(DW, DH);
    G.cu = fbo(SW, SH); G.dv = fbo(SW, SH);
    G.hdr = fbo(W, H); G.out = fbo(W, H); G.yuv = fbo(480, 1620, 'u8');
    G.dn = []; G.upT = [];
    for (let i = 1; i <= 5; i++) { G.dn.push(fbo(W >> i, H >> i)); G.upT.push(fbo(W >> i, H >> i)); }
    // 2D 画布层
    G.layers = {};
    for (const k of ['back', 'front', 'ui', 'stamp']) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      // 印模画布走 CPU 光栅：结果与此前画过什么无关（GPU 字形缓存会让流体注入随历史漂移）
      const ctx = c.getContext('2d', k === 'stamp' ? { willReadFrequently: true } : undefined);
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      c.dataset.name = k;
      G.layers[k] = { cv: c, ctx, tex: t, used: false };
    }
  };

  G.upload = function (L) {
    gl.bindTexture(gl.TEXTURE_2D, L.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, L.cv);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  };
  G.clearLayer = function (L) {
    const x = L.ctx;
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.shadowBlur = 0; x.shadowColor = 'transparent'; x.filter = 'none'; x.setLineDash([]);
    x.clearRect(0, 0, W, H); L.used = false;
  };
  G.beginLayers = function () { G.clearLayer(G.layers.back); G.clearLayer(G.layers.front); G.clearLayer(G.layers.ui); };

  // ---------- 流体 ----------
  const vt = [1 / SW, 1 / SH];
  G.fluidReset = function () {
    for (const f of [G.vel.a, G.vel.b, G.prs.a, G.prs.b, G.dye.a, G.dye.b, G.cu, G.dv]) draw(G.P.clear, f, { val: [0, 0, 0, 0] });
  };
  // 屏幕像素坐标 → uv（y 向上）
  const toUv = (x, y) => [x / W, 1 - y / H];
  G.splatDye = function (x, y, r, c, hard = 0) {
    draw(G.P.splat, G.dye.b, { src: G.dye.a.tex, pt: toUv(x, y), val: c, r: (r / H) * (r / H), aspect: W / H, hard });
    G.dye.swap();
  };
  // 速度注入：vx, vy 为屏幕像素/秒
  G.splatVel = function (x, y, r, vx, vy) {
    draw(G.P.splat, G.vel.b, { src: G.vel.a.tex, pt: toUv(x, y), val: [vx * SW / W, -vy * SH / H, 0, 0], r: (r / H) * (r / H), aspect: W / H, hard: 0 });
    G.vel.swap();
  };
  G.stampDye = function (L, k) {
    G.upload(L);
    draw(G.P.stamp, G.dye.b, { src: G.dye.a.tex, stamp: L.tex, k, mode: 0, push: [0, 0], ctr: [0.5, 0.5], boom: 0, aspect: W / H }); G.dye.swap();
  };
  // 速度印模：push 为屏幕像素/秒，boom 为自中心外爆速度（像素/秒）
  G.stampVel = function (L, k, push, cx, cy, boom, upload = true) {
    if (upload) G.upload(L);
    draw(G.P.stamp, G.vel.b, { src: G.vel.a.tex, stamp: L.tex, k, mode: 1, push: [push[0] * SW / W, -push[1] * SH / H], ctr: toUv(cx, cy), boom: boom * SH / H, aspect: W / H });
    G.vel.swap();
  };
  G.scaleDye = function (k) { draw(G.P.scale, G.dye.b, { src: G.dye.a.tex, k }); G.dye.swap(); };
  // 一步：o = {dt, velDiss, dyeDiss, vort, iters, field:[{x,y,R,swirl,radial,lin}], wind:[str, scale, time, drift]}
  const PA = new Float32Array(24), QA = new Float32Array(24);
  G.fluidStep = function (o) {
    const dt = o.dt;
    if ((o.field && o.field.length) || (o.wind && o.wind[0] > 0)) {
      const fs = (o.field || []).slice(0, 6);
      PA.fill(0); QA.fill(0);
      fs.forEach((e, i) => {
        const [u, v] = toUv(e.x, e.y);
        PA.set([u, v, e.R / H, e.lin || 0], i * 4);
        QA.set([(e.swirl || 0) / H, -(e.radial || 0) / H, 0, 0], i * 4);
      });
      draw(G.P.field, G.vel.b, { vel: G.vel.a.tex, P: PA, Q: QA, n: fs.length, wind: o.wind || [0, 0, 0, 0], dt, aspect: W / H }); G.vel.swap();
    }
    draw(G.P.curl, G.cu, { vel: G.vel.a.tex, vt });
    draw(G.P.vort, G.vel.b, { vel: G.vel.a.tex, cu: G.cu.tex, vt, k: o.vort ?? 20, dt }); G.vel.swap();
    draw(G.P.div, G.dv, { vel: G.vel.a.tex, vt });
    draw(G.P.scale, G.prs.b, { src: G.prs.a.tex, k: 0.8 }); G.prs.swap();
    for (let i = 0; i < (o.iters || 22); i++) { draw(G.P.press, G.prs.b, { pr: G.prs.a.tex, dv: G.dv.tex, vt }); G.prs.swap(); }
    draw(G.P.grad, G.vel.b, { pr: G.prs.a.tex, vel: G.vel.a.tex, vt }); G.vel.swap();
    draw(G.P.advect, G.vel.b, { vel: G.vel.a.tex, src: G.vel.a.tex, vt, dt, diss: o.velDiss ?? 0.2 }); G.vel.swap();
    draw(G.P.advect, G.dye.b, { vel: G.vel.a.tex, src: G.dye.a.tex, vt, dt, diss: o.dyeDiss ?? 0.05 }); G.dye.swap();
  };

  // ---------- 合成与输出 ----------
  const lin = (h) => C.hex(h).map(C.s2l);
  const ab = (h) => lin(h).map((v) => -Math.log(Math.max(v, 0.004)));
  G.frame = function (f, P) {
    const L = G.layers;
    if (L.back.used) G.upload(L.back);
    if (L.front.used) G.upload(L.front);
    if (L.ui.used) G.upload(L.ui);
    draw(G.P.comp, G.hdr, {
      dye: G.dye.a.tex, back: L.back.tex, front: L.front.tex, dark: P.dark, backOn: L.back.used ? 1 : 0, frontOn: L.front.used ? 1 : 0,
      ht: P.ht, frontGain: P.frontGain, inkK: P.inkK, glowK: P.glowK, zoom: P.zoom, misreg: P.misreg, shake: [P.shake[0] / W, -P.shake[1] / H],
      paper: C.hex(C.col.paper), night: C.hex(C.col.night), absV: ab(C.col.verm), absB: ab(C.col.blue), absK: ab(C.col.ink),
      glV: lin(C.col.vermGlow), glB: lin(C.col.blueGlow), glW: lin('#e9efff'),
    });
    draw(G.P.down, G.dn[0], { src: G.hdr.tex, tx: [1 / W, 1 / H], first: 1, thr: P.bloomThr });
    for (let i = 1; i < 5; i++) draw(G.P.down, G.dn[i], { src: G.dn[i - 1].tex, tx: [1 / G.dn[i - 1].w, 1 / G.dn[i - 1].h], first: 0, thr: 0 });
    for (let i = 3; i >= 0; i--) {
      const src = i === 3 ? G.dn[4] : G.upT[i + 1];
      draw(G.P.up, G.upT[i], { src: src.tex, base: G.dn[i].tex, tx: [0.5 / src.w, 0.5 / src.h], bk: 1 });
    }
    draw(G.P.fin, G.out, {
      hdr: G.hdr.tex, bloom: G.upT[0].tex, ui: L.ui.tex, uiOn: L.ui.used ? 1 : 0, bloomK: P.bloomK, grain: P.grain, vign: P.vign, fade: P.fade, flash: P.flash, time: f % 1000,
      dark: P.dark, flashCol: C.hex(P.flashCol), fadeCol: C.hex(P.fadeCol), lift: 0,
    });
  };
  G.readYUV = function (f, buf) {
    draw(G.P.pack, G.yuv, { src: G.out.tex, frame: f % 997 });
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.yuv.fb);
    gl.readPixels(0, 0, 480, 1620, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  };
  G.blit = function () { draw(G.P.copy, null, { src: G.out.tex }); };
})();
