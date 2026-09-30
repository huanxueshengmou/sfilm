#!/usr/bin/env python
"""全文检索 Grokking 资料库。

  python search.py "关键词"              # 检索全部文档
  python search.py "关键词" -n 30        # 每篇最多显示 30 行
  python search.py "关键词" --doc 02     # 限定单篇
  python search.py "关键词" --cat 机制    # 按分类过滤
  python search.py "关键词" --lang zh    # 按语言过滤
  python search.py --list                # 列出全部文档
  python search.py --stat                # 统计信息
  python search.py --context 2 "关键词"  # 显示上下文行数
"""
import sys, os, re, glob, json, argparse

BASE = os.path.dirname(os.path.abspath(__file__))
TXT = os.path.join(BASE, "txt")


def load():
    docs = []
    for p in sorted(glob.glob(os.path.join(TXT, "*.txt"))):
        d = open(p, encoding="utf-8").read()
        m = re.match(r"# (.+)\n# id: (\S+) \| lang: (\S+) \| category: (.+)\n# source: (\S+)",
                     d)
        if not m:
            continue
        body = d.split("=" * 78, 1)[1] if "=" * 78 in d else d
        docs.append({"title": m.group(1), "id": m.group(2), "lang": m.group(3),
                     "cat": m.group(4), "source": m.group(5),
                     "file": os.path.basename(p), "body": body})
    return docs


def main():
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("query", nargs="*")
    ap.add_argument("-n", type=int, default=12)
    ap.add_argument("--doc")
    ap.add_argument("--cat")
    ap.add_argument("--lang")
    ap.add_argument("--context", type=int, default=0)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--stat", action="store_true")
    ap.add_argument("-h", "--help", action="store_true")
    a = ap.parse_args()

    docs = load()
    if a.help or (not a.query and not a.list and not a.stat):
        print(__doc__)
        return
    if a.stat:
        tot = sum(len(d["body"]) for d in docs)
        img = len(glob.glob(os.path.join(BASE, "img", "*.png"))) + \
              len(glob.glob(os.path.join(BASE, "img", "*.jpg"))) + \
              len(glob.glob(os.path.join(BASE, "img", "*.webp"))) + \
              len(glob.glob(os.path.join(BASE, "img", "*.gif")))
        print(f"文档 {len(docs)} 篇 | 正文 {tot:,} 字符 | 配图 {img} 张")
        print(f"  英文 {sum(1 for d in docs if d['lang']=='en')} 篇"
              f" | 中文 {sum(1 for d in docs if d['lang']=='zh')} 篇")
        cats = {}
        for d in docs:
            cats[d["cat"]] = cats.get(d["cat"], 0) + 1
        for k, v in sorted(cats.items(), key=lambda x: -x[1]):
            print(f"  {k}: {v}")
        return
    if a.list:
        print(f"{'id':<4}{'lang':<5}{'chars':>8}  {'分类':<12} 标题")
        for d in docs:
            print(f"{d['id']:<4}{d['lang']:<5}{len(d['body']):>8}  {d['cat']:<12} {d['title']}")
        return

    q = " ".join(a.query)
    pat = re.compile(re.escape(q), re.I)
    hits_total = 0
    for d in docs:
        if a.doc and d["id"] != a.doc:
            continue
        if a.cat and a.cat not in d["cat"]:
            continue
        if a.lang and d["lang"] != a.lang:
            continue
        lines = d["body"].split("\n")
        hits = [i for i, l in enumerate(lines) if pat.search(l)]
        if not hits:
            continue
        hits_total += len(hits)
        print(f"\n{'='*74}\n[{d['id']}] {d['title']}  ({d['lang']}, {d['cat']}) — {len(hits)} 处\n"
              f"     {d['source']}")
        shown = 0
        last = -99
        for i in hits:
            if shown >= a.n:
                print(f"     ... 另有 {len(hits)-shown} 处")
                break
            if i - last <= a.context:      # merge overlapping windows
                print(f"  {lines[i].strip()[:400]}")
            else:
                if a.context:
                    for j in range(max(0, i - a.context), min(len(lines), i + a.context + 1)):
                        mark = ">" if j == i else " "
                        print(f" {mark}{lines[j].strip()[:400]}")
                else:
                    print(f"  L{i+1}: {lines[i].strip()[:400]}")
            last = i
            shown += 1
    print(f"\n共 {hits_total} 处命中（{q}）")


if __name__ == "__main__":
    main()
