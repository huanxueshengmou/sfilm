// WebGL2 管线：背景 → 背层画布 → GPU 粒子（26 万颗，运动完全由时间解析求得，任意帧可独立渲染）
//            → 前层画布 → 泛光 → 冲击波 / 色散 / 故障 / 热浪 / 胶片后期 → 字幕层 → YUV420p 打包
(function () {
  const G = (window.G = {});
  const W = C.W, H = C.H;
  const Q = new URLSearchParams(location.search);
  const QS = parseFloat(Q.get('q') || '1');
  G.NG = [131072, 65536, 65536].map((n) => Math.max(1024, Math.round(n * QS)));
  G.BASE = [0, 131072, 196608];
  let gl, quadVao, emptyVao;

  const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
in vec2 vUv; out vec4 o;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s; }
vec3 s2l(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 l2s(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
`;
  const FS = {};
  FS.copy = `uniform sampler2D uSrc; void main(){ o = texture(uSrc, vUv); }`;
  FS.bg = `uniform vec3 uTop, uBot, uNebA, uNebB, uGlowC, uGlowC2, uGridC;
uniform float uNeb, uStars, uT, uGridK; uniform vec2 uDrift; uniform vec4 uGlow, uGlow2;
void main(){
  vec2 px = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  vec3 c = mix(uBot, uTop, vUv.y);
  if (uNeb > 0.0) {
    float n = fbm(px / 520.0 + uDrift + vec2(uT * 0.012, uT * 0.004));
    float m = fbm(px / 300.0 - uDrift * 1.7 + vec2(5.2, 1.3) - uT * 0.008);
    c += (uNebA * smoothstep(0.35, 0.95, n) * 1.2 + uNebB * smoothstep(0.45, 1.0, m)) * uNeb;
  }
  if (uStars > 0.0) { vec2 g = floor(px / 2.0); float h = h12(g); float s = smoothstep(0.9968, 1.0, h);
    c += vec3(0.8, 0.9, 1.0) * s * uStars * (0.6 + 0.4 * sin(uT * 1.7 + h * 300.0)); }
  float d = length(px - uGlow.xy) / max(uGlow.z, 1.0); c += uGlowC * exp(-d * d) * uGlow.w;
  float d2 = length(px - uGlow2.xy) / max(uGlow2.z, 1.0); c += uGlowC2 * exp(-d2 * d2) * uGlow2.w;
  if (uGridK > 0.0) { vec2 gp = mod(px + 24.0, 48.0) - 24.0; c += uGridC * smoothstep(1.8, 0.4, length(gp)) * uGridK; }
  o = vec4(c, 1.0);
}`;
  // 画布层（预乘 sRGB）→ 线性 HDR
  FS.layer = `uniform sampler2D uSrc; uniform float uGain;
void main(){ vec4 c = texture(uSrc, vUv); if (c.a <= 0.0005) discard; o = vec4(s2l(c.rgb / c.a) * c.a * uGain, c.a); }`;
  FS.down = `uniform sampler2D uSrc; uniform vec2 uTx; uniform float uFirst, uThr, uKnee;
vec3 S(vec2 d){ return texture(uSrc, vUv + d * uTx).rgb; }
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main(){
  vec3 a = S(vec2(-2, 2)), b = S(vec2(0, 2)), c = S(vec2(2, 2)), d = S(vec2(-2, 0)), e = S(vec2(0, 0)), f = S(vec2(2, 0)),
       g = S(vec2(-2, -2)), h = S(vec2(0, -2)), i = S(vec2(2, -2)), j = S(vec2(-1, 1)), k = S(vec2(1, 1)), l = S(vec2(-1, -1)), m = S(vec2(1, -1));
  vec3 r;
  if (uFirst > 0.5) {
    vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
    float w0 = 0.125 / (1.0 + lum(g0)), w1 = 0.125 / (1.0 + lum(g1)), w2 = 0.125 / (1.0 + lum(g2)), w3 = 0.125 / (1.0 + lum(g3)), w4 = 0.5 / (1.0 + lum(g4));
    r = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
    float br = max(r.r, max(r.g, r.b));
    float rq = clamp(br - uThr + uKnee, 0.0, 2.0 * uKnee); rq = rq * rq / (4.0 * uKnee + 1e-4);
    r *= max(rq, br - uThr) / max(br, 1e-4);
  } else {
    r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  o = vec4(r, 1.0);
}`;
  FS.up = `uniform sampler2D uSrc, uBase; uniform vec2 uTx;
void main(){
  vec3 s = texture(uSrc, vUv + vec2(-1, 1) * uTx).rgb + texture(uSrc, vUv + vec2(0, 1) * uTx).rgb * 2.0 + texture(uSrc, vUv + vec2(1, 1) * uTx).rgb
         + texture(uSrc, vUv + vec2(-1, 0) * uTx).rgb * 2.0 + texture(uSrc, vUv).rgb * 4.0 + texture(uSrc, vUv + vec2(1, 0) * uTx).rgb * 2.0
         + texture(uSrc, vUv + vec2(-1, -1) * uTx).rgb + texture(uSrc, vUv + vec2(0, -1) * uTx).rgb * 2.0 + texture(uSrc, vUv + vec2(1, -1) * uTx).rgb;
  o = vec4(texture(uBase, vUv).rgb + s / 16.0, 1.0);
}`;
  FS.fin = `uniform sampler2D uHdr, uBloom, uUi;
uniform float uBloomK, uExp, uCA, uGrain, uVig, uFlash, uFade, uSat, uLetter, uGlitch, uHaze, uT, uUiOn, uContrast;
uniform vec3 uFlashC, uTint, uLift; uniform vec4 uShock[4]; uniform int uNS; uniform vec4 uHazeR;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 uv = vUv; const float asp = 1920.0 / 1080.0;
  for (int i = 0; i < 4; i++) { if (i >= uNS) break; vec4 s = uShock[i]; vec2 d = uv - s.xy; d.x *= asp;
    float r = length(d); float x = (r - s.z) / 0.075; float k = s.w * exp(-x * x) * x * 0.02;
    vec2 dir = d / max(r, 1e-4); dir.x /= asp; uv -= dir * k; }
  if (uHaze > 0.0) { vec2 hp = uv * vec2(1920.0, 1080.0);
    float w = uHazeR.z > 0.0 ? exp(-pow(length((uv - uHazeR.xy) * vec2(asp, 1.0)) / uHazeR.z, 2.0)) : 1.0;
    uv += (vec2(vn(hp / 36.0 + vec2(0.0, uT * 3.2)), vn(hp / 36.0 + vec2(7.3, uT * 3.2 + 3.1))) - 0.5) * 0.007 * uHaze * w; }
  if (uGlitch > 0.0) { float row = floor(vUv.y * 42.0); float fr = floor(uT * 20.0); float g = h12(vec2(row, fr));
    if (g > 1.0 - uGlitch * 0.35) uv.x += (h12(vec2(row + 7.0, fr)) - 0.5) * 0.12 * uGlitch; }
  vec2 cd = uv - 0.5; float ca = 0.0010 + uCA * 0.0035;
  vec3 c = vec3(texture(uHdr, uv + cd * ca).r, texture(uHdr, uv).g, texture(uHdr, uv - cd * ca).b);
  vec3 b = vec3(texture(uBloom, uv + cd * ca * 2.0).r, texture(uBloom, uv).g, texture(uBloom, uv - cd * ca * 2.0).b);
  if (uGlitch > 0.0) { float s = step(1.0 - uGlitch * 0.25, h12(vec2(floor(vUv.y * 90.0), floor(uT * 30.0) + 11.0)));
    c.r = mix(c.r, texture(uHdr, uv + vec2(0.012 * uGlitch, 0.0)).r, s); c.b = mix(c.b, texture(uHdr, uv - vec2(0.012 * uGlitch, 0.0)).b, s); }
  c = (c + b * uBloomK) * uExp * uTint + uLift;
  c = aces(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = max(mix(vec3(l), c, uSat), 0.0);
  vec2 q = vUv - 0.5; c *= 1.0 - uVig * dot(q * vec2(1.0, 0.75), q * vec2(1.0, 0.75)) * 2.4;
  c = l2s(c);
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  c = mix(c, l2s(uFlashC), clamp(uFlash, 0.0, 1.0));
  c += (h12(vUv * vec2(1920.0, 1080.0) + fract(uT * 7.13) * 391.0) - 0.5) * uGrain;
  c *= 1.0 - uFade;
  float bar = uLetter * 0.12806;
  if (vUv.y < bar || vUv.y > 1.0 - bar) c = vec3(0.0);
  if (uUiOn > 0.5) { vec4 u = texture(uUi, vUv); c = c * (1.0 - u.a) + u.rgb; }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
  // BT.709 limited range，Y 平面 + U/V 平面打包进 480×1620 的 RGBA 目标（readPixels 一次取回 1920×1080×1.5 字节）
  FS.pack = `uniform sampler2D uSrc; uniform float uFrame;
float Yv(vec3 c){ return (16.0 + 219.0 * dot(c, vec3(0.2126, 0.7152, 0.0722))) / 255.0; }
float Uv(vec3 c){ return (128.0 + 224.0 * dot(c, vec3(-0.114572, -0.385428, 0.5))) / 255.0; }
float Vv(vec3 c){ return (128.0 + 224.0 * dot(c, vec3(0.5, -0.454153, -0.045847))) / 255.0; }
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy); int row = p.y; int x4 = p.x * 4; vec4 r;
  float dz = (h12(vec2(p) + uFrame * 1.618) + h12(vec2(p.yx) * 1.37 + uFrame) - 1.0) / 255.0;
  if (row < 1080) {
    for (int c = 0; c < 4; c++) r[c] = Yv(texelFetch(uSrc, ivec2(x4 + c, 1079 - row), 0).rgb) + dz;
  } else {
    int rr = row - 1080; bool isV = rr >= 270; if (isV) rr -= 270;
    for (int c = 0; c < 4; c++) { int bb = x4 + c; int crow = rr * 2 + (bb >= 960 ? 1 : 0); int ccol = bb - (bb >= 960 ? 960 : 0);
      vec3 col = texture(uSrc, vec2(float(2 * ccol + 1) / 1920.0, float(1079 - 2 * crow) / 1080.0)).rgb;
      r[c] = (isV ? Vv(col) : Uv(col)) + dz * 0.5; }
  }
  o = r;
}`;

  // ---- 粒子 ----
  const PVS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uAtlas; uniform mat4 uVP; uniform float uT, uPx, uBase, uCount;
uniform int uA, uB, uSMode; uniform vec4 uPA, uQA, uRA, uPB, uQB, uRB;
uniform float uMix, uStag, uArc, uSize, uBright, uAlpha, uReveal, uTwinkle, uGrad, uSpark;
uniform vec4 uNoise, uRot, uBurst, uPulse; uniform vec2 uRotX, uPulseWK; uniform vec3 uColA, uColB, uColC;
out vec3 vCol; out float vA;
const float PI = 3.14159265, TAU = 6.2831853;
uint hsh(uint x){ x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
float u01(uint x){ return float(hsh(x) >> 8u) * (1.0 / 16777216.0); }
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1, 0, 0)), f.x), mix(h13(i + vec3(0, 1, 0)), h13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h13(i + vec3(0, 0, 1)), h13(i + vec3(1, 0, 1)), f.x), mix(h13(i + vec3(0, 1, 1)), h13(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
vec3 nz3(vec3 p){ return vec3(vn3(p), vn3(p + vec3(31.7, 7.3, 11.1)), vn3(p + vec3(3.3, 47.9, 23.5))) - 0.5; }
vec3 sdir(float a, float b){ float z = a * 2.0 - 1.0, r = sqrt(max(0.0, 1.0 - z * z)), ph = b * TAU; return vec3(r * cos(ph), z, r * sin(ph)); }
vec3 rotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 rotX(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
vec3 rotZ(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
vec4 atl(float slot, float idx){ int i = int(idx); return texelFetch(uAtlas, ivec2(i % 1024, int(slot) * 64 + i / 1024), 0); }
const vec3 IV[12] = vec3[12](vec3(-1, 1.618, 0), vec3(1, 1.618, 0), vec3(-1, -1.618, 0), vec3(1, -1.618, 0), vec3(0, -1, 1.618), vec3(0, 1, 1.618),
  vec3(0, -1, -1.618), vec3(0, 1, -1.618), vec3(1.618, 0, -1), vec3(1.618, 0, 1), vec3(-1.618, 0, -1), vec3(-1.618, 0, 1));
const int IE[60] = int[60](0,11, 0,5, 0,1, 0,7, 0,10, 1,5, 5,11, 11,10, 10,7, 7,1, 3,9, 3,4, 3,2, 3,6, 3,8, 4,9, 2,4, 6,2, 8,6, 9,8,
  4,5, 2,11, 6,10, 8,7, 9,1, 5,9, 11,4, 10,2, 7,6, 1,8);

vec3 shape(int id, vec4 P, vec4 Q, vec4 R, vec4 r, float fi, float t, out float tone, out float glow){
  tone = r.w; glow = 1.0;
  if (id == 1) {            // BALL 体积球：纬度差速自转形成条带 + 两级噪声起伏 + 沿表面的切向流动
    vec3 d = sdir(r.x, r.y); float rr = pow(r.z, mix(0.3333, 0.08, Q.x));
    d = rotY(d, t * R.x * (1.0 + 0.9 * (1.0 - d.y * d.y)) * (1.6 - rr));
    vec3 np = d * Q.z + vec3(0.0, t * 0.15, t * 0.05);
    float n = (vn3(np) - 0.5) + 0.5 * (vn3(np * 2.7 + 11.0) - 0.5);
    vec3 p = d * rr * (1.0 + Q.y * n * 2.0);
    vec3 tg = normalize(cross(d, vec3(0.0, 1.0, 0.0)) + vec3(1e-4));
    p += tg * (vn3(np * 1.7 + 5.0) - 0.5) * Q.y * 1.4 * rr;
    p.y *= Q.w;
    tone = rr; glow = 0.5 + 0.9 * smoothstep(0.75, 1.0, rr) + 0.9 * (1.0 - smoothstep(0.0, 0.22, rr));
    return P.xyz + p * P.w;
  }
  if (id == 2) {            // CRYSTAL 二十面体晶体（棱 + 顶点 + 核）
    vec3 p;
    if (r.w < Q.z) { p = sdir(r.x, r.y) * pow(r.z, 0.5) * 0.35; glow = 2.2; tone = 1.0; }
    else if (r.w < Q.z + 0.12) { int vi = int(r.x * 12.0); p = IV[vi] / 1.902 + sdir(r.y, r.z) * 0.035; glow = 2.0; tone = 0.9; }
    else { int e = int(r.x * 30.0); vec3 a = IV[IE[e * 2]] / 1.902, b = IV[IE[e * 2 + 1]] / 1.902;
      p = mix(a, b, r.y) + (vec3(r.z, r.w, fract(r.z * 7.31)) - 0.5) * Q.w; tone = 0.6; }
    p = rotX(rotY(p, t * Q.x), t * Q.y + 0.4);
    return P.xyz + p * P.w;
  }
  if (id == 3) {            // ATLAS 图集点云（文字 / 图形）
    vec4 a = atl(Q.x, mod(fi, max(Q.y, 1.0)));
    vec3 p = a.xyz + vec3((r.x - 0.5) * Q.w, (r.y - 0.5) * Q.w, (r.z - 0.5) * Q.z);
    p.y += sin(p.x * R.z + t * 2.2) * R.y; p = rotY(p, R.x);
    tone = a.w; glow = 0.6 + 0.8 * a.w;
    return P.xyz + p * P.w;
  }
  if (id == 4) {            // STREAM 贝塞尔流束
    float u = fract(r.x + t * R.x * (0.7 + 0.6 * r.y));
    vec3 a = P.xyz, d = Q.xyz; vec3 bb = mix(a, d, 0.33) + vec3(0.0, Q.w, 0.0), cc = mix(a, d, 0.66) + vec3(0.0, Q.w, 0.0);
    float v = 1.0 - u; vec3 p = v * v * v * a + 3.0 * v * v * u * bb + 3.0 * v * u * u * cc + u * u * u * d;
    float ang = r.z * TAU + u * R.y * TAU; float rad = P.w * sqrt(r.w) * (0.25 + 0.75 * sin(u * PI));
    p += vec3(0.0, cos(ang), sin(ang)) * rad;
    tone = u; glow = 0.5 + 0.9 * sin(u * PI);
    return p;
  }
  if (id == 5) {            // PATH 沿图集折线流动
    float u = fract(r.x + t * Q.w * (0.8 + 0.4 * r.y));
    float f = u * (Q.y - 1.0); float i0 = floor(f);
    vec3 a = atl(Q.x, i0).xyz, b = atl(Q.x, min(i0 + 1.0, Q.y - 1.0)).xyz;
    vec3 p = mix(a, b, f - i0);
    float ang = r.z * TAU + u * R.x * TAU; float rad = Q.z * sqrt(r.w);
    p += vec3(cos(ang), sin(ang), sin(ang * 1.7)) * rad;
    tone = u; glow = 0.8 + 0.4 * r.y;
    return P.xyz + p * P.w;
  }
  if (id == 6) {            // GALAXY 旋臂盘
    float rr = pow(r.x, 0.55); float arm = floor(r.y * max(Q.x, 1.0));
    float ang = arm / max(Q.x, 1.0) * TAU + rr * Q.y + (r.z - 0.5) * 0.9 * (1.0 - rr * 0.5) + t * Q.w / (0.35 + rr);
    vec3 p = vec3(cos(ang) * rr, (r.w - 0.5) * Q.z * (1.0 - rr * 0.7), sin(ang) * rr);
    p = rotZ(rotX(p, R.x), R.y);
    tone = 1.0 - rr; glow = 0.6 + 1.2 * (1.0 - rr);
    return P.xyz + p * P.w;
  }
  if (id == 7) {            // BUTTERFLY 蝴蝶曲线（Temple Fay），翅膀绕身体扇动
    float th = r.x * 12.0 * PI;
    float rc = exp(sin(th)) - 2.0 * cos(4.0 * th) + pow(sin((2.0 * th - PI) / 24.0), 5.0);
    vec2 q = vec2(sin(th), cos(th)) * rc;
    bool edge = r.y < 0.45; float fill = edge ? 1.0 : sqrt(r.z); q *= fill;
    tone = edge ? 1.0 : 0.45 * fill; q.y -= 0.9; q *= 0.36;
    float flap = Q.y * sin(t * Q.x * TAU);
    vec3 p = vec3(q.x * cos(flap), q.y, abs(q.x) * sin(flap));
    if (r.w > 0.97) { p = vec3((r.x - 0.5) * 0.05, (r.y - 0.5) * 1.5 - 0.15, 0.0); tone = 1.0; }
    p = rotX(rotY(p, Q.z), Q.w);
    glow = 0.7 + 0.8 * tone;
    return P.xyz + p * P.w;
  }
  if (id == 8) {            // FIELD 尘埃场（缓慢漂移，可整体上升/下落）
    vec3 p = (r.xyz - 0.5) * Q.xyz;
    p += vec3(sin(t * 0.13 + r.w * TAU), cos(t * 0.11 + r.x * TAU), sin(t * 0.07 + r.y * TAU)) * Q.w;
    if (R.x != 0.0) p.y = mod(p.y + t * R.x * (0.6 + 0.8 * r.w) + Q.y * 0.5, Q.y) - Q.y * 0.5;
    tone = r.w; return P.xyz + p;
  }
  if (id == 9) {            // RING 环 / 圆环面
    float th = r.x * TAU + t * Q.w; float ph = r.y * TAU; float mr = Q.x * sqrt(r.z);
    vec3 p = vec3((P.w + mr * cos(ph)) * cos(th), mr * sin(ph), (P.w + mr * cos(ph)) * sin(th));
    p = rotZ(rotX(p, Q.y), Q.z);
    tone = r.w; return P.xyz + p;
  }
  if (id == 10) {           // INFLOW 汇入 / OUTFLOW 喷出
    float u = fract(r.x + t * Q.y * (0.6 + 0.8 * r.y));
    vec3 d = sdir(r.z, r.w);
    float rad = Q.w > 0.5 ? mix(Q.x, P.w, sqrt(u)) : mix(P.w, Q.x, u * u);
    d = rotY(d, Q.z * u);
    tone = u; glow = sin(u * PI);
    return P.xyz + d * rad;
  }
  if (id == 11) {           // SWARM 群集（许多小团绕中心游走）
    float n = max(Q.x, 1.0); float ci = floor(r.x * n);
    float h1 = fract(sin(ci * 12.9898) * 43758.5453), h2 = fract(sin(ci * 78.233) * 12345.678), h3 = fract(sin(ci * 39.425) * 24634.6345);
    float ang = h1 * TAU + t * Q.z * (0.4 + h2); float el = (h3 - 0.5) * 1.6;
    vec3 cc = vec3(cos(ang) * cos(el), sin(el) * 0.7, sin(ang) * cos(el)) * P.w * (0.75 + 0.35 * h2);
    vec3 p = cc + sdir(r.y, r.z) * Q.y * sqrt(r.w);
    tone = h1; return P.xyz + p;
  }
  if (id == 12) {           // LARVA 幼虫（分节管体 + 尺蠖式拱起爬行）
    float s = r.x; float x = (s - 0.5) * P.w;
    float hump = Q.w * max(0.0, sin(s * PI * 2.0 - t * Q.z * TAU));
    float rad = Q.y * (0.75 + 0.25 * cos(s * Q.x * TAU)) * (0.55 + 0.45 * sin(s * PI));
    if (s > 0.9) rad *= 1.3;
    float ang = r.y * TAU; float rr = rad * sqrt(r.z);
    tone = step(0.5, fract(s * Q.x)); glow = 0.7 + 0.5 * tone;
    return P.xyz + vec3(x, hump + cos(ang) * rr, sin(ang) * rr);
  }
  tone = 0.0; glow = 0.0;
  return vec3(0.0, 0.0, -500.0);
}

void main(){
  uint id = uint(gl_VertexID) + uint(uBase);
  vec4 r = vec4(u01(id * 4u + 1u), u01(id * 4u + 2u), u01(id * 4u + 3u), u01(id * 4u + 4u));
  float fi = float(gl_VertexID);
  float tA, gA, tB = 0.0, gB = 0.0;
  vec3 pa = shape(uA, uPA, uQA, uRA, r, fi, uT, tA, gA);
  vec3 pb = pa; tB = tA; gB = gA;
  if (uMix > 0.0 && uB != uA || uMix > 0.0 && uPB != uPA) pb = shape(uB, uPB, uQB, uRB, r, fi, uT, tB, gB);
  float d;
  if (uSMode == 1) d = clamp(pa.x * 0.06 + 0.5, 0.0, 1.0);
  else if (uSMode == 2) d = clamp(length(pa - uPA.xyz) / max(uPA.w, 0.001), 0.0, 1.0);
  else if (uSMode == 3) d = clamp(0.5 - pa.y * 0.09, 0.0, 1.0);
  else if (uSMode == 4) d = clamp(pb.x * 0.06 + 0.5, 0.0, 1.0);
  else if (uSMode == 5) d = clamp(0.5 + pb.y * 0.09, 0.0, 1.0);
  else if (uSMode == 6) d = clamp(0.5 + pa.y * 0.09, 0.0, 1.0);
  else d = r.w;
  float k = clamp(uMix * (1.0 + uStag) - d * uStag, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  vec3 p = mix(pa, pb, k);
  if (uArc != 0.0 && k > 0.0 && k < 1.0) {
    vec3 dv = pb - pa; vec3 side = normalize(cross(dv + vec3(1e-4, 2e-4, 0.0), vec3(0.0, 0.0, 1.0)) + (r.xyz - 0.5) * 0.9);
    p += side * sin(k * PI) * uArc * (0.4 + r.y);
  }
  float tone = mix(tA, tB, k), glow = mix(gA, gB, k);
  if (uNoise.x > 0.0) p += nz3(p * uNoise.y + vec3(0.0, uT * uNoise.z, uT * uNoise.z * 0.7) + r.w * 3.0) * uNoise.x;
  if (uBurst.w != 0.0) { vec3 dv = p - uBurst.xyz; float l = length(dv) + 1e-3; p += dv / l * uBurst.w * (0.3 + r.y * 1.2) + (r.xyz - 0.5) * uBurst.w * 0.5; }
  vec3 q = p - uRot.xyz; q = rotY(q, uRot.w); q = rotX(q, uRotX.x); q = rotZ(q, uRotX.y); p = q + uRot.xyz;
  vec4 cp = uVP * vec4(p, 1.0);
  vec3 col = uGrad > 0.5 ? mix(uColA, uColB, tone) : mix(uColA, uColB, k);
  float tw = 1.0 + uTwinkle * sin(uT * (2.5 + 6.0 * r.x) + r.y * TAU) * 0.5;
  float spark = step(1.0 - uSpark, r.z);
  col = mix(col, uColC, spark * 0.75);
  float br = uBright * glow * tw * (1.0 + spark * 1.6);
  if (uPulseWK.y > 0.0) { float dd = (length(p - uPulse.xyz) - uPulse.w) / uPulseWK.x; br *= 1.0 + uPulseWK.y * exp(-dd * dd); }
  float a = uAlpha;
  if (uA == 0) a *= k;
  if (uB == 0 && uMix > 0.0) a *= 1.0 - k;
  if (uReveal < 1.0) a *= smoothstep(uReveal, uReveal - 0.04, fi / uCount);
  vA = a; vCol = col * br;
  float sz = uSize * (0.55 + 0.9 * r.z) * (1.0 + spark * 0.5) * uPx / max(cp.w, 0.1);
  gl_PointSize = clamp(sz, 1.0, 64.0);
  gl_Position = (a <= 0.002 || cp.w <= 0.05) ? vec4(2.0, 2.0, 2.0, 1.0) : cp;
}`;
  const PFS = `#version 300 es
precision highp float; in vec3 vCol; in float vA; out vec4 o;
void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float d2 = dot(q, q); if (d2 > 1.0) discard; o = vec4(vCol * exp(-d2 * 3.5) * vA, 0.0); }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const lines = src.split('\n').map((l, i) => String(i + 1).padStart(4) + ' ' + l).join('\n');
      throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + lines.slice(0, 6000));
    }
    return s;
  }
  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const set = {};
    let unit = 0;
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      const loc = gl.getUniformLocation(p, info.name);
      const T = info.type;
      if (T === gl.SAMPLER_2D) { const u = unit++; set[name] = (tx) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1i(loc, u); }; }
      else if (T === gl.FLOAT) set[name] = (v) => gl.uniform1f(loc, v);
      else if (T === gl.FLOAT_VEC2) set[name] = (v) => gl.uniform2fv(loc, v);
      else if (T === gl.FLOAT_VEC3) set[name] = (v) => gl.uniform3fv(loc, v);
      else if (T === gl.FLOAT_VEC4) set[name] = (v) => gl.uniform4fv(loc, v);
      else if (T === gl.INT || T === gl.BOOL) set[name] = (v) => gl.uniform1i(loc, v);
      else if (T === gl.FLOAT_MAT4) set[name] = (v) => gl.uniformMatrix4fv(loc, false, v);
    }
    return { p, set };
  }
  function texture(w, h, ifmt, fmt, type, filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, ifmt, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target(w, h, hdr = true) {
    const tex = texture(w, h, hdr ? gl.RGBA16F : gl.RGBA8, gl.RGBA, hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, gl.LINEAR);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete ' + w + 'x' + h);
    return { tex, fb, w, h };
  }
  function pass(P, tg, uni) {
    gl.useProgram(P.p);
    for (const k in uni) if (P.set[k]) P.set[k](uni[k]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tg ? tg.fb : null);
    gl.viewport(0, 0, tg ? tg.w : W, tg ? tg.h : H);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ---- 画布层 ----
  const layers = {};
  function makeLayer(name) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const tex = texture(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    const L = { name, cv, _ctx: ctx, tex, used: false };
    Object.defineProperty(L, 'ctx', { get() { if (!L.used) { L.used = true; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); } return ctx; } });
    layers[name] = L;
    return L;
  }
  G.layers = layers;
  G.beginLayers = () => { for (const k in layers) layers[k].used = false; };
  function upload(L) {
    gl.bindTexture(gl.TEXTURE_2D, L.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, L.cv);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  G.init = function () {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    document.body.appendChild(cv);
    G.canvas = cv;
    gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 不可用（请更新显卡驱动或浏览器）');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('缺少 EXT_color_buffer_float');
    gl.getExtension('EXT_float_blend');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    window.GLINFO = { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), version: gl.getParameter(gl.VERSION), particles: G.NG.reduce((a, b) => a + b, 0) };
    quadVao = gl.createVertexArray();
    gl.bindVertexArray(quadVao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    emptyVao = gl.createVertexArray();
    G.P = {};
    for (const k in FS) G.P[k] = program(VS, HEAD + FS[k]);
    G.P.pts = program(PVS, PFS);
    G.hdr = target(W, H, true);
    G.dn = []; G.upT = [];
    let w = W, h = H;
    for (let i = 0; i < 6; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); G.dn.push(target(w, h, true)); G.upT.push(target(w, h, true)); }
    G.out = target(W, H, false);
    G.yuv = target(480, 1620, false);
    ['back', 'front', 'ui'].forEach(makeLayer);
  };

  G.atlas = function (A) {
    G.atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, G.atlasTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, A.w, A.h, 0, gl.RGBA, gl.FLOAT, A.data);
  };

  // ---- 矩阵 ----
  function persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]; }
  function look(e, c, up) {
    let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z = z.map((v) => v / l);
    let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]]; l = Math.hypot(...x); x = x.map((v) => v / l);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
  }
  function mul(a, b) { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
  G.viewProj = (cam) => {
    const r = cam.roll || 0;
    const up = [Math.sin(r), Math.cos(r), 0];
    return new Float32Array(mul(persp((cam.fov * Math.PI) / 180, W / H, 0.1, 400), look(cam.eye, cam.at, up)));
  };

  // ---- 渲染一帧 ----
  G.render = function (F, f) {
    const L = layers;
    for (const k in L) if (L[k].used) upload(L[k]);
    const bg = F.bg;
    gl.disable(gl.BLEND);
    pass(G.P.bg, G.hdr, { uTop: bg.top, uBot: bg.bot, uNebA: bg.nebA, uNebB: bg.nebB, uNeb: bg.neb, uStars: bg.stars, uT: F.t,
      uDrift: bg.drift, uGlow: bg.glow, uGlowC: bg.glowC, uGlow2: bg.glow2, uGlowC2: bg.glowC2, uGridK: bg.gridK, uGridC: bg.gridC });
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (L.back.used) pass(G.P.layer, G.hdr, { uSrc: L.back.tex, uGain: F.post.backGain });
    // 粒子（加色混合）
    gl.blendFunc(gl.ONE, gl.ONE);
    const P = G.P.pts;
    gl.useProgram(P.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.hdr.fb);
    gl.viewport(0, 0, W, H);
    gl.bindVertexArray(emptyVao);
    const VP = G.viewProj(F.cam);
    const px = (H / 2) / Math.tan((F.cam.fov * Math.PI) / 360);
    P.set.uAtlas(G.atlasTex); P.set.uVP(VP); P.set.uPx(px);
    for (let gi = 0; gi < 3; gi++) {
      const g = F.g[gi];
      if (!g.on || g.alpha <= 0.001) continue;
      const n = Math.min(G.NG[gi], g.n || G.NG[gi]);
      const mb = Math.max(1, g.mb | 0);
      const U = {
        uBase: G.BASE[gi], uCount: n, uA: g.A.id, uPA: g.A.P, uQA: g.A.Q, uRA: g.A.R, uB: g.B.id, uPB: g.B.P, uQB: g.B.Q, uRB: g.B.R,
        uStag: g.stag, uSMode: g.smode, uArc: g.arc, uNoise: g.noise, uRot: g.rot, uRotX: g.rotx, uBurst: g.burst,
        uColA: g.colA, uColB: g.colB, uColC: g.colC, uSize: g.size, uReveal: g.reveal, uTwinkle: g.twinkle, uGrad: g.grad ? 1 : 0,
        uSpark: g.spark, uPulse: g.pulse, uPulseWK: g.pulseWK,
      };
      for (const k in U) if (P.set[k]) P.set[k](U[k]);
      for (let s = 0; s < mb; s++) {
        P.set.uT(F.t - s * (g.shutter / C.FPS) / mb);
        P.set.uMix(C.clamp(g.mix - s * g.trail));
        P.set.uAlpha(g.alpha / mb);
        P.set.uBright(g.bright);
        gl.drawArrays(gl.POINTS, 0, n);
      }
    }
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (L.front.used) pass(G.P.layer, G.hdr, { uSrc: L.front.tex, uGain: F.post.frontGain });
    gl.disable(gl.BLEND);
    // 泛光
    const po = F.post;
    let src = G.hdr;
    for (let i = 0; i < G.dn.length; i++) {
      pass(G.P.down, G.dn[i], { uSrc: src.tex, uTx: [1 / src.w, 1 / src.h], uFirst: i === 0 ? 1 : 0, uThr: po.thr, uKnee: po.knee });
      src = G.dn[i];
    }
    for (let i = G.dn.length - 2; i >= 0; i--) {
      const lo = i === G.dn.length - 2 ? G.dn[i + 1] : G.upT[i + 1];
      pass(G.P.up, G.upT[i], { uSrc: lo.tex, uBase: G.dn[i].tex, uTx: [1 / lo.w, 1 / lo.h] });
    }
    const sh = new Float32Array(16);
    const ns = Math.min(4, po.shocks.length);
    for (let i = 0; i < ns; i++) sh.set(po.shocks[i], i * 4);
    pass(G.P.fin, G.out, {
      uHdr: G.hdr.tex, uBloom: G.upT[0].tex, uUi: L.ui.tex, uUiOn: L.ui.used ? 1 : 0, uBloomK: po.bloomK, uExp: po.exp, uCA: po.ca,
      uGrain: po.grain, uVig: po.vig, uFlash: po.flash, uFlashC: C.lin(po.flashCol), uFade: po.fade, uSat: po.sat, uLetter: po.letter,
      uGlitch: po.glitch, uHaze: po.haze, uHazeR: po.hazeR, uT: F.t, uTint: po.tint, uLift: po.lift, uContrast: po.contrast, uShock: sh, uNS: ns,
    });
  };
  G.readYUV = function (f, buf) {
    pass(G.P.pack, G.yuv, { uSrc: G.out.tex, uFrame: f % 997 });
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.yuv.fb);
    gl.readPixels(0, 0, 480, 1620, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  };
  G.blit = function () { gl.disable(gl.BLEND); pass(G.P.copy, null, { uSrc: G.out.tex }); };
})();
