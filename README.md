# Little Learners

Small, offline-capable toddler learning games (English + 繁體中文), as a static PWA.

- `index.html`: game menu
- `colors/`: Colors 顏色 tap-to-match (4 choices)
- `shapes/`: Shapes 形狀 tap-to-match (3 choices)
- `abc/`: ABC 英文字母: letters A B M S P D with a picture word (apple, ball, moon, sun, pig, dog)
- `bopomofo/`: ㄅㄆㄇ 注音: ㄅ ㄆ ㄇ ㄈ ㄉ ㄊ with a picture word (杯子, 葡萄, 貓, 飛機, 蛋, 兔子)
- `shared/`: shared CSS and JS (language toggle, speech, service-worker registration;
  `letters.js`/`letters.css` are the engine for the ABC and ㄅㄆㄇ games)
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

## ABC and ㄅㄆㄇ games

One letter/symbol per round. A round starts with 2 big cards (symbol + photo). After 4
rounds in a row answered right on the first tap it shows 3 cards; after 2 wrong taps at 3
cards (with no clean round in between) it goes back to 2. A session is 5 rounds, then an
"All done!" screen with Play again / Home. The card count carries over to "Play again" and
resets when the page is reloaded. (`ROUNDS`, `STEP_UP`, `STEP_DOWN` at the top of
`shared/letters.js`.)

The EN/中文 toggle changes only the on-screen text. ABC speech is always English (en-US);
ㄅㄆㄇ speech is always Taiwan Mandarin (zh-TW).

### Please test the speech on the iPad

Text-to-speech voices are not good at saying a lone letter sound or a lone 注音 symbol, so
both games start with the safe setting. Test on the iPad (sound on, not in silent mode) and
change the setting if needed.

**ABC: letter sounds (`abc/index.html`, `USE_LETTER_SOUNDS`)**

- Default `false`: says the letter name, then the word: "B ... ball".
- `true`: says the letter, its sound twice, then the word: "B ... buh, buh, ball".
  The sound is spelled for the voice by each letter's `phoneme` text (`aah`, `buh`, `mmm`,
  `sss`, `puh`, `duh`); change any of these if the iPad says it badly. Give a single letter
  `usePhoneme: true` or `false` to override the global setting for just that letter.
- Quick test without editing anything: open `abc/?sounds=1` (or `abc/?sounds=0`). Tap
  🔊 Hear again to listen. If it sounds right, set `USE_LETTER_SOUNDS = true` in the file.
- Also listen for "A ... apple": some voices say a lone "A" as "uh". If so, change that
  letter's `name` (for example to `"Ay"`).

**ㄅㄆㄇ: speaking the symbol (`bopomofo/index.html`, `SPEAK_SYMBOL`)**

- Default `true`: says the symbol, then the word: "ㄅ，杯子".
- `false`: says only the word, from each symbol's `fallback` (e.g. "杯子"). It never
  replaces the symbol with a syllable such as 玻.
- Check on the iPad that the zh-TW voice reads each lone symbol as its 注音 sound. Quick
  test: open `bopomofo/?symbol=1`, then `bopomofo/?symbol=0`, and compare.
  - If none of the symbols come out right, set `SPEAK_SYMBOL = false`.
  - If only some are wrong, give those symbols `speakSymbol: false` (e.g. on ㄈ).

After editing either file, run `python3 tools/build_sw.py` so the installed app picks up the
change.

Photo credits: see `CREDITS.md`.
