/* Little Learners: shared engine for the letter games (ABC, ㄅㄆㄇ).
 *
 * One target per round. Starts with 2 cards; after STEP_UP correct-first-try rounds in a row
 * it shows 3 cards; after STEP_DOWN misses (without a clean round in between) it goes back to 2.
 * A session is ROUNDS rounds, then an "All done!" screen (Play again / Home).
 * The card count is kept for "Play again" and resets when the page is reloaded.
 *
 * cfg = {
 *   items: [{ id, big, img, alt, word }],
 *   speechLang: "en" | "zh",            // speech language, fixed for the game
 *   brand: { en, zh },                   // header title per UI language
 *   ask(item, uiLang) -> { ask, sub },   // prompt text (UI chrome)
 *   say(item) -> string,                 // spoken target, e.g. "B ... ball"
 *   praise(item) -> string,              // spoken on a correct tap
 *   line(item) -> string,                // text under the celebration
 *   doneSay: string,                     // spoken on the All done screen
 *   symClass: string,                    // extra class for the big symbol
 * }
 */
(function () {
  var ROUNDS = 5, STEP_UP = 4, STEP_DOWN = 2;
  var STAR = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50.0,6.0 61.2,37.6 94.7,38.5 68.1,58.9 77.6,91.0 50.0,72.0 22.4,91.0 31.9,58.9 5.3,38.5 38.8,37.6" fill="FILL" stroke="#e0a800" stroke-width="STROKE" stroke-linejoin="round"/></svg>';
  function star(on) { return STAR.replace("FILL", on ? "#facc15" : "#efe9dc").replace("STROKE", on ? "4" : "0"); }

  LL.letterGame = function (cfg) {
    var $ = function (id) { return document.getElementById(id); };
    var grid = $("grid"), celebrate = $("celebrate"), done = $("done");
    var lang = LL.getLang();
    var st = { n: 2, streak: 0, misses: 0, round: 0, inSession: 0, target: null, missed: false, locked: false, bag: [] };
    window.LLGame = { state: st, cfg: cfg, ROUNDS: ROUNDS, STEP_UP: STEP_UP, STEP_DOWN: STEP_DOWN };

    function T(en, zh) { return lang === "en" ? en : zh; }
    function sayTarget() { if (st.target) LL.speak(cfg.say(st.target), cfg.speechLang); }

    function paint() {
      $("homeLabel").textContent = T("Home", "首頁");
      $("brand").textContent = cfg.brand[lang];
      $("speak").textContent = T("🔊 Hear again", "🔊 再聽一次");
      $("yay").textContent = T("Great job!", "好棒！");
      $("doneTitle").textContent = T("All done!", "全部完成！");
      $("doneSub").textContent = T("You found them all!", "你都找到了！");
      $("againLabel").textContent = T("Play again", "再玩一次");
      $("doneHomeLabel").textContent = T("Home", "首頁");
      $("foot").textContent = cfg.foot[lang];
      if (st.target) {
        var a = cfg.ask(st.target, lang);
        $("ask").textContent = a.ask; $("sub").textContent = a.sub;
      }
      var p = "";
      for (var i = 0; i < ROUNDS; i++) p += "<span>" + star(i < st.inSession - (st.locked ? 0 : 1)) + "</span>";
      $("progress").innerHTML = p;
      $("progress").setAttribute("aria-label", T("Round ", "第 ") + st.inSession + " / " + ROUNDS);
    }

    function newSession() {
      st.inSession = 0;
      // Each session: a fresh shuffled order, no target twice, and not the same as the last one played.
      var last = st.target;
      st.bag = LL.shuffle(cfg.items);
      if (last && st.bag[0].id === last.id) st.bag.push(st.bag.shift());
      done.classList.remove("show");
      newRound();
    }

    function newRound() {
      st.round++; st.inSession++;
      st.locked = false; st.missed = false;
      celebrate.classList.remove("show");
      st.target = st.bag[(st.inSession - 1) % st.bag.length];
      var others = LL.shuffle(cfg.items.filter(function (x) { return x.id !== st.target.id; })).slice(0, st.n - 1);
      var choices = LL.shuffle([st.target].concat(others));
      grid.setAttribute("data-n", String(st.n));
      grid.setAttribute("data-target", st.target.id);
      grid.innerHTML = "";
      choices.forEach(function (it) {
        var b = document.createElement("button");
        b.className = "card"; b.type = "button";
        b.setAttribute("data-id", it.id);
        b.setAttribute("aria-label", it.big + " " + it.word);
        b.innerHTML =
          '<div class="sym ' + (cfg.symClass || "") + (it.big.length === 1 ? " one" : "") + '">' + it.big + "</div>" +
          '<div class="photo"><img src="' + it.img + '" alt="' + it.alt + '" draggable="false" /></div>' +
          '<div class="word">' + it.word + "</div>";
        b.addEventListener("click", function () { onPick(it, b); });
        grid.appendChild(b);
      });
      paint();
      setTimeout(sayTarget, 280);
    }

    function onPick(it, el) {
      if (st.locked) return;
      if (it.id === st.target.id) {
        st.locked = true;
        if (!st.missed) {
          st.streak++; st.misses = 0;
          if (st.n === 2 && st.streak >= STEP_UP) { st.n = 3; st.streak = 0; }
        }
        el.classList.add("correct");
        $("yayPair").innerHTML = '<span class="bigsym ' + (cfg.symClass || "") + '">' + st.target.big + '</span><img src="' + st.target.img + '" alt="" />';
        $("yaySub").textContent = cfg.line(st.target);
        celebrate.classList.add("show");
        paint();
        var r = st.round;
        LL.afterPraise(cfg.praise(st.target), cfg.speechLang, function () {
          if (r !== st.round) return;
          if (st.inSession >= ROUNDS) showDone(); else newRound();
        }, 1600);
      } else {
        st.missed = true; st.streak = 0;
        if (st.n === 3) {
          st.misses++;
          if (st.misses >= STEP_DOWN) { st.n = 2; st.misses = 0; } // takes effect next round
        }
        el.classList.remove("wrong"); void el.offsetWidth; el.classList.add("wrong");
        setTimeout(function () { el.classList.remove("wrong"); }, 350);
      }
    }

    function showDone() {
      st.round++; // cancels any pending round change
      celebrate.classList.remove("show");
      var s = "";
      for (var i = 0; i < ROUNDS; i++) s += '<span style="animation-delay:' + (i * 0.12) + 's">' + star(true) + "</span>";
      $("doneStars").innerHTML = s;
      done.classList.add("show");
      LL.speak(cfg.doneSay, cfg.speechLang);
    }

    $("again").addEventListener("click", newSession);
    $("speak").addEventListener("click", sayTarget);
    LL.bindLangToggle(function (l) { lang = l; paint(); });
    LL.onFirstTouch(sayTarget);
    newSession();
  };
})();
