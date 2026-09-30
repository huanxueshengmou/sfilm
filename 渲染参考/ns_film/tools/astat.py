# 音频分段统计：每个场景的各分轨 RMS(dBFS)、旁白对音乐余量、频谱重心；定位过响/过弱段
import json, os, sys, io, math
import numpy as np

if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from music import SR, render, CU
from sfx import render_sfx
from mix import voice_track

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def db(x):
    return 20 * math.log10(math.sqrt(np.mean(x ** 2)) + 1e-9)


def main():
    mus, drm, arp, pad = render()
    sfx = render_sfx()
    voc = voice_track()
    mix = np.fromfile(os.path.join(ROOT, 'audio', 'mix.f32'), dtype=np.float32).reshape(-1, 2)
    print(f"{'scene':>8} {'mix':>6} {'voice':>6} {'bass':>6} {'drums':>6} {'arp':>6} {'pad':>6} {'sfx':>6}  centroid")
    for s in CU['scenes']:
        a, b = int(s['start'] * SR), int(min(s['end'], CU['duration']) * SR)
        m = mix[a:b].mean(1)
        spec = np.abs(np.fft.rfft(m[:SR * 8] if len(m) > SR * 8 else m))
        fr = np.fft.rfftfreq(len(m[:SR * 8]) if len(m) > SR * 8 else len(m), 1 / SR)
        cen = (spec * fr).sum() / (spec.sum() + 1e-9)
        row = [db(m), db(voc[a:b]), db(mus[a:b].mean(1)), db(drm[a:b].mean(1)), db(arp[a:b].mean(1)), db(pad[a:b].mean(1)), db(sfx[a:b].mean(1))]
        print(f"{s['id']:>8} " + ' '.join(f'{v:6.1f}' for v in row) + f'  {cen:6.0f} Hz')
    # 峰值瞬间（冲击点）检查：±50ms 内的混音峰值
    print('impacts:')
    for e in CU['events']:
        if e['type'] != 'impact': continue
        i = int(e['t'] * SR)
        seg = mix[max(0, i - 2400):i + 2400]
        print(f"  {e['t']:7.2f}s  peak {20 * math.log10(np.abs(seg).max() + 1e-9):6.1f} dBFS")


if __name__ == '__main__':
    main()
