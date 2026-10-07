/* Little Learners: shared helpers (language, speech, service worker). No network use. */
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

  // ---- Speech (Web Speech API; uses on-device voices, works offline on iPad) ----
  LL.spoke = false; // becomes true once any utterance actually starts
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
  // onDone (optional) is called once when the utterance ends (or right away if speech is unavailable).
  LL.speak = function (text, lang, onDone) {
    var called = false;
    var done = function () { if (!called) { called = true; if (onDone) onDone(); } };
    if (!window.speechSynthesis || !text) { done(); return; }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "zh" ? "zh-TW" : "en-US";
    var v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = 0.9;
    u.onstart = function () { LL.spoke = true; };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  };
  // iPad Safari blocks speech that is not started from a tap. If the automatic
  // first prompt was blocked, say it on the first tap that isn't a button.
  // Show the "yay" for at least minMs, let the spoken praise finish, then call next (max 5 s).
  LL.afterPraise = function (text, lang, next, minMs) {
    var t0 = Date.now(), fired = false;
    var go = function () {
      if (fired) return; fired = true; next();
    };
    LL.speak(text, lang, function () {
      setTimeout(go, Math.max(250, (minMs || 1300) - (Date.now() - t0)));
    });
    setTimeout(go, 5000);
  };
  LL.onFirstTouch = function (fn) {
    document.addEventListener("pointerdown", function (e) {
      if (LL.spoke) return;
      if (e.target.closest && e.target.closest("button, a")) return;
      fn();
    }, { once: true, capture: true });
  };

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
