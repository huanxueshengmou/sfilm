# 时间线：按旁白实测时长排布全片 → script/timeline.json + web/js/timeline.js
#  · 场景起点吸附小节线（120 BPM，一小节 2 秒），指定短语吸附节拍
#  · cue（冲击/过门/静默…）用锚点书写，这里解析成绝对时间，画面与音频共用同一份
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import P, load_json, log, save_json, utf8_stdio

GRID = {'beat': 1, 'half': 2, 'bar': 4, 'eighth': 0.5}


def up(t, step):
    return math.ceil(t / step - 1e-6) * step


def near(t, step):
    return round(t / step) * step


def r3(x):
    return round(float(x), 3)


def build():
    s = load_json(P('script', 'narration.json'))
    beat = 60.0 / s['bpm']
    bar = beat * 4
    fps = s.get('fps', 60)
    t = 0.0
    scenes, lines = [], {}
    for sc in s['scenes']:
        start = t
        cur = start + sc.get('pre', 1.0)
        ids = []
        for l in sc['lines']:
            m = load_json(P('audio', 'tts', l['id'] + '.json'))
            spans = m['spans']
            if 'snap' in l:
                tgt, grid = l['snap']
                k = int(tgt[1:])
                rel = spans[k][0] if tgt[0] == 'p' else spans[k][1]
                cur = up(cur + rel, beat * GRID[grid]) - rel
            subs, says = l['sub'].split('|'), l['say'].split('|')
            if not (len(subs) == len(says) == len(spans)):
                raise ValueError(f"{l['id']}: sub/say 分段数不一致")
            ph = [{'a': r3(cur + a), 'b': r3(cur + b), 'sub': subs[i], 'say': says[i]}
                  for i, (a, b) in enumerate(spans)]
            lines[l['id']] = {'id': l['id'], 'scene': sc['id'], 'start': r3(cur), 'end': r3(cur + m['dur']),
                              'dur': m['dur'], 'phrases': ph}
            ids.append(l['id'])
            cur += m['dur'] + l.get('gap', 0.5)
        end = up(cur + sc.get('post', 0.5), bar)
        scenes.append({'id': sc['id'], 'start': r3(start), 'end': r3(end), 'lines': ids,
                       'chapter': sc.get('chapter'), 'title': sc.get('title')})
        t = end
    SC = {x['id']: x for x in scenes}

    def resolve(at):
        m = re.match(r'^@(\w+)(\.end)?$', at)
        if m:
            x = SC[m.group(1)]
            return x['end'] if m.group(2) else x['start']
        m = re.match(r'^(\w+)\.(s|e|p\d+|e\d+)$', at)
        if not m:
            raise ValueError('无法解析锚点 ' + at)
        L, k = lines[m.group(1)], m.group(2)
        if k == 's':
            return L['start']
        if k == 'e':
            return L['end']
        i = int(k[1:])
        return L['phrases'][i]['a'] if k[0] == 'p' else L['phrases'][i]['b']

    cues = []
    for sc in s['scenes']:
        for c in sc.get('cues', []):
            tt = resolve(c['at']) + c.get('off', 0.0) + c.get('beats', 0.0) * beat
            if c.get('snap'):
                tt = near(tt, beat * GRID[c['snap']])
            d = {k: v for k, v in c.items() if k not in ('off', 'beats', 'snap', 'to')}
            if 'to' in c:
                d['dur'] = r3(resolve(c['to']) - tt)
            d.update({'t': r3(tt), 'scene': sc['id']})
            cues.append(d)
    cues.sort(key=lambda c: c['t'])
    tl = {'title': s['title'], 'fps': fps, 'bpm': s['bpm'], 'beat': beat, 'bar': bar,
          'duration': r3(t), 'frames': int(round(t * fps)),
          'scenes': scenes, 'lines': lines, 'cues': cues}
    save_json(P('script', 'timeline.json'), tl)
    with open(P('web', 'js', 'timeline.js'), 'w', encoding='utf-8') as f:
        f.write('// 自动生成：tools/timeline.py（勿手改）\nwindow.TL = ' + json.dumps(tl, ensure_ascii=False) + ';\n')
    return tl


def main():
    utf8_stdio()
    tl = build()
    for sc in tl['scenes']:
        log(f"[timeline] {sc['id']:>7} {sc['start']:7.2f} → {sc['end']:7.2f}  ({sc['end'] - sc['start']:5.1f}s)")
    log(f"[timeline] 全片 {tl['duration']:.2f}s = {tl['frames']} 帧 @{tl['fps']}fps，{len(tl['cues'])} 个 cue")


if __name__ == '__main__':
    main()
