# 混音 + 母带：旁白处理 → 旁白侧链压低音乐/音效（并在 1–4 kHz 让出频段）→ 三条总线 →
# 胶水压缩 → 软削波 → 真峰值安全限制器 → 按 ITU-R BS.1770-4 校准到 -14 LUFS（峰值 ≤ -1.0 dBTP）。
# 输出 audio/build/：mix.f32（48k 立体声 float32 交错）、mix.wav、music.wav、sfx.wav、voice.wav、report.json
import gc
import math
import os
import sys
import time

import numpy as np
from scipy import ndimage
from scipy import signal as sg

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import P, load_json, log as _log, read_wav, save_json, utf8_stdio, write_wav  # noqa: E402
import music  # noqa: E402
import sfx  # noqa: E402
from music import SR, make_ir, nsamp, rbj, reverb  # noqa: E402

TARGET_LUFS = -14.0
CEIL_DB = -1.3          # 限制器检测上限（留余量，最终实测 ≤ -1.0 dBTP）
HOP = 48                # 动态处理的帧步长（1 ms）


# ====================================================================== 响度 / 真峰值（BS.1770-4）
_KB1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
_KB2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def kweight(x):
    """K 加权（两级 biquad，48 kHz 系数取自标准）。x: (c, n) → float64。"""
    y = sg.lfilter(_KB1[0], _KB1[1], np.asarray(x, dtype=np.float64), axis=-1)
    return sg.lfilter(_KB2[0], _KB2[1], y, axis=-1)


def _cs(y):
    z = np.cumsum(y * y, axis=-1)
    return np.concatenate([np.zeros((y.shape[0], 1)), z], axis=1)


def gated_lufs(cs, blk=19200, hop=4800):
    """400 ms 块、75% 重叠；绝对门限 -70 LUFS、相对门限 -10 LU。cs 为 K 加权平方的累加。"""
    n = cs.shape[1] - 1
    if n < blk:
        return -99.0
    idx = np.arange(0, n - blk + 1, hop)
    ms = ((cs[:, idx + blk] - cs[:, idx]) / blk).sum(axis=0)
    l = -0.691 + 10 * np.log10(ms + 1e-12)
    m1 = ms[l > -70.0]
    if len(m1) == 0:
        return -99.0
    rel = -0.691 + 10 * math.log10(m1.mean()) - 10.0
    m2 = m1[(-0.691 + 10 * np.log10(m1)) > rel]
    return -0.691 + 10 * math.log10(m2.mean()) if len(m2) else -99.0


def seg_lufs(cs, a, b):
    """区间平均（无门限）LUFS；静音返回 -99。"""
    a, b = int(a), int(b)
    if b <= a:
        return -99.0
    ms = float(((cs[:, b] - cs[:, a]) / (b - a)).sum())
    return max(-99.0, -0.691 + 10 * math.log10(ms + 1e-12))


def lufs(x):
    return gated_lufs(_cs(kweight(x)))


def rms_db(x):
    return max(-99.0, 10 * math.log10(float(np.mean(np.asarray(x, dtype=np.float64) ** 2)) + 1e-12))


def peak_env(x, chunk=1 << 20, pad=96):
    """4 倍过采样（resample_poly）逐采样真峰值包络，双声道取最大。x: (2, N) → (N,) float32。"""
    N = x.shape[1]
    p = np.empty(N, np.float32)
    for i in range(0, N, chunk):
        a, b = max(0, i - pad), min(N, i + chunk + pad)
        up = sg.resample_poly(x[:, a:b], 4, 1, axis=1)
        m = np.abs(up).max(axis=0)
        m = m[:(b - a) * 4].reshape(-1, 4).max(axis=1)
        j = min(N, i + chunk)
        p[i:j] = m[i - a:i - a + (j - i)]
    return p


def true_peak_db(x):
    return 20 * math.log10(float(peak_env(x).max()) + 1e-12)


# ====================================================================== 动态处理（帧级）
def smooth_ar(x, att, rel):
    """非线性一阶平滑：上升用 att、下降用 rel（系数为每帧比例）。"""
    y = np.empty(len(x))
    s = float(x[0]) if len(x) else 0.0
    for i, v in enumerate(x.tolist()):
        s += (att if v > s else rel) * (v - s)
        y[i] = s
    return y


def coef(t_sec, hop=HOP):
    return 1.0 - math.exp(-hop / (max(t_sec, 1e-4) * SR))


def expand(fr, N, hop=HOP):
    return np.interp(np.arange(N), np.arange(len(fr)) * hop + hop / 2, fr).astype(np.float32)


def frames_db(x, win=480, hop=HOP):
    p = x * x if x.ndim == 1 else 0.5 * (x[0] * x[0] + x[1] * x[1])
    m = ndimage.uniform_filter1d(p, size=win, mode='constant')[hop // 2::hop]
    return 10 * np.log10(m + 1e-12)


def gr_curve(lvl_db, thr, ratio, knee):
    over = lvl_db - thr
    k = max(knee, 1e-3)
    gr = np.where(over <= -k / 2, 0.0, np.where(over >= k / 2, over, (over + k / 2) ** 2 / (2 * k)))
    return gr * (1.0 - 1.0 / ratio)


def compress(x, thr, ratio, att, rel, knee=6.0, win=480):
    """帧级压缩器：返回逐采样线性增益（x 为单声道或 (2,N) 联动）。"""
    gr = smooth_ar(gr_curve(frames_db(x, win), thr, ratio, knee), coef(att), coef(rel))
    return expand(10 ** (-gr / 20.0), x.shape[-1])


def limiter_gain(p, ceil, look, rel_s, hop=24):
    """前瞻限制器增益：前向最小值 + 滑动平均（平滑起音）+ 帧级指数释放；保证 g[n]·p[n] ≤ ceil。"""
    need = np.minimum(1.0, ceil / np.maximum(p, 1e-9)).astype(np.float32)
    g = ndimage.uniform_filter1d(ndimage.minimum_filter1d(need, size=2 * look - 1, mode='nearest'), size=look, mode='nearest')
    N = len(g)
    nf = (N + hop - 1) // hop
    b = np.concatenate([g, np.ones(nf * hop - N, np.float32)]).reshape(nf, hop).min(axis=1)
    B = np.minimum(np.concatenate([[1.0], b]), np.concatenate([b, [1.0]]))
    a = 1.0 - math.exp(-hop / (rel_s * SR))
    r = np.empty(nf + 1)
    cur = 1.0
    for j, v in enumerate(B.tolist()):
        cur = min(v, cur + a * (1.0 - cur))
        r[j] = cur
    return np.interp(np.arange(N), np.arange(nf + 1) * hop, r).astype(np.float32)


def softclip(x, th=0.72):
    a = np.abs(x)
    m = a > th
    if m.any():
        k = 1.0 - th
        x = x.copy()
        x[m] = np.sign(x[m]) * (th + k * np.tanh((a[m] - th) / k))
    return x


# ====================================================================== 旁白
SCENE_VERB = {'open': 0.30, 'title': 0.34, 'craft': 0.14, 'dark': 0.26, 'why': 0.14, 'reason': 0.16, 'war': 0.24, 'final': 0.30}


def build_voice(tl, N, log):
    """旁白：逐句电平整理 → HPF/低中频清理/存在感提升 → 3:1 压缩 → 轻微板式混响。返回 (mono 干声 float32, 立体声总线 float32)。"""
    v = np.zeros(N)
    miss = 0
    for lid, L in tl['lines'].items():
        path = P('audio', 'tts', lid + '.wav')
        if not os.path.exists(path):
            miss += 1
            continue
        x, sr = read_wav(path)
        x = x.astype(np.float64)
        if sr != SR:
            g = math.gcd(SR, sr)
            y = sg.resample_poly(x, SR // g, sr // g)
        else:
            y = x
        fr = 960
        nfr = len(y) // fr
        if nfr > 0:
            r = np.sqrt(np.mean(y[:nfr * fr].reshape(nfr, fr) ** 2, axis=1))
            d = 20 * np.log10(r + 1e-9)
            act = d > d.max() - 30.0
            arms = 20 * math.log10(math.sqrt(float(np.mean(r[act] ** 2))) + 1e-9)
            y = y * 10 ** (float(np.clip(-20.0 - arms, -7.0, 7.0)) / 20.0)
        y = music.fade(y, 0.004, 0.006)
        i0 = int(round(float(L['start']) * SR))
        if i0 >= N:
            continue
        m = min(len(y), N - i0)
        v[i0:i0 + m] += y[:m]
    if miss:
        log(f'[mix] 警告：{miss} 段旁白音频缺失')
    v = sg.sosfilt(sg.butter(3, 80.0 / (SR / 2), 'high', output='sos'), v)
    for kind, f, q, gdb in (('peak', 280.0, 0.9, -2.0), ('peak', 3800.0, 0.85, 2.6), ('peak', 7800.0, 1.2, -1.0)):
        b, a = rbj(kind, f, q, gdb)
        v = sg.lfilter(b, a, v)
    gain = compress(v, -25.0, 3.0, 0.006, 0.14, knee=8.0, win=240)
    v = v * gain
    act = np.abs(v) > 10 ** (-45 / 20)
    arms = 20 * math.log10(math.sqrt(float(np.mean(v[act] ** 2))) + 1e-9) if act.any() else -20.0
    v = softclip((v * 10 ** ((-20.0 - arms) / 20.0)).astype(np.float32), 0.75)
    # 板式混响发送：按幕设置湿度，幕交界 120 ms 平滑
    t = np.arange(N, dtype=np.float32) / SR
    xs, ys = [], []
    for s in tl['scenes']:
        a = SCENE_VERB.get(s['id'], 0.18)
        xs += [float(s['start']) + 0.06, float(s['end']) - 0.06]
        ys += [a, a]
    amt = np.interp(t, xs, ys).astype(np.float32)
    ir = make_ir(1.25, pre=0.018, seed=31, damp=0.55, lf=260.0, hf=8000.0, bloom=0.006)
    wet = reverb(v * amt * 0.45, ir, N)
    bus = np.stack([v, v]) + wet
    return v, bus


def duck_amount(v, N, att=0.020, rel=0.350, look=0.025):
    """旁白活动度 0..1（RMS 20 ms）→ 非线性平滑（起音 20 ms / 释放 350 ms）并提前 25 ms 起压。"""
    db = frames_db(v, win=960)
    amt = np.clip((db + 55.0) / 13.0, 0.0, 1.0)
    amt = smooth_ar(amt, coef(att), coef(rel))
    k = int(round(look * SR / HOP))
    amt = np.concatenate([amt[k:], np.zeros(k)])
    return expand(amt, N)


def cue_windows(tl, typ='drop'):
    return [float(q['t']) for q in tl['cues'] if q['type'] == typ]


def drop_curves(tl, N):
    """relax：落点附近放松闪避（冲击不被旁白压扁）；pre：落点前 0.22 s 轻微下沉（让重拍更响）。"""
    t = np.arange(N, dtype=np.float32) / SR
    relax = np.zeros(N, np.float32)
    pre = np.ones(N, np.float32)
    for td in cue_windows(tl):
        x = t - td
        relax = np.maximum(relax, np.where(x < -0.05, 0.0, np.clip(1.0 - (x + 0.05) / 1.6, 0.0, 1.0) ** 0.8).astype(np.float32))
        w = np.clip((x + 0.22) / 0.2, 0.0, 1.0) * (x < 0)
        pre = np.minimum(pre, 1.0 - 0.3 * np.sin(w * math.pi / 2) ** 2 * (x < -0.004))
    return relax, pre


# ====================================================================== 主流程
def build(log=print):
    t_start = time.time()
    tl = load_json(P('script', 'timeline.json'))
    dur = float(tl['duration'])
    N = int(math.ceil(dur * SR - 1e-6))
    out_dir = P('audio', 'build')
    os.makedirs(out_dir, exist_ok=True)
    log(f'[mix] 时长 {dur:.2f}s → {N} 帧 @ {SR} Hz')

    # ---- 1) 旁白
    v_mono, voice = build_voice(tl, N, log)
    log(f'[mix] 旁白完成 {time.time() - t_start:.1f}s')
    # ---- 2) 音乐分轨、音效
    st = music.render_stems(tl, log=log)
    log(f'[mix] 音乐完成 {time.time() - t_start:.1f}s')
    sp = sfx.render_parts(tl, log=log)
    log(f'[mix] 音效完成 {time.time() - t_start:.1f}s')

    # ---- 3) 闪避：旁白包络 → 音乐（低频少压、中高频多压，并额外让出 1–4 kHz）
    amt = duck_amount(v_mono, N)
    relax, pre = drop_curves(tl, N)
    scale = 1.0 - 0.55 * relax

    def duck(x, depth, dip=0.0):
        g = 10 ** (-(depth * amt * scale) / 20.0)
        y = x * g
        if dip > 0:
            mid = sg.sosfilt(sg.butter(2, [1000 / (SR / 2), 4000 / (SR / 2)], 'band', output='sos'), y, axis=-1)
            y = y - mid * (1.0 - 10 ** (-dip * amt / 20.0)).astype(np.float32)
        return y

    low = st['sub'] + st['bass']
    drm = st['drums']
    body = st['pads'] + st['keys'] + st['fx'] + st['verb']
    del st
    gc.collect()
    music_bus = duck(low, 3.5) + duck(drm, 6.5, 3.0) + duck(body, 8.0, 3.5)
    del low, drm, body
    music_bus *= pre
    sfx_bus = duck(sp['impact'], 2.5, 1.5) + duck(sp['detail'], 5.0, 2.5)
    sfx_bus *= pre
    del sp
    gc.collect()

    # ---- 4) 总线电平：以旁白为基准
    speech = amt > 0.6
    vr = rms_db(v_mono[speech]) if speech.any() else -20.0
    mr = rms_db(music_bus[:, speech])
    sr_ = rms_db(sfx_bus[:, speech])
    g_music = 10 ** ((vr - 10.0 - mr) / 20.0)
    g_sfx = 1.0
    log(f'[mix] 旁白段：voice {vr:.1f} dB，music {mr:.1f} dB → 增益 {20 * math.log10(g_music):+.1f} dB，sfx {sr_:.1f} dB')
    music_bus *= np.float32(g_music)
    sfx_bus *= np.float32(g_sfx)

    # ---- 5) 母带
    hp_sos = sg.butter(2, 28.0 / (SR / 2), 'high', output='sos')
    raw = voice + music_bus + sfx_bus
    raw = sg.sosfilt(hp_sos, raw, axis=-1).astype(np.float32)
    fo = np.clip((dur - 0.5 - np.arange(N, dtype=np.float32) / SR) / 1.5, 0.0, 1.0) ** 1.5
    raw *= fo
    L0 = lufs(raw)
    G0 = 10 ** ((TARGET_LUFS - L0 + 1.5) / 20.0)
    log(f'[mix] 未处理混音 {L0:.2f} LUFS，预增益 {20 * math.log10(G0):+.1f} dB')
    x = raw * np.float32(G0)
    cg = compress(x, -19.0, 2.0, 0.030, 0.180, knee=8.0, win=480)
    x *= cg
    # 峰值修整（A 级，采样峰值，较松）→ 软削波 → 真峰值限制（B 级）
    pa = np.abs(x).max(axis=0)
    ga = limiter_gain(pa, 1.25, 192, 0.15)
    x *= ga
    x = softclip(x, 0.72)
    pk = peak_env(x)
    ceil = 10 ** (CEIL_DB / 20.0)
    G = 1.0
    hist = []
    for it in range(10):
        gl = limiter_gain(pk * np.float32(G), ceil, 120, 0.11)
        y = x * (gl * np.float32(G))
        L = lufs(y)
        hist.append((G, L))
        err = TARGET_LUFS - L
        log(f'[mix]   迭代 {it}: G={20 * math.log10(G):+.2f} dB → {L:.3f} LUFS')
        if abs(err) < 0.03:
            break
        if len(hist) >= 2 and abs(hist[-1][1] - hist[-2][1]) > 1e-4:
            slope = (hist[-1][1] - hist[-2][1]) / (20 * math.log10(hist[-1][0] / hist[-2][0]))
            step = err / max(0.2, min(1.5, slope))
        else:
            step = err
        G *= 10 ** (step / 20.0)
    tp = true_peak_db(y)
    if tp > -1.0:
        y *= np.float32(10 ** ((-1.0 - tp) / 20.0) * 0.999)
        tp = true_peak_db(y)
        L = lufs(y)
    gcurve = (cg * ga * gl * np.float32(G * G0))
    log(f'[mix] 成品：{L:.2f} LUFS，真峰值 {tp:.2f} dBTP，限制器最大增益衰减 {-20 * math.log10(float((ga * gl).min())):.1f} dB')

    # ---- 6) 输出与报告
    mix = np.ascontiguousarray(y.T)
    mix.astype('<f4').tofile(os.path.join(out_dir, 'mix.f32'))
    rng = np.random.default_rng(1234)

    def wav(name, arr):
        d = (rng.random((arr.shape[0], 2), dtype=np.float32) - rng.random((arr.shape[0], 2), dtype=np.float32)) / 32768.0
        write_wav(os.path.join(out_dir, name), arr + d, SR)

    wav('mix.wav', mix)
    bus_out = {}
    for name, b in (('music', music_bus), ('sfx', sfx_bus), ('voice', voice)):
        bus_out[name] = (sg.sosfilt(hp_sos, b, axis=-1) * fo * gcurve).astype(np.float32)
        wav(name + '.wav', np.ascontiguousarray(bus_out[name].T))

    cs = {'mix': _cs(kweight(y))}
    for k, b in bus_out.items():
        cs[k] = _cs(kweight(b))
    scenes = []
    for s in tl['scenes']:
        a, b = int(s['start'] * SR), min(N, int(s['end'] * SR))
        row = {'id': s['id'], 'start': s['start'], 'end': s['end']}
        for k in ('mix', 'music', 'sfx', 'voice'):
            seg = (y if k == 'mix' else bus_out[k])[:, a:b]
            row[k] = {'lufs': round(seg_lufs(cs[k], a, b), 2), 'rms_db': round(rms_db(seg), 2)}
        sm = speech[a:b]
        if sm.sum() > SR // 4:
            vv = rms_db(bus_out['voice'][:, a:b][:, sm])
            mm = rms_db((bus_out['music'][:, a:b] + bus_out['sfx'][:, a:b])[:, sm])
            row['voice_over_music_db'] = round(vv - mm, 2)
        scenes.append(row)
    sv = rms_db(bus_out['voice'][:, speech])
    sm_ = rms_db((bus_out['music'] + bus_out['sfx'])[:, speech])
    sm_only = rms_db(bus_out['music'][:, speech])
    drops = []
    for td in cue_windows(tl):
        a, b = int(round((td - 0.15) * SR)), int(round((td + 0.15) * SR))
        seg = np.abs(y[:, max(a, 0):b]).max(axis=0)
        k = int(np.argmax(seg))
        tp_ = (max(a, 0) + k) / SR
        drops.append({'cue_t': td, 'peak_t': round(tp_, 4), 'offset_ms': round((tp_ - td) * 1000, 1), 'peak_db': round(20 * math.log10(float(seg.max()) + 1e-12), 2)})
    mid, side = (y[0] + y[1]) * 0.5, (y[0] - y[1]) * 0.5
    report = {
        'duration_s': dur, 'frames': N, 'sample_rate': SR,
        'integrated_lufs': round(L, 2), 'true_peak_dbtp': round(tp, 2),
        'sample_peak_dbfs': round(20 * math.log10(float(np.abs(y).max()) + 1e-12), 2),
        'limiter_max_gain_reduction_db': round(-20 * math.log10(float((ga * gl).min())), 2),
        'dc_offset': [round(float(y[0].mean()), 7), round(float(y[1].mean()), 7)],
        'stereo_corr': round(float(np.corrcoef(y[0][::7], y[1][::7])[0, 1]), 3),
        'mid_side_db': round(rms_db(side) - rms_db(mid), 2),
        'voice_over_music_speech_db': round(sv - sm_, 2), 'voice_over_musiconly_speech_db': round(sv - sm_only, 2),
        'scenes': scenes, 'drops': drops,
        'runtime_s': round(time.time() - t_start, 1),
    }
    save_json(os.path.join(out_dir, 'report.json'), report)
    log(f'[mix] 完成 {report["runtime_s"]}s → {out_dir}')
    return {'mix_f32': os.path.join(out_dir, 'mix.f32'), 'mix_wav': os.path.join(out_dir, 'mix.wav'),
            'music_wav': os.path.join(out_dir, 'music.wav'), 'sfx_wav': os.path.join(out_dir, 'sfx.wav'),
            'voice_wav': os.path.join(out_dir, 'voice.wav'), 'report': os.path.join(out_dir, 'report.json'), 'stats': report}


if __name__ == '__main__':
    utf8_stdio()
    build(_log)
