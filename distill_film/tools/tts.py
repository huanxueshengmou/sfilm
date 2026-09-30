# 旁白：MiMo TTS 逐句合成（文本/音色/风格不变则跳过）→ 裁掉首尾静音 → 收紧过长停顿 → 按停顿切出字幕短语
#   audio/tts/raw/  API 原始返回（本地缓存，不入库）
#   audio/tts/      处理后的成品 wav + json（入库，渲染时不需要 API Key）
import concurrent.futures as cf
import hashlib
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import P, load_env_files, load_json, log, read_wav, save_json, utf8_stdio, write_wav

MODEL = 'mimo-v2.5-tts'
OUT = P('audio', 'tts')
RAW = P('audio', 'tts', 'raw')
PROC = 2          # 后处理版本：改动 trim/tighten/align 时加一，触发从 raw 重新处理
HOP = 0.01
PUNCT = set('，。、：；！？“”‘’「」—…（）()《》,.:;!?· ')


def spoken_weight(s):
    """估计一段文字的朗读时长权重（汉字 1，数字略短，拉丁字母按字母计）。"""
    w = 0.0
    for ch in s:
        if ch in PUNCT:
            continue
        if '\u4e00' <= ch <= '\u9fff' or ch == '〇':
            w += 1.0
        elif ch.isdigit():
            w += 0.9
        elif ch.isalpha():
            w += 0.36
        else:
            w += 0.2
    return max(w, 0.5)


def line_hash(voice, style, text):
    return hashlib.md5(f'{MODEL}|{voice}|{style}|{text}'.encode('utf-8')).hexdigest()[:12]


def env_db(y, sr):
    h = int(sr * HOP)
    n = len(y) // h
    e = np.sqrt(np.mean(y[:n * h].reshape(n, h).astype(np.float64) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(e)


def trim(y, sr):
    db = env_db(y, sr)
    thr = max(db.max() - 42.0, -58.0)
    on = np.where(db > thr)[0]
    h = int(sr * HOP)
    a = max(0, on[0] * h - int(0.03 * sr))
    b = min(len(y), (on[-1] + 1) * h + int(0.12 * sr))
    z = y[a:b].astype(np.float32).copy()
    f = int(0.006 * sr)
    z[:f] *= np.linspace(0, 1, f, dtype=np.float32)
    z[-f:] *= np.linspace(1, 0, f, dtype=np.float32)
    return z


def tighten(y, sr, cap):
    """把句内长于 cap 秒的停顿压到 cap 秒（只删静音的中段，接缝 10ms 交叉淡化）。"""
    db = env_db(y, sr)
    thr = max(db.max() - 34.0, -52.0)
    loud = db > thr
    idx = np.where(loud)[0]
    cuts, i, n = [], idx[0], idx[-1]
    while i < n:
        if not loud[i]:
            j = i
            while j < n and not loud[j]:
                j += 1
            if (j - i) * HOP > cap:
                a = int((i * HOP + cap / 2) * sr)
                b = int((j * HOP - cap / 2) * sr)
                if b > a:
                    cuts.append((a, b))
            i = j
        else:
            i += 1
    if not cuts:
        return y
    xf = int(0.010 * sr)
    ramp = np.linspace(0, 1, xf, dtype=np.float32)
    out, pos = [], 0
    for a, b in cuts:
        out.append(y[pos:a])
        # 以 a 处结束的片段与 b 处开始的片段交叉淡化
        tail = y[a:a + xf] * (1 - ramp)
        head = y[b:b + xf] * ramp
        out.append(tail + head)
        pos = b + xf
    out.append(y[pos:])
    return np.concatenate(out).astype(np.float32)


def align(y, sr, parts):
    """用句中停顿把整句切成 len(parts) 段，返回 [[起, 止], ...]（秒，相对本句）。
    候选停顿 = 低于阈值且 ≥90ms 的静音段；用动态规划选出与字数比例最吻合的一组，
    找不到停顿的边界退回按字数比例估计（虚拟候选，罚分较高）。"""
    k = len(parts)
    db = env_db(y, sr)
    thr = max(db.max() - 34.0, -52.0)
    loud = db > thr
    idx = np.where(loud)[0]
    s0, s1 = idx[0] * HOP, (idx[-1] + 1) * HOP
    if k == 1:
        return [[round(s0, 3), round(s1, 3)]], 'single'
    sil, i, n = [], idx[0], idx[-1]
    while i < n:
        if not loud[i]:
            j = i
            while j < n and not loud[j]:
                j += 1
            if (j - i) * HOP >= 0.09:
                sil.append((i * HOP, j * HOP))
            i = j
        else:
            i += 1
    w = np.array([spoken_weight(p) for p in parts])
    span = s1 - s0
    exp_t = s0 + np.cumsum(w)[:-1] / w.sum() * span
    m = len(sil)
    INF = 1e18
    VIRT = m  # 虚拟候选的下标

    def pos(j, c):
        return exp_t[j] if c == VIRT else (sil[c][0] + sil[c][1]) / 2

    def cost(j, c):
        if c == VIRT:
            return 3.0
        a, b = sil[c]
        d = ((a + b) / 2 - exp_t[j]) / span
        return 60 * d * d - 0.8 * np.log((b - a) / 0.09 + 1.0)

    dp = np.full((k - 1, m + 1), INF)
    bk = np.full((k - 1, m + 1), -1, dtype=int)
    for c in range(m + 1):
        dp[0][c] = cost(0, c)
    for j in range(1, k - 1):
        for c in range(m + 1):
            best, arg = INF, -1
            for q in range(m + 1):
                if dp[j - 1][q] >= INF or (q == c and c != VIRT):
                    continue
                if pos(j - 1, q) < pos(j, c) - 1e-6 and dp[j - 1][q] < best:
                    best, arg = dp[j - 1][q], q
            if arg >= 0:
                dp[j][c], bk[j][c] = best + cost(j, c), arg
    c = int(np.argmin(dp[k - 2]))
    chosen = [0] * (k - 1)
    for j in range(k - 2, -1, -1):
        chosen[j] = c
        c = bk[j][c]
    bounds, virt = [], 0
    for j, c in enumerate(chosen):
        if c == VIRT:
            virt += 1
            bounds.append((exp_t[j] - 0.02, exp_t[j] + 0.02))
        else:
            bounds.append(sil[c])
    spans, a = [], s0
    for (b0, b1) in bounds:
        spans.append([round(a, 3), round(max(b0, a + 0.05), 3)])
        a = b1
    spans.append([round(a, 3), round(max(s1, a + 0.05), 3)])
    return spans, f'{m} pauses, {virt} virtual'


def synth(text, voice, style):
    import mimo_tts
    last = None
    for attempt in range(5):
        try:
            return mimo_tts.tts(text, voice=voice, style=style)
        except SystemExit:
            raise
        except Exception as e:  # 网络 / 服务端偶发错误
            last = e
            time.sleep(2 + attempt * 3)
    raise RuntimeError(f'TTS 失败: {last!r}')


def plan():
    s = load_json(P('script', 'narration.json'))
    voice, styles = s['voice'], s['styles']
    out = []
    for sc in s['scenes']:
        for l in sc['lines']:
            style = styles[l.get('style', 'base')]
            text = l['say'].replace('|', '')
            out.append((l, voice, style, text, line_hash(voice, style, text)))
    return out


def up_to_date(l, h):
    mp, wp = os.path.join(OUT, l['id'] + '.json'), os.path.join(OUT, l['id'] + '.wav')
    if not (os.path.exists(mp) and os.path.exists(wp)):
        return False
    m = load_json(mp)
    return m.get('hash') == h and m.get('proc') == PROC and m.get('pause') == l.get('pause', 0.34)


def raw_fresh(l, h):
    rp, rj = os.path.join(RAW, l['id'] + '.wav'), os.path.join(RAW, l['id'] + '.json')
    return os.path.exists(rp) and os.path.exists(rj) and load_json(rj).get('hash') == h


def process(l, voice, style, text, h):
    os.makedirs(RAW, exist_ok=True)
    rp = os.path.join(RAW, l['id'] + '.wav')
    fetched = False
    if not raw_fresh(l, h):
        with open(rp, 'wb') as f:
            f.write(synth(text, voice, style))
        save_json(os.path.join(RAW, l['id'] + '.json'), {'hash': h, 'text': text, 'style': style})
        fetched = True
    y, sr = read_wav(rp)
    if y.ndim > 1:
        y = y.mean(1)
    pause = l.get('pause', 0.34)
    y = tighten(trim(y, sr), sr, pause)
    spans, info = align(y, sr, l['say'].split('|'))
    write_wav(os.path.join(OUT, l['id'] + '.wav'), y, sr)
    m = {'id': l['id'], 'hash': h, 'proc': PROC, 'pause': pause, 'voice': voice, 'style': style, 'text': text, 'sr': sr,
         'dur': round(len(y) / sr, 3), 'spans': spans, 'align': info,
         'peak_db': round(float(20 * np.log10(np.abs(y).max() + 1e-9)), 1)}
    save_json(os.path.join(OUT, l['id'] + '.json'), m)
    m['fetched'] = fetched
    return m


def main(force=False):
    utf8_stdio()
    load_env_files()
    os.makedirs(OUT, exist_ok=True)
    jobs = plan()
    todo = [j for j in jobs if force or not up_to_date(j[0], j[4])]
    need_api = [j for j in todo if force or not raw_fresh(j[0], j[4])]
    if need_api and not os.environ.get('MIMO_API_KEY'):
        raise SystemExit('有 %d 句旁白需要合成，但没有 MIMO_API_KEY。\n'
                         '把 .env（内容 MIMO_API_KEY=...）放到 distill_film\\.env 后重试。' % len(need_api))
    if todo:
        log(f'[tts] 处理 {len(todo)} 句（其中 {len(need_api)} 句调用 API，共 {len(jobs)} 句）…')
        with cf.ThreadPoolExecutor(3) as ex:
            futs = {ex.submit(process, *j): j[0]['id'] for j in todo}
            for f in cf.as_completed(futs):
                m = f.result()
                log(f"[tts] {m['id']:>5} {m['dur']:6.2f}s  {m['align']}{'  (API)' if m['fetched'] else ''}")
    else:
        log(f'[tts] {len(jobs)} 句旁白均已是最新，跳过合成')
    tot, chars = 0.0, 0.0
    for l, *_ in jobs:
        m = load_json(os.path.join(OUT, l['id'] + '.json'))
        tot += m['dur']
        chars += sum(spoken_weight(p) for p in l['say'].split('|'))
    log(f'[tts] 旁白总长 {tot:.1f}s，约 {chars:.0f} 字，{chars / tot:.2f} 字/秒')


if __name__ == '__main__':
    main(force='--force' in sys.argv)
