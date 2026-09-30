"""Render JS-heavy pages with Playwright, save DOM to raw/<stem>.html.

Then run:  python fetch.py manifest.tsv --only <ids>
which re-reads raw/<stem>.html and extracts text + figures.

Usage: python fetch_render.py manifest.tsv --only 30,37
"""
import sys, os, json, asyncio, re
from playwright.async_api import async_playwright

BASE = os.path.dirname(os.path.abspath(__file__))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")


async def main():
    man = sys.argv[1]
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    rows = []
    for line in open(os.path.join(BASE, man), encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 6 and p[0] != "id":
            if only and p[0] not in only:
                continue
            rows.append(p[:6])
    os.makedirs(os.path.join(BASE, "raw"), exist_ok=True)
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True, args=[
            "--disable-blink-features=AutomationControlled", "--no-sandbox"])
        ctx = await br.new_context(user_agent=UA, locale="en-US",
                                   viewport={"width": 1440, "height": 1000})
        await ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
        for rid, lang, cat, title, url, kind in rows:
            page = await ctx.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                try:
                    await page.wait_for_load_state("networkidle", timeout=12000)
                except Exception:
                    pass
                await page.wait_for_timeout(9000)
                # expand lazy-loaded figures
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(4000)
                await page.evaluate("window.scrollTo(0, 0)")
                await page.wait_for_timeout(1500)
                dom = await page.content()
                p = os.path.join(BASE, "raw", f"{rid}_grokking.html")
                open(p, "w", encoding="utf-8").write(dom)
                print(f"[{rid}] rendered {len(dom):>9} bytes -> {p}")
            except Exception as e:
                print(f"[{rid}] RENDER ERR {str(e)[:120]}")
            finally:
                await page.close()
        await br.close()


if __name__ == "__main__":
    asyncio.run(main())
