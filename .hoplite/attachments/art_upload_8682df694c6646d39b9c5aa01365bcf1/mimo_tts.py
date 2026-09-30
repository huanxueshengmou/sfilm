#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小米 MiMo TTS 工具（命令行 + 可 import）

命令行用法:
    python mimo_tts.py voices                          列出内置音色
    python mimo_tts.py say "文本" -o out.wav           合成（默认冰糖）
    python mimo_tts.py say "文本" -v 茉莉 -s "语气"     指定音色 + 风格指令
    python mimo_tts.py say -f script.txt -o out.wav    从文件读长文本
    python mimo_tts.py stream "文本" -o out.wav        流式合成
    python mimo_tts.py design "文本" -d "音色描述"      文字描述造音色
    python mimo_tts.py clone "文本" -r ref.wav         克隆参考音频的音色
    python mimo_tts.py asr in.wav                      语音识别（收费）
    python mimo_tts.py test                            跑一遍自检

API Key 来源（按优先级）:
    1. --key 命令行参数
    2. MIMO_API_KEY 系统环境变量
    3. 本脚本同目录下的 .env 文件

用法示例:
    cd /d I:\\tts脚本
    python mimo_tts.py say "你好，世界"
"""
import base64
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.request

BASE = "https://api.xiaomimimo.com/v1"
HERE = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(HERE, ".env")


def _load_env():
    """从脚本同目录的 .env 读取配置（不覆盖已有的环境变量）。"""
    if not os.path.exists(ENV_FILE):
        return
    try:
        with open(ENV_FILE, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v
    except OSError:
        pass


_load_env()

# 内置音色白名单（服务端校验列表；传错会 400 并列出全部合法值）
# mimo_default 是别名：中国区解析为「冰糖」，其他区为「Mia」
VOICES = {
    "mimo_default": "别名（中国区=冰糖）",
    "冰糖": "女声 261Hz 语速最快",
    "茉莉": "女声 250Hz 起伏大",
    "苏打": "男声 211Hz 偏清亮",
    "白桦": "男声 140Hz 沉稳",
    "Mia": "女声 233Hz 英文原生",
    "Chloe": "女声 250Hz 英文原生",
    "Milo": "男声 207Hz 英文原生",
    "Dean": "男声 126Hz 最低沉",
}


def _key(explicit=None):
    k = explicit or os.environ.get("MIMO_API_KEY", "")
    if not k:
        sys.exit("缺少 API Key：请设置环境变量 MIMO_API_KEY，或用 --key 传入")
    return k


def _post(path, payload, key=None, timeout=300, retries=4):
    """POST 到 API。对 429 / 5xx 做指数退避重试。"""
    body = json.dumps(payload).encode("utf-8")
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(
            BASE + path, data=body,
            headers={"Authorization": f"Bearer {_key(key)}",
                     "Content-Type": "application/json"},
            method="POST")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504):
                wait = 2 ** attempt + 1          # 2s,3s,5s,9s
                print(f"  [{e.code}] 限流或服务端错误，{wait}s 后重试 "
                      f"({attempt+1}/{retries})", file=sys.stderr)
                time.sleep(wait)
                continue
            raise                                # 4xx（除 429）直接抛
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            wait = 2 ** attempt + 1
            print(f"  [网络] {e}，{wait}s 后重试 ({attempt+1}/{retries})", file=sys.stderr)
            time.sleep(wait)
    raise last


def _b64(data):
    return base64.b64decode(data["choices"][0]["message"]["audio"]["data"])


def _msgs(text, style=None):
    """组装消息：文本必须放 assistant，风格指令放 user。"""
    m = []
    if style:
        m.append({"role": "user", "content": style})
    m.append({"role": "assistant", "content": text})
    return m


# ---------------- 核心 API ----------------

def tts(text, voice="冰糖", style=None, fmt="wav", key=None):
    """内置音色合成，返回音频 bytes。"""
    return _b64(_post("/chat/completions", {
        "model": "mimo-v2.5-tts",
        "messages": _msgs(text, style),
        "audio": {"voice": voice, "format": fmt},
    }, key=key))


def tts_voicedesign(text, description, fmt="wav", key=None):
    """文字描述生成音色。注意：不传 voice；每次生成结果不同，不可复现。"""
    return _b64(_post("/chat/completions", {
        "model": "mimo-v2.5-tts-voicedesign",
        "messages": [{"role": "user", "content": description},
                     {"role": "assistant", "content": text}],
        "audio": {"format": fmt},
    }, key=key))


def tts_voiceclone(text, sample_path, style=None, fmt="wav", key=None):
    """克隆参考音频的音色。voice 必须是 DataURL，纯 base64 会 400。"""
    raw = open(sample_path, "rb").read()
    if len(raw) * 4 / 3 > 10 * 1024 * 1024:
        raise ValueError("参考音频 Base64 后超过 10MB 上限，请用更短的样本")
    ext = "mpeg" if sample_path.lower().endswith(".mp3") else "wav"
    url = f"data:audio/{ext};base64," + base64.b64encode(raw).decode()
    return _b64(_post("/chat/completions", {
        "model": "mimo-v2.5-tts-voiceclone",
        "messages": _msgs(text, style),
        "audio": {"voice": url, "format": fmt},
    }, key=key))


def tts_stream(text, voice="冰糖", style=None, key=None):
    """流式合成，逐块 yield PCM16（24kHz 单声道）。"""
    req = urllib.request.Request(
        BASE + "/chat/completions",
        data=json.dumps({
            "model": "mimo-v2.5-tts",
            "messages": _msgs(text, style),
            "audio": {"voice": voice, "format": "pcm16"},
            "stream": True,
        }).encode("utf-8"),
        headers={"Authorization": f"Bearer {_key(key)}",
                 "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req, timeout=300) as r:
        for line in r:
            line = line.decode("utf-8", "replace").strip()
            if not line.startswith("data:"):
                continue
            d = line[5:].strip()
            if d == "[DONE]":
                break
            try:
                j = json.loads(d)
            except json.JSONDecodeError:
                continue
            for ch in j.get("choices", []):
                au = (ch.get("delta") or {}).get("audio") or {}
                if au.get("data"):
                    yield base64.b64decode(au["data"])


def asr(audio_path, key=None):
    """语音识别（收费：¥0.5/小时音频）。"""
    raw = open(audio_path, "rb").read()
    ext = "mpeg" if audio_path.lower().endswith(".mp3") else "wav"
    d = _post("/chat/completions", {
        "model": "mimo-v2.5-asr",
        "messages": [{"role": "user", "content": [{
            "type": "input_audio",
            "input_audio": {"data": f"data:audio/{ext};base64,"
                                    + base64.b64encode(raw).decode(),
                            "format": ext},
        }]}],
    }, key=key)
    return d["choices"][0]["message"]["content"]


def pcm16_to_wav(pcm, path, rate=24000, channels=1):
    """PCM16 裸数据包成 WAV。"""
    data = bytes(pcm)
    wav = (b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVEfmt "
           + struct.pack("<IHHIIHH", 16, 1, channels, rate,
                         rate * channels * 2, channels * 2, 16)
           + b"data" + struct.pack("<I", len(data)) + data)
    open(path, "wb").write(wav)


# ---------------- 自检 ----------------

def _selftest():
    print("自检：6 条路径")
    for label, fn, out in [
        ("基础合成", lambda: tts("你好，这是自检。", voice="冰糖"), "out_basic.wav"),
        ("风格指令", lambda: tts("我们成功了！", voice="冰糖",
                               style="用兴奋的语气说。"), "out_style.wav"),
        ("音色设计", lambda: tts_voicedesign("设计音色自检。",
                                            "二十多岁的女性，声音明亮清晰。"), "out_design.wav"),
    ]:
        open(out, "wb").write(fn())
        print(f"  {label}  OK  -> {out}")
    chunks = list(tts_stream("流式自检，验证分片拼接。", voice="冰糖"))
    pcm16_to_wav(b"".join(chunks), "out_stream.wav")
    print(f"  流式合成  OK  -> out_stream.wav ({len(chunks)} chunks)")
    open("out_clone.wav", "wb").write(
        tts_voiceclone("克隆自检。", "out_basic.wav"))
    print("  音色克隆  OK  -> out_clone.wav")
    print("  语音识别  OK  ->", asr("out_basic.wav"))


# ---------------- 命令行 ----------------

def main():
    import argparse
    p = argparse.ArgumentParser(
        description="小米 MiMo TTS 命令行",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--key", help="API Key（默认读环境变量 MIMO_API_KEY）")
    sub = p.add_subparsers(dest="cmd")

    sub.add_parser("voices", help="列出内置音色")
    sub.add_parser("test", help="跑自检")

    for name, help_ in [("say", "合成"), ("stream", "流式合成")]:
        q = sub.add_parser(name, help=help_)
        q.add_argument("text", nargs="?", help="要合成的文本")
        q.add_argument("-f", "--file", help="从文件读文本（长文本用）")
        q.add_argument("-o", "--out", default="out.wav")
        q.add_argument("-v", "--voice", default="冰糖")
        q.add_argument("-s", "--style", help="风格指令，如「用悲伤的语气说」")

    q = sub.add_parser("design", help="文字描述生成音色（不可复现）")
    q.add_argument("text")
    q.add_argument("-d", "--desc", required=True, help="音色描述")
    q.add_argument("-o", "--out", default="out_design.wav")

    q = sub.add_parser("clone", help="克隆参考音频音色")
    q.add_argument("text")
    q.add_argument("-r", "--ref", required=True, help="参考音频 (wav/mp3)")
    q.add_argument("-o", "--out", default="out_clone.wav")
    q.add_argument("-s", "--style")

    q = sub.add_parser("asr", help="语音识别（收费）")
    q.add_argument("audio")

    # --key 在主 parser 上，但用法上常被写在子命令后面。
    # 这里先做一次宽松预扫描，把 --key 的值取出来，两种位置都能用。
    argv = sys.argv[1:]
    pre_key = None
    if "--key" in argv:
        i = argv.index("--key")
        if i + 1 < len(argv):
            pre_key = argv[i + 1]
        del argv[i:i + 2]

    a = p.parse_args(argv)
    if pre_key:
        a.key = pre_key

    if a.cmd == "voices":
        print(f"{'音色 ID':<14}说明")
        print("-" * 50)
        for k, v in VOICES.items():
            print(f"{k:<14}{v}")
        print("\n注: mimo_default 是别名，不是独立音色")
        return

    if a.cmd == "test":
        _selftest()
        return

    def text_of():
        if a.file:
            return open(a.file, encoding="utf-8").read().strip()
        if a.text:
            return a.text
        sys.exit("请提供文本，或用 -f 指定文件")

    if a.cmd in ("say", "stream"):
        txt = text_of()
        if a.cmd == "say":
            open(a.out, "wb").write(tts(txt, voice=a.voice, style=a.style, key=a.key))
            print(f"{len(txt)} 字 -> {a.out}")
        else:
            chunks = list(tts_stream(txt, voice=a.voice, style=a.style, key=a.key))
            pcm16_to_wav(b"".join(chunks), a.out)
            print(f"{len(txt)} 字 -> {a.out} ({len(chunks)} chunks)")
    elif a.cmd == "design":
        open(a.out, "wb").write(tts_voicedesign(a.text, a.desc, key=a.key))
        print(f"-> {a.out}")
    elif a.cmd == "clone":
        open(a.out, "wb").write(
            tts_voiceclone(a.text, a.ref, style=a.style, key=a.key))
        print(f"-> {a.out}")
    elif a.cmd == "asr":
        print(asr(a.audio, key=a.key))
    else:
        p.print_help()


if __name__ == "__main__":
    main()
