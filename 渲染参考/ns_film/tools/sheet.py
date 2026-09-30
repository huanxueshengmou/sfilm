# 探针帧拼图：render/probe/f*.png → _tmp/sheet.jpg（带帧号/时间标注）
import sys, os, glob
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'render', 'probe')
fs = [int(a) for a in sys.argv[1:]] if len(sys.argv) > 1 else sorted(int(os.path.basename(p)[1:-4]) for p in glob.glob(os.path.join(P, 'f*.png')))
cols = 2 if len(fs) <= 4 else 3
w, h = 960 if cols == 2 else 640, 540 if cols == 2 else 360
rows = (len(fs) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * h), 'black'); d = ImageDraw.Draw(S)
for i, f in enumerate(fs):
    im = Image.open(os.path.join(P, f'f{f}.png')).resize((w, h), Image.LANCZOS)
    S.paste(im, ((i % cols) * w, (i // cols) * h))
    d.rectangle([(i % cols) * w, (i // cols) * h, (i % cols) * w + 110, (i // cols) * h + 18], fill='black')
    d.text(((i % cols) * w + 4, (i // cols) * h + 3), f'{f} {f/60:.2f}s', fill='yellow')
S.save(os.path.join(ROOT, '..', '_tmp', 'sheet.jpg'), quality=88)
print('sheet', len(fs))
