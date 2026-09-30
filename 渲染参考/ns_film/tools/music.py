# 原创配乐（120 BPM，C 小调 → 结尾 C 大调）：电影感混合编制
# 钢琴（加性合成+缓存）/ 弦乐群（超锯齿+颤音）/ 合唱（共振峰）/ 拨弦（KS）/ 钟琴（FM）/ 冷感琶音 / 断奏脉冲 / 贝斯
# 打击：底鼓 军鼓 踩镲 太鼓 定音鼓 镲；特效：BRAAM、预冲击静音
# 全部时刻取自 script/cues.json（与画面同源）；输出分轨字典，混音在 mix.py
import json, os, sys, io, math
import numpy as np
from numba import njit

if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
CU = json.load(open(os.path.join(ROOT, 'script', 'cues.json'), encoding='utf-8'))
DUR = CU['duration']
BEAT = 60.0 / CU['bpm']
BAR = BEAT * 4
N = int(DUR * SR) + SR * 4
SC = {s['id']: s for s in CU['scenes']}
AA = CU['A']
LINES = {l['id']: l for l in CU['lines']}
rng = np.random.default_rng(20260908)


def a(i, k=0): return AA[i][k]
def L1(i): return LINES[i]['end']
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)


# ---------------- DSP 基础 ----------------
@njit(cache=True)
def svf(x, cut, res, mode):
    y = np.zeros_like(x); ic1 = 0.0; ic2 = 0.0; k = 1.0 / max(res, 0.5)
    for i in range(len(x)):
        fc = min(max(cut[i], 10.0), 0.45 * 48000.0)
        g = math.tan(math.pi * fc / 48000.0)
        a1 = 1.0 / (1.0 + g * (g + k)); a2 = g * a1; a3 = g * a2
        v3 = x[i] - ic2; v1 = a1 * ic1 + a2 * v3; v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1; ic2 = 2.0 * v2 - ic2
        if mode == 0: y[i] = v2
        elif mode == 1: y[i] = v1 * k
        else: y[i] = x[i] - k * v1 - v2
    return y


@njit(cache=True)
def onepole(x, a):
    y = np.zeros_like(x); s = 0.0
    for i in range(len(x)):
        s += a * (x[i] - s); y[i] = s
    return y


@njit(cache=True)
def comb_reverb(x, sr, decay, damp, spread):
    cl = np.array([1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116]) * sr // 44100 + spread
    al = np.array([556, 441, 341, 225]) * sr // 44100 + spread // 3
    out = np.zeros_like(x)
    for c in range(8):
        L = cl[c]; buf = np.zeros(L); idx = 0; st = 0.0
        for i in range(len(x)):
            o = buf[idx]; st = o * (1 - damp) + st * damp
            buf[idx] = x[i] + st * decay; idx += 1
            if idx >= L: idx = 0
            out[i] += o
    for q in range(4):
        L = al[q]; buf = np.zeros(L); idx = 0; y = np.zeros_like(out)
        for i in range(len(out)):
            b = buf[idx]; y[i] = -out[i] + b; buf[idx] = out[i] + b * 0.5; idx += 1
            if idx >= L: idx = 0
        out = y
    return out * 0.1


@njit(cache=True)
def ks(n, period, damp, noise):
    buf = noise[:period].copy(); y = np.zeros(n); idx = 0
    for i in range(n):
        j = idx + 1
        if j >= period: j = 0
        v = damp * 0.5 * (buf[idx] + buf[j]); y[i] = buf[idx]; buf[idx] = v; idx = j
    return y


def saw_arr(f):
    ph = (rng.random() + np.cumsum(f) / SR) % 1.0
    dt = f / SR; s = 2 * ph - 1
    m1 = ph < dt; s[m1] -= (ph[m1] / dt[m1] - 1) ** 2
    m2 = ph > 1 - dt; s[m2] += ((ph[m2] - 1) / dt[m2] + 1) ** 2
    return s


def sine(f, n, ph=0.0): return np.sin(2 * np.pi * (f * np.arange(n) / SR + ph))


def put(buf, x, t0, pan=0.0, gain=1.0):
    i0 = int(round(t0 * SR))
    if i0 >= len(buf) or len(x) == 0: return
    if i0 < 0: x = x[-i0:]; i0 = 0
    n = min(len(x), len(buf) - i0)
    l = math.cos((pan + 1) * math.pi / 4) * gain * 1.4142; r = math.sin((pan + 1) * math.pi / 4) * gain * 1.4142
    buf[i0:i0 + n, 0] += x[:n] * l; buf[i0:i0 + n, 1] += x[:n] * r


def adsr(n, att, rel, hold):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(att, 1e-3))
    return e * np.clip(1 - (t - hold) / max(rel, 1e-3), 0, 1)


# ---------------- 和声 ----------------
CH = {  # 根音（低音）+ 上方声部
    'Cm': (36, [55, 60, 63, 67]), 'Ab': (32, [56, 60, 63, 68]), 'Eb': (39, [55, 58, 63, 67]), 'Bb': (34, [53, 58, 62, 65]),
    'Fm': (41, [56, 60, 65, 68]), 'Db': (37, [56, 61, 65, 68]), 'G': (43, [55, 59, 62, 67]), 'C': (36, [55, 60, 64, 67]),
    'Gsus': (43, [55, 60, 62, 67]), 'Abmaj7': (32, [55, 60, 63, 68]), 'Cadd9': (36, [55, 62, 64, 67]),
}
PROG = {
    'dark': ['Cm', 'Cm', 'Ab', 'Ab'], 'main': ['Cm', 'Ab', 'Eb', 'Bb'], 'tender': ['Ab', 'Eb', 'Bb', 'Cm'],
    'tense': ['Cm', 'Db', 'Cm', 'G'], 'lift': ['Eb', 'Bb', 'Cm', 'Ab'], 'solemn': ['Cm', 'Ab', 'Fm', 'G'],
    'final': ['Ab', 'Bb', 'Cm', 'Eb'],
}
MEL = {  # (midi, 拍)；按小节循环
    'tender': [[(72, 2), (75, 1), (72, 1)], [(70, 3), (67, 1)], [(65, 2), (74, 1), (72, 0.5), (70, 0.5)], [(72, 4)]],
    'swell': [[(68, 2), (72, 2)], [(75, 4)], [(67, 2), (70, 2)], [(71, 2), (74, 2)]],
    'final': [[(75, 1.5), (77, 0.5), (75, 1), (72, 1)], [(74, 2), (77, 2)], [(79, 3), (75, 1)], [(70, 4)]],
    'hope': [[(70, 2), (75, 2)], [(74, 3), (70, 1)], [(72, 2), (75, 1), (79, 1)], [(77, 4)]],
}


# ---------------- 乐器 ----------------
_pc = {}
def piano_raw(m, vb):
    key = (m, vb)
    if key in _pc: return _pc[key]
    f0 = mtof(m); L = int((4.8 if m < 60 else 3.4) * SR); t = np.arange(L) / SR
    x = np.zeros(L); B = 0.00032; bright = [0.55, 0.8, 1.05][vb]
    r = np.random.default_rng(m * 7 + vb)
    for n in range(1, 16):
        fn = f0 * n * math.sqrt(1 + B * n * n)
        if fn > 15000: break
        amp = (1 / n ** 1.05) * math.exp(-(n - 1) * (0.32 / bright))
        dec = (3.6 if m < 55 else 2.6) * (60 / max(m, 30)) ** 0.6 / (1 + 0.22 * n)
        for d in (-0.35e-3, 0.35e-3):
            x += amp * np.sin(2 * np.pi * fn * (1 + d) * t + r.random() * 6.28) * np.exp(-t / dec)
    x *= 0.55 + 0.45 * np.exp(-t / 0.3)
    hn = int(0.012 * SR)
    h = svf(r.standard_normal(hn), np.full(hn, 2500.0 * bright), 0.7, 1) * np.exp(-np.arange(hn) / SR / 0.002) * 0.25 * bright
    x[:hn] += h
    x /= np.abs(x).max() + 1e-9
    _pc[key] = x
    return x


def piano(buf, m, t0, dur, vel):
    vb = 0 if vel < 0.42 else 1 if vel < 0.7 else 2
    x = piano_raw(m, vb)
    n_on, rel = int(dur * SR), int(0.35 * SR)
    n = min(len(x), n_on + rel)
    y = x[:n].copy()
    if n_on < n: y[n_on:] *= np.linspace(1, 0, n - n_on) ** 2
    put(buf, y * vel * 0.32, t0, pan=C((m - 62) / 36, -0.7, 0.7))


def C(v, a, b): return max(a, min(b, v))


_kc = {}
def pizz(buf, m, t0, vel, pan=0.0):
    if m not in _kc:
        p = int(round(SR / mtof(m))); n = int(0.9 * SR)
        r = np.random.default_rng(m)
        y = ks(n, p, 0.994, svf(r.standard_normal(p + 2), np.full(p + 2, 3000.0), 0.7, 0))
        y = svf(y, np.full(n, 2600.0), 0.8, 0) * np.exp(-np.arange(n) / SR / 0.35)
        _kc[m] = y / (np.abs(y).max() + 1e-9)
    put(buf, _kc[m] * vel * 0.3, t0, pan=pan)


def strings(buf, notes, t0, dur, amp, cut, att, rel=0.9, trem=0.0):
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    env = adsr(n, att, rel, dur)
    if trem > 0: env *= (1 - trem) + trem * (0.5 + 0.5 * np.cos(2 * np.pi * 8 * (t + t0)))
    for j, m in enumerate(notes):
        f0 = mtof(m); vib = 1 + 0.0028 * np.sin(2 * np.pi * (5.1 + 0.3 * j) * t + j) * np.minimum(1, t / 0.8)
        x = np.zeros(n)
        for d in (-8, 0, 7):
            x += saw_arr(f0 * 2 ** (d / 1200) * vib)
        c = np.full(n, cut * (0.7 + 0.3 * min(1, m / 60)))
        x = svf(x, c, 0.8, 0); x = svf(x, np.full(n, 90.0), 0.7, 2)
        put(buf, x * env * amp * 0.06, t0, pan=C((j - (len(notes) - 1) / 2) * 0.35, -0.8, 0.8))


VOW = [(800, 1150, 2900), (450, 800, 2830), (400, 1600, 2700)]
def choir(buf, notes, t0, dur, amp, vowel=0, att=0.9):
    n = int((dur + 1.4) * SR); t = np.arange(n) / SR
    env = adsr(n, att, 1.4, dur)
    F = VOW[vowel]
    for j, m in enumerate(notes):
        f0 = mtof(m); x = np.zeros(n)
        for d in (-11, 9):
            vib = 1 + 0.004 * np.sin(2 * np.pi * (4.7 + 0.4 * j + d * 0.01) * t + d)
            x += saw_arr(f0 * 2 ** (d / 1200) * vib)
        y = svf(x, np.full(n, F[0]), 5, 1) * 1.0 + svf(x, np.full(n, F[1]), 6, 1) * 0.6 + svf(x, np.full(n, F[2]), 8, 1) * 0.25
        y = svf(y, np.full(n, 4200.0), 0.7, 0)
        put(buf, y * env * amp * 0.055, t0, pan=C((j - 1.5) * 0.4, -0.8, 0.8))


def bell(buf, m, t0, vel, dur=2.2):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m)
    idx = 2.2 * np.exp(-t / 0.35)
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t / (dur * 0.35))
    x += 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.4)
    put(buf, x * vel * 0.12, t0, pan=C((m - 76) / 20, -0.6, 0.6))


def pulse_note(buf, m, t0, vel, cut):
    n = int(0.16 * SR); t = np.arange(n) / SR
    x = saw_arr(np.full(n, mtof(m))) * 0.7 + saw_arr(np.full(n, mtof(m) * 1.004)) * 0.5
    x = svf(x, cut * (0.3 + 0.7 * np.exp(-t / 0.05)), 1.3, 0) * np.minimum(1, t / 0.003) * np.exp(-t / 0.06)
    put(buf, x * vel * 0.16, t0, pan=0.12 * math.sin(t0 * 5))


def arp_note(buf, m, t0, vel, pan):
    n = int(0.22 * SR); t = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * mtof(m) * t)) * 0.4 + np.sin(2 * np.pi * mtof(m) * t) * 0.6
    x = svf(x, 900 + 3500 * np.exp(-t / 0.04), 1.1, 0) * np.exp(-t / 0.08)
    put(buf, x * vel * 0.09, t0, pan=pan)


def bass_seg(buf, m, t0, dur, amp, mode):
    if mode == 'drone' or mode == 'sub':
        n = int((dur + 0.6) * SR); t = np.arange(n) / SR; env = adsr(n, 0.4, 0.6, dur)
        x = sine(mtof(m), n) * 0.9
        if mode == 'drone': x += svf(saw_arr(np.full(n, mtof(m))), np.full(n, 260.0), 0.8, 0) * 0.45
        put(buf, x * env * amp * 0.3, t0)
    elif mode == 'eighth':
        k = 0
        tt = t0
        while tt < t0 + dur - 1e-3:
            nn = int(BEAT / 2 * SR); t = np.arange(nn) / SR
            f = mtof(m + (12 if k % 4 == 3 else 0))
            x = saw_arr(np.full(nn, f)) * 0.55 + np.sin(2 * np.pi * f / 2 * t) * 0.8
            x = svf(x * adsr(nn, 0.004, 0.05, BEAT / 2 - 0.06), 170 + 1300 * np.exp(-t / 0.08), 1.3, 0)
            put(buf, x * amp * 0.28, tt); tt += BEAT / 2; k += 1


# ---------------- 打击 ----------------
def kick(dec=0.35, pitch=1.0):
    n = int(0.55 * SR); t = np.arange(n) / SR
    f = 44 * pitch + 150 * pitch * np.exp(-t / 0.032)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / dec)
    return np.tanh((x + rng.standard_normal(n) * np.exp(-t / 0.003) * 0.25) * 1.7)


def snare(dec=0.13):
    n = int(0.4 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05) * 0.6
    nz = svf(rng.standard_normal(n), np.full(n, 5000.0), 0.8, 1) * np.exp(-t / dec)
    return np.tanh((body + nz) * 1.3)


def hat(open_=False):
    n = int((0.3 if open_ else 0.06) * SR); t = np.arange(n) / SR
    return svf(rng.standard_normal(n), np.full(n, 9000.0), 0.7, 2) * np.exp(-t / (0.1 if open_ else 0.017)) * 0.55


def taiko(pitch=1.0):
    n = int(1.3 * SR); t = np.arange(n) / SR
    f = 64 * pitch * (1 + 0.7 * np.exp(-t / 0.025))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.42)
    skin = svf(rng.standard_normal(n), np.full(n, 1100.0), 0.8, 0) * np.exp(-t / 0.05)
    return np.tanh((body + skin * 0.7) * 1.6)


def timp(m):
    n = int(1.8 * SR); t = np.arange(n) / SR; f = mtof(m)
    x = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t) * np.exp(-t / 0.3)) * np.exp(-t / 0.7)
    x += svf(rng.standard_normal(n), np.full(n, 600.0), 0.7, 0) * np.exp(-t / 0.04) * 0.6
    return np.tanh(x * 1.2)


def crash():
    n = int(2.6 * SR); t = np.arange(n) / SR
    x = svf(rng.standard_normal(n), np.full(n, 4500.0), 0.6, 2) * np.exp(-t / 0.9)
    x += svf(rng.standard_normal(n), np.full(n, 7000.0), 3, 1) * np.exp(-t / 1.4) * 0.4
    return x * 0.5


def braam(buf, t0, chord, g=1.0):
    root = CH[chord][0]; n = int(4.2 * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for m in (root, root + 7, root + 12):
        for d in (-13, -5, 0, 6, 12):
            x += saw_arr(np.full(n, mtof(m) * 2 ** (d / 1200)))
    cut = 110 + 2400 * np.exp(-t / 0.45) * (1 - np.exp(-t / 0.035)) + 380 * np.exp(-t / 2.2)
    x = np.tanh(svf(x, cut, 2.4, 0) * 0.55)
    env = np.minimum(1, t / 0.025) * np.exp(-t / 2.0)
    sub = np.sin(2 * np.pi * mtof(root - 12) * t) * np.exp(-t / 2.4)
    y = (x * 0.5 + sub * 0.55) * env * g
    put(buf, y, t0, pan=-0.15); put(buf, np.roll(y, 360), t0, pan=0.15)


def drums_bar(buf, fx, t0, kind, I, bi, last):
    B = BEAT
    if kind == 'heart':
        put(buf, kick(0.45, 0.9), t0, gain=0.55 * I); put(buf, kick(0.4, 0.85), t0 + 0.75 * B, gain=0.4 * I)
    elif kind == 'build':
        for s in range(4): put(buf, kick(), t0 + s * B, gain=0.55 * I)
        for s in range(8): put(buf, hat(), t0 + s * B / 2, pan=0.3, gain=0.18 * I)
        for s in range(4): put(buf, snare(), t0 + 2 * B + s * B / 2, gain=(0.12 + 0.05 * s) * I)
    elif kind == 'roll':
        for s in range(4): put(buf, kick(), t0 + s * B, gain=0.6 * I)
        for s in range(16): put(buf, snare(0.08), t0 + s * B / 4, gain=(0.1 + 0.25 * I * (s / 16)) * I)
        put(fx, taiko(), t0, gain=0.5 * I)
    elif kind == 'light':
        put(buf, kick(), t0, gain=0.5 * I); put(buf, kick(), t0 + 2.5 * B, gain=0.35 * I)
        put(buf, snare(0.09), t0 + B, gain=0.16 * I, pan=-0.05); put(buf, snare(0.09), t0 + 3 * B, gain=0.2 * I, pan=-0.05)
        for s in range(8): put(buf, hat(), t0 + s * B / 2 + (0.01 if s % 2 else 0), pan=0.35, gain=(0.12 + 0.06 * (s % 2)) * I)
    elif kind in ('drive', 'full'):
        for s in range(4): put(buf, kick(), t0 + s * B, gain=0.72 * I)
        put(buf, snare(), t0 + B, gain=0.42 * I); put(buf, snare(), t0 + 3 * B, gain=0.42 * I)
        for s in range(16): put(buf, hat(open_=(s % 4 == 2 and kind == 'full')), t0 + s * B / 4, pan=0.32, gain=(0.16 if s % 2 == 0 else 0.1) * I)
        if kind == 'full':
            put(fx, taiko(), t0, gain=0.7 * I); put(fx, taiko(1.2), t0 + 2 * B, gain=0.5 * I)
            if bi % 4 == 0: put(fx, crash(), t0, gain=0.55 * I)
        if last:
            for s in range(4): put(buf, snare(), t0 + 3 * B + s * B / 4, gain=(0.2 + 0.08 * s) * I)
    elif kind == 'taiko':
        for off, g, p in [(0, 1, 1), (1.5, 0.6, 1.25), (2, 0.8, 1), (3.5, 0.55, 1.4)]:
            put(fx, taiko(p), t0 + off * B, gain=0.75 * g * I)
        put(buf, hat(), t0 + B, gain=0.1 * I); put(buf, hat(), t0 + 3 * B, gain=0.1 * I)
    elif kind == 'march':
        put(fx, timp(43), t0, gain=0.5 * I); put(fx, timp(36), t0 + 2 * B, gain=0.45 * I)
        for s in range(3): put(buf, snare(0.06), t0 + 3 * B + s * B / 6, gain=0.12 * I)


# ---------------- 乐谱 ----------------
def plan():
    S = SC
    ob = a('o3', 1); tc = L1('o2') + 0.25
    t1h = a('t1') + 0.42 + 4 * 0.06 + 0.28; tq = a('t2', 1) + 12 * 0.045 + 0.28
    eb = next(w for w in [a('e4')] ) + 0.0
    # e4 “爆破”一词的起点（取音效 hit 时刻，更准）
    hits = sorted(e['t'] for e in CU['events'] if e['type'] == 'hit')
    near = lambda x: min(hits, key=lambda h: abs(h - x))
    eb = near(a('e4') + 1.0)
    st = near(a('r5', 1) + 1.5)             # 涡旋坍缩
    stp = [e['t'] for e in CU['events'] if e['type'] == 'stamp']
    tStampE = min(stp, key=lambda h: abs(h - a('e6', 1)))
    tNo = min(stp, key=lambda h: abs(h - a('r7', 1)))
    n0r = a('r3') - 0.35
    tOffP = [e['t'] for e in CU['events'] if e['type'] == 'powerDown'][0]
    n1m = L1('m2') + 0.9
    tSo = near(a('m4', 2))
    tNoB = min(stp, key=lambda h: abs(h - a('a3')))
    tName = near(a('f1', 4) + 0.5)
    n0f = a('f3') - 0.7
    tUs = a('f4', 1)
    secs = [
        # (起, 止, 和声, 参数)
        (0, 6, 'dark', dict(pad=0.25, att=3.0, cut=900, bass=('drone', 0.5))),
        (6, tc, 'dark', dict(pad=0.4, att=1.5, cut=1200, bass=('drone', 0.55), drums=('heart', 0.8), bell=0.25)),
        (tc, ob - 0.4, 'dark', dict(pad=0.6, att=0.6, cut=2000, trem=0.6, bass=('eighth', 0.6), drums=('build', 0.9), pulse=0.7, choir=0.25)),
        (ob, 18, ['Cm'], dict(pad=0.35, att=0.05, cut=1600, bass=('sub', 0.6))),
        (18, 20, ['Ab'], dict(pad=0.4, att=0.8, cut=1400, trem=0.5, bell=0.3)),
        (20, 24, ['Cm', 'Cm'], dict(pad=0.6, att=0.05, cut=2400, bass=('eighth', 0.7), drums=('taiko', 0.9), choir=0.35)),
        (24, 26, ['Ab'], dict(pad=0.55, att=0.1, cut=2200, bass=('eighth', 0.6), drums=('taiko', 0.8))),
        (26.4, 30, ['Ab', 'Bb'], dict(pad=0.4, att=0.4, cut=1600, trem=0.4, bell=0.35, bass=('drone', 0.4))),
        # 01 方程
        (30, 34, ['Cm', 'Cm'], dict(pad=0.28, att=1.2, cut=1200, piano=('sparse', 0.5))),
        (34, 44, 'main', dict(pad=0.28, att=0.8, cut=1500, piano=('ost', 0.5), pizz=('q', 0.45), bass=('drone', 0.4))),
        (44, 49, 'main', dict(pad=0.34, att=0.5, cut=1800, piano=('ost', 0.55), pizz=('e', 0.4), bass=('drone', 0.45), drums=('light', 0.7))),
        (49, eb - 0.3, ['G', 'G'], dict(pad=0.65, att=0.3, cut=2600, trem=0.8, pulse=0.6, drums=('roll', 0.9), bass=('eighth', 0.55))),
        (eb, 56, 'main', dict(pad=0.6, att=0.05, cut=2600, choir=0.35, bass=('eighth', 0.7), drums=('full', 0.9))),
        (56, 62.8, 'main', dict(pad=0.5, att=0.4, cut=2000, piano=('chords', 0.5), choir=0.25, bell=0.3, drums=('march', 0.9), bass=('drone', 0.5))),
        (62.8, 68, ['Ab', 'Bb', 'Cm'], dict(pad=0.42, att=0.5, cut=1800, piano=('chords', 0.45), drums=('light', 0.6), bass=('drone', 0.45))),
        # 02 八十八小时
        (68, 78, 'tense', dict(pad=0.28, att=0.8, cut=1300, pulse=0.55, bass=('eighth', 0.45), drums=('heart', 0.8))),
        (78, n0r, 'main', dict(pad=0.35, att=0.3, cut=2000, pulse=0.7, arp=0.4, bass=('eighth', 0.65), drums=('drive', 0.85))),
        (n0r, 92, 'dark', dict(pad=0.5, att=0.6, cut=1800, trem=0.6, choir=0.35, pulse=0.5, arp=0.3, drums=('build', 0.8), bass=('drone', 0.55))),
        (92, st - 0.3, ['Ab', 'Bb', 'G', 'G'], dict(pad=0.75, att=0.3, cut=3000, trem=0.9, choir=0.5, pulse=0.8, drums=('roll', 1.0), bass=('eighth', 0.7))),
        (st, 102, 'main', dict(pad=0.7, att=0.05, cut=2800, choir=0.6, arp=0.45, bass=('eighth', 0.75), drums=('full', 1.0))),
        (102, 107.35, 'lift', dict(pad=0.42, att=0.4, cut=2200, piano=('ost', 0.5), bell=0.45, drums=('light', 0.7), bass=('drone', 0.45))),
        (107.35, 112, ['Ab', 'Bb', 'Cm'], dict(pad=0.4, att=0.4, cut=1800, piano=('chords', 0.45), drums=('light', 0.55), bass=('drone', 0.4))),
        # 03 铺路的人
        (112, 122, 'tender', dict(pad=0.14, att=2.0, cut=1000, piano=('sparse', 0.6))),
        (122, 134, 'tender', dict(pad=0.3, att=1.2, cut=1300, piano=('arp', 0.5), bass=('drone', 0.35))),
        (134, 140.75, 'tender', dict(pad=0.38, att=0.8, cut=1500, piano=('arp', 0.52), bass=('drone', 0.4), choir=0.15)),
        (140.75, 148, ['Fm', 'Ab', 'Eb', 'G'], dict(pad=0.55, att=1.0, cut=1900, piano=('mel', 0.55), mel='swell', choir=0.25, bass=('drone', 0.45))),
        (148, 160.6, 'tense', dict(pad=0.28, att=0.8, cut=1200, pulse=0.32, piano=('sparse', 0.4), bass=('drone', 0.4), drums=('heart', 0.6))),
        (160.6, 168, 'tender', dict(pad=0.6, att=0.8, cut=2000, piano=('mel', 0.6), mel='tender', choir=0.35, bass=('drone', 0.5))),
        # 04 外力
        (168, 175.2, ['Cm', 'Db'], dict(pad=0.25, att=1.0, cut=1100, bell=0.3)),
        (175.2, a('l2', 3), 'tense', dict(pad=0.3, att=0.6, cut=1300, pulse=0.45, pizz=('e', 0.38), bass=('drone', 0.4))),
        (a('l2', 3), tOffP, 'tense', dict(pad=0.55, att=0.3, cut=2400, trem=0.7, pulse=0.7, drums=('drive', 0.8), bass=('eighth', 0.6))),
        (tOffP + 0.1, 191.94, ['Cm'], dict(pad=0.18, att=1.5, cut=700, bass=('sub', 0.4))),
        (191.94, 202, ['Ab', 'Eb', 'Fm', 'G'], dict(pad=0.3, att=0.8, cut=1300, piano=('sparse', 0.45), bass=('drone', 0.35))),
        (202, 212, 'main', dict(pad=0.28, att=0.6, cut=1400, pizz=('q', 0.45), bell=0.25, drums=('light', 0.5), bass=('drone', 0.4))),
        # 05 错位
        (212, 220.4, 'solemn', dict(pad=0.35, att=1.2, cut=1300, choir=0.5, bell=0.35, bass=('drone', 0.45))),
        (220.6, n1m, 'solemn', dict(pad=0.5, att=0.2, cut=1800, choir=0.65, drums=('taiko', 0.6), bass=('drone', 0.55))),
        (n1m, 237.9, 'main', dict(pad=0.35, att=0.5, cut=1600, piano=('chords', 0.5), drums=('light', 0.6), bass=('drone', 0.4))),
        (237.9, tSo - 0.25, 'tense', dict(pad=0.5, att=0.3, cut=2200, trem=0.7, pulse=0.5, drums=('build', 0.8), bass=('eighth', 0.55))),
        (tSo, 248, ['Fm', 'G'], dict(pad=0.5, att=0.05, cut=1800, choir=0.3, bass=('drone', 0.5))),
        (248, 256.4, 'lift', dict(pad=0.3, att=0.5, cut=1800, piano=('ost', 0.5), pizz=('e', 0.42), drums=('light', 0.65), bass=('drone', 0.4))),
        (256.4, 262, 'main', dict(pad=0.75, att=0.3, cut=3000, trem=0.6, choir=0.5, pulse=0.6, drums=('full', 0.9), bass=('eighth', 0.7))),
        # 06 章程
        (262, 269, ['Cm', 'Ab'], dict(pad=0.2, att=0.8, cut=1200, pizz=('q', 0.4), bell=0.3)),
        (269, tNoB - 0.4, 'main', dict(pad=0.25, att=0.6, cut=1400, pizz=('e', 0.42), piano=('sparse', 0.4), drums=('light', 0.45), bass=('drone', 0.35))),
        (tNoB, 284.66, ['Ab', 'Ab'], dict(pad=0.25, att=0.05, cut=1200, bass=('sub', 0.4))),
        (284.66, 294.1, 'lift', dict(pad=0.45, att=0.6, cut=2000, piano=('ost', 0.5), bell=0.35, drums=('light', 0.6), bass=('drone', 0.45))),
        (294.1, 298, 'lift', dict(pad=0.6, att=0.3, cut=2400, choir=0.4, piano=('mel', 0.55), mel='hope', drums=('drive', 0.6), bass=('eighth', 0.55))),
        # 07 奖章
        (298, tName - 0.3, 'final', dict(pad=0.55, att=0.5, cut=2200, piano=('ost', 0.5), choir=0.35, drums=('build', 0.75), bass=('eighth', 0.6))),
        (tName, n0f, 'final', dict(pad=0.78, att=0.05, cut=3000, choir=0.7, piano=('mel', 0.55), mel='final', bell=0.4, drums=('full', 1.0), bass=('eighth', 0.75))),
        (n0f + 0.6, tUs - 0.4, ['Cm', 'Cm', 'Cm'], dict(pad=0.28, att=0.5, cut=1000, arp=0.55, bass=('sub', 0.5))),
        (tUs, tUs + 3.2, ['C', 'C'], dict(pad=0.95, att=0.05, cut=3200, choir=0.95, bass=('drone', 0.7))),
        (tUs + 3.2, DUR + 2, ['Abmaj7', 'Cadd9', 'Abmaj7', 'C'], dict(pad=0.5, att=1.0, cut=1800, choir=0.35, piano=('sparse', 0.5), bell=0.3, bass=('drone', 0.4))),
    ]
    ev = [('braam', ob, 'Cm', 1.0), ('taiko', ob, 1.0), ('crash', ob, 0.8),
          ('taiko', a('t1') + 0.28, 0.7), ('braam', t1h, 'Cm', 1.0), ('taiko', t1h, 1.0), ('crash', t1h, 0.6),
          ('taiko', a('t2') + 0.28, 0.6), ('braam', tq, 'Ab', 0.9), ('taiko', tq, 0.9),
          ('braam', eb, 'Cm', 1.0), ('taiko', eb, 1.0), ('crash', eb, 0.8),
          ('timp', tStampE, 36, 0.8), ('taiko', tStampE, 0.6),
          ('braam', st, 'Cm', 1.1), ('taiko', st, 1.1), ('crash', st, 0.9),
          ('taiko', tNo, 0.8), ('timp', tNo, 43, 0.6),
          ('braam', 220.6, 'Cm', 0.8), ('taiko', 220.6, 0.8),
          ('braam', tSo, 'Db', 0.9), ('taiko', tSo, 1.0),
          ('braam', tNoB, 'Ab', 0.8), ('taiko', tNoB, 0.9), ('timp', tNoB, 44, 0.6),
          ('braam', tName, 'Ab', 1.0), ('taiko', tName, 1.0), ('crash', tName, 0.8),
          ('braam', tUs, 'C', 1.2), ('taiko', tUs, 1.2), ('crash', tUs, 1.0), ('timp', tUs, 36, 0.9)]
    # 预冲击静音：(起, 止)
    sil = [(ob - 0.4, ob), (eb - 0.3, eb), (st - 0.3, st), (tSo - 0.25, tSo), (tNoB - 0.4, tNoB), (tName - 0.3, tName), (tUs - 0.4, tUs),
           (tOffP, tOffP + 0.1)]
    return secs, ev, sil, dict(tOffP=tOffP)


def chord_of(prog, k):
    p = PROG[prog] if isinstance(prog, str) else prog
    return p[k % len(p)]


def render():
    secs, ev, sil, K = plan()
    st = {k: np.zeros((N, 2)) for k in ('orch', 'keys', 'synth', 'bass', 'drums', 'fx')}
    for (s0, s1, prog, P) in secs:
        s1 = min(s1, DUR + 2)
        if s1 <= s0 + 0.05: continue
        b0 = math.floor(s0 / BAR + 1e-6)
        nb = math.ceil((s1 - b0 * BAR) / BAR - 1e-6)
        for bi in range(nb):
            bt = (b0 + bi) * BAR
            g0, g1 = max(bt, s0), min(bt + BAR, s1)
            if g1 - g0 < 0.05: continue
            ch = chord_of(prog, bi); root, vs = CH[ch]
            last = bi == nb - 1
            # 弦乐：每段首小节用 att，其后连贯（短起音）
            if P.get('pad'):
                att = P.get('att', 0.6) if bi == 0 else 0.25
                strings(st['orch'], vs + [root + 12], g0, g1 - g0, P['pad'], P.get('cut', 1800), att, 0.9, P.get('trem', 0))
            if P.get('choir'):
                choir(st['orch'], [vs[0] + 12 if vs[0] < 58 else vs[0], vs[1] + 12, vs[2] + 12, vs[3] + 12][:4], g0, g1 - g0, P['choir'], vowel=(b0 + bi) % 2, att=0.6 if bi == 0 else 0.3)
            if P.get('bass'):
                mode, amp = P['bass']; bass_seg(st['bass'], root, g0, g1 - g0, amp, mode)
            # 以下按拍/半拍/十六分触发，只取段内的时刻
            inside = lambda tt: s0 - 1e-4 <= tt < s1 - 0.02
            if P.get('piano'):
                mode, vel = P['piano']
                top = [v + 12 for v in vs]
                if mode == 'sparse' and inside(bt):
                    for j, m in enumerate([root + 12] + vs): piano(st['keys'], m, bt + j * 0.025, BAR * 0.98, vel * (0.8 if j else 0.9))
                elif mode == 'chords':
                    for h in (0, 2):
                        tt = bt + h * BEAT
                        if inside(tt):
                            for j, m in enumerate([root + 12] + vs): piano(st['keys'], m, tt + j * 0.012, BEAT * 1.9, vel * (0.85 if h else 1))
                elif mode == 'ost':
                    pat = [0, 2, 1, 3, 2, 1, 3, 2]
                    if inside(bt): piano(st['keys'], root + 12, bt, BAR, vel * 0.8)
                    for s in range(8):
                        tt = bt + s * BEAT / 2
                        if inside(tt): piano(st['keys'], top[pat[s]] - (12 if top[pat[s]] > 80 else 0), tt, BEAT * 0.9, vel * (0.95 if s % 2 == 0 else 0.72))
                elif mode == 'arp':
                    pat = [root + 12, vs[0], vs[1], vs[2], vs[3], vs[2], vs[1], vs[0]]
                    for s in range(8):
                        tt = bt + s * BEAT / 2
                        if inside(tt): piano(st['keys'], pat[s], tt, BEAT * 1.6, vel * (0.95 if s == 0 else 0.7))
                elif mode == 'mel':
                    if inside(bt):
                        for j, m in enumerate([root + 12] + vs[:3]): piano(st['keys'], m, bt + j * 0.02, BAR * 0.98, vel * 0.55)
                    mel = MEL[P.get('mel', 'tender')][bi % 4]; tt = bt
                    for (m, bb) in mel:
                        if inside(tt): piano(st['keys'], m, tt, bb * BEAT * 0.95, vel * 1.25); strings(st['orch'], [m - 12], tt, bb * BEAT * 0.95, 0.55 * P.get('pad', 0.4), 2400, 0.12, 0.5)
                        tt += bb * BEAT
            if P.get('pizz'):
                mode, vel = P['pizz']
                seq = [root + 12, root + 19, root + 24, root + 19] if mode == 'q' else [root + 12, vs[0], root + 19, vs[1], root + 24, vs[1], root + 19, vs[0]]
                step = BEAT if mode == 'q' else BEAT / 2
                for s in range(len(seq)):
                    tt = bt + s * step
                    if inside(tt): pizz(st['keys'], seq[s], tt, vel * (1 if s % 2 == 0 else 0.75), pan=-0.3 + 0.6 * (s % 2))
            if P.get('bell'):
                for h, g in ((0, 1.0), (2.5, 0.55)):
                    tt = bt + h * BEAT
                    if inside(tt): bell(st['keys'], vs[3] + 12 - (0 if h == 0 else 5), tt, P['bell'] * g)
            if P.get('pulse'):
                cyc = [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 12, 0, 3, 0, 7, 12]
                for s in range(16):
                    tt = bt + s * BEAT / 4
                    if not inside(tt): continue
                    prog_q = (tt - s0) / max(0.5, s1 - s0)
                    pulse_note(st['synth'], root + 24 + cyc[s], tt, P['pulse'] * (1 if s % 4 == 0 else 0.7), 800 + 3200 * prog_q)
            if P.get('arp'):
                seq = [vs[0] + 12, vs[1] + 12, vs[2] + 12, vs[3] + 12, vs[2] + 24, vs[3] + 12, vs[1] + 24, vs[2] + 12]
                for s in range(16):
                    tt = bt + s * BEAT / 4
                    if inside(tt): arp_note(st['synth'], seq[s % 8], tt, P['arp'] * (1 if s % 4 == 0 else 0.7), 0.5 * math.sin(s * 0.9 + bi))
            if P.get('drums'):
                kind, I = P['drums']
                if inside(bt) or (bt < s0 and s0 - bt < 0.05):
                    drums_bar(st['drums'], st['fx'], max(bt, s0), kind, I, bi, last)
    for e in ev:
        if e[0] == 'braam': braam(st['fx'], e[1], e[2], e[3])
        elif e[0] == 'taiko': put(st['fx'], taiko(), e[1], gain=0.8 * e[2]); put(st['fx'], taiko(0.7), e[1] + 0.005, gain=0.5 * e[2])
        elif e[0] == 'crash': put(st['fx'], crash(), e[1], gain=e[2])
        elif e[0] == 'timp': put(st['fx'], timp(e[2]), e[1], gain=0.8 * e[3])
    # 电源断开：音乐音高下坠（对 orch/synth 做变速重采样的简化：低通快速关闭）
    t = np.arange(N) / SR
    auto = np.ones(N)
    for (s0, s1) in sil:
        w = np.clip((t - (s0 - 0.06)) / 0.06, 0, 1) * (t < s1)
        auto *= 1 - w
    tp = K['tOffP']
    pd = np.clip((t - tp) / 0.45, 0, 1) * (t < tp + 1.6)
    return st, auto, pd


if __name__ == '__main__':
    import time
    t0 = time.time(); st, auto, pd = render()
    for k, v in st.items(): print(k, f'{20 * math.log10(np.sqrt(np.mean(v ** 2)) + 1e-9):.1f} dBFS rms', f'peak {np.abs(v).max():.2f}')
    print(f'{time.time() - t0:.1f}s')
