# 由旁白实测时长生成全片时间线：场景起点吸附小节线，关键词吸附节拍，输出 JSON 与前端 JS
import json, math, os, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRID = {'beat': 1, 'half': 2, 'bar': 4}


def up(t, step):
    return math.ceil(t / step - 1e-6) * step


def anchor(l, m):
    """snap 目标在本句内的相对时刻：'p<k>' 短语起点，'e<k>' 短语终点，'w:<词>' 某词起点。"""
    tgt = l['snap'][0]
    if tgt.startswith('w:'):
        key = tgt[2:]
        for w in m['words']:
            if key in w['w']:
                return max(w['t'], 0.0)
        raise KeyError(f"{l['id']} 找不到词 {key}")
    k = int(tgt[1:])
    a, b = m['spans'][k]
    return max(a, 0.0) if tgt[0] == 'p' else b


def build():
    s = json.load(open(os.path.join(ROOT, 'script', 'narration.json'), encoding='utf-8'))
    beat = 60.0 / s['bpm']
    t = 0.0
    scenes, flat = [], {}
    for sc in s['scenes']:
        start = t
        cur = start + sc['pre']
        lines = []
        for l in sc['lines']:
            m = json.load(open(os.path.join(ROOT, 'audio', 'tts', l['id'] + '.json'), encoding='utf-8'))
            if 'snap' in l:
                rel = anchor(l, m)
                cur = up(cur + rel, beat * GRID[l['snap'][1]]) - rel
            subs, says = l['sub'].split('|'), l['say'].split('|')
            phrases = [{'t0': round(cur + max(a, 0.0), 3), 't1': round(cur + b, 3), 'sub': subs[k], 'say': says[k]}
                       for k, (a, b) in enumerate(m['spans'])]
            words = [{'t': round(cur + max(w['t'], 0.0), 3), 'd': w['d'], 'w': w['w']} for w in m['words']]
            ln = {'id': l['id'], 'start': round(cur, 3), 'end': round(cur + m['dur'], 3), 'dur': m['dur'],
                  'phrases': phrases, 'words': words, 'scene': sc['id']}
            lines.append(ln)
            flat[l['id']] = ln
            cur += m['dur'] + l['gap']
        end = up(cur + sc['post'], beat * GRID[sc.get('grid', 'bar')])
        scenes.append({'id': sc['id'], 'start': round(start, 3), 'end': round(end, 3), 'lines': lines})
        t = end
    tl = {'fps': 60, 'bpm': s['bpm'], 'beat': round(beat, 6), 'duration': round(t, 3),
          'scenes': scenes, 'lines': flat}
    json.dump(tl, open(os.path.join(ROOT, 'script', 'timeline.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, 'web', 'js', 'timeline.js'), 'w', encoding='utf-8') as f:
        f.write('// 自动生成：tools/timeline.py\nwindow.TL = ' + json.dumps(tl, ensure_ascii=False) + ';\n')
    for sc in scenes:
        print(f"{sc['id']:>8} {sc['start']:7.2f} → {sc['end']:7.2f}  ({sc['end'] - sc['start']:5.2f}s)  "
              f"bar {sc['start'] / beat / 4:6.2f}")
    print('duration', tl['duration'], 's =', round(tl['duration'] * 60), 'frames @60,', tl['duration'] / beat / 4, 'bars')


if __name__ == '__main__':
    build()
