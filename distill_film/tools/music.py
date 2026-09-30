# 原创配乐：D 小调 / 120 BPM，电影预告风 × 电子（Zimmer × Tron）。
# 纯合成，仅 numpy + scipy，固定随机种子；所有时刻取自 script/timeline.json（与画面同源）。
# 分轨：sub / bass / drums / pads / keys / fx / verb（mix.py 负责旁白闪避与母带）。
import math
import os
import sys
from functools import lru_cache

import numpy as np
from scipy import signal as sg

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import P, load_json, log, utf8_stdio  # noqa: E402,F401

SR = 48000
SEED = 20260930
TAU = 2.0 * math.pi


# ====================================================================== 基础
def nsamp(sec):
    return int(round(sec * SR))


def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=np.float64) - 69.0) / 12.0)


def dbg(d):
    return 10.0 ** (d / 20.0)


def tt(n):
    return np.arange(n, dtype=np.float64) / SR


def panlr(p):
    a = (min(1.0, max(-1.0, p)) + 1.0) * math.pi / 4.0
    return math.cos(a) * math.sqrt(2.0), math.sin(a) * math.sqrt(2.0)


def fade(y, fin=0.002, fout=0.01):
    """原地淡入淡出（升余弦），保证任何音符首尾无爆音。"""
    n = y.shape[-1]
    a, b = min(n // 2, nsamp(fin)), min(n // 2, nsamp(fout))
    if a > 1:
        y[..., :a] *= np.sin(np.linspace(0.0, math.pi / 2, a)) ** 2
    if b > 1:
        y[..., -b:] *= np.cos(np.linspace(0.0, math.pi / 2, b)) ** 2
    return y


def norm(y, peak=0.9):
    m = float(np.max(np.abs(y))) if len(y) else 0.0
    return y * (peak / m) if m > 1e-9 else y


def ro(y):
    y = np.ascontiguousarray(y)
    y.flags.writeable = False
    return y


# ====================================================================== 滤波
@lru_cache(maxsize=1024)
def _sos(kind, f, order):
    f = min(max(float(f), 5.0), SR * 0.47)
    return sg.butter(order, f / (SR / 2), kind, output='sos')


@lru_cache(maxsize=256)
def _sosbp(lo, hi, order):
    lo, hi = min(max(float(lo), 5.0), SR * 0.44), min(max(float(hi), 10.0), SR * 0.47)
    return sg.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band', output='sos')


def lp(x, f, order=2):
    return sg.sosfilt(_sos('low', f, order), x, axis=-1)


def hp(x, f, order=2):
    return sg.sosfilt(_sos('high', f, order), x, axis=-1)


def bp(x, lo, hi, order=2):
    return sg.sosfilt(_sosbp(lo, hi, order), x, axis=-1)


def rbj(kind, f, q=0.7071, gain_db=0.0):
    f = min(max(float(f), 5.0), SR * 0.47)
    w = TAU * f / SR
    cw, sw = math.cos(w), math.sin(w)
    al = sw / (2.0 * q)
    A = 10.0 ** (gain_db / 40.0)
    if kind == 'lp':
        b, a = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2], [1 + al, -2 * cw, 1 - al]
    elif kind == 'hp':
        b, a = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2], [1 + al, -2 * cw, 1 - al]
    elif kind == 'bp':
        b, a = [al, 0.0, -al], [1 + al, -2 * cw, 1 - al]
    elif kind == 'peak':
        b, a = [1 + al * A, -2 * cw, 1 - al * A], [1 + al / A, -2 * cw, 1 - al / A]
    elif kind in ('hs', 'ls'):
        sA = 2.0 * math.sqrt(A) * al
        if kind == 'hs':
            b = [A * ((A + 1) + (A - 1) * cw + sA), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sA)]
            a = [(A + 1) - (A - 1) * cw + sA, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sA]
        else:
            b = [A * ((A + 1) - (A - 1) * cw + sA), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sA)]
            a = [(A + 1) + (A - 1) * cw + sA, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sA]
    else:
        raise ValueError(kind)
    b, a = np.array(b, dtype=np.float64), np.array(a, dtype=np.float64)
    return b / a[0], a / a[0]


def biq(x, kind, f, q=0.7071, gain_db=0.0):
    b, a = rbj(kind, f, q, gain_db)
    return sg.lfilter(b, a, x, axis=-1)


def sweep(x, kind, fc, q=1.0, block=256):
    """逐块更新系数的时变双二阶（保留状态）；fc 为逐采样截止频率。适合短音效。"""
    n = len(x)
    y = np.empty(n)
    zi = np.zeros(2)
    for i in range(0, n, block):
        j = min(n, i + block)
        b, a = rbj(kind, float(fc[(i + j) // 2]), q)
        y[i:j], zi = sg.lfilter(b, a, x[i:j], zi=zi)
    return y


_MF = np.geomspace(60.0, 15000.0, 12)


def morph_lp(x, fc, order=2):
    """多档低通线性插值的时变低通：无拉链噪声，全向量化。x: (n,) 或 (c,n)，fc: (n,)。"""
    x = np.asarray(x)
    single = x.ndim == 1
    X = x[None] if single else x
    n = X.shape[-1]
    g0 = math.log2(_MF[0])
    st = math.log2(_MF[1] / _MF[0])
    pos = (np.log2(np.clip(fc, _MF[0], _MF[-1])) - g0) / st
    i0 = np.minimum(np.floor(pos).astype(np.intp), len(_MF) - 2)
    fr = pos - i0
    lo, hi = int(i0.min()), int(min(len(_MF) - 1, i0.max() + 1))
    ys = {k: sg.sosfilt(_sos('low', _MF[k], order), X, axis=-1) for k in range(lo, hi + 1)}
    out = np.empty(X.shape, dtype=np.float64)
    idx = np.arange(n)
    stack = np.stack([ys[k] for k in range(lo, hi + 1)])
    for ch in range(X.shape[0]):
        a = stack[i0 - lo, ch, idx]
        b = stack[np.minimum(i0 + 1, hi) - lo, ch, idx]
        out[ch] = a * (1.0 - fr) + b * fr
    return out[0] if single else out


def expcurve(n, f0, f1):
    """从 f0 到 f1 的指数（对数线性）曲线。"""
    return np.exp(np.linspace(math.log(f0), math.log(f1), n))


def drive(x, d):
    return np.tanh(d * x) / math.tanh(d) if d > 1e-6 else x


def onepole(x, fc):
    a = 1.0 - math.exp(-TAU * fc / SR)
    return sg.lfilter([a], [1.0, a - 1.0], x, axis=-1)


# ====================================================================== 振荡器（polyBLEP）
def _ph(f, n, ph0):
    f = np.asarray(f, dtype=np.float64)
    if f.ndim == 0:
        dt = np.full(n, float(f) / SR)
        ph = (ph0 + np.arange(n) * (float(f) / SR)) % 1.0
    else:
        dt = f / SR
        ph = (ph0 + np.cumsum(dt) - dt) % 1.0
    return ph, dt


def _blep(ph, dt):
    y = np.zeros_like(ph)
    m = ph < dt
    if m.any():
        x = ph[m] / dt[m]
        y[m] = 2.0 * x - x * x - 1.0
    m = ph > 1.0 - dt
    if m.any():
        x = (ph[m] - 1.0) / dt[m]
        y[m] = x * x + 2.0 * x + 1.0
    return y


def saw(f, n, ph0=0.0):
    ph, dt = _ph(f, n, ph0)
    return 2.0 * ph - 1.0 - _blep(ph, dt)


def square(f, n, pw=0.5, ph0=0.0):
    ph, dt = _ph(f, n, ph0)
    y = np.where(ph < pw, 1.0, -1.0)
    return y + _blep(ph, dt) - _blep((ph - pw) % 1.0, dt)


def tri(f, n, ph0=0.0):
    ph, _ = _ph(f, n, ph0)
    return 4.0 * np.abs(ph - 0.5) - 1.0


def sine(f, n, ph0=0.0):
    f = np.asarray(f, dtype=np.float64)
    if f.ndim == 0:
        return np.sin(TAU * (ph0 + np.arange(n) * (float(f) / SR)))
    return np.sin(TAU * (ph0 + np.cumsum(f) / SR))


def glide_sine(f0, f1, tau, n, amp_tau=None):
    """指数滑音正弦：频率 f1 + (f0-f1)·exp(-t/tau)，相位取闭式积分（无累积误差）。"""
    t = tt(n)
    ph = TAU * (f1 * t + (f0 - f1) * tau * (1.0 - np.exp(-t / tau)))
    y = np.sin(ph)
    return y * np.exp(-t / amp_tau) if amp_tau else y


# ====================================================================== 混响 / 回声
def make_ir(rt60, pre=0.0, length=None, seed=1, damp=0.45, lf=120.0, hf=9000.0, bloom=0.02):
    """合成立体声脉冲响应：三频段指数衰减噪声（高频衰减更快）+ 缓起 + 低/高切。"""
    rng = np.random.default_rng(seed)
    n = nsamp(length or rt60 * 1.15)
    t = tt(n)
    k = 6.9078 / rt60
    ir = np.zeros((2, n))
    for ch in range(2):
        x = rng.standard_normal(n)
        lo, hi = lp(x, 350.0), hp(x, 3500.0)
        mid = x - lo - hi
        y = lo * np.exp(-t * k / 1.1) + mid * np.exp(-t * k) + hi * np.exp(-t * k / max(damp, 0.05))
        y *= 1.0 - np.exp(-t / bloom)
        ir[ch] = lp(hp(y, lf), hf)
    if pre > 0:
        ir = np.concatenate([np.zeros((2, nsamp(pre))), ir], axis=1)
    ir /= math.sqrt(float(np.mean(np.sum(ir ** 2, axis=1))))
    return ir.astype(np.float32)


def reverb(x, ir, n=None):
    """单声道发送 → 立体声湿信号（FFT 卷积）。"""
    n = len(x) if n is None else n
    x = np.asarray(x, dtype=np.float32)
    out = np.empty((2, n), np.float32)
    for ch in range(2):
        out[ch] = sg.oaconvolve(x, ir[ch], mode='full')[:n]
    return out


def pingpong(x, delay, fb=0.45, taps=6, lpf=4200.0):
    """乒乓回声：每次重复再做一次单极低通，奇偶次交替左右。返回 (2, n + taps*d)。"""
    n, d = len(x), nsamp(delay)
    out = np.zeros((2, n + d * taps), np.float32)
    s = np.asarray(x, dtype=np.float32)
    g = 1.0
    for k in range(1, taps + 1):
        s = onepole(s, lpf).astype(np.float32)
        g *= fb
        out[k % 2, k * d:k * d + n] += s * np.float32(g)
    return out


# ====================================================================== 乐器：打击
@lru_cache(maxsize=None)
def kick(kind='punch'):
    f0, f1, tp, ta, dur, click, drv = {
        'soft': (105, 47, 0.030, 0.17, 0.50, 0.10, 1.0),
        'punch': (185, 50, 0.018, 0.23, 0.55, 0.32, 1.7),
        'big': (240, 42, 0.040, 0.52, 1.40, 0.38, 1.9),
        'long': (135, 37, 0.055, 0.85, 1.90, 0.20, 1.5),
    }[kind]
    n = nsamp(dur)
    t = tt(n)
    y = glide_sine(f0, f1, tp, n, ta)
    rng = np.random.default_rng(11)
    cl = bp(rng.standard_normal(n), 1800, 7000) * np.exp(-t / 0.0025)
    y = drive(y + click * cl, drv)
    return ro(norm(fade(y, 0.0004, 0.012)))


@lru_cache(maxsize=None)
def snare(kind='tight', tune=1.0):
    sp = {
        'tight': dict(body=195, tb=0.055, lo=1800, hi=9000, tn=0.11, dur=0.45, ba=0.75),
        'big': dict(body=150, tb=0.11, lo=650, hi=9500, tn=0.36, dur=1.4, ba=0.9),
        'roll': dict(body=215, tb=0.035, lo=2200, hi=9500, tn=0.07, dur=0.3, ba=0.6),
    }[kind]
    n = nsamp(sp['dur'])
    t = tt(n)
    rng = np.random.default_rng(21)
    fb = sp['body'] * tune * (1.0 + 0.7 * np.exp(-t / 0.012))
    body = np.sin(TAU * np.cumsum(fb) / SR) * np.exp(-t / sp['tb'])
    nz = bp(rng.standard_normal(n), sp['lo'], sp['hi']) * np.exp(-t / sp['tn'])
    snap = hp(rng.standard_normal(n), 4500) * np.exp(-t / 0.004)
    y = sp['ba'] * body + nz + 0.5 * snap
    return ro(norm(fade(drive(y, 1.3), 0.0004, 0.02)))


@lru_cache(maxsize=None)
def clap(kind='std'):
    n = nsamp(0.55 if kind == 'std' else 1.0)
    t = tt(n)
    rng = np.random.default_rng(31)
    nz = bp(rng.standard_normal(n), 900, 3800)
    y = np.zeros(n)
    for k, (off, a) in enumerate(((0.0, 0.8), (0.0095, 0.9), (0.019, 1.0))):
        i = nsamp(off)
        y[i:] += a * nz[:n - i] * np.exp(-t[:n - i] / 0.007)
    tail = bp(rng.standard_normal(n), 1100, 3200) * np.exp(-np.maximum(t - 0.03, 0) / (0.10 if kind == 'std' else 0.22))
    y += 0.85 * tail * (t > 0.028)
    return ro(norm(fade(y, 0.0004, 0.02)))


@lru_cache(maxsize=None)
def hat(kind='c', v=0, fc=0.0):
    rng = np.random.default_rng(100 + v)
    if kind == 'c':
        n = nsamp(0.14)
        t = tt(n)
        y = lp(hp(rng.standard_normal(n), 7200 + 300 * v, 4), 15500) * np.exp(-t / 0.019)
    elif kind == 'o':
        n = nsamp(0.7)
        t = tt(n)
        y = lp(hp(rng.standard_normal(n), 6500, 4), 15500) * (0.6 * np.exp(-t / 0.05) + 0.4 * np.exp(-t / 0.2))
    elif kind == 'sh':
        n = nsamp(0.09)
        t = tt(n)
        y = bp(rng.standard_normal(n), 4200, 11000) * np.minimum(1.0, t / 0.006) * np.exp(-t / 0.038)
    else:  # 'tk' 滤波小滴答，fc 为中心频率
        n = nsamp(0.06)
        t = tt(n)
        c = fc or 4500.0
        y = bp(rng.standard_normal(n), c * 0.6, min(c * 1.6, 15000)) * np.exp(-t / 0.007)
    return ro(norm(fade(y, 0.0003, 0.008)))


@lru_cache(maxsize=None)
def tom(midi, kind='taiko'):
    f = float(mtof(midi))
    dur, ta = (1.6, 0.42) if kind == 'taiko' else (0.9, 0.22)
    n = nsamp(dur)
    t = tt(n)
    ph = TAU * (f * t + 0.55 * f * 0.05 * (1.0 - np.exp(-t / 0.05)))
    rng = np.random.default_rng(41 + int(midi))
    y = np.sin(ph) * np.exp(-t / ta)
    y += 0.32 * np.sin(1.59 * ph + 0.4) * np.exp(-t / (ta * 0.55)) + 0.14 * np.sin(2.14 * ph + 1.1) * np.exp(-t / (ta * 0.35))
    y += 0.55 * lp(rng.standard_normal(n), 1100) * np.exp(-t / 0.022)
    return ro(norm(fade(drive(y, 1.5), 0.0005, 0.03)))


@lru_cache(maxsize=None)
def crash(dur=4.5, seed=3):
    n = nsamp(dur)
    t = tt(n)
    rng = np.random.default_rng(seed)
    out = np.zeros((2, n))
    env = (0.55 * np.exp(-t / 0.30) + 0.45 * np.exp(-t / (dur * 0.33))) * np.minimum(1.0, t / 0.002)
    for ch in range(2):
        x = hp(rng.standard_normal(n), 3000, 3)
        x += 0.5 * hp(rng.standard_normal(n), 8500, 2) * np.exp(-t / (dur * 0.2))
        out[ch] = lp(x, 16000) * env
    return ro(norm(fade(out, 0.0005, 0.08), 0.85))


@lru_cache(maxsize=None)
def heart(kind='lub'):
    n = nsamp(0.55)
    t = tt(n)
    rng = np.random.default_rng(51)
    if kind == 'lub':
        y = glide_sine(84, 40, 0.028, n, 0.12)
    else:
        y = 0.75 * glide_sine(96, 47, 0.022, n, 0.085)
    y = drive(y, 2.2) + 0.25 * lp(rng.standard_normal(n), 180) * np.exp(-t / 0.018)
    return ro(norm(fade(y, 0.001, 0.05)))


# ====================================================================== 乐器：低音 / 音色
def sub_note(midi, dur, att=0.012, rel=0.09, harm=0.2):
    n = nsamp(dur + rel)
    t = tt(n)
    f = float(mtof(midi))
    y = np.sin(TAU * f * t) + harm * np.sin(TAU * 2 * f * t + 0.6)
    env = np.interp(t, [0, att, dur, dur + rel], [0, 1, 1, 0])
    return y * env * 0.85


@lru_cache(maxsize=None)
def bass_note(midi, dur, kind='saw', cut=900.0, tau=0.12, drv=1.0):
    n = nsamp(dur + 0.03)
    t = tt(n)
    f = float(mtof(midi))
    if kind == 'pulse':
        x = 0.5 * square(f, n, 0.3) + 0.5 * saw(f * 1.003, n, 0.2)
    else:
        x = 0.6 * saw(f, n) + 0.4 * square(f, n)
    e = np.exp(-t / tau)
    y = lp(x, cut * 0.4) * (1 - e) + lp(x, cut * 2.6) * e
    y = y * 0.7 + 0.8 * np.sin(TAU * f * t)
    y = drive(y * 0.8, drv) if drv > 1 else y
    y = y - y.mean()
    env = np.interp(t, [0, 0.004, max(dur - 0.02, 0.01), dur + 0.03], [0, 1, 1, 0])
    return ro(norm(y * env, 0.8))


@lru_cache(maxsize=None)
def pluck_note(midi, dur=0.45, tau=0.16, bright=1.0, kind='saw'):
    n = nsamp(dur)
    t = tt(n)
    f = float(mtof(midi))
    if kind == 'saw':
        x = 0.5 * (saw(f, n) + saw(f * 1.004, n, 0.3))
    elif kind == 'sq':
        x = 0.6 * square(f, n, 0.4) + 0.4 * saw(f * 0.998, n, 0.1)
    else:
        x = tri(f, n)
    ef = np.exp(-t / (0.55 * tau))
    y = lp(x, 450 + 350 * bright) * (1 - ef) + lp(x, 700 + 6500 * bright) * ef
    y = y - y.mean()
    y *= np.minimum(1.0, t / 0.002) * np.exp(-t / tau)
    return ro(norm(fade(y, 0.0005, 0.02), 0.7))


@lru_cache(maxsize=None)
def piano_note(midi, dur=3.0, vel=0.8):
    """加性钢琴：非谐泛音 + 双弦微失谐 + 击槌位置梳状谱 + 高泛音更快衰减。"""
    n = nsamp(dur)
    t = tt(n)
    f0 = float(mtof(midi))
    kmax = int(min(18, (0.45 * SR) / f0))
    B = 0.00012 * (1 + max(0, 60 - midi) * 0.08)
    rng = np.random.default_rng(61 + int(midi))
    y = np.zeros(n)
    t60 = 6.0 * (0.92 ** max(0, (midi - 48) / 6.0)) + 1.0
    for k in range(1, kmax + 1):
        fk = k * f0 * math.sqrt(1 + B * k * k)
        ak = (1.0 / k ** 0.85) * abs(math.sin(math.pi * k * 0.125)) ** 0.6 * (vel ** (0.4 + 0.25 * k / kmax * 2))
        tau = (t60 / 6.9) / (1 + 0.55 * (k - 1) ** 0.9)
        d = 0.0004 * k
        y += ak * np.exp(-t / tau) * 0.5 * (np.sin(TAU * fk * t + rng.uniform(0, 6.28)) + np.sin(TAU * fk * (1 + d) * t + rng.uniform(0, 6.28)))
    ham = lp(rng.standard_normal(n), 2200) * np.exp(-t / 0.008) * 0.08 * vel
    y = (y + ham) * np.minimum(1.0, t / 0.0015)
    return ro(norm(fade(y, 0.0003, 0.15), 0.6))


@lru_cache(maxsize=None)
def bell_note(midi, dur=3.0, kind='bell'):
    n = nsamp(dur)
    t = tt(n)
    f0 = float(mtof(midi))
    rng = np.random.default_rng(71 + int(midi))
    if kind == 'glock':
        parts = [(1.0, 1.0, 1.4), (2.756, 0.55, 0.8), (5.404, 0.28, 0.5), (8.933, 0.12, 0.3)]
    else:  # 暖钟/钟琴：带小三度泛音
        parts = [(0.5, 0.25, 2.4), (1.0, 1.0, 2.2), (1.19, 0.35, 1.6), (1.5, 0.22, 1.4), (2.0, 0.5, 1.2), (2.74, 0.25, 0.8), (4.07, 0.1, 0.45)]
    y = np.zeros(n)
    for r, a, tau in parts:
        fk = f0 * r
        if fk > 0.45 * SR:
            continue
        y += a * np.sin(TAU * fk * t + rng.uniform(0, 6.28)) * np.exp(-t / (tau * (1.0 if dur > 2 else 0.7)))
    y *= np.minimum(1.0, t / 0.0008)
    return ro(norm(fade(y, 0.0002, 0.2), 0.6))


# ---------------------------------------------------------------- 铺底 / 合唱 / 弦 / 铜管
def pad_chord(midis, dur, att=0.8, rel=1.0, cut=(900.0, 1600.0), nv=4, det=9.0, width=0.85,
              seed=0, vib=1.0, vib_hz=0.0, vib_c=0.0, air=0.0, bright=1.0):
    """失谐锯齿叠层铺底（立体声 (2,n)）。cut：起止截止频率（指数插值）；vib_hz>0 时加弦乐式颤音。"""
    n = nsamp(dur + rel)
    t = tt(n)
    rng = np.random.default_rng(1000 + seed)
    L, R = np.zeros(n), np.zeros(n)
    for m in midis:
        f0 = float(mtof(m))
        for v in range(nv):
            u = (v / max(nv - 1, 1)) * 2.0 - 1.0
            cents = det * u + rng.uniform(-1.5, 1.5) + 2.2 * vib * np.sin(TAU * (0.09 + 0.05 * v) * t + rng.uniform(0, 6.28))
            if vib_hz > 0:
                cents = cents + vib_c * np.sin(TAU * (vib_hz + 0.25 * v) * t + rng.uniform(0, 6.28)) * np.minimum(1.0, t / 0.8)
            s = saw(f0 * 2.0 ** (cents / 1200.0), n, rng.random())
            wl, wr = 0.5 - 0.5 * u * width, 0.5 + 0.5 * u * width
            L += s * wl
            R += s * wr
    sc = 1.0 / math.sqrt(len(midis) * nv)
    fc = expcurve(n, cut[0], cut[1])
    Y = morph_lp(np.stack([L, R]) * sc * 0.7, fc)
    if air > 0:
        nz = hp(rng.standard_normal((2, n)), 3500 / bright, 2) * (0.6 + 0.4 * np.sin(TAU * 0.13 * t))
        Y = Y + air * 0.06 * nz
    env = np.interp(t, [0, att, dur, dur + rel], [0, 1, 1, 0])
    env = np.sin(env * math.pi / 2) ** 1.5
    return Y * env


FORMANT = {
    'ah': ((730, 0.0, 90), (1090, -4.0, 110), (2440, -11.0, 140), (3400, -16.0, 160)),
    'oh': ((520, 0.0, 80), (850, -5.0, 90), (2400, -16.0, 130), (3300, -22.0, 150)),
    'oo': ((330, 0.0, 70), (720, -9.0, 90), (2350, -20.0, 130), (3300, -26.0, 150)),
}


def choir_chord(midis, dur, att=1.2, rel=1.5, vowel='ah', nv=3, seed=0, vib_hz=5.3, vib_depth=0.011, breath=0.05):
    """共振峰合唱：锯齿声源 + 颤音 + 失谐多声部，经 4 个共振峰带通（'ah' / 'oh' / 'oo'）。"""
    n = nsamp(dur + rel)
    t = tt(n)
    rng = np.random.default_rng(2000 + seed)
    src = np.zeros((2, n))
    for m in midis:
        f0 = float(mtof(m))
        for v in range(nv):
            det = rng.uniform(-12, 12)
            vr = vib_hz * rng.uniform(0.9, 1.12)
            vib = 1.0 + vib_depth * np.minimum(1.0, t / 1.0) * np.sin(TAU * vr * t + rng.uniform(0, 6.28))
            s = saw(f0 * 2.0 ** (det / 1200.0) * vib, n, rng.random())
            pos = rng.uniform(-1, 1)
            src[0] += s * (0.5 - 0.5 * pos)
            src[1] += s * (0.5 + 0.5 * pos)
    src = onepole(src, 2600.0)
    src += breath * hp(rng.standard_normal((2, n)), 1500)
    src /= math.sqrt(len(midis) * nv)
    out = np.zeros((2, n))
    for fq, g, bw in FORMANT[vowel]:
        out += dbg(g) * biq(src, 'bp', fq, fq / bw)
    env = np.interp(t, [0, att, dur, dur + rel], [0, 1, 1, 0])
    env = np.sin(env * math.pi / 2) ** 1.6
    return out * env * 3.0


def braam(midis, dur=5.0, bright=1.0, dist=2.2, seed=0, sub=True, bend=0.0):
    """合成铜管 BRAAM：每音 7 锯齿失谐叠层 + 滤波器瞬间打开后回落 + 饱和。立体声 (2,n)。"""
    n = nsamp(dur)
    t = tt(n)
    rng = np.random.default_rng(3000 + seed)
    nv = 7
    L, R = np.zeros(n), np.zeros(n)
    for m in midis:
        f0 = float(mtof(m))
        for v in range(nv):
            u = (v / (nv - 1)) * 2.0 - 1.0
            cents = 17.0 * u + rng.uniform(-3, 3) + 3.0 * np.sin(TAU * rng.uniform(0.2, 0.6) * t + rng.uniform(0, 6.28))
            fl = f0 * 2.0 ** (cents / 1200.0) * (1.0 + bend * np.exp(-t / 0.35))
            s = saw(fl, n, rng.uniform(0.0, 0.2))
            L += s * (0.5 - 0.45 * u)
            R += s * (0.5 + 0.45 * u)
    sc = 1.0 / math.sqrt(len(midis) * nv) * 2.4
    fc = 380.0 + (900.0 + 4300.0 * bright) * np.exp(-t / 0.55) + 500.0 * bright * np.exp(-t / 2.4)
    Y = morph_lp(np.stack([L, R]) * sc, fc)
    Y = drive(Y * 0.9, dist)
    if sub:
        f0 = float(mtof(min(midis) - 12))
        Y = Y + 0.55 * np.sin(TAU * f0 * t) * np.exp(-t / 2.2)
    env = np.minimum(1.0, t / 0.010) * (0.40 + 0.60 * np.exp(-t / 0.9)) * np.exp(-t / (dur * 0.42))
    env = env * np.minimum(1.0, (dur - t) / 0.4)
    return lp(Y * env, 7800)


def brass_swell(midis, dur=3.0, att=0.12, rel=0.8, cut=(260.0, 700.0), seed=0):
    """低沉铜管长音（深铜管一击）：3 锯齿 + 低通，较慢起音。"""
    n = nsamp(dur + rel)
    t = tt(n)
    rng = np.random.default_rng(4000 + seed)
    Y = np.zeros((2, n))
    for m in midis:
        f0 = float(mtof(m))
        for v in range(3):
            u = v - 1.0
            s = saw(f0 * 2.0 ** (u * 7 / 1200.0), n, rng.random())
            Y[0] += s * (0.5 - 0.25 * u)
            Y[1] += s * (0.5 + 0.25 * u)
    Y = morph_lp(Y / math.sqrt(len(midis) * 3) * 2.0, expcurve(n, cut[0], cut[1]))
    env = np.interp(t, [0, att, att + 0.25, dur, dur + rel], [0, 1, 0.75, 0.25, 0])
    return drive(Y * env, 1.6)


@lru_cache(maxsize=None)
def rev_crash(dur=2.5):
    """反向镲：渐强到末尾骤停（作 BRAAM 前的吸气）。"""
    y = np.array(crash(dur, 7)[:, ::-1])
    y *= np.linspace(0.0, 1.0, y.shape[-1]) ** 1.3
    return ro(fade(y, 0.002, 0.02))


@lru_cache(maxsize=None)
def stab_note(midi, dur=0.14, bright=1.0):
    """警报感短促和弦音：方波 + 锯齿，饱和。"""
    n = nsamp(dur)
    t = tt(n)
    f = float(mtof(midi))
    x = lp(0.6 * square(f, n) + 0.5 * saw(f * 1.006, n, 0.3), 1600 + 2200 * bright)
    x = drive(x, 2.5)
    x = (x - x.mean()) * np.minimum(1.0, t / 0.002) * np.exp(-t / (dur * 0.6))
    return ro(norm(fade(x, 0.0005, 0.015), 0.7))


@lru_cache(maxsize=None)
def glitch_hit(v=0):
    """比特压缩的小噪声碎片（故障感打击）。"""
    rng = np.random.default_rng(300 + v)
    n = nsamp(0.03 + 0.012 * (v % 4))
    x = bp(rng.standard_normal(n), 1500 + 900 * (v % 5), 6000 + 1000 * (v % 4))
    hold = 5 + (v % 4) * 2
    x = np.round(np.repeat(x[::hold], hold)[:n] * 3.0) / 3.0
    x = x * np.exp(-tt(n) / (n / SR * 0.4))
    return ro(norm(fade(x, 0.0002, 0.004), 0.8))


# ====================================================================== 和声
# r 低音根音（bass）、s 次低音（sub）、pad 铺底声部、arp 琶音（低→高 5 音）、tri 三和弦音（高八度用）
CH = {
    'Dm': dict(r=38, s=26, pad=[50, 57, 62, 65, 69], arp=[62, 69, 74, 77, 81], tri=[74, 77, 81]),
    'Bb': dict(r=34, s=34, pad=[46, 58, 62, 65, 70], arp=[58, 65, 70, 74, 77], tri=[70, 74, 77]),
    'F': dict(r=41, s=29, pad=[53, 57, 60, 65, 69], arp=[60, 65, 69, 72, 77], tri=[65, 69, 72]),
    'C': dict(r=36, s=36, pad=[55, 60, 64, 67, 72], arp=[60, 67, 72, 76, 79], tri=[72, 76, 79]),
    'Gm': dict(r=31, s=31, pad=[55, 58, 62, 67, 70], arp=[55, 62, 67, 70, 74], tri=[67, 70, 74]),
    'A': dict(r=33, s=33, pad=[57, 61, 64, 69, 73], arp=[57, 64, 69, 73, 76], tri=[69, 73, 76]),
    'Eb': dict(r=39, s=27, pad=[51, 55, 58, 63, 67], arp=[58, 63, 67, 70, 75], tri=[70, 75, 79]),
    'Dmaj': dict(r=38, s=26, pad=[50, 57, 62, 66, 69], arp=[62, 69, 74, 78, 81], tri=[74, 78, 81]),
    'Bm': dict(r=35, s=35, pad=[50, 54, 59, 62, 66], arp=[59, 66, 71, 74, 78], tri=[71, 74, 78]),
    'G': dict(r=31, s=31, pad=[50, 55, 59, 62, 67], arp=[55, 62, 67, 71, 74], tri=[67, 71, 74]),
    'Dmb9': dict(r=38, s=26, pad=[50, 57, 63, 65], arp=[62, 69, 75, 77, 81], tri=[75, 77, 81]),
    'BbD': dict(r=38, s=26, pad=[50, 58, 62, 65], arp=[58, 65, 70, 74, 77], tri=[70, 74, 77]),
    'EbD': dict(r=38, s=26, pad=[50, 58, 63, 67], arp=[58, 63, 67, 70, 75], tri=[70, 75, 79]),
}
VEL = {'x': 1.0, 'o': 0.65, 'g': 0.33, 'a': 1.25, 'f': 0.8}
BASSMAP = {'x': (0, 0.85), 'o': (12, 1.0), 'g': (0, 0.42), 'f': (7, 0.8), 'b': (1, 0.95), 'c': (-2, 0.95), 'l': (-12, 0.9)}
TOMMAP = {'x': 38, 'o': 33, 'h': 50, 'l': 29, 'm': 45}


def chord_seq(t0, t1, names, per):
    out, t, i = [], t0, 0
    while t < t1 - 1e-6:
        out.append((t, min(t + per, t1), names[i % len(names)]))
        t += per
        i += 1
    return out


def chord_at(seq, t):
    for a, b, nm in seq:
        if a - 1e-6 <= t < b - 1e-6:
            return nm
    return seq[-1][2]


def clamp01(x):
    return min(1.0, max(0.0, x))


# ====================================================================== 调度上下文
class Ctx:
    STEMS = ('sub', 'bass', 'drums', 'pads', 'keys', 'fx')
    SENDS = ('hall', 'plate', 'room', 'echo')

    def __init__(self, tl, only=None):
        self.tl = tl
        self.dur = float(tl['duration'])
        self.N = int(math.ceil(self.dur * SR - 1e-6))
        self.beat, self.bar = float(tl['beat']), float(tl['bar'])
        self.s16 = self.beat / 4.0
        self.sc = {s['id']: s for s in tl['scenes']}
        self.cues = tl['cues']
        self.only = only
        self.buf = {k: np.zeros((2, self.N), np.float32) for k in self.STEMS}
        self.snd = {k: np.zeros(self.N, np.float32) for k in self.SENDS}
        self.kicks = []
        self.auto = []
        self.stops = [(float(q['t']), float(q.get('dur', 1.0)), True) for q in self.cues if q['type'] == 'stop']
        self.rng = np.random.default_rng(SEED)

    # ---- 时间线查询
    def span(self, sid):
        s = self.sc[sid]
        return float(s['start']), float(s['end'])

    def cues_of(self, typ, scene=None):
        return [q for q in self.cues if q['type'] == typ and (scene is None or q.get('scene') == scene)]

    def cue_t(self, typ, scene=None, nth=0, default=None):
        q = self.cues_of(typ, scene)
        return float(q[nth]['t']) if len(q) > nth else default

    def stop_in(self, a, b):
        for t, d, _ in self.stops:
            if a - 1e-6 <= t < b:
                return t, d
        return None

    # ---- 放置
    def put(self, stem, y, t, pan=0.0, g=1.0, hall=0.0, plate=0.0, room=0.0, echo=0.0):
        i0 = int(round(t * SR))
        m = y.shape[-1]
        a, b = max(0, -i0), min(m, self.N - i0)
        if b <= a or g == 0.0:
            return
        seg = y[..., a:b]
        i0 += a
        j = i0 + (b - a)
        buf = self.buf[stem]
        if y.ndim == 2:
            buf[:, i0:j] += seg * g
            mono = 0.5 * (seg[0] + seg[1])
        else:
            l, r = panlr(pan)
            buf[0, i0:j] += seg * (g * l)
            buf[1, i0:j] += seg * (g * r)
            mono = seg
        for name, amt in (('hall', hall), ('plate', plate), ('room', room), ('echo', echo)):
            if amt:
                self.snd[name][i0:j] += mono * (g * amt)

    def on(self, sid):
        return self.only is None or sid in self.only

    # ---- 鼓组
    def kick(self, t, kind='punch', g=1.0, pump=0.0, **sd):
        self.put('drums', kick(kind), t, g=g, **sd)
        if pump > 0:
            self.kicks.append((t, pump))

    def snare(self, t, kind='tight', g=1.0, tune=1.0, pan=0.0, **sd):
        self.put('drums', snare(kind, round(tune * 20) / 20), t, pan=pan, g=g, **sd)

    def clap(self, t, g=1.0, kind='std', **sd):
        self.put('drums', clap(kind), t, g=g, **sd)

    def hat(self, t, kind='c', g=1.0, v=0, pan=0.0, fc=0.0, **sd):
        self.put('drums', hat(kind, v % 4, fc), t, pan=pan, g=g, **sd)

    def tom(self, t, midi, g=1.0, kind='taiko', pan=0.0, **sd):
        self.put('drums', tom(int(midi), kind), t, pan=pan, g=g, **sd)

    def crash(self, t, g=1.0, dur=4.5, **sd):
        self.put('drums', crash(dur), t, g=g, **sd)


# ====================================================================== 通用段落件
def motif(c, t, inst='bell', g=0.5, step=None, notes=(81, 77, 74, 69), echo=0.5, hall=0.4, plate=0.0, pan=0.0):
    """水滴动机：A5–F5–D5–A4 下行四音（大调终曲里换成 F#5）。"""
    step = step or c.beat
    for i, m in enumerate(notes):
        if inst == 'bell':
            w = bell_note(m, 3.0, 'bell')
        elif inst == 'glock':
            w = bell_note(m, 2.0, 'glock')
        elif inst == 'piano':
            w = piano_note(m, 3.5, 0.72)
        else:
            w = pluck_note(m, 0.6, 0.3, 1.0, 'tri')
        c.put('keys', w, t + i * step, pan=pan + (-0.3 if i % 2 == 0 else 0.3), g=g * (1.0, 0.92, 0.85, 0.96)[i % 4],
              echo=echo, hall=hall, plate=plate)


def snare_roll(c, t0, t1, g0=0.25, g1=1.0, tune0=0.85, tune1=1.7, kick_g=0.0):
    """加速军鼓滚奏：八分 → 十六分 → 三十二分（三段等长），音高与力度渐升。"""
    dur = t1 - t0
    t = t0
    while t < t1 - 1e-6:
        p = (t - t0) / dur
        c.snare(t, 'roll', g=(g0 + (g1 - g0) * p ** 1.4) * 0.8, tune=tune0 + (tune1 - tune0) * p,
                pan=0.12 * math.sin(t * 40), plate=0.18)
        t += c.beat / 2 if p < 1 / 3 else (c.beat / 4 if p < 2 / 3 else c.beat / 8)


def pads_for(c, seq, t0, t1, g=0.4, cut=(800.0, 2200.0), att=0.3, rel=0.4, hall=0.2, nv=4, det=9.0, air=0.25, key='pad', stem='pads'):
    for a, b, nm in seq:
        a2, b2 = max(a, t0), min(b, t1)
        if b2 - a2 < 0.2:
            continue
        pd = pad_chord(CH[nm][key], b2 - a2, att=att, rel=rel, cut=cut, nv=nv, det=det, air=air, seed=int(a2 * 10) % 97)
        c.put(stem, pd, a2, g=g, hall=hall)


def subs_for(c, seq, t0, t1, g=0.45, stem='bass', att=0.02):
    for a, b, nm in seq:
        a2, b2 = max(a, t0), min(b, t1)
        if b2 - a2 < 0.1:
            continue
        c.put(stem, sub_note(CH[nm]['s'], b2 - a2, att=att, rel=0.1), a2, g=g)


def groove(c, t0, t1, seq, o):
    """按十六分网格铺设一段律动：kick / snare / clap / hat / ohat / toms / bass / arp / stac 九层，按层入场时间与强度曲线 k(t) 缩放。"""
    S = c.s16
    i0, i1 = int(math.ceil(t0 / S - 1e-6)), int(math.ceil(t1 / S - 1e-6))
    kf = o.get('k', lambda t: 1.0)
    on, off = o.get('on', {}), o.get('off', {})

    def act(name, t):
        return on.get(name, t0) - 1e-6 <= t < off.get(name, t1 + 1.0)

    for i in range(i0, i1):
        t, pos = i * S, i % 16
        k = kf(t)
        ch = CH[chord_at(seq, t)]
        pan = 0.25 if i % 2 else -0.25
        p = o.get('kick')
        if p and p[pos] != '.' and act('kick', t):
            c.kick(t, o.get('kick_kind', 'punch'), g=o.get('kick_g', 0.9) * VEL[p[pos]] * (0.55 + 0.45 * k), pump=o.get('pump', 0.0),
                   room=o.get('kick_room', 0.0))
        p = o.get('snare')
        if p and p[pos] != '.' and act('snare', t):
            c.snare(t, o.get('snare_kind', 'tight'), g=o.get('snare_g', 0.7) * VEL[p[pos]] * (0.6 + 0.4 * k),
                    plate=o.get('snare_plate', 0.25), hall=o.get('snare_hall', 0.0))
        p = o.get('clap')
        if p and p[pos] != '.' and act('clap', t):
            c.clap(t, g=o.get('clap_g', 0.55) * VEL[p[pos]] * (0.6 + 0.4 * k), plate=o.get('clap_plate', 0.28), hall=o.get('clap_hall', 0.05))
        p = o.get('hat')
        if p and p[pos] != '.' and act('hat', t):
            c.hat(t, 'c', g=o.get('hat_g', 0.3) * VEL[p[pos]] * (0.45 + 0.55 * k), v=i, pan=pan)
        p = o.get('ohat')
        if p and p[pos] != '.' and act('ohat', t):
            c.hat(t, 'o', g=o.get('ohat_g', 0.22) * VEL[p[pos]] * (0.45 + 0.55 * k), pan=-pan)
        p = o.get('toms')
        if p and p[pos] != '.' and act('toms', t):
            c.tom(t, TOMMAP[p[pos]], g=o.get('tom_g', 0.6) * (0.5 + 0.5 * k) * (1.0 if pos % 8 == 0 else 0.75), hall=o.get('tom_hall', 0.18),
                  pan=o.get('tom_pan', 0.0))
        sp = o.get('bass')
        if sp and sp['pat'][pos] != '.' and act('bass', t):
            off_, vv = BASSMAP[sp['pat'][pos]]
            cut = sp['cut'](t) if callable(sp['cut']) else sp['cut']
            cut = 2.0 ** (round(math.log2(cut) * 3) / 3)
            c.put('bass', bass_note(ch['r'] + off_ + sp.get('oct', 0), sp.get('dur', 0.11), sp.get('kind', 'saw'), cut=round(cut, 1),
                                    tau=sp.get('tau', 0.08), drv=sp.get('drv', 1.0)), t, g=sp['g'] * vv * (0.6 + 0.4 * k))
        sp = o.get('arp')
        if sp and sp['pat'][pos] is not None and act('arp', t):
            m = ch[sp.get('set', 'arp')][sp['pat'][pos]] + sp.get('oct', 0)
            c.put('keys', pluck_note(m, sp.get('dur', 0.4), sp.get('tau', 0.14), sp.get('bright', 1.0), sp.get('kind', 'saw')), t,
                  pan=pan * 1.4, g=sp['g'] * (0.45 + 0.55 * k) * (1.0 if pos % 4 == 0 else 0.8), echo=sp.get('echo', 0.4), hall=sp.get('hall', 0.1))
        sp = o.get('stac')
        if sp and sp['pat'][pos] is not None and act('stac', t):
            m = ch[sp.get('set', 'pad')][sp['pat'][pos]] + sp.get('oct', 0)
            c.put('keys', pluck_note(m, 0.13, sp.get('tau', 0.05), sp.get('bright', 1.3), 'saw'), t, pan=pan * 0.8,
                  g=sp['g'] * (0.4 + 0.6 * k) * (1.0 if pos % 4 == 0 else 0.75), hall=sp.get('hall', 0.08), echo=sp.get('echo', 0.0))


def drop_hit(c, t, braam_notes, g=1.0, dur=5.5, choir=None, choir_dur=6.0, bright=1.0, tun=1.0, choir_vowel='ah', sub_midi=26):
    """全频带段落重拍：BRAAM + 大底鼓 + 太鼓 + 军鼓/拍手 + 镲 + 次低音；各层起点严格对齐 t。"""
    c.put('fx', braam(braam_notes, dur, bright=bright, seed=int(t) % 13), t, g=0.5 * g, hall=0.28)
    c.kick(t, 'big', g=1.0 * g, pump=0.9, hall=0.1)
    c.put('sub', sub_note(sub_midi, 3.8, att=0.004, rel=0.6), t, g=0.5 * g)
    c.tom(t, 38, g=0.8 * g, hall=0.25)
    c.tom(t, 45, g=0.55 * g, hall=0.2)
    c.snare(t, 'big', g=0.7 * g, plate=0.32, hall=0.28)
    c.clap(t, g=0.55 * g, kind='long', plate=0.3, hall=0.12)
    c.crash(t, g=0.75 * g, dur=5.0, hall=0.15)
    if choir:
        c.put('pads', choir_chord(choir, choir_dur, att=0.18, rel=2.5, vowel=choir_vowel, seed=int(t) % 11), t, g=0.6 * g, hall=0.42)


# ====================================================================== 场景
def scene_open(c):
    s, e = c.span('open')
    B, S16 = c.beat, c.s16
    stp = c.stop_in(s, e)
    end = stp[0] if stp else e
    L = end - s
    # 持续低音 D1 + 暗色锯齿铺底，滤波缓慢打开
    n = nsamp(L + 0.2)
    t = tt(n)
    sub = 0.6 * np.sin(TAU * 36.708 * t) + 0.13 * np.sin(TAU * 73.416 * t + 0.4)
    c.put('sub', fade(sub * np.interp(t, [0, 3.5, L - 2.0, L], [0, 0.75, 1.0, 1.0]), 0.01, 0.01), s, g=0.8)
    c.put('pads', pad_chord([38, 45, 50, 57], L, att=4.0, rel=0.3, cut=(130.0, 2200.0), nv=3, det=7.0, air=0.4), s, g=0.42, hall=0.35)
    # 心跳：每小节第 1 拍 lub、随后八分音符 dub
    k = 1
    while s + k * c.bar < end - 0.2:
        tb = s + k * c.bar
        v = 0.35 + 0.65 * min(1.0, (tb - s) / (L * 0.9))
        c.put('sub', heart('lub'), tb, g=0.75 * v)
        c.put('sub', heart('dub'), tb + B / 2, g=0.5 * v)
        k += 1
    # 稀疏的水滴动机钟声：每两小节一次
    k = 2
    while s + k * c.bar < end - 4.0:
        motif(c, s + k * c.bar, 'bell', g=0.4, echo=0.55, hall=0.45)
        k += 2
    # 16 秒起：滤波十六分滴答，逐渐变亮变响
    tk0 = s + 16.0
    i = 0
    while tk0 + i * S16 < end - 0.05:
        tk = tk0 + i * S16
        p = (tk - tk0) / max(end - tk0, 1.0)
        acc = 1.0 if i % 4 == 0 else (0.55 if i % 2 == 0 else 0.35)
        c.put('drums', hat('tk', i % 4, round((2400 + 4200 * p) / 400) * 400.0), tk, pan=0.3 if i % 2 else -0.3, g=(0.25 + 0.6 * p) * acc * 0.5, plate=0.1)
        i += 1
    # 22–25 秒：上行琶音 + 逐渐加强的定音鼓脉冲
    a0 = end - 3.05
    segA = [(a0, a0 + 2.0, 'Bb'), (a0 + 2.0, end + 0.01, 'A')]
    pat = [0, 1, 2, 3, 4, 3, 2, 1]
    i = 0
    while a0 + i * S16 < end - 0.04:
        tk = a0 + i * S16
        p = (tk - a0) / (end - a0)
        ch = CH[chord_at(segA, tk)]
        m = ch['arp'][pat[i % 8]] + (12 if p > 0.45 else 0)
        c.put('keys', pluck_note(m, 0.3, 0.11, 0.5 + p, 'saw'), tk, pan=0.35 if i % 2 else -0.35, g=(0.15 + 0.85 * p ** 1.3) * 0.7, echo=0.3, hall=0.1)
        i += 1
    tk = a0 + 1.0
    while tk < end - 0.04:
        p = (tk - a0) / (end - a0)
        c.tom(tk, 38, g=0.25 + 0.5 * p, hall=0.3)
        tk += B if tk < end - 1.6 else B / 2


def scene_title(c):
    s, e = c.span('title')
    B, BAR = c.beat, c.bar
    t0 = c.cue_t('drop', 'title', default=s)
    drop_hit(c, t0, [38, 45, 50, 53], g=1.0, dur=5.6, choir=None)
    for dt, m, v in ((0.5, 45, 0.45), (0.75, 38, 0.5), (1.0, 38, 0.65), (1.5, 45, 0.4), (2.0, 38, 0.45)):
        c.tom(t0 + dt, m, g=v, hall=0.3)
    c.put('pads', choir_chord(CH['Dm']['pad'], (e - t0) - 0.3, att=1.6, rel=1.4, vowel='ah', seed=1), t0 + 0.3, g=0.58, hall=0.45)
    c.put('pads', pad_chord(CH['Dm']['pad'], 4.0, att=0.5, rel=1.2, cut=(500.0, 2400.0), nv=4, det=10.0), t0, g=0.5, hall=0.3)
    c.put('pads', pad_chord(CH['Bb']['pad'], e - (t0 + 4.0) + 0.2, att=1.0, rel=1.2, cut=(900.0, 1500.0), nv=4, det=10.0), t0 + 4.0, g=0.45, hall=0.3)
    c.put('bass', sub_note(26, 4.0, att=0.02, rel=0.5), t0 + 0.2, g=0.3)
    c.put('bass', sub_note(34, e - t0 - 4.0, att=0.05, rel=0.6), t0 + 4.0, g=0.3)
    motif(c, t0 + 2.0, 'bell', g=0.5, echo=0.55, hall=0.5)
    motif(c, t0 + 4.0, 'bell', g=0.4, echo=0.55, hall=0.5)
    c.put('fx', rev_crash(1.4), e - 1.4, g=0.25, hall=0.15)


def scene_craft(c):
    s, e = c.span('craft')
    B, BAR, S16 = c.beat, c.bar, c.s16
    lift = c.cue_t('shimmer', 'craft', default=e - 7.5)
    lift_bar = math.floor(lift / BAR) * BAR
    q0, q1 = lift - 6.5, lift - 0.5
    seq = chord_seq(s, lift_bar, ['Dm', 'Bb', 'F', 'C'], 2 * BAR) + chord_seq(lift_bar, e, ['Bb', 'F', 'C', 'Dm'], 2 * BAR)

    def quiet(t):
        return q0 - 1e-6 <= t < q1

    for a, b, nm in seq:
        ch = CH[nm]
        up = a >= lift_bar - 0.01
        c.put('pads', pad_chord(ch['pad'], b - a, att=0.9, rel=1.3, cut=(900.0, 2600.0) if up else (650.0, 1250.0), nv=4, det=9.0, air=0.3,
                                seed=int(a) % 50), a, g=0.4 if quiet(a) else 0.46, hall=0.25)
        c.put('sub', sub_note(ch['s'], b - a, att=0.05, rel=0.3), a, g=0.4)
        tt_ = a
        while tt_ < b - 0.3:
            if not quiet(tt_) and tt_ >= s + BAR:
                c.put('bass', bass_note(ch['r'], 0.45, 'saw', cut=480.0, tau=0.2), tt_, g=0.2)
            tt_ += 2 * B
    # 柔和底鼓（1、3 拍）与低音量 shaker
    t = s + 2 * BAR
    while t < e - 0.1:
        if not quiet(t):
            c.kick(t, 'soft', g=0.5, pump=0.22)
        t += 2 * B
    i = int(math.ceil((s + 4 * BAR) / S16))
    while i * S16 < e:
        t = i * S16
        if not quiet(t):
            c.hat(t, 'sh', g=0.15 * VEL['xgog'[i % 4]], v=i, pan=0.3 if i % 2 else -0.3)
        i += 1
    # 拨弦琶音：八分音符；安静段稀疏；升格后十六分且更亮
    A1_, A2_ = [0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 1, 3, 2, 4, 3, 2]
    t = s + BAR
    while t < e - 0.05:
        bi = int((t - s + 1e-6) // BAR)
        ch = CH[chord_at(seq, t)]
        pos = int(round((t - (s + bi * BAR)) / (B / 2))) % 8
        pat = A1_ if bi % 2 == 0 else A2_
        if t >= lift - 0.01:
            for sub16 in (0, 1):
                idx = (A1_ + A2_)[(pos * 2 + sub16) % 16]
                c.put('keys', pluck_note(ch['arp'][idx] + (12 if pos >= 4 else 0), 0.35, 0.12, 1.3, 'saw'), t + sub16 * S16,
                      pan=-0.3 if (pos + sub16) % 2 else 0.3, g=0.5, echo=0.45, hall=0.15)
            step = B / 2
        elif quiet(t):
            if pos % 2 == 0:
                c.put('keys', pluck_note(ch['arp'][pat[pos]], 0.5, 0.2, 0.7, 'saw'), t, pan=-0.25 if pos % 4 else 0.25, g=0.3, echo=0.5, hall=0.25)
            step = B / 2
        else:
            acc = (1.0, 0.6, 0.8, 0.6)[pos % 4]
            c.put('keys', pluck_note(ch['arp'][pat[pos]], 0.4, 0.15, 0.9, 'saw'), t, pan=-0.3 if pos % 2 else 0.3, g=0.42 * acc, echo=0.45, hall=0.15)
            step = B / 2
        t += step
    # 升格：钟琴（Bb–F–C–Dm 的和弦音琶音），水滴动机在蝴蝶时刻
    motif(c, s + 16.0, 'pluck', g=0.45, echo=0.5, hall=0.3)
    motif(c, lift, 'glock', g=0.55, echo=0.5, hall=0.35)
    for a, b, nm in seq:
        if a < lift_bar - 0.01:
            continue
        tri = CH[nm]['tri']
        t = max(a, lift + 2 * B)
        j = 0
        while t < b - 0.2:
            c.put('keys', bell_note(tri[[0, 1, 2, 1][j % 4]] + 12 - 12 * 0, 1.6, 'glock'), t, pan=0.4 if j % 2 else -0.4, g=0.32, echo=0.45, hall=0.3)
            t += B / 2
            j += 1


def scene_dark(c):
    s, e = c.span('dark')
    B, BAR, S16 = c.beat, c.bar, c.s16
    boom = c.cue_t('boom', 'dark', default=s + 23.5)
    g0 = c.cue_t('sizzle', 'dark', default=s + 30.5)
    rs = c.cues_of('riser', 'dark')
    peak = float(rs[0]['t']) if rs else g0 + 8.15
    st = c.stop_in(s, e)
    stop_t, stop_d = st if st else (e - 12.0, 3.6)
    stop_e = stop_t + stop_d
    drop_t = c.cue_t('drop', 'dark', default=e - 4.0)
    # ---- A 段：神秘。D 持续低音 + 暗铺底 + 弗里几亚低音 ostinato（D–Eb–D–C）
    for a, b, nm in chord_seq(s, g0 + 0.5, ['Dmb9', 'BbD', 'EbD', 'Dmb9'], 8.0):
        c.put('pads', pad_chord(CH[nm]['pad'], b - a, att=2.5, rel=2.0, cut=(420.0, 900.0), nv=3, det=8.0, air=0.3, seed=int(a) % 40), a, g=0.42, hall=0.4)
    cell = [38, 39, 38, 36]
    k = 0
    t = s
    while t < g0 - 0.01:
        bi = int((t - s + 1e-6) // BAR)
        p = clamp01((t - s) / (g0 - s))
        if bi % 4 != 3 and not (boom - 0.05 <= t < boom + 0.5):
            c.put('bass', bass_note(cell[k % 4], 0.2, 'saw', cut=320.0, tau=0.1), t, g=(0.16 + 0.16 * p) * (1.0 if k % 4 == 0 else 0.7))
        t += B / 2
        k += 1
    t = s
    while t < g0 - 0.3:
        c.put('sub', sub_note(26, 1.7, att=0.03, rel=0.5), t, g=0.4)
        if int((t - s + 1e-6) // BAR) % 4 == 0:
            c.tom(t, 38, g=0.35, hall=0.3)
        if int((t - s + 1e-6) // BAR) % 2 == 1:
            c.put('drums', hat('tk', 1, 5200.0), t + 1.75, g=0.28, plate=0.2, pan=0.4)
        t += BAR
    for tb in (s + 4.0, s + 12.0, s + 20.0, boom + 4.0):
        if tb < g0 - 1.0:
            motif(c, tb, 'bell', g=0.3, echo=0.55, hall=0.5)
    # 深铜管一击（与 boom 同刻）+ 反向镲吸气
    c.put('fx', rev_crash(2.4), boom - 2.4, g=0.35, hall=0.2)
    c.put('fx', brass_swell([26, 38, 45], 3.0, att=0.06, seed=3), boom, g=0.75, hall=0.35)
    c.tom(boom, 38, g=0.9, hall=0.3)
    c.tom(boom, 33, g=0.6, hall=0.3)
    c.put('sub', sub_note(26, 3.0, att=0.004, rel=0.6), boom, g=0.5)
    # ---- B 段：律动（g0 → stop）：渐强到 peak，再稳定
    seq = chord_seq(s, e, ['Dm', 'Eb', 'Dm', 'C'], BAR)
    o = dict(
        k=lambda t: 0.3 + 0.7 * clamp01((t - g0) / (peak - g0)),
        kick='x...x...x...x...', kick_kind='punch', kick_g=0.85, pump=0.7,
        clap='....x.......x...', clap_g=0.5, ohat='..x...x...x...x.', ohat_g=0.2,
        hat='xgogxgogxgogxgog', hat_g=0.24,
        bass=dict(pat='..x...x...x...xo', g=0.46, dur=0.2, cut=lambda t: 180.0 + 2600.0 * clamp01((t - g0) / (peak - g0)) ** 1.3, tau=0.1, kind='saw'),
        arp=dict(pat=[0, 2, 1, 3, 2, 4, 3, 2, 0, 2, 1, 3, 4, 3, 2, 1], g=0.42, dur=0.3, tau=0.1, bright=1.0, echo=0.4, hall=0.1),
        on=dict(clap=g0 + 3.5, ohat=g0 + 2.0, hat=g0 + 5.0, arp=g0 + 4.0),
    )
    groove(c, g0, stop_t, seq, o)
    pads_for(c, seq, g0 - 0.3, stop_t, g=0.36, cut=(500.0, 2600.0), att=0.25, rel=0.4, hall=0.2)
    subs_for(c, seq, g0 - 0.3, stop_t, g=0.4)
    c.crash(peak, g=0.55, dur=3.5, hall=0.15)
    c.snare(peak, 'tight', g=0.6, plate=0.3)
    # ---- 静默后的构建：加速军鼓滚奏 + 上行铺底
    rs0 = math.ceil((stop_e - 1e-6) / B) * B
    c.put('pads', pad_chord([38, 45, 50, 57], drop_t - stop_e, att=3.0, rel=0.05, cut=(200.0, 6500.0), nv=4, det=14.0), stop_e, g=0.4, hall=0.25)
    snare_roll(c, rs0, drop_t, g0=0.22, g1=1.0)
    # ---- 下拍：全频带 DROP + 余韵
    drop_hit(c, drop_t, [38, 45, 50, 53], g=1.0, dur=5.0, choir=CH['Dm']['pad'], choir_dur=5.0)
    o2 = dict(
        kick='x.......x.......', kick_kind='punch', kick_g=0.9, pump=0.6,
        clap='........x.......', clap_g=0.5, hat='x.o.x.o.x.o.x.o.', hat_g=0.22,
        bass=dict(pat='x...............', g=0.5, dur=1.6, cut=900.0, tau=0.3, kind='saw'),
        on=dict(kick=drop_t + B * 2, clap=drop_t + B * 2, hat=drop_t + B, bass=drop_t + 4 * B),
    )
    groove(c, drop_t + B, e - BAR, [(drop_t, e, 'Dm')], o2)
    c.put('pads', pad_chord(CH['Dm']['pad'], e - drop_t, att=0.4, rel=1.0, cut=(900.0, 2200.0), nv=4, det=10.0), drop_t, g=0.4, hall=0.3)
    motif(c, e - BAR, 'bell', g=0.45, echo=0.5, hall=0.45)
    c.put('fx', rev_crash(1.6), e - 1.6, g=0.3, hall=0.15)
    tk = e - B * 2
    while tk < e - 0.05:
        c.tom(tk, 38 if tk < e - B else 45, g=0.45, hall=0.3)
        tk += B / 2


def scene_why(c):
    s, e = c.span('why')
    B, BAR = c.beat, c.bar
    light = e - 8.0
    seq = chord_seq(s, e, ['Dm', 'Bb', 'Gm', 'A'], BAR)
    base = dict(
        k=lambda t: 0.72,
        kick='x...x...x...x...', kick_kind='punch', kick_g=0.95, pump=0.75,
        clap='....x.......x...', clap_g=0.5, hat='xgogxgogxgogxgog', hat_g=0.24, ohat='..x...x...x...x.', ohat_g=0.2,
        bass=dict(pat='gxoxgxoxgxoxgxox', g=0.44, dur=0.105, cut=1500.0, tau=0.07, kind='saw'),
        arp=dict(pat=[0, None, 2, None, 1, None, 3, None, 2, None, 4, None, 3, None, 2, None], g=0.46, dur=0.4, tau=0.13, bright=1.0, echo=0.45, hall=0.12),
        on=dict(bass=s + BAR, arp=s + 2 * BAR, clap=s + BAR),
    )
    groove(c, s, light, seq, base)
    pads_for(c, seq, s, light + 0.3, g=0.36, cut=(700.0, 2400.0), att=0.2, rel=0.35, hall=0.2)
    subs_for(c, seq, s, light, g=0.4)
    c.crash(s, g=0.6, dur=4.0, hall=0.15)
    # 最后 8 秒：更轻盈 + 闪烁
    lt = dict(
        k=lambda t: 0.5,
        kick='x.......x.......', kick_kind='soft', kick_g=0.6, pump=0.3,
        hat='x.o.x.o.x.o.x.o.', hat_g=0.16, ohat='..x...x...x...x.', ohat_g=0.0,
        arp=dict(pat=[0, None, 2, None, 1, None, 3, None, 2, None, 4, None, 3, None, 2, None], g=0.36, dur=0.5, tau=0.18, bright=1.2, echo=0.55, hall=0.25, oct=12),
        on=dict(kick=light + BAR),
    )
    groove(c, light, e - BAR, seq, lt)
    pads_for(c, seq, light, e, g=0.4, cut=(1100.0, 3000.0), att=0.6, rel=0.9, hall=0.35)
    motif(c, light + 2.0, 'bell', g=0.4, echo=0.5, hall=0.45)
    # 收尾：小军鼓滚 + 反向镲 + 定音鼓渐强，落入下一幕
    c.put('fx', rev_crash(2.0), e - 2.0, g=0.35, hall=0.15)
    tk = e - BAR
    while tk < e - 0.05:
        c.tom(tk, 38 if tk < e - B else 45, g=0.3 + 0.4 * (tk - (e - BAR)) / BAR, hall=0.3)
        tk += B


def scene_reason(c):
    s, e = c.span('reason')
    B, BAR, S16 = c.beat, c.bar, c.s16
    drop_t = c.cue_t('drop', 'reason', default=s + 23.46)
    bar_end = math.ceil((drop_t - 1e-6) / BAR) * BAR
    seqA = chord_seq(s, s + 16.0, ['Gm', 'Bb', 'F', 'C'], BAR) + chord_seq(s + 16.0, bar_end, ['Dm', 'Bb', 'F', 'A'], BAR)
    seqB = chord_seq(bar_end, bar_end + 8.0, ['Dm', 'Bb', 'F', 'A'], BAR) + chord_seq(bar_end + 8.0, e, ['Gm', 'Bb', 'F', 'C', 'A'], BAR)
    bt = drop_t - 3.0
    build = dict(
        k=lambda t: 0.25 + 0.75 * clamp01((t - s) / (drop_t - s)) ** 1.1,
        toms='x..o..o.x..o..h.', tom_g=0.55, tom_hall=0.22,
        kick='x...x...x...x...', kick_kind='punch', kick_g=0.75, pump=0.6,
        clap='....x.......x...', clap_g=0.45, hat='xgogxgogxgogxgog', hat_g=0.2,
        stac=dict(pat=[0, 2, 3, 2] * 4, g=0.4, tau=0.05, bright=1.3, oct=0),
        on=dict(toms=s, stac=s + 4 * BAR, hat=s + 8 * BAR, kick=s + 10 * BAR, clap=s + 12 * BAR),
        off=dict(kick=bt, clap=bt, hat=bt),
    )
    groove(c, s, drop_t - 0.05, seqA, build)
    pads_for(c, seqA, s, drop_t, g=0.36, cut=(500.0, 3200.0), att=0.6, rel=0.5, hall=0.25)
    subs_for(c, seqA, s, drop_t, g=0.36)
    # 弦乐长音渐强
    for a, b, nm in seqA:
        p = clamp01((a - s) / (drop_t - s))
        c.put('pads', pad_chord(CH[nm]['pad'], b - a, att=0.5, rel=0.6, cut=(1200.0, 3600.0), nv=5, det=11.0, vib_hz=5.4, vib_c=6.0, seed=int(a) % 30), a,
              g=0.12 + 0.3 * p, hall=0.3)
    # 构建的最后三拍：加速军鼓滚奏（与 riser 同步）
    snare_roll(c, bt, drop_t, g0=0.2, g1=1.0)
    # ---- DROP
    drop_hit(c, drop_t, [38, 45, 50, 53], g=1.0, dur=5.0, choir=CH['Dm']['pad'], choir_dur=4.5)
    hot = dict(
        k=lambda t: 0.95,
        kick='x...x...x...x...', kick_kind='punch', kick_g=0.95, pump=0.75, clap='....x.......x...', clap_g=0.55,
        hat='xgogxgogxgogxgog', hat_g=0.24, ohat='..x...x...x...x.', ohat_g=0.2,
        bass=dict(pat='gxoxgxoxgxoxgxox', g=0.44, dur=0.105, cut=1600.0, tau=0.07, kind='saw'),
        stac=dict(pat=[0, 2, 3, 2] * 4, g=0.36, tau=0.05, bright=1.3, oct=0),
        arp=dict(pat=[0, None, 2, None, 1, None, 3, None, 2, None, 4, None, 3, None, 2, None], g=0.4, dur=0.4, tau=0.13, bright=1.1, echo=0.45, hall=0.12, oct=12),
    )
    brk_a, brk_b = bar_end + BAR / 2, bar_end + 3.5 * BAR
    groove(c, bar_end, brk_a, seqB, hot)
    # 小型中段（201–207）：抽掉鼓与低音，只留铺底、钢琴琶音与轻滴答
    pads_for(c, seqB, bar_end - 0.2, brk_b, g=0.38, cut=(900.0, 2600.0), att=0.5, rel=0.6, hall=0.3)
    subs_for(c, seqB, bar_end, brk_b, g=0.35)
    t = brk_a
    j = 0
    while t < brk_b - 0.1:
        ch = CH[chord_at(seqB, t)]
        c.put('keys', piano_note(ch['arp'][[0, 2, 1, 3, 2, 4, 3, 2][j % 8]] + 0, 2.0, 0.55), t, pan=-0.2 if j % 2 else 0.2, g=0.85, echo=0.3, hall=0.35)
        t += B / 2
        j += 1
    tk = brk_a
    while tk < brk_b - 0.1:
        c.tom(tk, 38, g=0.3, hall=0.3)
        tk += BAR
    snare_roll(c, brk_b - BAR, brk_b, g0=0.1, g1=0.6, tune0=1.0, tune1=1.3)
    # ---- 207 起再次激昂，直到 218
    hot2 = dict(hot)
    hot2['k'] = lambda t: 0.9 + 0.1 * clamp01((t - brk_b) / (e - brk_b))
    hot2['on'] = dict(stac=brk_b + BAR, arp=brk_b + BAR)
    c.crash(brk_b, g=0.55, dur=3.5, hall=0.15)
    groove(c, brk_b, e - BAR / 2, seqB, hot2)
    pads_for(c, seqB, brk_b, e, g=0.38, cut=(1000.0, 3200.0), att=0.3, rel=0.6, hall=0.25)
    subs_for(c, seqB, brk_b, e, g=0.38)
    c.put('fx', rev_crash(2.0), e - 2.0, g=0.4, hall=0.15)
    snare_roll(c, e - BAR, e, g0=0.3, g1=0.9)


def scene_war(c):
    s, e = c.span('war')
    B, BAR, S16 = c.beat, c.bar, c.s16
    drop_t = c.cue_t('drop', 'war', default=e - 3.5)
    boom = c.cue_t('boom', 'war', default=s + 4.0)
    seq = chord_seq(s, e, ['Dm', 'Eb'], 2 * BAR)
    # 起：低沉簇音与心跳
    c.put('sub', sub_note(26, boom - s + 0.5, att=1.0, rel=0.3), s, g=0.6)
    c.put('pads', pad_chord(CH['Dmb9']['pad'], boom - s + 0.5, att=1.2, rel=0.6, cut=(200.0, 1100.0), nv=3, det=10.0, air=0.4), s, g=0.42, hall=0.4)
    t = s + BAR
    while t < boom - 0.1:
        c.put('sub', heart('lub'), t, g=0.6)
        c.put('sub', heart('dub'), t + B / 2, g=0.4)
        t += BAR
    c.put('fx', rev_crash(1.6), boom - 1.6, g=0.3, hall=0.2)
    # 重半拍：kick 1、3& ，军鼓落在第 3 拍；失真贝斯（弗里几亚 D–Eb）；逐层加入
    t1, t2, t3 = boom + 8.0, boom + 16.0, boom + 24.0
    bld = drop_t - 4.0
    o = dict(
        k=lambda t: 0.55 + 0.45 * clamp01((t - boom) / (drop_t - boom)),
        kick='x.....x.....x...', kick_kind='long', kick_g=0.85, pump=0.6,
        snare='........x.......', snare_kind='big', snare_g=0.85, snare_plate=0.3, snare_hall=0.3,
        hat='xgogxgogxgogxgog', hat_g=0.2, ohat='............x.x.', ohat_g=0.14,
        bass=dict(pat='x..g.xb.x..g.xc.', g=0.5, dur=0.16, cut=1100.0, tau=0.06, kind='pulse', drv=2.6),
        arp=dict(pat=[None, None, None, None, 0, None, None, None, None, None, None, None, 1, None, None, None], g=0.3, dur=0.14, tau=0.06, bright=1.4, echo=0.35, hall=0.15, oct=0, kind='sq'),
        on=dict(hat=t1, ohat=t2, bass=boom + 4.0, arp=t2),
        off=dict(kick=bld, snare=bld, hat=bld, ohat=bld, arp=bld),
    )
    groove(c, boom, bld, seq, o)
    pads_for(c, seq, boom, drop_t, g=0.36, cut=(350.0, 1700.0), att=0.8, rel=0.8, hall=0.3, det=16.0)
    subs_for(c, seq, boom, drop_t, g=0.42)
    c.kick(boom, 'big', g=0.9, pump=0.8, hall=0.12)
    c.put('fx', brass_swell([26, 38, 45], 2.8, att=0.05, seed=9), boom, g=0.6, hall=0.3)
    # 警报式和弦音（三全音 A–Eb）与故障碎片
    t = boom + 12.0
    j = 0
    while t < bld - 0.05:
        p = clamp01((t - t2) / (bld - t2))
        for dt, m in ((0.0, 69), (B / 2, 75)):
            if t + dt < bld:
                c.put('keys', stab_note(m, 0.13, 1.0), t + dt, pan=-0.25 if j % 2 else 0.25, g=0.3 + 0.2 * p, echo=0.25, hall=0.15)
        t += BAR if t < t3 else B * 3
        j += 1
    rng = np.random.default_rng(SEED + 5)
    i = int(math.ceil((boom + 8.0) / S16))
    while i * S16 < drop_t - 0.5:
        if rng.random() < 0.16 + 0.12 * clamp01((i * S16 - boom) / (drop_t - boom)):
            c.put('drums', glitch_hit(int(rng.integers(0, 20))), i * S16, pan=float(rng.uniform(-0.8, 0.8)), g=0.28, plate=0.15)
        i += 1
    # 构建：最后四秒加速军鼓滚奏 + 四踩底鼓
    snare_roll(c, bld, drop_t, g0=0.3, g1=1.05, tune0=0.9, tune1=1.8)
    t = bld
    while t < drop_t - 0.4:
        c.kick(t, 'punch', g=0.8, pump=0.7)
        t += B
    c.put('pads', pad_chord([38, 45, 50, 53], drop_t - bld, att=2.5, rel=0.05, cut=(250.0, 7000.0), nv=4, det=20.0), bld, g=0.35, hall=0.2)
    # ---- 最强 DROP，随后混乱渐散，约 253.5 收成一口气
    drop_hit(c, drop_t, [38, 45, 50, 53], g=1.2, dur=3.2, bright=1.25, choir=None, choir_dur=3.0)
    c.put('fx', braam([50, 57, 62, 63], 3.0, bright=1.4, dist=3.0, seed=4, sub=False), drop_t, g=0.32, hall=0.25)
    c.put('keys', stab_note(69, 0.6, 1.3), drop_t, g=0.5, hall=0.3)
    c.put('keys', stab_note(75, 0.6, 1.3), drop_t, g=0.4, hall=0.3)
    breath = e - 0.5
    t = drop_t + B
    j = 0
    while t < breath - 0.2:
        p = (t - drop_t) / (breath - drop_t)
        c.kick(t, 'punch', g=0.8 * (1 - p), pump=0.5)
        if j % 2 == 1:
            c.snare(t, 'tight', g=0.7 * (1 - p), plate=0.3, hall=0.2)
        c.put('drums', glitch_hit(j % 20), t + B / 2, pan=(-1) ** j * 0.6, g=0.3 * (1 - p), plate=0.2)
        t += B
        j += 1
    c.stops.append((breath, 0.5, False))


def scene_final(c):
    s, e = c.span('final')
    B, BAR = c.beat, c.bar
    drop_t = c.cue_t('drop', 'final', default=e - 12.0)
    booms = [q for q in c.cues_of('boom', 'final')]
    big = float(booms[-1]['t']) if booms else drop_t - 10.0
    swell_t = c.cue_t('swell', 'final', default=s + 4.0)
    seq1 = chord_seq(s, big, ['Dm', 'Bb', 'F', 'C'], 2 * BAR)
    seq2 = [(big, drop_t - 3 * BAR, 'C'), (drop_t - 3 * BAR, drop_t - 2 * BAR, 'Bb'), (drop_t - 2 * BAR, drop_t - BAR, 'Gm'), (drop_t - BAR, drop_t, 'A')]
    seq3 = [(drop_t, drop_t + 2 * BAR, 'Dmaj'), (drop_t + 2 * BAR, drop_t + 3 * BAR, 'Bm'), (drop_t + 3 * BAR, drop_t + 4 * BAR, 'G'), (drop_t + 4 * BAR, e, 'Dmaj')]
    seq = seq1 + seq2 + seq3
    # 暖铺底（全程），钢琴动机 + 分解和弦，弦乐渐起
    for a, b, nm in seq:
        p = clamp01((a - s) / (big - s))
        if a < drop_t:
            c.put('pads', pad_chord(CH[nm]['pad'], b - a, att=1.8, rel=1.8, cut=(600.0, 1400.0 + 1200 * p), nv=4, det=9.0, air=0.2, seed=int(a) % 60), a,
                  g=0.3 + 0.12 * p, hall=0.35)
        c.put('sub', sub_note(CH[nm]['s'], b - a, att=0.3, rel=0.6), a, g=0.26)
    t = s + 2.0
    while t < big - 3.0:
        motif(c, t, 'piano', g=0.85, step=B, echo=0.3, hall=0.4, plate=0.1)
        t += 2 * BAR * 2
    t = s + 12.0
    j = 0
    while t < big - 0.3:
        ch = CH[chord_at(seq1, t)]
        p = clamp01((t - (s + 12.0)) / (big - s - 12.0))
        c.put('keys', piano_note(ch['pad'][[0, 2, 1, 3, 2, 1, 3, 2][j % 8]] + (12 if j % 8 in (3, 6) else 0), 2.4, 0.42 + 0.3 * p), t,
              pan=-0.2 if j % 2 else 0.2, g=0.8, hall=0.4, plate=0.1)
        t += B
        j += 1
    for a, b, nm in seq1:
        if a < swell_t - 0.01:
            continue
        p = clamp01((a - swell_t) / (big - swell_t))
        c.put('pads', pad_chord(CH[nm]['pad'], b - a, att=2.4, rel=1.8, cut=(1000.0, 3200.0), nv=5, det=11.0, vib_hz=5.4, vib_c=6.0, seed=int(a) % 30), a,
              g=0.14 + 0.3 * p, hall=0.4)
    # 心跳式定音鼓与 sub 脉冲（274 起），282 起合唱 + 大铺底 + 太鼓 ostinato + 弦乐断奏
    hb = s + 20.0
    t = hb
    while t < big - 0.1:
        c.put('sub', heart('lub'), t, g=0.45)
        c.put('sub', heart('dub'), t + B / 2, g=0.3)
        t += BAR
    for a, b, nm in seq2:
        c.put('pads', choir_chord(CH[nm]['pad'], b - a, att=1.5, rel=1.6, vowel='ah', seed=int(a) % 17), a, g=0.62, hall=0.45)
        c.put('pads', pad_chord(CH[nm]['pad'], b - a, att=0.8, rel=1.0, cut=(900.0, 3600.0), nv=5, det=12.0, vib_hz=5.4, vib_c=5.0, seed=int(a) % 29), a, g=0.42, hall=0.35)
    big_o = dict(
        k=lambda t: 0.3 + 0.7 * clamp01((t - big) / (drop_t - big)),
        toms='x..o..o.x..o..h.', tom_g=0.6, tom_hall=0.25,
        stac=dict(pat=[0, 2, 3, 2] * 4, g=0.36, tau=0.05, bright=1.3),
        on=dict(toms=big + BAR, stac=big + 3 * BAR),
    )
    groove(c, big, drop_t - 0.05, seq2, big_o)
    c.tom(big, 38, g=0.8, hall=0.3)
    c.put('bass', sub_note(CH['C']['s'], BAR * 2, att=0.05, rel=0.4), big, g=0.3)
    snare_roll(c, drop_t - 2.5, drop_t, g0=0.2, g1=1.0)
    # ---- 终极 DROP：D 大调（皮卡第三度）
    drop_hit(c, drop_t, [38, 45, 50, 54], g=1.05, dur=5.6, choir=[50, 57, 62, 66, 69, 74], choir_dur=6.5, sub_midi=26)
    for a, b, nm in seq3:
        c.put('pads', pad_chord(CH[nm]['pad'], b - a, att=1.0, rel=2.5, cut=(800.0, 3000.0), nv=5, det=11.0, vib_hz=5.0, vib_c=4.0, air=0.3, seed=int(a) % 31), a,
              g=0.42, hall=0.45)
        c.put('sub', sub_note(CH[nm]['s'], b - a, att=0.2, rel=0.8), a, g=0.26)
    for dt, mm, v in ((1.0, 38, 0.6), (2.0, 38, 0.55), (3.0, 38, 0.5), (4.0, 38, 0.6)):
        c.tom(drop_t + dt, mm, g=v, hall=0.3)
    for dt in (2.0, 6.0):
        c.kick(drop_t + dt, 'punch', g=0.6, pump=0.4, hall=0.1)
    for k, dt in enumerate((2.0, 6.0, 10.0)):
        if drop_t + dt < e - 2.0:
            motif(c, drop_t + dt, 'bell', g=0.55 - 0.1 * k, notes=(81, 78, 74, 69), echo=0.55, hall=0.5)
    c.put('pads', choir_chord([50, 57, 62, 66, 69], e - (drop_t + 4.0), att=2.5, rel=2.5, vowel='oo', seed=7), drop_t + 4.0, g=0.4, hall=0.5)
    c.auto.extend([(drop_t + 4.0, 0.0), (drop_t + 8.0, -6.0), (e - 3.0, -16.0), (e - 0.7, -60.0)])


SCENES = [('open', scene_open), ('title', scene_title), ('craft', scene_craft), ('dark', scene_dark),
          ('why', scene_why), ('reason', scene_reason), ('war', scene_war), ('final', scene_final)]


# ====================================================================== 收尾：包络 / 侧链 / 混响 / 静默
def pump_env(N, kicks, tau=0.17, att=0.004):
    out = np.ones(N, np.float32)
    cache = {}
    L = int(4.5 * tau * SR)
    x = np.arange(L) / SR
    for t, d in kicks:
        i0 = int(round(t * SR))
        if i0 >= N:
            continue
        seg = cache.get(d)
        if seg is None:
            seg = cache[d] = (1.0 - d * (1.0 - np.exp(-x / att)) * np.exp(-x / tau)).astype(np.float32)
        j = min(N, i0 + L)
        np.minimum(out[i0:j], seg[:j - i0], out=out[i0:j])
    return out


def gate_curves(N, stops):
    """返回 (fast, slow)：fast 给干声（12 ms 快速切断），slow 给混响尾（指数回落，保留一点尾巴）。"""
    fast, slow = np.ones(N, np.float32), np.ones(N, np.float32)
    for t0, d, _ in stops:
        i0, i1 = int(round(t0 * SR)), min(N, int(round((t0 + d) * SR)))
        a = nsamp(0.012)
        if i0 - a >= 0:
            fast[i0 - a:i0] = np.cos(np.linspace(0.0, math.pi / 2, a)) ** 2
        fast[i0:i1] = 0.0
        x = np.arange(i1 - i0) / SR
        slow[i0:i1] = np.maximum(0.02, np.exp(-x / 0.42))
    return fast, slow


def finalize(c, log=log):
    N = c.N
    stems = {k: c.buf[k] for k in Ctx.STEMS}
    tsec = (np.arange(N, dtype=np.float32) / np.float32(SR))
    if c.auto:
        pts = sorted(c.auto)
        g = (10.0 ** (np.interp(tsec, [p[0] for p in pts], [p[1] for p in pts]) / 20.0)).astype(np.float32)
        for k in c.SENDS:
            c.snd[k] *= g
        for k in ('sub', 'bass', 'drums', 'pads', 'keys', 'fx'):
            stems[k] *= g
    # 侧链：底鼓抽吸 pads / bass / keys
    pe = pump_env(N, sorted(c.kicks))
    for k, sc in (('bass', 1.0), ('pads', 1.0), ('keys', 0.55)):
        stems[k] *= (1.0 - sc * (1.0 - pe))
    # 乒乓回声 → keys
    echo = pingpong(c.snd['echo'], 0.375, fb=0.46, taps=6, lpf=4200.0)[:, :N]
    stems['keys'] += echo
    c.snd['echo'] = None
    # 三种混响：厅（长）、板（亮）、房间（短）
    irs = {'hall': make_ir(4.6, pre=0.028, seed=11, damp=0.4, lf=140.0, hf=8200.0, bloom=0.035),
           'plate': make_ir(1.7, pre=0.012, seed=12, damp=0.6, lf=220.0, hf=11000.0, bloom=0.008),
           'room': make_ir(0.5, pre=0.004, seed=13, damp=0.5, lf=180.0, hf=9000.0, bloom=0.004)}
    verb = np.zeros((2, N), np.float32)
    lv = {'hall': 1.0, 'plate': 0.8, 'room': 0.8}
    for k, ir in irs.items():
        if np.any(c.snd[k]):
            verb += reverb(c.snd[k], ir, N) * np.float32(lv[k])
    stems['verb'] = verb
    # 静默：干声快切、混响尾慢落，并在空隙里放一丝高频长音
    fast, slow = gate_curves(N, c.stops)
    for k in Ctx.STEMS:
        stems[k] *= fast
    stems['verb'] *= slow
    for t0, d, drone in c.stops:
        if not drone:
            continue
        n = nsamp(d)
        t = tt(n)
        x = (np.sin(TAU * 1174.66 * t) + 0.7 * np.sin(TAU * 1176.2 * t + 1.0) + 0.6 * np.sin(TAU * 1760.0 * t + 2.0) + 0.4 * np.sin(TAU * 2349.3 * t + 0.5))
        x *= np.interp(t, [0, 0.35, d - 0.05, d], [0, 1, 1, 0]) * (0.75 + 0.25 * np.sin(TAU * 0.9 * t))
        i0 = nsamp(t0)
        j = min(N, i0 + n)
        stems['fx'][:, i0:j] += (0.006 * x[:j - i0]).astype(np.float32)
    # 去直流 / 次声
    for k in list(stems):
        stems[k] = sg.sosfilt(_sos('high', 22.0, 2), stems[k], axis=-1).astype(np.float32)
    # 片尾淡出，末 0.5 秒静音
    fo = np.clip((c.dur - 0.5 - tsec) / 2.0, 0.0, 1.0) ** 1.5
    for k in stems:
        stems[k] *= fo
    return stems


def render_stems(tl, scenes=None, log=log):
    """返回 dict：sub / bass / drums / pads / keys / fx / verb，每个 (2, N) float32。"""
    c = Ctx(tl, only=scenes)
    for sid, fn in SCENES:
        if sid in c.sc and c.on(sid):
            fn(c)
    return finalize(c, log)


def render(tl, scenes=None, log=log):
    """整条配乐（未做旁白闪避）：(N, 2) float32。"""
    st = render_stems(tl, scenes, log)
    return np.ascontiguousarray(sum(st.values()).T)


if __name__ == '__main__':
    utf8_stdio()
    import time
    t0 = time.time()
    tl = load_json(P('script', 'timeline.json'))
    m = render(tl)
    log(f'[music] {m.shape} peak {np.abs(m).max():.3f}  {time.time() - t0:.1f}s')
