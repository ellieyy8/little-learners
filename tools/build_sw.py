#!/usr/bin/env python3
"""Regenerate sw.js with the full precache list and a content-hash version.

Run from anywhere after adding/changing files:  python3 tools/build_sw.py
Every app file (html, css, js, images, icons, audio clips, manifest) is precached so the
site works fully offline after one online visit.
"""
import hashlib, os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCLUDE_EXT = {".html", ".css", ".js", ".webmanifest", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".mp3"}
SKIP_DIRS = {".git", "tools", "node_modules"}
SKIP_FILES = {"sw.js"}

files = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not d.startswith("."))
    for fn in sorted(filenames):
        if fn in SKIP_FILES or os.path.splitext(fn)[1].lower() not in INCLUDE_EXT:
            continue
        files.append(os.path.relpath(os.path.join(dirpath, fn), ROOT).replace(os.sep, "/"))

h = hashlib.sha256()
for f in files:
    h.update(f.encode()); h.update(open(os.path.join(ROOT, f), "rb").read())
h.update(open(os.path.join(ROOT, "tools", "sw.template.js"), "rb").read())  # SW logic changes bump it too
version = h.hexdigest()[:10]

urls = []
for f in files:
    if f == "index.html":
        urls.append("./")
    elif f.endswith("/index.html"):
        urls.append(f[: -len("index.html")])   # e.g. "colors/"
    urls.append(f)

template = open(os.path.join(ROOT, "tools", "sw.template.js"), encoding="utf-8").read()
out = template.replace("__VERSION__", version).replace("__PRECACHE__", json.dumps(urls, indent=2))
open(os.path.join(ROOT, "sw.js"), "w", encoding="utf-8").write(out)
print(f"sw.js written: version {version}, {len(urls)} URLs ({len(files)} files)")
