# 探针帧分析：YUV→PNG、亮度/色彩统计、ASCII 缩略图、排版登记表检查（越界/重叠/压字幕）
import sys, io, os, json, glob
import numpy as np
from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROBE = os.path.join(ROOT, 'render', 'probe')
W, H = 1920, 1080
RAMP = ' .:-=+*#%@'


def load(f):
    b = np.fromfile(os.path.join(PROBE, f'f{f}.yuv'), dtype=np.uint8)
    y = b[:W * H].reshape(H, W).astype(np.float32)
    u = b[W * H:W * H + W * H // 4].reshape(H // 2, W // 2).astype(np.float32)
    v = b[W * H + W * H // 4:].reshape(H // 2, W // 2).astype(np.float32)
    u = u.repeat(2, 0).repeat(2, 1); v = v.repeat(2, 0).repeat(2, 1)
    Y = (y - 16) / 219; Cb = (u - 128) / 224; Cr = (v - 128) / 224
    r = Y + 1.5748 * Cr; g = Y - 0.1873 * Cb - 0.4681 * Cr; bl = Y + 1.8556 * Cb
    rgb = np.clip(np.stack([r, g, bl], -1), 0, 1)
    return rgb, np.clip(Y, 0, 1)


def ascii(Y, cols=112, rows=30):
    h, w = Y.shape
    out = []
    for j in range(rows):
        row = ''
        for i in range(cols):
            blk = Y[j * h // rows:(j + 1) * h // rows, i * w // cols:(i + 1) * w // cols]
            v = blk.mean() ** 0.6  # 提亮暗部便于看结构
            row += RAMP[min(len(RAMP) - 1, int(v * len(RAMP)))]
        out.append('|' + row + '|')
    return '\n'.join(out)


def hue_name(rgb):
    r, g, b = rgb
    mx, mn = max(rgb), min(rgb)
    if mx < 0.08: return 'black'
    if mx - mn < 0.08: return 'gray/white'
    if mx == r: h = ((g - b) / (mx - mn)) % 6
    elif mx == g: h = (b - r) / (mx - mn) + 2
    else: h = (r - g) / (mx - mn) + 4
    h *= 60
    for lim, n in [(20, 'red'), (45, 'orange'), (65, 'yellow'), (160, 'green'), (200, 'cyan'), (250, 'blue'), (290, 'violet'), (340, 'magenta'), (361, 'red')]:
        if h < lim: return n


def stats(f, rgb, Y):
    m = Y.mean(); p = np.percentile(Y, [1, 50, 99, 99.9])
    clip = (Y > 0.985).mean() * 100
    # 色彩：亮像素的主色
    mask = Y > 0.15
    cols = {}
    if mask.any():
        px = rgb[mask][::37]
        for q in px:
            n = hue_name(q); cols[n] = cols.get(n, 0) + 1
    tot = sum(cols.values()) or 1
    cs = ', '.join(f'{k} {v * 100 / tot:.0f}%' for k, v in sorted(cols.items(), key=lambda x: -x[1])[:5])
    # 3x3 区域亮度
    grid = [[Y[j * H // 3:(j + 1) * H // 3, i * W // 3:(i + 1) * W // 3].mean() for i in range(3)] for j in range(3)]
    print(f'  mean {m:.3f}  p1/50/99/99.9 {p[0]:.3f}/{p[1]:.3f}/{p[2]:.3f}/{p[3]:.3f}  clip {clip:.2f}%  lit(>0.15) {mask.mean() * 100:.1f}%')
    print(f'  colors: {cs}')
    print('  3x3: ' + ' | '.join(' '.join(f'{v:.2f}' for v in row) for row in grid))


def check_reg(reg):
    issues = []
    tw = next((r for r in reg if r['id'] == '#tower'), None)
    reg = [r for r in reg if r['id'] != '#tower']
    boxes = [r for r in reg if r['a'] > 0.05]
    if tw and tw['bg'] > 0.6:
        for r in boxes:
            if r['id'] in ('sub', 'hud'): continue
            area = max(1, (r['x1'] - r['x0']) * (r['y1'] - r['y0']))
            for b in tw['box']:
                ix = max(0, min(r['x1'], b[2]) - max(r['x0'], b[0])); iy = max(0, min(r['y1'], b[3]) - max(r['y0'], b[1]))
                if ix * iy > 0.3 * area:
                    issues.append(f"压塔 {r['id'] or '?'} ({ix * iy / area * 100:.0f}%)"); break
    for r in boxes:
        if r['x0'] < 40 or r['x1'] > W - 40 or r['y0'] < 20 or r['y1'] > H - 10:
            issues.append(f"越界 {r['id'] or '?'} [{r['x0']:.0f},{r['y0']:.0f},{r['x1']:.0f},{r['y1']:.0f}]")
    subs = [r for r in boxes if r['id'] == 'sub']
    for s in subs:
        for r in boxes:
            if r['id'] in ('sub', 'hud') or r['layer'] == 'ui' and r['id'] == 'sub': continue
            if r['x0'] < s['x1'] and r['x1'] > s['x0'] and r['y0'] < s['y1'] + 8 and r['y1'] > s['y0'] - 8:
                issues.append(f"压字幕 {r['id'] or '?'} [{r['x0']:.0f},{r['y0']:.0f},{r['x1']:.0f},{r['y1']:.0f}]")
    named = [r for r in boxes if r['id'] not in ('sub',)]
    for i in range(len(named)):
        for j in range(i + 1, len(named)):
            a, b = named[i], named[j]
            if a['id'] and a['id'] == b['id']: continue
            ix = min(a['x1'], b['x1']) - max(a['x0'], b['x0']); iy = min(a['y1'], b['y1']) - max(a['y0'], b['y0'])
            if ix > 6 and iy > 6:
                small = min((a['x1'] - a['x0']) * (a['y1'] - a['y0']), (b['x1'] - b['x0']) * (b['y1'] - b['y0']))
                if ix * iy > 0.12 * small:
                    issues.append(f"重叠 {a['id'] or '?'} × {b['id'] or '?'} ({ix:.0f}x{iy:.0f})")
    return issues


def prof(Y, x, y0=60, y1=1020, step=6):
    col = Y[:, max(0, x - 2):x + 3].mean(1)
    vals = [col[y:y + step].max() for y in range(y0, y1, step)]
    return ''.join(RAMP[min(len(RAMP) - 1, int((v ** 0.6) * len(RAMP)))] for v in vals)


def main():
    opts = {a.split('=')[0]: a.split('=')[1] if '=' in a else '1' for a in sys.argv[1:] if a.startswith('--')}
    sys.argv = [sys.argv[0]] + [a for a in sys.argv[1:] if not a.startswith('--')]
    fs = sys.argv[1:] or sorted(int(os.path.basename(p)[1:-4]) for p in glob.glob(os.path.join(PROBE, 'f*.yuv')))
    for f in map(int, fs):
        rgb, Y = load(f)
        Image.fromarray((rgb * 255 + 0.5).astype(np.uint8)).save(os.path.join(PROBE, f'f{f}.png'))
        meta = json.load(open(os.path.join(PROBE, f'f{f}.json'), encoding='utf-8'))
        print(f'=== frame {f}  t={f / 60:.2f}s ===')
        stats(f, rgb, Y)
        if '--crop' in opts:
            x0, y0, x1, y1 = map(int, opts['--crop'].split(','))
            print(ascii(Y[y0:y1, x0:x1], 112, max(8, int(30 * (y1 - y0) / (x1 - x0) * 112 / 60))))
        elif '--noascii' not in opts: print(ascii(Y))
        if '--prof' in opts:
            for xx in map(int, opts['--prof'].split(',')): print(f'  prof x={xx}: ' + prof(Y, xx))
        iss = check_reg(meta['reg'])
        texts = [r['id'] for r in meta['reg'] if r['a'] > 0.05 and r['id'] not in ('sub', 'hud')]
        print('  texts:', ', '.join(dict.fromkeys(texts))[:400])
        for s in iss[:20]: print('  !!', s)


if __name__ == '__main__':
    main()
