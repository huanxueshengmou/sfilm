# 公共：路径、日志、JSON、WAV 读写、ffmpeg 定位、.env 读取
import json
import os
import shutil
import subprocess
import sys
import time
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.dirname(ROOT)


def P(*a):
    return os.path.join(ROOT, *a)


def utf8_stdio():
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass


LOG_PATH = P('render', 'logs', 'run.log')


def log(*a):
    msg = ' '.join(str(x) for x in a)
    print(msg, flush=True)
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        with open(LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(time.strftime('%H:%M:%S ') + msg + '\n')
    except OSError:
        pass


def load_json(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def save_json(p, obj, indent=1):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent)
    os.replace(tmp, p)


def load_env_files():
    """按优先级读取 .env（不覆盖已存在的环境变量）；.env 已被 .gitignore 忽略，绝不入库。"""
    for p in (P('.env'), P('tools', '.env'), os.path.join(REPO, '.env')):
        if not os.path.exists(p):
            continue
        with open(p, encoding='utf-8-sig') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v


def read_wav(path):
    """16-bit PCM WAV → (float32 [n] 或 [n, ch], sr)。"""
    with wave.open(path, 'rb') as w:
        sr, ch, sw, n = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
        raw = w.readframes(n)
    if sw != 2:
        raise ValueError(f'{path}: 只支持 16-bit PCM')
    x = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0
    return (x.reshape(-1, ch) if ch > 1 else x), sr


def write_wav(path, x, sr):
    x = np.asarray(x, dtype=np.float64)
    ch = 1 if x.ndim == 1 else x.shape[1]
    pcm = (np.clip(x, -1.0, 1.0) * 32767.0).round().astype('<i2')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def ffmpeg_exe():
    env = os.environ.get('FFMPEG')
    if env and os.path.exists(env):
        return env
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    w = shutil.which('ffmpeg')
    if w:
        return w
    raise RuntimeError('找不到 ffmpeg：请先 pip install imageio-ffmpeg，或把 ffmpeg 加入 PATH')


def run(args, what='command'):
    r = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode:
        raise RuntimeError(f'{what} 失败 (exit {r.returncode}):\n' + (r.stderr or '')[-3000:])
    return r
