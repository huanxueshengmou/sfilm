"""Build INDEX.md / IMAGES.md / meta.json / sources.tsv from txt/ + img/."""
import os, re, json, glob

BASE = os.path.dirname(os.path.abspath(__file__))
TXT, IMG = os.path.join(BASE, "txt"), os.path.join(BASE, "img")


def parse_head(p):
    d = open(p, encoding="utf-8").read()
    h = {}
    m = re.match(r"# (.+)\n# id: (\S+) \| lang: (\S+) \| category: (.+)\n"
                 r"# source: (\S+)\n# extracted_via: (\S+) \| chars: (\d+) \| figures: (\d+)",
                 d)
    if m:
        h = {"title": m.group(1), "id": m.group(2), "lang": m.group(3),
             "cat": m.group(4), "source": m.group(5), "via": m.group(6),
             "chars": int(m.group(7)), "figs": int(m.group(8))}
    body = d.split("=" * 78, 1)[1] if "=" * 78 in d else d
    h["body"] = body.strip()
    return h


def main():
    docs = []
    for p in sorted(glob.glob(os.path.join(TXT, "*.txt"))):
        h = parse_head(p)
        if not h:
            continue
        h["file"] = os.path.basename(p)
        rid = h["id"]
        jf = os.path.join(IMG, f"{rid}_grokking.json")
        h["images"] = json.load(open(jf, encoding="utf-8")) if os.path.exists(jf) else []
        docs.append(h)
    docs.sort(key=lambda d: d["id"])

    # ---------- IMAGES.md ----------
    with open(os.path.join(BASE, "IMAGES.md"), "w", encoding="utf-8") as f:
        tot = sum(len(d["images"]) for d in docs)
        f.write(f"# Grokking 资料库 · 配图索引\n\n共 **{len(docs)} 篇**，配图 **{tot} 张**。\n\n")
        for d in docs:
            if not d["images"]:
                continue
            f.write(f"## {d['id']} · {d['title']}\n\n")
            for im in d["images"]:
                alt = (im.get("alt") or "").replace("\n", " ")[:160]
                f.write(f"- `img/{im['file']}` — {im['w']}×{im['h']}, {im['bytes']//1024}KB"
                        + (f" — {alt}" if alt else "") + "\n")
            f.write("\n")

    # ---------- meta.json ----------
    json.dump([{k: v for k, v in d.items() if k != "body"} for d in docs],
              open(os.path.join(BASE, "meta.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    # ---------- sources.tsv ----------
    with open(os.path.join(BASE, "sources.tsv"), "w", encoding="utf-8") as f:
        f.write("id\tlang\tcategory\tchars\tfigures\ttitle\tsource\n")
        for d in docs:
            f.write("\t".join([d["id"], d["lang"], d["cat"], str(d["chars"]),
                               str(len(d["images"])), d["title"], d["source"]]) + "\n")

    print(f"docs={len(docs)} images={sum(len(d['images']) for d in docs)} "
          f"chars={sum(d['chars'] for d in docs)}")


if __name__ == "__main__":
    main()
