# A/V 同步校验（解码最终 MP4，含 AAC 与编辑列表）
# 1) 封装偏移：成片音频与源混音 audio/mix.f32 做互相关，应为 0 样本
# 2) 画面对位：闪白帧（视频亮度跃升）与冲击音效起音应落在同一时刻。起音在纯音效分轨上测，
#    因为完整混音里上升音效(riser)一直顶到冲击点，会盖住起音，能量比检测器会误报
import json, os, subprocess, sys, io
import numpy as np

if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
CU = json.load(open(os.path.join(ROOT, 'script', 'cues.json'), encoding='utf-8'))
FINAL = os.path.join(ROOT, 'output', 'AI解决了千禧年难题_菲尔兹奖只能颁给AI了吗.mp4')
FPS, SR = 60, 48000


def video_luma(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', 'scale=32:18,format=gray', '-f', 'rawvideo', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, 32 * 18).mean(1)


def audio(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def onset(sig, t):
    # 阈值穿越：在 [t-0.1, t+0.3] 内找第一个 1ms 窗，其 RMS 比之前 60ms 的中位数高 6 dB（riser 垫底时 argmax 比值会跳到后面的峰）
    hop = SR // 1000
    n = len(sig) // hop
    env = np.sqrt(np.mean(sig[:n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-9
    for m in range(int((t - 0.1) * 1000), int((t + 0.3) * 1000)):
        base = np.median(env[m - 60:m])
        if env[m] > base * 2.0 and env[m + 1] > base * 2.0:
            return m / 1000
    return t + 0.3


def mux_lag(fin, src, t):
    a, b = src[int((t - 4) * SR):int((t + 4) * SR)], fin[int((t - 4) * SR):int((t + 4) * SR)]
    n = 1 << int(np.ceil(np.log2(len(a) * 2)))
    xc = np.fft.irfft(np.fft.rfft(b, n) * np.conj(np.fft.rfft(a, n)), n)
    return int(np.argmax(np.r_[xc[-2000:], xc[:2000]])) - 2000


def main():
    y = video_luma(FINAL)
    fin = audio(FINAL).astype(np.float64)
    src = np.fromfile(os.path.join(ROOT, 'audio', 'mix.f32'), dtype=np.float32).reshape(-1, 2).mean(1).astype(np.float64)
    sfx = np.load(os.path.join(ROOT, 'audio', 'sfx.npy')).mean(1).astype(np.float64)
    print(f'video {len(y)} frames ({len(y) / FPS:.3f}s)   audio {len(fin)} samples ({len(fin) / SR:.3f}s)')
    worst_av, worst_lag = 0.0, 0
    # 大闪光冲击（flash ≥ 0.5）：画面亮度跃升 vs 冲击音效起音
    for h in [h for h in CU['hits'] if h['flash'] >= 0.5]:
        t = h['t']
        f0, f1 = int((t - 0.3) * FPS), int((t + 0.3) * FPS)
        d = np.diff(y[f0:f1 + 1])
        tv = (f0 + int(np.argmax(np.abs(d))) + 1) / FPS
        ta = onset(sfx, t)
        lag = mux_lag(fin, src, t)
        worst_av, worst_lag = max(worst_av, abs(ta - tv) * 1000), max(worst_lag, abs(lag))
        print(f'  cue {t:8.3f}s  flash frame {tv:8.3f}s  impact onset {ta:8.3f}s  A/V {1000 * (ta - tv):+6.1f} ms  mux lag {lag:+d} samples')
    ok = worst_av <= 1000 / FPS and worst_lag == 0
    print(f'worst A/V {worst_av:.1f} ms (1 frame = {1000 / FPS:.1f} ms), worst mux lag {worst_lag} samples → {"PASS" if ok else "CHECK"}')


if __name__ == '__main__':
    main()
