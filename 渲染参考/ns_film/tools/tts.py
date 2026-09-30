# 旁白生成：edge-tts 逐句合成 → 48k 单声道 wav → 词边界对齐到字幕分段
import asyncio, json, hashlib, subprocess, sys, io, os
import numpy as np
import edge_tts

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'tts')
SR = 48000


def load_script():
    return json.load(open(os.path.join(ROOT, 'script', 'narration.json'), encoding='utf-8'))


async def synth(text, voice, rate, mp3_path):
    c = edge_tts.Communicate(text, voice, rate=rate, boundary='WordBoundary')
    words = []
    with open(mp3_path, 'wb') as f:
        async for ch in c.stream():
            if ch['type'] == 'audio':
                f.write(ch['data'])
            elif ch['type'] == 'WordBoundary':
                words.append({'t': ch['offset'] / 1e7, 'd': ch['duration'] / 1e7, 'w': ch['text']})
    return words


def decode(mp3_path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp3_path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def speech_bounds(x):
    # 10ms RMS 包络，-48 dBFS 以上视为有声
    hop = SR // 100
    n = len(x) // hop
    env = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(env)
    on = np.where(db > -48)[0]
    return on[0] * hop / SR, (on[-1] + 1) * hop / SR


def align(say, words):
    """把词边界映射到 '|' 分出的短语，返回每段 [起, 止]。"""
    parts = say.split('|')
    clean = ''.join(parts)
    cuts, acc = [], 0
    for p in parts:
        acc += len(p)
        cuts.append(acc)
    pos, spans = 0, []
    for w in words:
        key = w['w']
        i = clean.find(key, pos)
        if i < 0:
            i = clean.replace(' ', '').find(key.replace(' ', ''), 0)
            # 去空格后的位置换算回原串
            if i >= 0:
                cnt, j = -1, 0
                for j, ch in enumerate(clean):
                    if ch != ' ':
                        cnt += 1
                    if cnt == i:
                        break
                i = j
        if i < 0:
            i = pos
        seg = next(k for k, c in enumerate(cuts) if i < c) if i < len(clean) else len(parts) - 1
        spans.append((seg, w))
        pos = i + len(key)
    out = []
    for k in range(len(parts)):
        ws = [w for s, w in spans if s == k]
        if ws:
            out.append([ws[0]['t'], ws[-1]['t'] + ws[-1]['d']])
        else:
            out.append(None)
    # 空段（罕见）用相邻段插值
    for k in range(len(out)):
        if out[k] is None:
            a = out[k - 1][1] if k > 0 and out[k - 1] else 0
            out[k] = [a, a + 0.3]
    return out


async def main():
    s = load_script()
    voice, rate = s['voice'], s['rate']
    sem = asyncio.Semaphore(4)
    lines = [l for sc in s['scenes'] for l in sc['lines']]

    async def one(l):
        text = l['say'].replace('|', '')
        h = hashlib.md5((voice + rate + text).encode('utf-8')).hexdigest()[:10]
        meta_p = os.path.join(OUT, l['id'] + '.json')
        if os.path.exists(meta_p):
            m = json.load(open(meta_p, encoding='utf-8'))
            if m.get('hash') == h:
                return m
        mp3 = os.path.join(OUT, l['id'] + '.mp3')
        async with sem:
            for attempt in range(4):
                try:
                    words = await synth(text, voice, rate, mp3)
                    break
                except Exception as e:
                    print('retry', l['id'], e)
                    await asyncio.sleep(2 + attempt * 3)
            else:
                raise RuntimeError('tts failed ' + l['id'])
        x = decode(mp3)
        a, b = speech_bounds(x)
        a = max(0.0, a - 0.03)
        b = min(len(x) / SR, b + 0.08)
        y = x[int(a * SR):int(b * SR)]
        # 首尾 8ms 淡入淡出防爆音
        f = int(0.008 * SR)
        y[:f] *= np.linspace(0, 1, f)
        y[-f:] *= np.linspace(1, 0, f)
        wav = os.path.join(OUT, l['id'] + '.f32')
        y.astype(np.float32).tofile(wav)
        for w in words:
            w['t'] = round(w['t'] - a, 3)
            w['d'] = round(w['d'], 3)
        spans = align(l['say'], words)
        m = {'id': l['id'], 'hash': h, 'dur': round(len(y) / SR, 3), 'words': words,
             'spans': [[round(p, 3), round(q, 3)] for p, q in spans], 'text': text}
        json.dump(m, open(meta_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        return m

    res = await asyncio.gather(*[one(l) for l in lines])
    tot = 0
    for l, m in zip(lines, res):
        n = len(m['text'].replace(' ', ''))
        tot += m['dur']
        print(f"{m['id']:>3} {m['dur']:6.2f}s  {n/m['dur']:4.1f} 字/s  {m['text']}")
    print('narration total', round(tot, 2))


if __name__ == '__main__':
    asyncio.run(main())
