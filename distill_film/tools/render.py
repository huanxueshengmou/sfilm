# 画面渲染：本地 HTTP 服务 web/ → 浏览器（Edge / Chrome / Chromium，WebGL2 GPU）逐帧渲染
#          → WebSocket 推送 YUV420p 帧 → ffmpeg 分段编码 render/seg/seg_XXXX.mp4
# 断点续渲：每段完成写 .ok；web/ 或时间线改动后自动作废旧分段（SIGNATURE）
# 探针：--probe 3,10.5,26  或  --probe-every 4   → render/probe/*.png + sheet.jpg
import argparse
import asyncio
import base64
import functools
import glob
import hashlib
import http.server
import json
import math
import os
import socket
import subprocess
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import P, ffmpeg_exe, load_json, log, save_json, utf8_stdio

SEG = 600
SEG_DIR = P('render', 'seg')
PROBE_DIR = P('render', 'probe')
GPU_ARGS = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
            '--force-color-profile=srgb', '--disable-features=CalculateNativeWinOcclusion']
SWIFT_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--in-process-gpu', '--no-sandbox',
              '--disable-dev-shm-usage']
SOFT_GL = ('SwiftShader', 'llvmpipe', 'Microsoft Basic Render', 'Software')


class Quiet(http.server.SimpleHTTPRequestHandler):
    extensions_map = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                      '.ttf': 'font/ttf', '.json': 'application/json', '.png': 'image/png',
                      '.txt': 'text/plain; charset=utf-8', '': 'application/octet-stream'}

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def start_http():
    port = free_port()
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Quiet, directory=P('web')))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, port


def signature(extra=''):
    h = hashlib.sha1(extra.encode())
    for root, dirs, files in os.walk(P('web')):
        dirs.sort()
        for f in sorted(files):
            if f.endswith(('.js', '.html')):
                h.update(f.encode())
                with open(os.path.join(root, f), 'rb') as fh:
                    h.update(fh.read())
    return h.hexdigest()[:16]


def channels():
    forced = os.environ.get('FILM_BROWSER')
    if forced:
        return [forced]
    if sys.platform == 'win32':
        return ['msedge', 'chrome', 'chromium']
    return ['chromium', 'chrome', 'msedge']


async def open_page(browser, url):
    page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
    page.on('console', lambda m: log('[web]', m.text) if m.type in ('error', 'warning') and 'GPU stall' not in m.text else None)
    page.on('pageerror', lambda e: log('[web] 页面错误:', e))
    await page.goto(url, wait_until='load', timeout=180000)
    await page.wait_for_function('window.READY === true || !!window.BOOT_ERR', timeout=300000, polling=250)
    err = await page.evaluate('window.BOOT_ERR || null')
    if err:
        raise RuntimeError('页面初始化失败：\n' + err[:4000])
    return page


async def launch(pw, url):
    """优先硬件加速：无头模式拿不到 GPU 时改用有界面（窗口放到屏幕外）模式。"""
    soft_env = os.environ.get('FILM_GL', '').lower() == 'swiftshader'
    forced_head = os.environ.get('FILM_HEADLESS')
    errors, installed = [], False
    for ch in channels():
        modes = [forced_head != '0'] if forced_head else [True, False]
        for headless in modes:
            args = list(GPU_ARGS) + (SWIFT_ARGS if soft_env else [])
            if not headless:
                args += ['--window-position=-2400,-2400', '--window-size=800,500']
            kw = dict(headless=headless, args=args)
            if ch != 'chromium':
                kw['channel'] = ch
            try:
                browser = await pw.chromium.launch(**kw)
            except Exception as e:
                msg = str(e).strip().splitlines()[0][:200]
                if ch == 'chromium' and not installed and ('Executable' in str(e) or 'playwright install' in str(e)):
                    log('[render] 未找到 Edge/Chrome，正在下载 Playwright Chromium（约 150MB，仅首次）…')
                    subprocess.run([sys.executable, '-m', 'playwright', 'install', 'chromium'], check=False)
                    installed = True
                    try:
                        browser = await pw.chromium.launch(**kw)
                    except Exception as e2:
                        errors.append(f'{ch}: {str(e2).strip().splitlines()[0][:200]}')
                        break
                else:
                    errors.append(f'{ch}: {msg}')
                    break
            try:
                page = await open_page(browser, url)
            except Exception as e:
                errors.append(f'{ch}: {e}')
                await browser.close()
                if 'WebGL2' in str(e) and headless:
                    continue
                raise
            info = await page.evaluate('window.GLINFO')
            soft = any(k.lower() in (info.get('renderer') or '').lower() for k in SOFT_GL)
            if soft and not soft_env and headless and not forced_head:
                log(f"[render] {ch} 无头模式只拿到软件渲染（{info.get('renderer')}），改用有界面模式重试…")
                await browser.close()
                continue
            info.update(browser=ch, headless=headless, version=browser.version, software=soft)
            return browser, page, info
    raise RuntimeError('无法启动支持 WebGL2 的浏览器：\n  ' + '\n  '.join(errors) +
                       '\n请安装/更新 Microsoft Edge 或 Google Chrome 与显卡驱动。')


class Sink:
    """WebSocket 收帧 → 写入当前 ffmpeg 的 stdin；每帧回一个 ack 做流控。"""

    def __init__(self):
        self.proc = None
        self.frames = 0

    async def handler(self, ws, *_):
        async for msg in ws:
            if isinstance(msg, (bytes, bytearray)):
                if self.proc is not None:
                    await asyncio.to_thread(self.proc.stdin.write, msg)
                    self.frames += 1
                await ws.send('k')


async def serve_ws(sink, port):
    try:
        from websockets.asyncio.server import serve
    except ImportError:  # websockets < 13
        from websockets import serve
    return await serve(sink.handler, '127.0.0.1', port, max_size=None, compression=None, ping_interval=None)


def enc_cmd(out, fps, crf, preset):
    return [ffmpeg_exe(), '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', '1920x1080',
            '-r', str(fps), '-i', '-', '-c:v', 'libx264', '-preset', preset, '-crf', str(crf), '-pix_fmt', 'yuv420p',
            '-profile:v', 'high', '-x264-params', 'aq-mode=3:aq-strength=0.9:deblock=-1,-1', '-g', str(fps * 2),
            '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
            '-movflags', '+faststart', out]


async def render_segments(page, tl, args):
    fps, total = tl['fps'], tl['frames']
    os.makedirs(SEG_DIR, exist_ok=True)
    sig = signature(json.dumps([tl['duration'], tl['cues'], args.crf, args.preset, args.q]))
    sig_p = os.path.join(SEG_DIR, 'SIGNATURE')
    old = open(sig_p, encoding='utf-8').read().strip() if os.path.exists(sig_p) else ''
    if old != sig:
        stale = glob.glob(os.path.join(SEG_DIR, 'seg_*'))
        if stale:
            log(f'[render] 画面代码或时间线有改动，作废 {len(stale)} 个旧分段文件')
            for f in stale:
                os.remove(f)
        with open(sig_p, 'w', encoding='utf-8') as f:
            f.write(sig)
    nseg = math.ceil(total / SEG)
    f_lo = int(args.t_from * fps) if args.t_from is not None else 0
    f_hi = int(math.ceil(args.t_to * fps)) if args.t_to is not None else total
    todo = []
    for i in range(nseg):
        f0, f1 = i * SEG, min(total, (i + 1) * SEG)
        if f1 <= f_lo or f0 >= f_hi:
            continue
        out = os.path.join(SEG_DIR, f'seg_{i:04d}.mp4')
        ok = out + '.ok'
        if os.path.exists(out) and os.path.exists(ok) and open(ok).read().strip() == str(f1 - f0):
            continue
        todo.append((i, f0, f1, out))
    done_frames = sum(int(open(p).read()) for p in glob.glob(os.path.join(SEG_DIR, 'seg_*.mp4.ok')))
    log(f'[render] 共 {nseg} 段 / {total} 帧；已完成 {done_frames} 帧，本次需渲染 {len(todo)} 段')
    if not todo:
        return {'segments': nseg, 'rendered': 0}
    sink = Sink()
    port = free_port()
    server = await serve_ws(sink, port)
    t_start, frames_done, ms_hist = time.time(), 0, []
    try:
        for n, (i, f0, f1, out) in enumerate(todo):
            part = out[:-4] + '.part.mp4'
            errlog = open(os.path.join(SEG_DIR, f'seg_{i:04d}.ffmpeg.log'), 'w', encoding='utf-8')
            sink.proc = subprocess.Popen(enc_cmd(part, fps, args.crf, args.preset), stdin=subprocess.PIPE,
                                         stdout=subprocess.DEVNULL, stderr=errlog)
            sink.frames = 0
            try:
                ms = await page.evaluate(f'renderRange({f0}, {f1}, {port})')
            finally:
                sink.proc.stdin.close()
                rc = sink.proc.wait()
                errlog.close()
                got, sink.proc = sink.frames, None
            if rc != 0 or got != f1 - f0:
                tail = open(os.path.join(SEG_DIR, f'seg_{i:04d}.ffmpeg.log'), encoding='utf-8', errors='replace').read()[-1500:]
                raise RuntimeError(f'第 {i} 段编码失败（ffmpeg exit {rc}，收到 {got}/{f1 - f0} 帧）\n{tail}')
            os.replace(part, out)
            with open(out + '.ok', 'w') as f:
                f.write(str(f1 - f0))
            frames_done += f1 - f0
            ms_hist.append(ms)
            el = time.time() - t_start
            left = sum(b - a for _, a, b, _ in todo[n + 1:])
            eta = el / frames_done * left
            log(f'[render] 段 {i + 1:>3}/{nseg}  帧 {f0}–{f1}  {ms:5.1f} ms/帧  '
                f'已用 {el / 60:4.1f} 分  预计还需 {eta / 60:4.1f} 分')
    finally:
        server.close()
    return {'segments': nseg, 'rendered': len(todo), 'ms_per_frame': round(sum(ms_hist) / len(ms_hist), 2),
            'minutes': round((time.time() - t_start) / 60, 2)}


async def probe(page, times, fps, fmt='png'):
    os.makedirs(PROBE_DIR, exist_ok=True)
    out = []
    for t in times:
        f = int(round(t * fps))
        url = await page.evaluate(f"probe({f}, 'image/{'jpeg' if fmt == 'jpg' else 'png'}')")
        p = os.path.join(PROBE_DIR, f'f{f:05d}.{fmt}')
        with open(p, 'wb') as fh:
            fh.write(base64.b64decode(url.split(',', 1)[1]))
        out.append((t, p))
    return out


def sheet(items, path, cols=4, w=480):
    from PIL import Image, ImageDraw
    h = w * 9 // 16
    rows = math.ceil(len(items) / cols)
    S = Image.new('RGB', (cols * w, rows * h), 'black')
    d = ImageDraw.Draw(S)
    for i, (t, p) in enumerate(items):
        im = Image.open(p).convert('RGB').resize((w, h), Image.LANCZOS)
        x, y = (i % cols) * w, (i // cols) * h
        S.paste(im, (x, y))
        d.rectangle([x, y, x + 74, y + 18], fill='black')
        d.text((x + 4, y + 3), f'{t:7.2f}s', fill='yellow')
    S.save(path, quality=88)
    return path


async def amain(args):
    tl = load_json(P('script', 'timeline.json'))
    srv, hport = start_http()
    url = f'http://127.0.0.1:{hport}/index.html' + (f'?q={args.q}' if args.q != 1 else '')
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser, page, info = await launch(pw, url)
        mode = '无头' if info['headless'] else '有界面'
        log(f"[render] 浏览器 {info['browser']} {info['version']}（{mode}）| GPU: {info['renderer']} | 粒子 {info['particles']}")
        if info.get('software'):
            log('[render] 警告：当前是软件渲染（没有用上显卡），会非常慢。请更新显卡驱动或设置 FILM_BROWSER=chrome 重试。')
        save_json(P('render', 'logs', 'gpu.json'), info)
        res = {'gpu': info}
        try:
            if args.probe or args.probe_every:
                times = [float(x) for x in args.probe.split(',')] if args.probe else \
                    [x * args.probe_every + args.probe_every / 2 for x in range(int(tl['duration'] / args.probe_every))]
                t0 = time.time()
                items = await probe(page, times, tl['fps'], 'jpg' if args.probe_every else 'png')
                log(f'[render] 探针 {len(items)} 帧，{(time.time() - t0) / len(items):.2f} s/帧')
                res['sheet'] = sheet(items, os.path.join(PROBE_DIR, 'sheet.jpg'), cols=args.cols)
                res['probes'] = [p for _, p in items]
            else:
                res.update(await render_segments(page, tl, args))
        finally:
            await browser.close()
            srv.shutdown()
    return res


def build(t_from=None, t_to=None, crf=16, preset='medium', q=1.0, probe=None, probe_every=None, cols=4):
    a = argparse.Namespace(t_from=t_from, t_to=t_to, crf=crf, preset=preset, q=q, probe=probe,
                           probe_every=probe_every, cols=cols)
    return asyncio.run(amain(a))


def main():
    utf8_stdio()
    ap = argparse.ArgumentParser(description='渲染画面分段 / 探针截图')
    ap.add_argument('--from', dest='t_from', type=float)
    ap.add_argument('--to', dest='t_to', type=float)
    ap.add_argument('--crf', type=int, default=16)
    ap.add_argument('--preset', default='medium')
    ap.add_argument('--q', type=float, default=1.0, help='粒子数量倍率（调试用）')
    ap.add_argument('--probe', help='逗号分隔的秒数，只截图不编码')
    ap.add_argument('--probe-every', type=float, help='每隔 N 秒截一张做总览')
    ap.add_argument('--cols', type=int, default=4)
    a = ap.parse_args()
    res = build(a.t_from, a.t_to, a.crf, a.preset, a.q, a.probe, a.probe_every, a.cols)
    log('[render] 完成', json.dumps({k: v for k, v in res.items() if k != 'probes'}, ensure_ascii=False)[:400])


if __name__ == '__main__':
    main()
