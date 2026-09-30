# 字形覆盖检查：场景脚本里所有单引号字符串 + 字幕，列出任何字体都没有的字符（会显示成豆腐块）
import glob, json, os, sys, io
from fontTools.ttLib import TTFont
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = ['NotoSerifSC-VF.ttf', 'NotoSansSC-VF.ttf', 'georgia.ttf', 'consola.ttf', 'KaTeX_Math-Italic.ttf', 'KaTeX_Main-Regular.ttf']
cms = [TTFont(os.path.join(ROOT, 'web', 'fonts', f)).getBestCmap() for f in FONTS]


def strings(src):
    out, i = [], 0
    while True:
        a = src.find("'", i)
        if a < 0: return out
        b = a + 1
        while b < len(src) and src[b] != "'":
            b += 2 if src[b] == chr(92) else 1
        out.append(src[a + 1:b]); i = b + 1


text = ''
for f in glob.glob(os.path.join(ROOT, 'web', 'js', 'sc-*.js')) + [os.path.join(ROOT, 'web', 'js', n) for n in ('dir.js', 'fx.js')]:
    text += ''.join(strings(open(f, encoding='utf-8').read()))
tl = json.load(open(os.path.join(ROOT, 'script', 'timeline.json'), encoding='utf-8'))
for l in tl['lines'].values():
    for p in l['phrases']: text += p['sub']
chars = sorted(set(text) - set(' \n\t'))
tofu = [c for c in chars if all(ord(c) not in cm for cm in cms)]
print('distinct chars', len(chars))
print('missing in every font:', repr(''.join(tofu)))
