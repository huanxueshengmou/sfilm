# 收尾：拼接视频分段 + 混音 → AAC → 成片 MP4；附 SRT 字幕与封面；并做一致性检查
import json, os, subprocess, sys, io, glob

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEG = os.path.join(ROOT, 'render', 'seg')
OUT = os.path.join(ROOT, 'output')
TL = json.load(open(os.path.join(ROOT, 'script', 'timeline.json'), encoding='utf-8'))
NAME = 'AI解决了千禧年难题_菲尔兹奖只能颁给AI了吗'


def run(args):
    r = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode:
        print(r.stderr[-3000:]); sys.exit(1)
    return r.stdout


def srt():
    def ts(x):
        h, x = divmod(x, 3600); m, x = divmod(x, 60); s = int(x); ms = int(round((x - s) * 1000))
        if ms == 1000: s += 1; ms = 0
        return f'{int(h):02d}:{int(m):02d}:{s:02d},{ms:03d}'
    rows, k = [], 1
    for l in sorted(TL['lines'].values(), key=lambda q: q['start']):
        ph = l['phrases']
        for i, p in enumerate(ph):
            t1 = p['t1'] + 0.25
            if i + 1 < len(ph): t1 = min(t1, ph[i + 1]['t0'] - 0.02)
            text = p['sub'].strip()
            rows.append(f"{k}\n{ts(p['t0'])} --> {ts(t1)}\n{text}\n"); k += 1
    path = os.path.join(OUT, NAME + '.srt')
    open(path, 'w', encoding='utf-8').write('\n'.join(rows))
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    segs = sorted(glob.glob(os.path.join(SEG, 'seg_*.mp4')))
    ok = [s for s in segs if os.path.exists(s + '.ok')]
    frames = sum(int(open(s + '.ok').read()) for s in ok)
    total = round(TL['duration'] * 60)
    print(f'segments {len(ok)}/{len(segs)}  frames {frames}/{total}')
    if frames != total: print('incomplete render'); sys.exit(1)
    lst = os.path.join(SEG, 'list.txt')
    open(lst, 'w', encoding='utf-8').write(''.join(f"file '{os.path.basename(s)}'\n" for s in ok))
    video = os.path.join(SEG, 'video.mp4')
    run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', video])
    final = os.path.join(OUT, NAME + '.mp4')
    run(['ffmpeg', '-y', '-v', 'error', '-i', video,
         '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', os.path.join(ROOT, 'audio', 'mix.f32'),
         '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
         '-metadata', 'title=AI 解决了千禧年难题，以后的菲尔兹奖真的只能颁给 AI 了吗？',
         '-metadata', 'comment=非官方科普动画；资料来自 OpenAI、Clay、IMU、Quanta、SciAm、Nature、BBC、陶哲轩与高尔斯博客等公开报道',
         '-movflags', '+faststart', '-shortest', final])
    s = srt()
    # 封面：标题砸入后 1 秒
    thumb = os.path.join(OUT, NAME + '_封面.png')
    t = TL['lines']['t2']['start'] + 2.9
    run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{t:.3f}', '-i', final, '-frames:v', '1', thumb])
    # 分镜总览：每 8 秒一帧，5×6 网格
    sheet = os.path.join(OUT, NAME + '_分镜总览.jpg')
    run(['ffmpeg', '-y', '-v', 'error', '-ss', '4', '-i', final, '-vf', 'fps=1/8,scale=384:-1,tile=5x6:padding=6:margin=6:color=black',
         '-frames:v', '1', '-q:v', '3', sheet])
    info = json.loads(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels', '-of', 'json', final]))
    print(json.dumps(info, ensure_ascii=False, indent=1))
    loud = subprocess.run(['ffmpeg', '-v', 'info', '-i', final, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    print('\n'.join(l for l in loud.splitlines()[-14:] if l.strip()))
    print('→', final); print('→', s); print('→', thumb); print('→', sheet)


if __name__ == '__main__':
    main()
