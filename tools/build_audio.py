#!/usr/bin/env python3
"""Generate the spoken clips audio/<lang>/<key>.mp3 from audio/phrases.json.

Voices: Microsoft Edge neural TTS via edge-tts (needs internet while building; the app
itself plays the bundled MP3s offline).
    en -> en-US-JennyNeural, zh -> zh-TW-HsiaoChenNeural, rate -10% (a bit slow for a toddler)

    pip install edge-tts            # e.g. in /workspace/.venv-tts
    python tools/collect_phrases.py # (needs Playwright) refresh audio/phrases.json from the games
    python tools/build_audio.py     # make missing/changed clips, delete unused ones
    python tools/build_sw.py        # precache the new clips

Only clips whose text/voice/rate changed are regenerated (tracked in audio/build-lock.json).
Use --force to redo everything. Output is edge-tts' default 24 kHz mono 48 kbps MP3.
"""
import asyncio, hashlib, json, os, shutil, subprocess, sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "audio")
VOICES = {"en": "en-US-JennyNeural", "zh": "zh-TW-HsiaoChenNeural"}
RATE = "-10%"
CONCURRENCY = 6
FORCE = "--force" in sys.argv


def tts_text(text, lang):
    """End every phrase with a full stop so the voice finishes with a natural fall."""
    t = text.strip()
    if t and t[-1] not in ".!?。！？":
        t += "。" if lang == "zh" else "."
    return t


def sig(lang, text):
    return hashlib.sha256(f"{VOICES[lang]}|{RATE}|{tts_text(text, lang)}".encode()).hexdigest()[:16]


async def make(sem, lang, key, text, out):
    async with sem:
        for attempt in range(4):
            try:
                tmp = out + ".part"
                await edge_tts.Communicate(tts_text(text, lang), VOICES[lang], rate=RATE).save(tmp)
                if os.path.getsize(tmp) < 1000:
                    raise RuntimeError("clip too small")
                os.replace(tmp, out)
                print(f"  made {lang}/{key}.mp3  {tts_text(text, lang)}")
                return True
            except Exception as e:  # network hiccups: retry
                print(f"  retry {lang}/{key}: {e}")
                await asyncio.sleep(1 + attempt * 2)
        return False


def duration(path):
    if not shutil.which("ffprobe"):
        return None
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    return float(out) if out else None


async def main():
    phrases = json.load(open(os.path.join(AUDIO, "phrases.json"), encoding="utf-8"))
    lock_path = os.path.join(AUDIO, "build-lock.json")
    lock = json.load(open(lock_path)) if os.path.exists(lock_path) and not FORCE else {}
    sem = asyncio.Semaphore(CONCURRENCY)
    jobs, new_lock = [], {}
    for lang, items in phrases.items():
        os.makedirs(os.path.join(AUDIO, lang), exist_ok=True)
        for key, text in items.items():
            out = os.path.join(AUDIO, lang, key + ".mp3")
            s = sig(lang, text)
            new_lock[f"{lang}/{key}"] = s
            if lock.get(f"{lang}/{key}") != s or not os.path.exists(out):
                jobs.append((lang, key, text, out))
    print(f"{sum(len(v) for v in phrases.values())} phrases; {len(jobs)} clip(s) to generate")
    results = await asyncio.gather(*(make(sem, *j) for j in jobs))
    failed = [f"{j[0]}/{j[1]}" for j, ok in zip(jobs, results) if not ok]
    for f in failed:
        new_lock.pop(f, None)
    # remove clips no longer used
    for lang in os.listdir(AUDIO):
        d = os.path.join(AUDIO, lang)
        if not os.path.isdir(d):
            continue
        for fn in os.listdir(d):
            if fn.endswith(".mp3") and fn[:-4] not in phrases.get(lang, {}):
                os.remove(os.path.join(d, fn)); print(f"  removed unused {lang}/{fn}")
    # a tiny silent clip used to unlock audio on iOS at the first tap
    silence = os.path.join(AUDIO, "silence.mp3")
    if not os.path.exists(silence) and shutil.which("ffmpeg"):
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.15",
                        "-b:a", "32k", "-y", silence], check=True)
    json.dump(dict(sorted(new_lock.items())), open(lock_path, "w"), indent=1)
    # sanity report
    total, n, bad = 0, 0, []
    for lang, items in phrases.items():
        for key in items:
            p = os.path.join(AUDIO, lang, key + ".mp3")
            if not os.path.exists(p):
                bad.append(f"missing {lang}/{key}"); continue
            n += 1; total += os.path.getsize(p)
            d = duration(p)
            if d is not None and not (0.4 <= d <= 8):
                bad.append(f"odd duration {lang}/{key}: {d:.2f}s")
    print(f"{n} clips, {total/1024/1024:.2f} MB")
    if failed or bad:
        print("PROBLEMS:", failed + bad); sys.exit(1)

asyncio.run(main())
