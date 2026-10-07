# Little Learners

Small, offline-capable toddler learning games (English + 繁體中文), as a static PWA.

- `index.html`: game menu
- `colors/`: Colors 顏色 tap-to-match (4 choices)
- `shapes/`: Shapes 形狀 tap-to-match (3 choices)
- `shared/`: shared CSS and JS (language toggle, speech, service-worker registration)
- `sw.js`: service worker (generated). It precaches every app file so the site works offline after one visit.

No external requests at runtime: no CDNs, web fonts or analytics. Speech uses the
device's built-in voices (Web Speech API, `en-US` / `zh-TW`).

## Run locally

    python3 -m http.server 8000
    # open http://localhost:8000/

## After adding or changing any file

    python3 tools/build_sw.py     # refresh the precache list and bump the cache version

`tools/make_icons.py` redraws the icons. All paths are relative, so the site also
works from a GitHub Pages project URL like `https://<user>.github.io/<repo>/`.

Photo credits: see `CREDITS.md`.
