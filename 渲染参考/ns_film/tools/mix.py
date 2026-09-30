# 混音 + 母带：音乐/音效/旁白 → 旁白侧链压低音乐 → 混响发送 → 总线压缩/限制 → LUFS 校准（-16 LUFS, 峰值 -1 dBTP）
import json, os, sys, io, math, time
import numpy as np

if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from music import SR, N, CU, render, comb_reverb, onepole, svf
from sfx import render_sfx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'script', 'timeline.json'), encoding='utf-8'))


def voice_track():
    v = np.zeros(N)
    for l in TL['lines'].values():
        x = np.fromfile(os.path.join(ROOT, 'audio', 'tts', l['id'] + '.f32'), dtype=np.float32).astype(np.float64)
        i0 = int(round(l['start'] * SR)); n = min(len(x), N - i0)
        v[i0:i0 + n] += x[:n]
    # 人声处理：高通 90Hz、轻微存在感提升（2.5–5k 带通叠加）、温和压缩
    v = svf(v, np.full(N, 90.0), 0.7, 2)
    pres = svf(v, np.full(N, 3500.0), 0.9, 1)
    v = v + pres * 0.35
    return v


def env_follow(x, att=0.005, rel=0.25):
    a1, a2 = 1 - math.exp(-1 / (att * SR)), 1 - math.exp(-1 / (rel * SR))
    ax = np.abs(x)
    return _ef(ax, a1, a2)


from numba import njit


@njit(cache=True)
def _ef(ax, a1, a2):
    y = np.zeros_like(ax); s = 0.0
    for i in range(len(ax)):
        a = a1 if ax[i] > s else a2
        s += a * (ax[i] - s); y[i] = s
    return y


@njit(cache=True)
def compress(x, thr, ratio, att, rel, sr):
    # 立体声联动峰值压缩；x: (n,2)
    a1 = 1 - math.exp(-1 / (att * sr)); a2 = 1 - math.exp(-1 / (rel * sr))
    y = np.zeros_like(x); env = 0.0
    for i in range(x.shape[0]):
        lv = max(abs(x[i, 0]), abs(x[i, 1]))
        env += (a1 if lv > env else a2) * (lv - env)
        db = 20 * math.log10(env + 1e-9)
        gr = 0.0
        if db > thr: gr = (db - thr) * (1 - 1 / ratio)
        g = 10 ** (-gr / 20)
        y[i, 0] = x[i, 0] * g; y[i, 1] = x[i, 1] * g
    return y


@njit(cache=True)
def limit(x, ceil, look, rel, sr):
    # 前瞻砖墙限制器
    n = x.shape[0]; L = int(look * sr)
    pk = np.zeros(n)
    for i in range(n): pk[i] = max(abs(x[i, 0]), abs(x[i, 1]))
    need = np.ones(n)
    for i in range(n):
        if pk[i] > ceil: need[i] = ceil / pk[i]
    # 前瞻窗口最小值
    g = np.ones(n); a2 = 1 - math.exp(-1 / (rel * sr)); cur = 1.0
    mn = np.ones(n)
    for i in range(n):
        m = 1.0
        for j in range(i, min(n, i + L)):
            if need[j] < m: m = need[j]
        mn[i] = m
    for i in range(n):
        tgt = mn[i]
        if tgt < cur: cur = tgt
        else: cur += a2 * (tgt - cur)
        g[i] = cur
    y = np.zeros_like(x)
    for i in range(n): y[i, 0] = x[i, 0] * g[i]; y[i, 1] = x[i, 1] * g[i]
    return y


def lufs(x):
    # ITU-R BS.1770 K 加权 + 门限（400ms 块，75% 重叠；系数按 48k）
    def biquad(sig, b, a):
        return _bq(sig, b[0], b[1], b[2], a[1], a[2])
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]
    ch = [biquad(biquad(x[:, c], b1, a1), b2, a2) for c in range(2)]
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = []
    for i in range(0, len(ch[0]) - blk, hop):
        ms.append(sum(np.mean(c[i:i + blk] ** 2) for c in ch))
    ms = np.array(ms)
    L = -0.691 + 10 * np.log10(ms + 1e-12)
    ms = ms[L > -70]
    rel = -0.691 + 10 * np.log10(ms.mean()) - 10
    ms2 = ms[(-0.691 + 10 * np.log10(ms)) > rel]
    return -0.691 + 10 * math.log10(ms2.mean())


@njit(cache=True)
def _bq(x, b0, b1, b2, a1, a2):
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        o = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2 = x1; x1 = x[i]; y2 = y1; y1 = o; y[i] = o
    return y


def true_peak(x):
    # 4 倍过采样近似真峰值
    from numpy.fft import rfft, irfft
    pk = 0.0
    for c in range(2):
        s = x[:, c]
        for i in range(0, len(s), SR * 10):
            seg = s[i:i + SR * 10 + 64]
            up = irfft(rfft(seg), n=len(seg) * 4) * 4
            pk = max(pk, np.abs(up).max())
    return 20 * math.log10(pk + 1e-12)


def main():
    t0 = time.time()
    st, auto, pd = render()
    print(f'music rendered {time.time() - t0:.1f}s')
    sfx = render_sfx()
    print(f'sfx rendered {time.time() - t0:.1f}s')
    voc = voice_track()
    # 旁白侧链：包络 → 音乐增益（最多 -8 dB），释放 0.4s；鼓与特效闪避更少，保住冲击
    ve = env_follow(voc, 0.01, 0.4)
    duck = 1 - 0.6 * np.clip(ve / 0.05, 0, 1)
    duck = onepole(duck, 1 - math.exp(-1 / (0.04 * SR)))
    dk = duck[:, None]; dk2 = (0.5 + 0.5 * duck)[:, None]
    # 断电：乐队低通关闭
    orch = st['orch'] * 1.0; keys = st['keys'] * 1.0; syn = st['synth'] * 1.6
    for c in range(2):
        cut = 18000 * (1 - pd) ** 3 + 120
        orch[:, c] = svf(orch[:, c], cut, 0.7, 0); syn[:, c] = svf(syn[:, c], cut, 0.7, 0)
    a2 = auto[:, None]
    music = (orch * 1.05 + keys * 1.1 + syn + st['bass'] * 0.9) * a2 * dk + (st['drums'] * 0.55 + st['fx'] * 0.5) * a2 * dk2
    sfx = sfx * (0.6 + 0.4 * duck)[:, None]
    # 混响：乐队大厅 + 音效
    send = (orch[:, 0] + orch[:, 1]) * 0.5 * 0.9 + (keys[:, 0] + keys[:, 1]) * 0.5 * 0.7 + (syn[:, 0] + syn[:, 1]) * 0.3 + (sfx[:, 0] + sfx[:, 1]) * 0.2 + (st['fx'][:, 0] + st['fx'][:, 1]) * 0.15
    send = send * auto
    wetL = comb_reverb(send, SR, 0.9, 0.35, 0)
    wetR = comb_reverb(send, SR, 0.9, 0.35, 23)
    wet = np.stack([wetL, wetR], 1) * dk
    voc = voc * 2.2
    vr = comb_reverb(voc, SR, 0.55, 0.5, 0) * 0.3
    vox = np.stack([voc + vr * 0.22, voc + np.roll(vr, 97) * 0.22], 1)
    print(f'fx done {time.time() - t0:.1f}s')
    mix = music + wet * 0.7 + sfx * 0.9 + vox
    mix = compress(mix, -14.0, 2.0, 0.012, 0.18, SR)
    target = -14.5
    L = lufs(mix)
    mix *= 10 ** ((target - L) / 20)
    ceil = 10 ** (-1.3 / 20)
    mix = limit(mix, ceil, 0.004, 0.08, SR)
    TP = true_peak(mix)
    if TP > -1.0: mix *= 10 ** ((-1.0 - TP) / 20)
    L2, TP = lufs(mix), true_peak(mix)
    print(f'LUFS {L:.2f} -> {L2:.2f}  true peak {TP:.2f} dBTP')
    dur = CU['duration']; n = int(dur * SR)
    mix = mix[:n]
    fo = int(2.5 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
    out = os.path.join(ROOT, 'audio', 'mix.f32')
    mix.astype(np.float32).tofile(out)
    vm = ve[:n] > 0.02
    mv = np.sqrt(np.mean(music[:n][vm] ** 2)); vv = np.sqrt(np.mean(vox[:n][vm] ** 2))
    print(f'voice-over-music margin {20 * math.log10(vv / mv):.1f} dB (speech frames {vm.mean() * 100:.0f}%)')
    np.save(os.path.join(ROOT, 'audio', 'sfx.npy'), sfx[:n].astype(np.float32))
    print(f'done {time.time() - t0:.1f}s -> {out}')


if __name__ == '__main__':
    main()
