#!/usr/bin/env python3
"""Collect every phrase the games can say into audio/phrases.json.

Each game registers its phrases in JavaScript with LL.definePhrases(...) (the same code
that picks what to say), so this opens every page in headless Chromium and asks it.
Needs Playwright:  pip install playwright && playwright install chromium
Then:              python tools/collect_phrases.py && python tools/build_audio.py
"""
import functools, glob, http.server, json, os, sys, threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "audio", "phrases.json")

pages = ["index.html"] + sorted(os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, "*", "index.html")))

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Handler = functools.partial(Quiet, directory=ROOT)
httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{httpd.server_address[1]}/"

phrases = {"en": {}, "zh": {}}
problems = []
with sync_playwright() as p:
    exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
    browser = p.chromium.launch(executable_path=exe, headless=True)
    ctx = browser.new_context(service_workers="block")
    page = ctx.new_page()
    for rel in pages:
        page.goto(base + rel.replace("index.html", ""), wait_until="load")
        found = page.evaluate("() => (window.LL && LL.allPhrases) ? LL.allPhrases() : []")
        print(f"{rel}: {len(found)} phrases")
        for ph in found:
            key, lang, text = ph["key"], ph["lang"], ph["text"].strip()
            if lang not in phrases or not key.replace("-", "").isalnum():
                problems.append(f"bad phrase {ph} on {rel}")
                continue
            old = phrases[lang].get(key)
            if old is not None and old != text:
                problems.append(f"key {lang}/{key} has two texts: {old!r} vs {text!r}")
            phrases[lang][key] = text
    browser.close()
httpd.shutdown()

if problems:
    print("\n".join(problems)); sys.exit(1)
data = {lang: dict(sorted(d.items())) for lang, d in phrases.items()}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
    f.write("\n")
print(f"wrote {os.path.relpath(OUT, ROOT)}: {len(data['en'])} English + {len(data['zh'])} Mandarin phrases")
