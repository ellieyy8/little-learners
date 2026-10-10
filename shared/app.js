/* Little Learners: shared helpers (language, speech clips, service worker). No network use. */
(function () {
  var LL = (window.LL = {});
  // Path from this page back to the site root ("./" on the menu, "../" inside a game).
  LL.root = document.documentElement.getAttribute("data-root") || "./";

  LL.getLang = function () {
    try { return localStorage.getItem("ll-lang") === "zh" ? "zh" : "en"; } catch (e) { return "en"; }
  };
  LL.setLang = function (l) {
    try { localStorage.setItem("ll-lang", l); } catch (e) {}
  };

  LL.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  // ---- Speech --------------------------------------------------------------
  // Every phrase has a stable key. LL.say(key, text, lang) plays the bundled clip
  // audio/<lang>/<key>.mp3 (pre-recorded neural voice, precached for offline use).
  // If the clip is missing or fails to load, it falls back to the device voice
  // (Web Speech API) reading `text`. Clips are made by tools/build_audio.py from
  // audio/phrases.json, which tools/collect_phrases.py builds from LL.definePhrases().
  LL.spoke = false;   // becomes true once any clip or utterance actually starts
  LL.audioLog = [];   // [{key, lang, via}] for tests/debugging
  var phraseFns = [];
  // Each game registers a function returning every phrase it can say:
  // [{ key, lang: "en"|"zh", text }]
  LL.definePhrases = function (fn) { phraseFns.push(fn); };
  // Shared phrases (not spoken by any game yet; ready for future use).
  LL.definePhrases(function () {
    return [{ key: "great-job", lang: "en", text: "Great job!" }, { key: "great-job", lang: "zh", text: "好棒！" }];
  });
  LL.allPhrases = function () {
    var out = [];
    phraseFns.forEach(function (fn) { out = out.concat(fn()); });
    return out;
  };

  function pickVoice(lang) {
    if (!window.speechSynthesis) return null;
    var voices = window.speechSynthesis.getVoices() || [];
    var norm = function (v) { return (v.lang || "").replace("_", "-").toLowerCase(); };
    if (lang === "zh") {
      return voices.find(function (v) { return norm(v) === "zh-tw"; }) ||
             voices.find(function (v) { return norm(v).indexOf("zh-hant") === 0 && norm(v) !== "zh-hant-hk"; }) ||
             voices.find(function (v) { return norm(v) === "zh-cn" || norm(v) === "zh"; }) || null;
    }
    return voices.find(function (v) { return norm(v) === "en-us"; }) ||
           voices.find(function (v) { return norm(v).indexOf("en") === 0; }) || null;
  }
  if (window.speechSynthesis && "onvoiceschanged" in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {};
  }
  function ttsSpeak(text, lang, done) {
    if (!window.speechSynthesis || !text) { done(); return; }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "zh" ? "zh-TW" : "en-US";
    var v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = 0.9;
    u.onstart = function () { LL.spoke = true; };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  }

  // One shared <audio> element. iOS only lets a page start audio from a user tap, but
  // once an element has played inside a tap it may be played again later from code
  // (e.g. the next round's prompt after a timer). So the first tap "unlocks" this element.
  var player = typeof Audio !== "undefined" ? new Audio() : null;
  if (player) { player.preload = "auto"; player.setAttribute("playsinline", ""); }
  LL.player = player;
  var unlocked = false;
  var pending = null;   // a clip that was blocked because there had been no tap yet
  var current = null;   // { id, done } of the clip/utterance now playing
  var seq = 0;

  function stopCurrent() {
    var c = current; current = null;
    if (player) { try { player.pause(); } catch (e) {} }
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    if (c) c.done();
  }

  LL.say = function (key, text, lang, onDone) {
    stopCurrent();
    pending = null;
    var called = false;
    var id = ++seq;
    var done = function () { if (!called) { called = true; if (current && current.id === id) current = null; if (onDone) onDone(); } };
    current = { id: id, done: done };
    var fellBack = false;
    var fallback = function (why) {
      if (fellBack || called || !current || current.id !== id) return;
      fellBack = true;
      LL.audioLog.push({ key: key, lang: lang, via: "tts", why: why });
      ttsSpeak(text, lang, done);
    };
    if (!player || !key) { fallback("no-audio"); return; }
    LL.audioLog.push({ key: key, lang: lang, via: "mp3" });
    player.onended = function () { if (current && current.id === id) done(); };
    var path = "audio/" + lang + "/" + key + ".mp3";
    player.onerror = function () {
      if ((player.src || "").slice(-path.length) === path) fallback("load-error");
    };
    player.src = LL.root + path;
    var p;
    try { p = player.play(); } catch (e) { p = Promise.reject(e); }
    if (p && p.then) {
      p.then(function () { unlocked = true; LL.spoke = true; }, function (err) {
        if (!current || current.id !== id) return;          // replaced by a newer clip
        if (err && err.name === "NotAllowedError") {
          // No tap yet (iOS / autoplay rules): play it on the first tap instead.
          LL.audioLog.push({ key: key, lang: lang, via: "blocked" });
          pending = { key: key, text: text, lang: lang, onDone: onDone };
          current = null;
        } else if (err && err.name === "AbortError") {
          // interrupted by a newer load; nothing to do
        } else {
          fallback((err && err.name) || "play-error");
        }
      });
    }
  };
  // Old name kept for safety: speech without a clip key goes straight to the device voice.
  LL.speak = function (text, lang, onDone) { LL.say(null, text, lang, onDone); };

  // First tap anywhere: unlock the audio element inside the gesture, then replay a
  // blocked clip (unless the tap itself already started a new one).
  function unlock() {
    if (!player || unlocked) return;
    var waiting = pending;
    if (waiting) {
      pending = null;
      LL.say(waiting.key, waiting.text, waiting.lang, waiting.onDone);
      return;
    }
    if (current) return;  // something is already playing/starting inside this tap
    player.src = LL.root + "audio/silence.mp3";
    var p = player.play();
    if (p && p.then) p.then(function () { unlocked = true; }, function () {});
  }
  ["touchend", "click", "keydown"].forEach(function (ev) {
    document.addEventListener(ev, function () {
      // Let the tap's own handlers run first (a card tap starts praise), then unlock/replay.
      if (!unlocked) unlock();
    }, false);
  });

  // Show the "yay" for at least minMs, let the spoken praise finish, then call next (max 7 s).
  LL.afterPraise = function (key, text, lang, next, minMs) {
    var t0 = Date.now(), fired = false;
    var go = function () {
      if (fired) return; fired = true; next();
    };
    LL.say(key, text, lang, function () {
      setTimeout(go, Math.max(250, (minMs || 1300) - (Date.now() - t0)));
    });
    setTimeout(go, 7000);
  };
  // Kept for compatibility: the audio layer now replays a blocked prompt on the first tap.
  LL.onFirstTouch = function () {};

  // ---- Language toggle (EN / 中文), remembered across games ----
  LL.bindLangToggle = function (onChange) {
    var en = document.getElementById("langEN");
    var zh = document.getElementById("langZH");
    function paint(l) {
      en.classList.toggle("active", l === "en");
      zh.classList.toggle("active", l === "zh");
      document.documentElement.lang = l === "zh" ? "zh-Hant-TW" : "en";
    }
    paint(LL.getLang());
    en.addEventListener("click", function () { LL.setLang("en"); paint("en"); onChange("en"); });
    zh.addEventListener("click", function () { LL.setLang("zh"); paint("zh"); onChange("zh"); });
  };

  // ---- Offline support ----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(LL.root + "sw.js").catch(function (err) {
        console.warn("Service worker registration failed:", err);
      });
    });
  }
})();
