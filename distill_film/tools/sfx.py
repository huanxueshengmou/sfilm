# 音效合成：按 script/timeline.json 的 cue 生成（与画面同源），纯 numpy + scipy，固定随机种子。
# 输出两条总线：impact（drop/hit/boom/riser/swell/whoosh）与 detail（其余细节音效），由 mix.py 分别闪避。
import math
import os
import sys

import numpy as np
from scipy import signal as sg  # noqa: F401

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import P, load_json, log, utf8_stdio  # noqa: E402
from music import (SR, TAU, SEED, nsamp, tt, mtof, panlr, lp, hp, bp, sweep, make_ir, reverb, fade, norm, drive,  # noqa: E402
                   expcurve, glide_sine, saw, square, sine, morph_lp, crash, bell_note)

IMPACT = ('drop', 'hit', 'boom', 'riser', 'swell', 'whoosh')


class SfxCtx:
    def __init__(self, tl):
        self.N = int(math.ceil(float(tl['duration']) * SR - 1e-6))
        self.buf = {b: np.zeros((2, self.N), np.float32) for b in ('impact', 'detail')}
        self.snd = {(b, k): np.zeros(self.N, np.float32) for b in ('impact', 'detail') for k in ('hall', 'plate')}

    def put(self, bus, y, t, pan=0.0, g=1.0, hall=0.0, plate=0.0):
        i0 = int(round(t * SR))
        m = y.shape[-1]
        a, b = max(0, -i0), min(m, self.N - i0)
        if b <= a or g == 0.0:
            return
        seg = y[..., a:b]
        i0 += a
        j = i0 + (b - a)
        if y.ndim == 2:
            self.buf[bus][:, i0:j] += seg * g
            mono = 0.5 * (seg[0] + seg[1])
        else:
            l, r = panlr(pan)
            self.buf[bus][0, i0:j] += seg * (g * l)
            self.buf[bus][1, i0:j] += seg * (g * r)
            mono = seg
        if hall:
            self.snd[(bus, 'hall')][i0:j] += mono * (g * hall)
        if plate:
            self.snd[(bus, 'plate')][i0:j] += mono * (g * plate)


def bump(tm, st, att, dec):
    x = tm - st
    return np.where(x >= 0, (1.0 - np.exp(-np.maximum(x, 0) / att)) * np.exp(-np.maximum(x, 0) / dec), 0.0)


def pan_stereo(x, pan):
    """单声道 + 逐采样声像数组 → (2, n)（等功率）。"""
    a = (np.clip(pan, -1, 1) + 1.0) * math.pi / 4.0
    return np.stack([x * np.cos(a) * math.sqrt(2.0), x * np.sin(a) * math.sqrt(2.0)])


# ====================================================================== 冲击类
def s_drop(c, t, g, q, rng):
    """段落重拍：次低音下坠 + 电影感重击 + 镲 + 下扫噪声 + 长尾。"""
    n = nsamp(4.8)
    tm = tt(n)
    sub = glide_sine(92, 27, 0.26, n) * (1.0 - np.exp(-tm / 0.003)) * np.exp(-tm / 1.5)
    c.put('impact', fade(drive(sub, 1.5), 0.0, 0.5), t, g=0.5 * g)
    n2 = nsamp(2.6)
    t2 = tt(n2)
    nzz = bp(rng.standard_normal(n2), 90, 5200) * (0.7 * np.exp(-t2 / 0.11) + 0.3 * np.exp(-t2 / 0.5))
    thump = glide_sine(125, 41, 0.05, n2, 0.42)
    metal = sum(a * np.sin(TAU * 172.0 * r * t2 + i) * np.exp(-t2 / (1.5 / (1 + 0.3 * i))) for i, (r, a) in enumerate(((1.0, 1.0), (1.47, 0.7), (2.09, 0.5), (2.56, 0.4), (3.41, 0.3))))
    y = drive(0.6 * nzz + 0.9 * thump + 0.12 * metal, 1.4)
    c.put('impact', norm(fade(y, 0.0004, 0.4), 0.9), t, g=0.6 * g, hall=0.5, plate=0.2)
    c.put('impact', crash(5.0, 17), t, g=0.5 * g, hall=0.25)
    n3 = nsamp(1.8)
    t3 = tt(n3) / 1.8
    sw = sweep(rng.standard_normal(n3), 'bp', 5200.0 * (150.0 / 5200.0) ** (t3 ** 0.7), q=1.8, block=128)
    c.put('impact', norm(fade(sw * np.exp(-t3 / 0.35), 0.001, 0.2), 0.8), t, g=0.32 * g, hall=0.3)
    n4 = nsamp(5.0)
    t4 = tt(n4)
    rum = lp(rng.standard_normal(n4), 120.0) * np.exp(-t4 / 1.8) * (1.0 - np.exp(-t4 / 0.05))
    c.put('impact', norm(fade(rum, 0.01, 0.6), 0.8), t, g=0.28 * g)


def s_hit(c, t, g, q, rng):
    n = nsamp(1.4)
    tm = tt(n)
    thump = glide_sine(118, 46, 0.032, n, 0.22)
    snap = bp(rng.standard_normal(n), 250, 6500) * np.exp(-tm / 0.06)
    body = lp(saw(62.0, n), 420) * np.exp(-tm / 0.14)
    y = drive(0.95 * thump + 0.45 * snap + 0.3 * body, 1.5)
    c.put('impact', norm(fade(y, 0.0004, 0.06), 0.9), t, g=0.8 * g, hall=0.22, plate=0.12)


def s_boom(c, t, g, q, rng):
    """深沉次低音轰鸣 + 远雷（多段不规则隆隆声，频率缓慢下沉）。"""
    n = nsamp(5.0)
    tm = tt(n)
    sub = glide_sine(56, 27, 0.5, n, 1.7) * (1.0 - np.exp(-tm / 0.006))
    env = np.zeros(n)
    for k in range(6):
        env += rng.uniform(0.35, 1.0) * (0.85 ** k) * bump(tm, 0.03 + k * 0.32 + rng.uniform(0, 0.25), 0.05, rng.uniform(0.5, 1.1))
    thunder = morph_lp(lp(rng.standard_normal(n), 300.0) * env, expcurve(n, 420.0, 110.0))
    y = drive(0.9 * sub + 1.3 * thunder / max(1e-9, np.abs(thunder).max()) * 0.6, 1.25)
    c.put('impact', norm(fade(y, 0.004, 0.3), 0.9), t, g=0.85 * g, hall=0.4)


def s_riser(c, t, g, q, rng):
    """噪声 + 合成器上升音，在 t 处达到顶点并骤停（长度 dur）；终点音高落在 D。"""
    dur = float(q.get('dur', 3.0))
    n = nsamp(dur)
    p = tt(n) / dur
    fc = 250.0 * (9000.0 / 250.0) ** (p ** 1.3)
    noise = np.stack([sweep(rng.standard_normal(n), 'bp', fc, q=2.2, block=128) for _ in range(2)]) * (p ** 2.0)
    air = hp(rng.standard_normal((2, n)), 4500.0) * (p ** 3.0) * 0.35
    f = 146.83 * 2.0 ** (2.0 * p ** 1.4)
    syn = np.zeros(n)
    for cents, ph in ((-9, 0.0), (0, 0.3), (9, 0.6), (1200, 0.1)):
        syn += saw(f * 2.0 ** (cents / 1200.0), n, ph) * (0.5 if cents == 1200 else 1.0)
    syn = morph_lp(syn, 300.0 + 8200.0 * p ** 1.5) * (p ** 2.4)
    y = noise * 0.9 + air + syn * 0.22
    y = y * np.minimum(1.0, (dur - tt(n)) / 0.012)
    c.put('impact', norm(fade(y, 0.002, 0.0), 0.8), t - dur, g=0.7 * g, hall=0.12)


def s_swell(c, t, g, q, rng):
    """反向镲式渐强：从 t 起，在 t+dur 达到顶点并骤停。"""
    dur = float(q.get('dur', 2.0))
    n = nsamp(dur)
    p = tt(n) / dur
    fc = 1500.0 * (10000.0 / 1500.0) ** p
    x = np.stack([sweep(rng.standard_normal(n), 'bp', fc, q=0.9, block=128) for _ in range(2)]) * (p ** 2.3)
    x = x + hp(rng.standard_normal((2, n)), 6500.0) * (p ** 3.0) * 0.4
    x = x * np.minimum(1.0, (dur - tt(n)) / 0.03)
    c.put('impact', norm(fade(x, 0.002, 0.0), 0.75), t, g=0.55 * g, hall=0.15)


def s_whoosh(c, t, g, q, rng):
    dur = 0.9
    n = nsamp(dur)
    p = tt(n) / dur
    fc = 380.0 + 4300.0 * np.sin(math.pi * p) ** 1.2
    x = sweep(rng.standard_normal(n), 'bp', fc, q=1.2, block=128) * np.sin(math.pi * p) ** 2
    d = 1.0 if int(round(t * 10)) % 2 == 0 else -1.0
    y = pan_stereo(norm(x, 0.9), d * 0.75 * (2.0 * p - 1.0))
    c.put('impact', y, t - dur / 2, g=0.6 * g, hall=0.12)


# ====================================================================== 细节类
def s_blip(c, t, g, q, rng):
    n = nsamp(0.18)
    tm = tt(n)
    f = float(rng.choice([1174.66, 1396.9, 1760.0]))
    y = sine(f, n) * np.exp(-tm / 0.035) + 0.3 * sine(2 * f, n, 0.1) * np.exp(-tm / 0.02) + 0.15 * sine(f / 2, n) * np.exp(-tm / 0.05)
    c.put('detail', norm(fade(y, 0.001, 0.02), 0.7), t, pan=float(rng.uniform(-0.3, 0.3)), g=0.55 * g, plate=0.25, hall=0.1)


def s_tick(c, t, g, q, rng):
    n = nsamp(0.03)
    tm = tt(n)
    y = bp(rng.standard_normal(n), 3200, 9500) * np.exp(-tm / 0.0022) + 0.5 * sine(2600.0, n) * np.exp(-tm / 0.006)
    c.put('detail', norm(fade(y, 0.0002, 0.006), 0.6), t, pan=float(rng.uniform(-0.25, 0.25)), g=0.45 * g, plate=0.12)


def s_warn(c, t, g, q, rng):
    for k, f in enumerate((659.26, 466.16)):
        n = nsamp(0.15)
        tm = tt(n)
        y = lp(square(f, n), 3200.0) * np.minimum(1.0, tm / 0.004) * np.exp(-tm / 0.12)
        c.put('detail', norm(fade(drive(y, 1.8), 0.001, 0.03), 0.65), t + k * 0.16, g=0.5 * g, plate=0.2, hall=0.08)


def ding():
    n = nsamp(1.0)
    tm = tt(n)
    y = sum(a * np.sin(TAU * 1174.66 * r * tm + i) * np.exp(-tm / d) for i, (r, a, d) in enumerate(((1.0, 1.0, 0.32), (2.0, 0.4, 0.2), (3.01, 0.22, 0.12), (4.2, 0.1, 0.07))))
    return norm(fade(y, 0.0005, 0.05), 0.7)


def s_count(c, t, g, q, rng):
    """加速计数滴答，以一声小“叮”收尾（落在 t+dur）。"""
    dur = float(q.get('dur', 2.0))
    M = max(6, int(dur * 10))
    for k in range(M):
        x = k / M
        tk = dur * (1.0 - (1.0 - x) ** 1.8)
        n = nsamp(0.03)
        tm = tt(n)
        f = 1400.0 + 1800.0 * x
        y = sine(f, n) * np.exp(-tm / 0.006) + 0.6 * bp(rng.standard_normal(n), 3500, 9000) * np.exp(-tm / 0.002)
        c.put('detail', norm(fade(y, 0.0002, 0.006), 0.6), t + tk, pan=0.15 * math.sin(k), g=(0.3 + 0.5 * x) * g, plate=0.12)
    c.put('detail', ding(), t + dur, g=0.5 * g, plate=0.2, hall=0.25)


def s_type(c, t, g, q, rng):
    """机械键盘敲击：点击 + 闷响，间隔随机带突发与停顿，每 7 键一次空格。"""
    dur = float(q.get('dur', 2.0))
    tk, k = 0.0, 0
    while tk < dur:
        space = k % 7 == 6
        n = nsamp(0.07)
        tm = tt(n)
        fc = float(rng.uniform(2200, 4800))
        click = bp(rng.standard_normal(n), fc * 0.7, fc * 1.6) * np.exp(-tm / 0.0025)
        thock = sine(float(rng.uniform(150, 260)) * (0.7 if space else 1.0), n, float(rng.random())) * np.exp(-tm / 0.012) * (0.9 if space else 0.55)
        y = norm(fade(0.7 * click + thock, 0.0002, 0.01), 0.7)
        c.put('detail', y, t + tk, pan=float(rng.uniform(-0.3, 0.3)), g=g * float(rng.uniform(0.35, 0.65)) * (1.3 if space else 1.0), plate=0.12)
        gap = float(rng.gamma(2.2, 0.04))
        if rng.random() < 0.08:
            gap += float(rng.uniform(0.12, 0.3))
        tk += max(0.03, gap)
        k += 1


def s_drip(c, t, g, q, rng):
    """水滴“咕咚”：音高下坠的共振正弦 + 小涟漪 + 大混响。"""
    n = nsamp(0.6)
    tm = tt(n)
    y = glide_sine(1900.0, 740.0, 0.05, n) * np.exp(-tm / 0.085) * np.minimum(1.0, tm / 0.001)
    y += 0.3 * glide_sine(2400.0, 930.0, 0.05, n) * np.exp(-np.maximum(tm - 0.19, 0) / 0.06) * (tm > 0.19)
    y += 0.35 * glide_sine(320.0, 130.0, 0.02, n) * np.exp(-tm / 0.03)
    y += 0.18 * sine(2217.0, n) * np.exp(-tm / 0.25)
    c.put('detail', norm(fade(y, 0.0005, 0.08), 0.7), t, pan=float(rng.uniform(-0.2, 0.2)), g=0.6 * g, plate=0.45, hall=0.5)


def s_sizzle(c, t, g, q, rng):
    """受热噼啪：泊松随机脆响 + 高频嘶声 + 低频火声，Hann 淡入淡出。"""
    dur = float(q.get('dur', 2.5))
    n = nsamp(dur)
    tm = tt(n)
    win = np.sin(math.pi * tm / dur) ** 2
    out = np.zeros((2, n))
    rumble = lp(rng.standard_normal(n), 240.0) * 0.05
    for ch in range(2):
        bed = hp(rng.standard_normal(n), 5500.0) * 0.05 * (0.7 + 0.3 * np.sin(TAU * float(rng.uniform(3, 9)) * tm))
        cr = np.zeros(n)
        m = int(dur * float(rng.uniform(35, 55)))
        for pos, amp in zip(rng.integers(0, n - 400, m), np.minimum(rng.exponential(0.5, m), 2.0)):
            L = int(rng.uniform(30, 160))
            cr[pos:pos + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L * 0.3)) * amp
        out[ch] = (bp(cr, 1800, 9000) * 0.22 + bed + rumble * 0.6) * win
    c.put('detail', out, t, g=0.75 * g, plate=0.08)


PENT_MIN = [81, 84, 86, 89, 91, 93, 96, 98]
PENT_MAJ = [78, 81, 83, 86, 88, 90, 93, 95, 98]


def s_shimmer(c, t, g, q, rng):
    """高频闪烁钟声：D 小调五声音阶（终段大调后换 D 大调五声），密度先升后降。"""
    dur = float(q.get('dur', 2.0))
    major = q.get('scene') == 'final' and t > 290.0
    notes = PENT_MAJ if major else PENT_MIN
    tk = 0.0
    while tk < dur:
        p = tk / dur
        rate = 5.0 + 14.0 * math.sin(math.pi * p)
        m = int(rng.choice(notes))
        w = bell_note(m, 1.6, 'glock')
        c.put('detail', w, t + tk, pan=float(rng.uniform(-0.8, 0.8)), g=g * 0.4 * (0.35 + 0.65 * math.sin(math.pi * min(1.0, p * 0.9 + 0.05))) * float(rng.uniform(0.6, 1.0)),
              hall=0.4, plate=0.2)
        tk += float(rng.exponential(1.0 / rate))
    n = nsamp(dur + 0.6)
    tm = tt(n)
    air = hp(rng.standard_normal((2, n)), 7500.0) * np.sin(math.pi * np.clip(tm / (dur + 0.6), 0, 1)) ** 2 * (0.6 + 0.4 * np.sin(TAU * 7.0 * tm)) * 0.03
    c.put('detail', air, t, g=g)


def s_glitch(c, t, g, q, rng):
    """数字故障 ≈0.4 秒：音调碎片重复（stutter）+ 比特压缩 + 下行 zap + 门控噪声。"""
    n = nsamp(0.42)
    tm = tt(n)
    y = np.zeros(n)
    k = 0
    pos = 0.0
    while pos < 0.36:
        L = float(rng.uniform(0.03, 0.055))
        f = float(rng.uniform(180, 1500))
        seg = saw(f * (1.0 + 0.5 * rng.random()), nsamp(L), float(rng.random()))
        seg = fade(seg * np.exp(-tt(len(seg)) / (L * 0.8)), 0.0003, 0.003)
        for rpt in range(int(rng.integers(2, 4))):
            i0 = nsamp(pos + rpt * L)
            y[i0:i0 + len(seg)] += seg[:max(0, n - i0)] * (0.85 ** rpt)
        pos += L * 2.2
        k += 1
    for zt in rng.uniform(0.0, 0.3, 2):
        nz_ = nsamp(0.06)
        y[nsamp(zt):nsamp(zt) + nz_] += 0.8 * glide_sine(6500.0, 300.0, 0.02, nz_) * np.exp(-tt(nz_) / 0.03)
    gate = np.repeat(rng.random(n // 576 + 2) > 0.45, 576)[:n]
    y += 0.35 * gate * bp(rng.standard_normal(n), 1200, 9000)
    hold = int(rng.integers(5, 10))
    y = np.round(np.repeat(y[::hold], hold)[:n] * 6.0) / 6.0
    y = hp(y, 160.0) * np.minimum(1.0, (0.42 - tm) / 0.03)
    c.put('detail', norm(fade(y, 0.0005, 0.02), 0.75), t, pan=float(rng.uniform(-0.4, 0.4)), g=0.55 * g, plate=0.15)


def s_alarm(c, t, g, q, rng):
    """低频警报脉冲：三全音（A3 / Eb4）交替，八分音符节拍，渐入渐出。"""
    dur = float(q.get('dur', 2.5))
    n = nsamp(dur + 0.3)
    tm = tt(n)
    step = 0.25
    y = np.zeros(n)
    k = 0
    while k * step < dur:
        f = 220.0 if k % 2 == 0 else 311.13
        L = nsamp(0.2)
        seg = lp(0.6 * saw(f, L) + 0.4 * square(f * 1.004, L), 1500.0)
        seg = drive(seg * 0.9, 2.0) * np.minimum(1.0, tt(L) / 0.006) * np.minimum(1.0, (0.2 - tt(L)) / 0.02)
        i0 = nsamp(k * step)
        y[i0:i0 + L] += seg[:max(0, n - i0)]
        k += 1
    y *= np.interp(tm, [0, 0.3, max(dur - 0.8, 0.4), dur + 0.3], [0, 1, 1, 0])
    c.put('detail', norm(fade(y, 0.002, 0.05), 0.75), t, g=0.6 * g, hall=0.2, plate=0.1)


def s_swarm(c, t, g, q, rng):
    """数据小虫群：大量微型啁啾 + 嗡嗡底噪，密度与音量随时间上升。"""
    dur = float(q.get('dur', 4.5))
    n = nsamp(dur + 0.6)
    out = np.zeros((2, n))
    tm = tt(n)
    tk = 0.0
    while tk < dur:
        p = tk / dur
        L = nsamp(float(rng.uniform(0.006, 0.024)))
        f0 = float(rng.uniform(1500, 6500))
        f1 = f0 * float(rng.choice([0.6, 0.8, 1.25, 1.6]))
        tl_ = tt(L)
        seg = np.sin(TAU * (f0 * tl_ + 0.5 * (f1 - f0) * tl_ ** 2 / (L / SR))) * np.sin(math.pi * tl_ / (L / SR)) ** 2
        a = float(rng.uniform(0.2, 1.0)) * (0.3 + 0.7 * p)
        pan = float(rng.uniform(-1, 1))
        l_, r_ = panlr(pan)
        i0 = nsamp(tk)
        out[0, i0:i0 + L] += seg * a * l_
        out[1, i0:i0 + L] += seg * a * r_
        tk += float(rng.exponential(1.0 / (15.0 + 285.0 * p ** 2)))
    buzz = np.stack([bp(rng.standard_normal(n), 900, 2600) for _ in range(2)])
    buzz *= (0.5 + 0.5 * np.sin(TAU * (70.0 + 50.0 * tm / dur) * tm)) * np.clip(tm / dur, 0, 1) ** 1.6
    out = out * 0.18 + buzz * 0.12
    out *= np.interp(tm, [0, 0.2, dur, dur + 0.6], [0, 1, 1, 0])
    c.put('detail', norm(fade(out, 0.002, 0.05), 0.75), t, g=0.6 * g, plate=0.1, hall=0.1)


GEN = {'drop': s_drop, 'hit': s_hit, 'boom': s_boom, 'riser': s_riser, 'swell': s_swell, 'whoosh': s_whoosh,
       'blip': s_blip, 'tick': s_tick, 'warn': s_warn, 'count': s_count, 'type': s_type, 'drip': s_drip,
       'sizzle': s_sizzle, 'shimmer': s_shimmer, 'glitch': s_glitch, 'alarm': s_alarm, 'swarm': s_swarm}


def render_parts(tl, log=log):
    """返回 dict：impact / detail，各 (2, N) float32（已含各自混响回送）。"""
    c = SfxCtx(tl)
    for idx, q in enumerate(tl['cues']):
        fn = GEN.get(q['type'])
        if fn is None:
            continue
        rng = np.random.default_rng([SEED + 77, idx])
        fn(c, float(q['t']), float(q.get('gain', 1.0)), q, rng)
    irs = {'hall': make_ir(4.2, pre=0.025, seed=21, damp=0.4, lf=140.0, hf=8500.0, bloom=0.03),
           'plate': make_ir(1.5, pre=0.01, seed=22, damp=0.6, lf=220.0, hf=11000.0, bloom=0.008)}
    out = {}
    for b in ('impact', 'detail'):
        buf = c.buf[b]
        for k, ir in irs.items():
            s = c.snd[(b, k)]
            if np.any(s):
                buf += reverb(s, ir, c.N)
        out[b] = buf
    return out


def render(tl, log=log):
    """整条音效 (N, 2) float32。"""
    p = render_parts(tl, log)
    return np.ascontiguousarray((p['impact'] + p['detail']).T)


if __name__ == '__main__':
    utf8_stdio()
    import time
    t0 = time.time()
    tl = load_json(P('script', 'timeline.json'))
    m = render(tl)
    log(f'[sfx] {m.shape} peak {np.abs(m).max():.3f}  {time.time() - t0:.1f}s')
