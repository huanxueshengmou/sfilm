# 音效合成：按 script/cues.json 的时刻表生成（与画面同源），返回立体声缓冲
import math
import numpy as np
from music import SR, N, CU, svf, saw_arr, put, kick, snare, taiko, crash, onepole

R = np.random.default_rng(777)
def tt(n): return np.arange(n) / SR
def nz(n): return R.standard_normal(n)


def hit(g):
    n = int(2.2 * SR); t = tt(n)
    sub = np.sin(2 * np.pi * np.cumsum(36 + 110 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.65)
    n2 = svf(nz(n), 2600 * np.exp(-t / 0.2) + 150, 0.8, 0) * np.exp(-t / 0.3)
    x = np.tanh((sub * 1.3 + n2 * 0.7) * 1.5)
    k = kick(0.45); x[:len(k)] += k * 0.5
    return x * 0.85 * g


def boom(g):
    n = int(4.0 * SR); t = tt(n)
    x = np.sin(2 * np.pi * np.cumsum(28 + 26 * np.exp(-t / 0.35)) / SR) * np.exp(-t / 1.4)
    x += svf(nz(n), np.full(n, 180.0), 0.7, 0) * np.exp(-t / 1.0) * 0.8
    return np.tanh(x * 1.2) * 0.8 * g


def riser(g, dur):
    n = int(dur * SR); p = tt(n) / dur
    x = svf(nz(n), 250 + 8000 * p ** 2.2, 2.6, 1) * p ** 1.8
    tone = np.zeros(n)
    for k, m in enumerate([0, 7, 12]):
        f = 110 * 2 ** (m / 12) * 2 ** (p * 2.4)
        tone += np.sin(2 * np.pi * np.cumsum(f) / SR + k) * p ** 2.4
    return (x * 0.6 + tone * 0.12) * g


def reverse(g, dur):
    # 反向钢琴/镲的吸气感
    n = int(dur * SR); t = tt(n)[::-1]
    x = svf(nz(n), np.full(n, 6000.0), 0.6, 2) * np.exp(-t / 0.5)
    x += np.sin(2 * np.pi * 262 * t) * np.exp(-t / 0.4) * 0.4 + np.sin(2 * np.pi * 392 * t) * np.exp(-t / 0.35) * 0.25
    return x * np.linspace(0, 1, n) ** 1.5 * 0.5 * g


def swell(g, dur):
    n = int(dur * SR); p = tt(n) / dur
    x = svf(nz(n), 300 + 2500 * np.sin(np.pi * p), 1.5, 1) * np.sin(np.pi * p) ** 2
    return x * 0.3 * g


def whoosh(g, dur=0.7):
    n = int(dur * SR); p = tt(n) / dur
    return svf(nz(n), 500 + 5500 * np.sin(np.pi * p), 1.6, 1) * np.sin(np.pi * p) ** 2 * 0.55 * g


def sweep_down(g, dur):
    n = int(dur * SR); p = tt(n) / dur
    return svf(nz(n), 6000 * (1 - p) + 200, 2.5, 1) * np.sin(np.pi * p) ** 1.5 * 0.35 * g


def typing(g, pitch=1.0):
    n = int(0.06 * SR); t = tt(n)
    x = svf(nz(n), np.full(n, 3200.0 * pitch), 2.0, 1) * np.exp(-t / 0.006)
    x += np.sin(2 * np.pi * 180 * pitch * t) * np.exp(-t / 0.01) * 0.5
    return x * 0.5 * g


def clock(g, pitch=1.0):
    n = int(0.1 * SR); t = tt(n)
    x = np.sin(2 * np.pi * 2600 * pitch * t) * np.exp(-t / 0.008) + svf(nz(n), np.full(n, 5000.0), 2, 1) * np.exp(-t / 0.004) * 0.6
    return x * 0.35 * g


def tick(g, pitch=1.0):
    n = int(0.08 * SR); t = tt(n)
    return (np.sin(2 * np.pi * 2000 * pitch * t) * np.exp(-t / 0.012) + np.sin(2 * np.pi * 4000 * pitch * t) * np.exp(-t / 0.006) * 0.4) * 0.3 * g


def blip(g, pitch=1.0):
    n = int(0.35 * SR); t = tt(n)
    f = 660 * pitch * (1 + 0.5 * np.exp(-t / 0.02))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.09) * 0.28 * g


def data(g, dur):
    n = int(dur * SR); t = tt(n)
    step = int(0.025 * SR); x = np.zeros(n)
    for i in range(0, n, step):
        f = 800 + R.random() * 2400; m = min(step, n - i)
        x[i:i + m] = np.sign(np.sin(2 * np.pi * f * tt(m))) * (R.random() < 0.7)
    x = svf(x, np.full(n, 3500.0), 0.8, 0) * np.minimum(1, t / 0.1) * np.clip((dur - t) / 0.3, 0, 1)
    return x * 0.08 * g


def glitch(g):
    n = int(0.35 * SR); t = tt(n)
    x = np.sign(np.sin(2 * np.pi * 90 * t)) * (np.sin(2 * np.pi * 23 * t) > 0) + svf(nz(n), np.full(n, 2000.0), 3, 1) * 0.6
    return x * np.exp(-t / 0.15) * 0.25 * g


def slam(g):
    n = int(0.5 * SR); t = tt(n)
    x = np.sin(2 * np.pi * np.cumsum(70 + 160 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.12)
    x += svf(nz(n), np.full(n, 1800.0), 0.8, 0) * np.exp(-t / 0.03) * 0.8
    return np.tanh(x * 1.6) * 0.45 * g


def melt(g, dur):
    n = int(dur * SR); p = tt(n) / dur
    x = svf(nz(n), 3000 * (1 - p) ** 2 + 200, 3.0, 1) * np.sin(np.pi * np.minimum(1, p * 1.5)) ** 1.2
    y = np.sin(2 * np.pi * np.cumsum(220 * (1 - 0.6 * p)) / SR) * (1 - p) * 0.2
    return (x * 0.45 + y) * g


def drop(g, pitch=1.0):
    n = int(0.6 * SR); t = tt(n)
    f = 380 * pitch * (1 + 2.2 * np.exp(-t / 0.018))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.09)
    x += svf(nz(n), np.full(n, 1500.0), 1.2, 1) * np.exp(-t / 0.05) * 0.3
    return x * 0.4 * g


def splash(g):
    n = int(1.5 * SR); t = tt(n)
    x = svf(nz(n), 4000 * np.exp(-t / 0.3) + 400, 0.9, 0) * np.exp(-t / 0.35)
    for k in range(10):
        i = int(R.random() * 0.8 * SR); d = drop(0.5, 0.8 + R.random() * 1.5); m = min(len(d), n - i); x[i:i + m] += d[:m] * 0.4
    return x * 0.6 * g


def pen(g, dur):
    n = int(dur * SR); t = tt(n)
    x = svf(nz(n), np.full(n, 3800.0), 1.2, 1) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 7 * t)))
    return x * np.minimum(1, t / 0.03) * np.clip((dur - t) / 0.08, 0, 1) * 0.12 * g


def chime(g, pitch=1.0):
    n = int(2.2 * SR); t = tt(n); x = np.zeros(n)
    for m, a in [(84, 1), (91, 0.6), (96, 0.35), (103, 0.2)]:
        f = 440 * 2 ** ((m - 69) / 12) * pitch
        x += np.sin(2 * np.pi * f * t) * np.exp(-t / (0.9 / (1 + a))) * a
    return x * 0.13 * g


def shimmer(g):
    n = int(3.2 * SR); t = tt(n); x = np.zeros(n)
    for k, m in enumerate([72, 79, 84, 88, 91, 96]):
        f = 440 * 2 ** ((m - 69) / 12)
        x += np.sin(2 * np.pi * f * t + k) * np.exp(-t / 1.5) * (1 - np.exp(-t / (0.05 + 0.06 * k)))
    return x * 0.07 * g


def card(g, pitch=1.0):
    n = int(0.25 * SR); t = tt(n)
    x = svf(nz(n), np.full(n, 2500.0 * pitch), 1.0, 1) * np.exp(-t / 0.04) + np.sin(2 * np.pi * 140 * t) * np.exp(-t / 0.03) * 0.4
    return x * 0.4 * g


def page(g, pitch=1.0):
    n = int(0.35 * SR); p = tt(n) / 0.35
    return svf(nz(n), 1500 + 4000 * p * pitch, 0.9, 1) * np.sin(np.pi * p) ** 2 * 0.3 * g


def coin(g):
    n = int(1.2 * SR); t = tt(n)
    x = np.sin(2 * np.pi * 1975 * t) * np.exp(-t / 0.3) + np.sin(2 * np.pi * 2637 * t) * np.exp(-t / 0.25) * (t > 0.07)
    return x * 0.18 * g


def stamp(g):
    n = int(0.8 * SR); t = tt(n)
    x = np.sin(2 * np.pi * np.cumsum(90 + 120 * np.exp(-t / 0.015)) / SR) * np.exp(-t / 0.1)
    x += svf(nz(n), np.full(n, 900.0), 0.8, 0) * np.exp(-t / 0.04) * 1.2
    return np.tanh(x * 2.0) * 0.6 * g


def redact(g):
    n = int(0.4 * SR); p = tt(n) / 0.4
    return svf(nz(n), 900 + 2500 * p, 1.4, 1) * np.sin(np.pi * p) * 0.35 * g


def count(g, dur):
    n = int(dur * SR); x = np.zeros(n); i = 0; k = 0
    while i < n:
        c = tick(0.5, 1.2 + 0.4 * (i / n)); m = min(len(c), n - i); x[i:i + m] += c[:m]
        i += int(SR * (0.07 - 0.045 * (i / n))); k += 1
    return x * g


def drone(g, dur):
    n = int(dur * SR); t = tt(n); p = t / dur
    x = saw_arr(55 * (1 + 0.5 * p ** 2) * np.ones(n)) + saw_arr(55.4 * (1 + 0.5 * p ** 2) * np.ones(n))
    x = svf(x, 150 + 1200 * p ** 2, 2, 0)
    return x * np.minimum(1, t / 0.5) * 0.15 * g


def check(g, pitch=1.0):
    n = int(0.4 * SR); t = tt(n)
    x = np.sin(2 * np.pi * 880 * pitch * t) * np.exp(-t / 0.08) + np.sin(2 * np.pi * 1320 * pitch * t) * np.exp(-t / 0.1) * (t > 0.06)
    return x * 0.2 * g


def brick(g, pitch=1.0):
    n = int(0.9 * SR); t = tt(n)
    x = np.sin(2 * np.pi * np.cumsum(60 * pitch + 90 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.18)
    x += svf(nz(n), np.full(n, 700.0), 0.8, 0) * np.exp(-t / 0.08) * 0.9
    x += svf(nz(n), np.full(n, 3000.0), 0.8, 2) * np.exp(-t / 0.2) * 0.15 * (t > 0.03)
    return np.tanh(x * 1.6) * 0.6 * g


def motor(g, dur):
    n = int(dur * SR); t = tt(n); p = t / dur
    f = 40 + 90 * p ** 1.5
    x = saw_arr(f) * 0.6 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * 0.4
    x = svf(x, 300 + 1500 * p, 1.8, 0) * (0.8 + 0.2 * np.sin(2 * np.pi * 11 * t))
    return x * np.minimum(1, t / 0.2) * 0.25 * g


def power_down(g):
    n = int(1.4 * SR); t = tt(n)
    f = 260 * np.exp(-t / 0.35) + 25
    x = saw_arr(f) * 0.5 + np.sin(2 * np.pi * np.cumsum(f) / SR)
    return svf(x, 2000 * np.exp(-t / 0.4) + 100, 1.2, 0) * np.exp(-t / 0.6) * 0.35 * g


def error(g):
    n = int(0.5 * SR); t = tt(n)
    x = np.sign(np.sin(2 * np.pi * 180 * t)) * 0.5 + np.sign(np.sin(2 * np.pi * 127 * t)) * 0.5
    x = svf(x, np.full(n, 1800.0), 0.8, 0)
    gate = ((t < 0.12) | ((t > 0.18) & (t < 0.3))).astype(float)
    return x * gate * np.exp(-t / 0.4) * 0.22 * g


def sign(g, pitch=1.0):
    n = int(0.3 * SR); p = tt(n) / 0.3
    x = svf(nz(n), 2500 + 2500 * np.sin(np.pi * p * 3) * pitch, 2.0, 1) * np.sin(np.pi * p) * (0.6 + 0.4 * np.sin(2 * np.pi * 14 * tt(n)))
    return x * 0.15 * g


def weight(g):
    n = int(1.4 * SR); t = tt(n)
    x = np.sin(2 * np.pi * np.cumsum(50 + 70 * np.exp(-t / 0.04)) / SR) * np.exp(-t / 0.35)
    x += np.sin(2 * np.pi * 620 * t) * np.exp(-t / 0.5) * 0.15 + np.sin(2 * np.pi * 931 * t) * np.exp(-t / 0.4) * 0.1
    return np.tanh(x * 1.4) * 0.5 * g


def wave(g, dur):
    n = int(dur * SR); p = tt(n) / dur
    x = svf(nz(n), 400 + 2200 * np.sin(np.pi * p) ** 0.7, 0.8, 0) * np.sin(np.pi * np.minimum(1, p * 1.3)) ** 0.8
    x += svf(nz(n), np.full(n, 120.0), 0.7, 0) * np.sin(np.pi * p) * 1.2
    return x * 0.5 * g


def medal(g):
    n = int(4.5 * SR); t = tt(n); x = np.zeros(n)
    for f, a, d in [(196, 1, 3.0), (392 * 1.003, 0.6, 2.2), (587, 0.35, 1.6), (831, 0.25, 1.2), (1174, 0.15, 0.9)]:
        x += np.sin(2 * np.pi * f * t) * np.exp(-t / d) * a
    x = x * (1 - np.exp(-t / 0.4)) * 0.6 + svf(nz(n), np.full(n, 3000.0), 0.7, 2) * np.exp(-t / 0.6) * 0.05
    return x * 0.25 * g


def engrave(g, pitch=1.0):
    n = int(0.09 * SR); t = tt(n)
    x = svf(nz(n), np.full(n, 5500.0 * pitch), 3.0, 1) * np.exp(-t / 0.02) + np.sin(2 * np.pi * 3100 * pitch * t) * np.exp(-t / 0.01) * 0.4
    return x * 0.3 * g


def render_sfx():
    buf = np.zeros((N, 2))
    for e in CU['events']:
        k, g, t0 = e['type'], e['gain'], e['t']
        p = e.get('pitch', 1.0); d = e.get('dur', 1.0); pan = 0.0
        if k == 'hit': x = hit(g)
        elif k == 'boom': x = boom(g)
        elif k == 'riser': x = riser(g, d)
        elif k == 'reverse': x = reverse(g, d)
        elif k == 'swell': x = swell(g, d)
        elif k == 'whoosh': x = whoosh(g); t0 -= 0.35
        elif k == 'sweepDown': x = sweep_down(g, d)
        elif k == 'type': x = typing(g, p); pan = math.sin(t0 * 7) * 0.3
        elif k == 'clock': x = clock(g, p); pan = math.sin(t0 * 3) * 0.2
        elif k == 'tick': x = tick(g, p); pan = math.sin(t0 * 3.1) * 0.35
        elif k == 'blip': x = blip(g, p); pan = math.sin(t0 * 1.7) * 0.25
        elif k == 'data': x = data(g, d)
        elif k == 'glitch': x = glitch(g)
        elif k == 'slam': x = slam(g); pan = math.sin(t0 * 5.3) * 0.25
        elif k == 'melt': x = melt(g, d)
        elif k == 'drop': x = drop(g, p); pan = math.sin(t0 * 2.3) * 0.4
        elif k == 'splash': x = splash(g)
        elif k == 'pen': x = pen(g, d)
        elif k == 'chime': x = chime(g, p)
        elif k == 'shimmer': x = shimmer(g)
        elif k == 'card': x = card(g, p); pan = math.sin(t0 * 4.1) * 0.35
        elif k == 'page': x = page(g, p); pan = math.sin(t0 * 6.1) * 0.3
        elif k == 'coin': x = coin(g)
        elif k == 'stamp': x = stamp(g)
        elif k == 'redact': x = redact(g)
        elif k == 'count': x = count(g, d)
        elif k == 'drone': x = drone(g, d)
        elif k == 'check': x = check(g, p)
        elif k == 'brick': x = brick(g, p)
        elif k == 'motor': x = motor(g, d)
        elif k == 'powerDown': x = power_down(g)
        elif k == 'error': x = error(g)
        elif k == 'sign': x = sign(g, p); pan = math.sin(t0 * 9) * 0.5
        elif k == 'weight': x = weight(g)
        elif k == 'wave': x = wave(g, d)
        elif k == 'medal': x = medal(g)
        elif k == 'engrave': x = engrave(g, p); pan = math.sin(t0 * 2.5) * 0.4
        else:
            print('unknown sfx', k); continue
        if k in ('shimmer', 'chime', 'medal', 'swell', 'wave'):
            put(buf, x, t0, pan=-0.4); put(buf, np.roll(x, 600), t0, pan=0.4)
        else:
            put(buf, x, t0, pan=pan)
    return buf * 0.7071
