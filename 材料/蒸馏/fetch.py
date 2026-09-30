"""Fetch grokking corpus: arXiv HTML full text + blog pages, with figures.

Usage:  python fetch.py manifest.tsv [--only 01,02] [--lang en]
Writes: txt/<id>_<slug>.txt, img/<id>_<n>.<ext>, raw/<id>.html, fetch_report.tsv
"""
import sys, os, re, json, html, time, struct, urllib.parse, urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
HDR = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8"}
BASE = os.path.dirname(os.path.abspath(__file__))
CTRL = dict.fromkeys(range(0, 33)); CTRL[9] = CTRL[10] = CTRL[13] = None


# ---------- deep extraction (tag-pair counting; handles nesting) ----------
def deep_extract(s, tag, start=0):
    """Return outermost <tag>...</tag> block, correctly skipping nested ones."""
    m = re.search(r"(?is)<%s[\s>]" % tag, s[start:])
    if not m:
        return ""
    i = start + m.start()
    depth, pos = 0, i
    pat = re.compile(r"(?is)</?%s[\s>]" % tag)
    while True:
        mm = pat.search(s, pos)
        if not mm:
            return s[i:]
        if s[mm.start():mm.start() + 2] == "</":
            depth -= 1
            if depth == 0:
                end = s.find(">", mm.start())
                return s[i:end + 1]
        else:
            depth += 1
        pos = mm.end()


def strip_tags(s):
    s = re.sub(r"(?is)<(script|style|svg|noscript)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"(?is)<br\s*/?>", "\n", s)
    s = re.sub(r"(?is)</(p|div|li|h[1-6]|tr|blockquote|figcaption)>", "\n", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = s.replace(" ", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n\s*\n\s*\n+", "\n\n", s)
    return s.strip()


def density_pick(doc):
    """Readability-lite: score candidate containers by text minus link text.

    Sites like 36kr/CSDN wrap the article in a div that also holds nav chrome;
    picking the densest container drops the chrome without site-specific rules.
    """
    cands = []
    for tag in ("article", "div", "section", "main"):
        for m in re.finditer(r"(?is)<%s[\s>]" % tag, doc):
            blk = deep_extract(doc, tag, m.start())
            if not blk or len(blk) > 400000:
                continue
            txt = strip_tags(blk)
            if len(txt) < 900:
                continue
            linktxt = sum(len(strip_tags(a)) for a in
                          re.findall(r"(?is)<a\b[^>]*>.*?</a>", blk))
            net = len(txt) - 1.5 * linktxt
            if net > 0:
                cands.append((net, len(blk), blk, tag))
    if not cands:
        return "", ""
    cands.sort(key=lambda c: -c[0])
    top = cands[0][0]
    # Prefer the tightest container that still holds ~all of the best net text,
    # so a page-wide wrapper does not win over the real article box.
    tight = [c for c in cands if c[0] >= 0.92 * top]
    tight.sort(key=lambda c: c[1])
    return tight[0][2], f"density:{tight[0][3]}"


# Site-specific body containers, tried before the generic heuristics.
SITE_RULES = [
    ("blog.csdn.net", r'<div[^>]+id="content_views"[^>]*>'),
    ("zhuanlan.zhihu.com", r'<div[^>]+class="[^"]*RichText[^"]*"[^>]*>'),
    ("mp.weixin.qq.com", r'<div[^>]+id="js_content"[^>]*>'),
    ("36kr.com", r'<div[^>]+class="[^"]*articleDetail[^"]*"[^>]*>'),
    ("juejin.cn", r'<div[^>]+class="[^"]*markdown-body[^"]*"[^>]*>'),
]


def page_body(doc):
    m = re.search(r"(?is)<body[^>]*>(.*)</body>", doc)
    b = m.group(1) if m else doc
    for junk in ("nav", "header", "footer", "aside", "script", "style"):
        b = re.sub(r"(?is)<%s[^>]*>.*?</%s>" % (junk, junk), " ", b)
    return b


def body_of(doc, url=""):
    """Ordered candidate extraction: site rule -> article -> density -> body.

    SPA pages (transformer-circuits, distill) bury prose in deep divs, so a
    candidate holding much less text than the whole body is almost certainly
    a sidebar, not the article -- fall back to the body in that case.
    """
    full = strip_tags(page_body(doc))
    floor = max(1200, int(0.35 * len(full)))
    for host, pat in SITE_RULES:
        if host in url:
            m = re.search(pat, doc, re.I)
            if m:
                blk = deep_extract(doc, "div", m.start())
                if len(strip_tags(blk)) > 500:
                    return blk, f"site:{host}"
    for tag in ("article", "main"):
        blk = deep_extract(doc, tag)
        if len(strip_tags(blk)) > max(1500, floor):
            return blk, tag
    blk, how = density_pick(doc)
    if blk and len(strip_tags(blk)) >= floor:
        return blk, how
    return page_body(doc), "body"


# ---------- image helpers ----------
def img_dims(b):
    try:
        if b[:8] == b"\x89PNG\r\n\x1a\n":
            w, h = struct.unpack(">II", b[16:24]); return w, h
        if b[:2] == b"\xff\xd8":
            i = 2
            while i < len(b) - 9:
                if b[i] != 0xFF:
                    i += 1; continue
                mk = b[i + 1]
                if mk in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB,
                          0xCD, 0xCE, 0xCF):
                    h, w = struct.unpack(">HH", b[i + 5:i + 9]); return w, h
                if mk in (0xD8, 0xD9) or 0xD0 <= mk <= 0xD7:
                    i += 2; continue
                i += 2 + struct.unpack(">H", b[i + 2:i + 4])[0]
        if b[:6] in (b"GIF87a", b"GIF89a"):
            w, h = struct.unpack("<HH", b[6:10]); return w, h
        if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
            if b[12:16] == b"VP8X":
                w = int.from_bytes(b[24:27], "little") + 1
                h = int.from_bytes(b[27:30], "little") + 1
                return w, h
    except Exception:
        pass
    return 0, 0


JUNK = re.compile(r"扫码|二维码|头像|APP|微信|Most Read|作者头像|logo|icon|avatar|badge|qr", re.I)


def collect_images(doc, page_url, base_for_rel):
    """Return list of (absolute_url, alt/caption). Handles relative arXiv paths."""
    out, seen = [], set()
    for m in re.finditer(r"(?is)<img\b([^>]*)>", doc):
        attrs = m.group(1)
        src = re.search(r'(?is)\bsrc\s*=\s*["\']([^"\']+)["\']', attrs)
        if not src:
            continue
        u = html.unescape(src.group(1)).strip()
        if not u or u.startswith(("data:", "#")):
            continue
        if u.startswith("//"):
            u = "https:" + u
        elif not u.startswith("http"):
            u = urllib.parse.urljoin(base_for_rel, u)
        alt = re.search(r'(?is)\balt\s*=\s*["\']([^"\']{0,200})["\']', attrs)
        alt = html.unescape(alt.group(1)).strip() if alt else ""
        if u in seen:
            continue
        seen.add(u)
        out.append((u, alt))
    return out


def dl_image(u, dest_dir, stem, idx):
    try:
        r = urllib.request.Request(u, headers=HDR)
        with urllib.request.urlopen(r, timeout=30) as f:
            b = f.read()
        if len(b) < 3000:
            return None
        w, h = img_dims(b)
        if w and h and (w < 200 or h < 120):
            return None
        if w and h and max(w, h) / max(1, min(w, h)) > 12:
            return None
        ext = ".png"
        if b[:2] == b"\xff\xd8":
            ext = ".jpg"
        elif b[:6] in (b"GIF87a", b"GIF89a"):
            ext = ".gif"
        elif b[:4] == b"RIFF":
            ext = ".webp"
        elif b[:8] != b"\x89PNG\r\n\x1a\n":
            return None                       # not an image (HTML error page)
        p = os.path.join(dest_dir, f"{stem}_{idx:02d}{ext}")
        open(p, "wb").write(b)
        return {"file": os.path.basename(p), "w": w, "h": h, "bytes": len(b), "src": u}
    except Exception:
        return None


# ---------- per-item fetch ----------
def iri_to_uri(u):
    """Percent-encode non-ASCII path/query so urllib does not raise."""
    p = urllib.parse.urlsplit(u)
    return urllib.parse.urlunsplit((
        p.scheme, p.netloc,
        urllib.parse.quote(p.path, safe="/%:@&=+$,;~()*!.'"),
        urllib.parse.quote(p.query, safe="/%:@&=+$,;~()*!.'?"),
        p.fragment))


def fetch(url):
    r = urllib.request.Request(iri_to_uri(url), headers=HDR)
    with urllib.request.urlopen(r, timeout=60) as f:
        return f.read().decode("utf-8", "ignore"), f.geturl()


def slugify(t):
    t = re.sub(r"[^A-Za-z0-9 ]+", " ", t)
    return re.sub(r"\s+", "_", t.strip())[:58]


def process(row):
    rid, lang, cat, title, url, kind = row
    stem = f"{rid}_grokking"
    rep = {"id": rid, "url": url, "final": "", "chars": 0, "imgs": 0, "status": "",
           "title": title}
    try:
        if kind == "arxiv":
            aid = re.search(r"(\d{4}\.\d{4,5})", url).group(1)
            # arXiv HTML full text; try v1..v3
            doc = None
            for v in ("v1", "v2", "v3", ""):
                for cand in (f"https://arxiv.org/html/{aid}{v}",):
                    try:
                        d, fin = fetch(cand)
                        if len(strip_tags(d)) > 4000:
                            doc, rep["final"] = d, fin
                            break
                    except Exception:
                        pass
                if doc:
                    break
            if not doc:
                rep["status"] = "NO_HTML"
                return rep
            # arXiv fig srcs are relative AND already carry the version dir
            # (e.g. "2301.05217v1/figs/x.png"), so the base must NOT include it.
            base_rel = "https://arxiv.org/html/"
        else:
            doc, fin = fetch(url)
            rep["final"] = fin
            base_rel = fin

        open(os.path.join(BASE, "raw", f"{stem}.html"), "w", encoding="utf-8").write(doc)
        blk, how = body_of(doc, rep["final"] or url)
        txt = strip_tags(blk)

        # figures: keep captions as inline markers
        caps = [strip_tags(c)[:300] for c in
                re.findall(r"(?is)<figcaption[^>]*>(.*?)</figcaption>", doc)][:40]

        imgs = collect_images(doc, url, base_rel)
        saved = []
        for i, (iu, alt) in enumerate(imgs[:36]):
            if JUNK.search(iu) or JUNK.search(alt):
                continue
            r = dl_image(iu, os.path.join(BASE, "img"), stem, len(saved) + 1)
            if r:
                r["alt"] = alt or (caps[len(saved)] if len(saved) < len(caps) else "")
                saved.append(r)

        header = (f"# {title}\n"
                  f"# id: {rid} | lang: {lang} | category: {cat}\n"
                  f"# source: {rep['final'] or url}\n"
                  f"# extracted_via: {how} | chars: {len(txt)} | figures: {len(saved)}\n"
                  + "=" * 78 + "\n\n")
        open(os.path.join(BASE, "txt", f"{stem}.txt"), "w", encoding="utf-8").write(header + txt)

        # per-doc figure list for IMAGES.md
        json.dump(saved, open(os.path.join(BASE, "img", f"{stem}.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        rep.update(chars=len(txt), imgs=len(saved), status="OK", via=how)
        return rep
    except Exception as e:
        rep["status"] = "ERR:" + str(e)[:70]
        return rep


def main():
    man = sys.argv[1]
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    lang_f = None
    if "--lang" in sys.argv:
        lang_f = sys.argv[sys.argv.index("--lang") + 1]
    rows = []
    for line in open(os.path.join(BASE, man), encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 6 and p[0] != "id":
            if only and p[0] not in only:
                continue
            if lang_f and p[1] != lang_f:
                continue
            rows.append(p[:6])
    for i, d in enumerate(("txt", "img", "raw")):
        os.makedirs(os.path.join(BASE, d), exist_ok=True)
    out = []
    for n, row in enumerate(rows, 1):
        rep = process(row)
        out.append(rep)
        print(f"[{n}/{len(rows)}] {rep['id']} {rep['status']:<28} "
              f"chars={rep['chars']:>7} imgs={rep['imgs']:>2}  {rep['title'][:52]}")
        sys.stdout.flush()
        time.sleep(1.5)
    with open(os.path.join(BASE, "fetch_report.tsv"), "a", encoding="utf-8") as f:
        for r in out:
            f.write("\t".join([r["id"], r["status"], str(r["chars"]), str(r["imgs"]),
                               r.get("final", "") or r["url"]]) + "\n")


if __name__ == "__main__":
    main()
