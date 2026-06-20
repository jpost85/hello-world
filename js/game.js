/*
 * Game controller — screens, state and rendering for the
 * All-Time World Cup Simulator.
 *
 * Flow:  Start → Mode select → (Decade/Nation pick) → Draft → Team → Gauntlet → Win/Lose
 */
(function () {
  var app = document.getElementById("app");

  var state = {
    mode: { type: "all-time", value: null }, // see js/modes.js
    slots: window.SLOTS,                      // active slot template
    squad: {},                               // slotKey -> player object
    slotIndex: 0,                            // which draft slot we're on
    round: 0,                               // current gauntlet round
    bracket: null,                          // this run's drawn opponents
    history: [],                           // per-match results for sharing
  };

  // ---------------------------------------------------------------- helpers
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function buttonEl(text, cls, onclick) {
    var b = el('<button class="btn ' + cls + '">' + text + "</button>");
    b.onclick = onclick;
    return b;
  }

  function pdCard(player, opts) {
    opts = opts || {};
    return (
      '<div class="player-card' + (opts.selected ? " selected" : "") + '"' +
      (opts.pickKey ? ' data-pick="' + opts.pickKey + '" data-id="' + player.id + '"' : "") +
      ' role="button" tabindex="0">' +
        '<div class="pc-flag">' + player.flag + "</div>" +
        '<div class="pc-body">' +
          '<div class="pc-name">' + player.name + "</div>" +
          '<div class="pc-meta">' + player.club + " · " + player.decade + "</div>" +
        "</div>" +
        '<div class="pc-ovr">' + player.ovr + "</div>" +
      "</div>"
    );
  }

  function squadComplete() {
    return state.slots.every(function (s) { return state.squad[s.key]; });
  }

  // ---------------------------------------------------------------- difficulty scaling
  // The gauntlet is calibrated against an all-time XI. So that constrained
  // modes (a single nation/region/decade) are winnable rather than hopeless,
  // opponents are scaled down toward the *ceiling* of the chosen pool — the
  // strongest XI it could possibly field. Drafting closer to that ceiling
  // still improves your odds; all-time mode is left unscaled.
  function bestRatingForMode(mode) {
    var slots = window.Modes.slotsFor(mode);
    var sq = {};
    slots.forEach(function (slot) {
      var pool = window.Modes.poolFor(mode, slot, sq)
        .map(function (id) { return window.PLAYER_BY_ID[id]; })
        .sort(function (a, b) { return b.pwr - a.pwr; });
      if (pool[0]) sq[slot.key] = pool[0];
    });
    return window.Engine.rateSquad(sq, slots);
  }
  function avg3(r) { return (r.att + r.mid + r.def) / 3; }
  var REF_CEILING = avg3(bestRatingForMode({ type: "all-time", value: null }));
  function scaleForMode(mode) {
    var c = avg3(bestRatingForMode(mode));
    return Math.max(0.8, Math.min(1, c / REF_CEILING));
  }

  // ---------------------------------------------------------------- bracket draw
  // Each run draws a fresh cup: an easier "group stage" then a "knockout"
  // stage of all-time greats. Group teams are ordered easiest-first for a
  // clean ramp; knockout teams are shuffled but the strongest drawn side is
  // saved for the final, so every run climaxes against a true heavyweight.
  function oppStrength(o) { return o.att + o.mid + o.def; }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function drawN(pool, n) {
    return shuffle(pool).slice(0, Math.min(n, pool.length));
  }

  function buildBracket() {
    var groupPool = window.OPPONENTS.filter(function (o) { return o.tier === "group"; });
    var koPool = window.OPPONENTS.filter(function (o) { return o.tier === "knockout"; });

    var group = drawN(groupPool, window.GAUNTLET.group)
      .sort(function (a, b) { return oppStrength(a) - oppStrength(b); });

    var ko = drawN(koPool, window.GAUNTLET.knockout);
    // Pull the strongest drawn side out and make it the final.
    var maxIdx = 0;
    ko.forEach(function (o, i) { if (oppStrength(o) > oppStrength(ko[maxIdx])) maxIdx = i; });
    var finalBoss = ko.splice(maxIdx, 1)[0];
    ko.push(finalBoss);

    return group.concat(ko);
  }

  function stageOf(round) {
    return round < window.GAUNTLET.group ? "Group Stage" : "Knockout";
  }

  // ---------------------------------------------------------------- start
  function renderStart() {
    state.mode = { type: "all-time", value: null };
    state.slots = window.SLOTS;
    state.squad = {};
    state.slotIndex = 0;
    state.round = 0;
    state.bracket = null;
    state.history = [];

    app.innerHTML = "";
    app.appendChild(el(
      '<section class="screen start">' +
        '<div class="trophy">🏆</div>' +
        "<h1>All-Time World Cup</h1>" +
        '<p class="tagline">Draft a team of legends. Run the gauntlet of the greatest sides ever to play. Lose once and it\'s over.</p>' +
        '<div class="how">' +
          '<div class="how-step"><span class="num">1</span> Choose a squad style, then pick a legend for each position.</div>' +
          '<div class="how-step"><span class="num">2</span> Face ' + window.OPPONENTS.length + " all-time great teams, one by one.</div>" +
          '<div class="how-step"><span class="num">3</span> Win every match to be crowned champion of history.</div>' +
        "</div>" +
        '<button class="btn primary big" id="startBtn">Start the Gauntlet</button>' +
      "</section>"
    ));
    document.getElementById("startBtn").onclick = renderModeSelect;
  }

  // ---------------------------------------------------------------- mode select
  function renderModeSelect() {
    app.innerHTML = "";
    var section = el(
      '<section class="screen modes">' +
        "<h2>Choose your squad</h2>" +
        '<p class="slot-blurb">How do you want to build your team?</p>' +
        '<div class="mode-grid">' +
          modeCard("all-time", "🌍", "All-Time", "Themed tiers — pit the very best of every era against each other.") +
          modeCard("decade", "📅", "By Decade", "Field the greatest XI of a single decade.") +
          modeCard("nation", "🏳️", "By Nation", "Build an all-time team from one country.") +
          modeCard("confed", "🌐", "By Region", "An all-time XI from a whole confederation.") +
        "</div>" +
        '<div class="team-nav"><button class="btn ghost" id="backStart">← Back</button></div>' +
      "</section>"
    );
    app.appendChild(section);

    section.querySelector('[data-mode="all-time"]').onclick = function () {
      state.mode = { type: "all-time", value: null };
      state.slots = window.SLOTS;
      state.squad = {};
      state.slotIndex = 0;
      renderDraft();
    };
    section.querySelector('[data-mode="decade"]').onclick = function () { renderFilterSelect("decade"); };
    section.querySelector('[data-mode="nation"]').onclick = function () { renderFilterSelect("nation"); };
    section.querySelector('[data-mode="confed"]').onclick = function () { renderFilterSelect("confed"); };
    document.getElementById("backStart").onclick = renderStart;
  }

  function modeCard(key, icon, title, desc) {
    return (
      '<div class="mode-card" data-mode="' + key + '" role="button" tabindex="0">' +
        '<div class="mode-icon">' + icon + "</div>" +
        '<div class="mode-title">' + title + "</div>" +
        '<div class="mode-desc">' + desc + "</div>" +
      "</div>"
    );
  }

  // ---------------------------------------------------------------- decade / nation / region pick
  function renderFilterSelect(type) {
    var options = type === "decade" ? window.Modes.availableDecades()
                : type === "nation" ? window.Modes.availableNations()
                : window.Modes.availableConfederations();
    var heading = type === "decade" ? "Pick a decade"
                : type === "nation" ? "Pick a nation"
                : "Pick a region";
    app.innerHTML = "";

    var cards = options.map(function (o) {
      var face = type === "decade" ? '<div class="filter-decade">' + o.label + "</div>"
                                   : '<div class="filter-flag">' + o.flag + "</div>";
      var name = type === "decade" ? "" : '<div class="filter-name">' + o.label + "</div>";
      return (
        '<div class="filter-card" data-value="' + o.value + '" role="button" tabindex="0">' +
          face + name +
          '<div class="filter-count">' + o.count + " legends</div>" +
        "</div>"
      );
    }).join("");

    var section = el(
      '<section class="screen filter">' +
        "<h2>" + heading + "</h2>" +
        '<p class="slot-blurb">Only teams with a full squad of legends are shown.</p>' +
        '<div class="filter-grid">' + cards + "</div>" +
        '<div class="team-nav"><button class="btn ghost" id="backModes">← Back</button></div>' +
      "</section>"
    );
    app.appendChild(section);

    section.querySelectorAll(".filter-card").forEach(function (node) {
      node.onclick = function () {
        state.mode = { type: type, value: node.getAttribute("data-value") };
        state.slots = window.FORMATION;
        state.squad = {};
        state.slotIndex = 0;
        renderDraft();
      };
    });
    document.getElementById("backModes").onclick = renderModeSelect;
  }

  // ---------------------------------------------------------------- draft
  function renderDraft() {
    var slot = state.slots[state.slotIndex];
    app.innerHTML = "";

    var cards = window.Modes.poolFor(state.mode, slot, state.squad)
      .map(function (id) { return window.PLAYER_BY_ID[id]; })
      .filter(Boolean)
      .map(function (p) {
        return pdCard(p, {
          pickKey: slot.key,
          selected: state.squad[slot.key] && state.squad[slot.key].id === p.id,
        });
      })
      .join("");

    var context = state.mode.type === "all-time" ? "" :
      '<div class="draft-context">' + window.Modes.label(state.mode) + "</div>";

    var section = el(
      '<section class="screen draft">' +
        '<div class="draft-head">' +
          context +
          '<div class="draft-progress">Pick ' + (state.slotIndex + 1) + " of " + state.slots.length + "</div>" +
          "<h2>" + slot.label + "</h2>" +
          '<p class="slot-blurb">' + slot.blurb + "</p>" +
        "</div>" +
        '<div class="pick-grid">' + cards + "</div>" +
        '<div class="draft-nav">' +
          '<button class="btn ghost" id="backBtn">← Back</button>' +
          '<div class="pitch-dots">' + dotsHTML() + "</div>" +
        "</div>" +
      "</section>"
    );
    app.appendChild(section);

    section.querySelectorAll("[data-pick]").forEach(function (node) {
      var choose = function () {
        state.squad[slot.key] = window.PLAYER_BY_ID[node.getAttribute("data-id")];
        advanceDraft();
      };
      node.addEventListener("click", choose);
      node.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); }
      });
    });
    document.getElementById("backBtn").onclick = function () {
      if (state.slotIndex > 0) { state.slotIndex--; renderDraft(); }
      else renderModeSelect();
    };
  }

  function dotsHTML() {
    return state.slots.map(function (s, i) {
      var cls = state.squad[s.key] ? "dot filled" : (i === state.slotIndex ? "dot active" : "dot");
      return '<span class="' + cls + '"></span>';
    }).join("");
  }

  function advanceDraft() {
    if (state.slotIndex < state.slots.length - 1) {
      state.slotIndex++;
      renderDraft();
    } else if (squadComplete()) {
      renderTeam();
    } else {
      state.slotIndex = state.slots.findIndex(function (s) { return !state.squad[s.key]; });
      renderDraft();
    }
  }

  // ---------------------------------------------------------------- pitch view
  // Lay the chosen XI out on a 4-3-3 pitch (GK at the bottom, attack on top).
  var LINE_Y = { FWD: 17, MID: 43, DEF: 69, GK: 89 };

  function pitchTokens() {
    var byLine = { GK: [], DEF: [], MID: [], FWD: [] };
    state.slots.forEach(function (s) { byLine[s.line].push(s); });

    var tokens = [];
    Object.keys(byLine).forEach(function (line) {
      var arr = byLine[line];
      arr.forEach(function (slot, i) {
        var p = state.squad[slot.key];
        if (!p) return;
        var x = ((i + 1) / (arr.length + 1)) * 100;
        var surname = p.name.split(" ").slice(-1)[0];
        tokens.push(
          '<div class="pitch-token" style="left:' + x.toFixed(1) + "%;top:" + LINE_Y[line] + '%" ' +
            'title="' + p.name + " — " + p.club + " (" + p.decade + ')">' +
            '<div class="token-badge">' + p.flag + '<span class="token-ovr">' + p.ovr + "</span></div>" +
            '<div class="token-name">' + surname + "</div>" +
          "</div>"
        );
      });
    });
    return tokens.join("");
  }

  function pitchHTML() {
    return (
      '<div class="pitch">' +
        '<div class="m-circle"></div>' +
        '<div class="m-halfway"></div>' +
        '<div class="m-box top"></div>' +
        '<div class="m-box bottom"></div>' +
        pitchTokens() +
      "</div>"
    );
  }

  // ---------------------------------------------------------------- sharing
  function resultSquares() {
    var total = state.bracket ? state.bracket.length : state.history.length;
    var sq = [];
    for (var i = 0; i < total; i++) {
      if (i < state.history.length) sq.push(state.history[i].result === "win" ? "🟩" : "🟥");
      else sq.push("⬜");
    }
    return sq.join("");
  }

  function buildShareText() {
    var beaten = state.history.filter(function (h) { return h.result === "win"; }).length;
    var total = state.bracket ? state.bracket.length : state.history.length;
    var champion = beaten === total;
    var lines = [
      "🏆 All-Time World Cup Simulator",
      window.Modes.label(state.mode) + " — " +
        (champion ? "CHAMPIONS! " + total + "/" + total
                  : beaten + "/" + total + " · out in round " + (beaten + 1)),
      resultSquares(),
    ];
    var last = state.history[state.history.length - 1];
    if (!champion && last) {
      lines.push("Fell to " + last.flag + " " + last.name + " " + last.year + " (" + last.home + "–" + last.away + ")");
    }
    lines.push("", window.location.href);
    return lines.join("\n");
  }

  function toast(msg) {
    var t = el('<div class="toast">' + msg + "</div>");
    document.body.appendChild(t);
    var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
    raf(function () { t.classList.add("show"); });
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { t.remove(); }, 300);
    }, 1600);
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast("Result copied!"); }
    catch (e) { toast("Copy failed — select and copy manually"); }
    ta.remove();
  }

  function shareResult() {
    var text = buildShareText();
    if (navigator.share) {
      navigator.share({ title: "All-Time World Cup Simulator", text: text }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Result copied!"); }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  // ---------------------------------------------------------------- team review
  function renderTeam() {
    var r = window.Engine.rateSquad(state.squad, state.slots);
    app.innerHTML = "";
    app.appendChild(el(
      '<section class="screen team">' +
        '<div class="draft-context">' + window.Modes.label(state.mode) + "</div>" +
        "<h2>Your Starting XI</h2>" +
        '<div class="ratings">' +
          ratingBox("Attack", r.att) +
          ratingBox("Midfield", r.mid) +
          ratingBox("Defence", r.def) +
        "</div>" +
        pitchHTML() +
        '<div class="team-nav">' +
          '<button class="btn ghost" id="redraftBtn">↺ Re-draft</button>' +
          '<button class="btn primary big" id="toGauntletBtn">Enter the Gauntlet →</button>' +
        "</div>" +
      "</section>"
    ));
    document.getElementById("redraftBtn").onclick = function () {
      state.squad = {}; state.slotIndex = 0; renderDraft();
    };
    document.getElementById("toGauntletBtn").onclick = function () {
      state.bracket = buildBracket();
      state.round = 0;
      state.history = [];
      renderGauntlet();
    };
  }

  function ratingBox(label, val) {
    return (
      '<div class="rating-box">' +
        '<div class="rb-val">' + Math.round(val) + "</div>" +
        '<div class="rb-label">' + label + "</div>" +
      "</div>"
    );
  }

  // ---------------------------------------------------------------- gauntlet
  function renderGauntlet() {
    if (!state.bracket) state.bracket = buildBracket();
    var opp = state.bracket[state.round];
    var total = state.bracket.length;
    var me = window.Engine.rateSquad(state.squad, state.slots);
    var s = scaleForMode(state.mode);
    var oppRating = { att: opp.att * s, mid: opp.mid * s, def: opp.def * s };
    var odds = window.Engine.winProbability(me, oppRating);
    var scaleNote = s < 0.99
      ? '<div class="scale-note">⚖️ Opponents tuned to your ' +
          (state.mode.type === "confed" ? "region" : state.mode.type === "nation" ? "nation" : "era") +
          " pool</div>"
      : "";

    app.innerHTML = "";
    app.appendChild(el(
      '<section class="screen gauntlet">' +
        '<div class="round-pill">' + stageOf(state.round) + " · Match " + (state.round + 1) + " / " + total + "</div>" +
        scaleNote +
        '<div class="matchup">' +
          '<div class="side me">' +
            '<div class="side-flag">⭐</div>' +
            '<div class="side-name">' + window.Modes.label(state.mode) + "</div>" +
            '<div class="side-sub">ATT ' + Math.round(me.att) + " · MID " + Math.round(me.mid) + " · DEF " + Math.round(me.def) + "</div>" +
          "</div>" +
          '<div class="vs">VS</div>' +
          '<div class="side opp">' +
            '<div class="side-flag">' + opp.flag + "</div>" +
            '<div class="side-name">' + opp.name + " " + opp.year + "</div>" +
            '<div class="side-sub">' + opp.tag + "</div>" +
          "</div>" +
        "</div>" +
        '<p class="opp-blurb">' + opp.blurb + "</p>" +
        '<div class="odds">Win probability: <strong>' + odds + "%</strong></div>" +
        '<button class="btn primary big" id="kickoffBtn">Kick Off ⚽</button>' +
        progressTrack() +
      "</section>"
    ));
    document.getElementById("kickoffBtn").onclick = function () { playMatch(me, oppRating, opp); };
  }

  function progressTrack() {
    var dots = state.bracket.map(function (o, i) {
      var cls = i < state.round ? "track-dot beat" : (i === state.round ? "track-dot now" : "track-dot");
      // Visual divider between the group stage and the knockout rounds.
      var sep = i === window.GAUNTLET.group ? '<span class="track-sep">▸</span>' : "";
      return sep + '<span class="' + cls + '" title="' + o.name + " " + o.year + " (" + o.tag + ')">' + o.flag + "</span>";
    }).join("");
    return '<div class="track">' + dots + "</div>";
  }

  // ---------------------------------------------------------------- match
  function playMatch(me, oppRating, opp) {
    var res = window.Engine.simulateMatch(me, oppRating);
    state.history[state.round] = {
      name: opp.name, year: opp.year, flag: opp.flag,
      result: res.result, home: res.home, away: res.away,
    };
    var scoreline = res.home + " – " + res.away;
    var pens = res.penalties
      ? '<div class="pens">(' + res.penalties.home + " – " + res.penalties.away + " on penalties)</div>"
      : "";

    app.innerHTML = "";
    app.appendChild(el(
      '<section class="screen result ' + (res.result === "win" ? "won" : "lost") + '">' +
        '<div class="result-tag">' + (res.result === "win" ? "VICTORY" : "DEFEAT") + "</div>" +
        '<div class="scoreboard">' +
          '<div class="sb-team">⭐ You</div>' +
          '<div class="sb-score">' + scoreline + "</div>" +
          '<div class="sb-team">' + opp.flag + " " + opp.name + "</div>" +
        "</div>" +
        pens +
        '<p class="commentary">' + commentary(res, opp) + "</p>" +
        '<div class="result-nav"></div>' +
      "</section>"
    ));

    var nav = app.querySelector(".result-nav");
    if (res.result === "win") {
      if (state.round >= state.bracket.length - 1) {
        nav.appendChild(buttonEl("🏆 Claim Your Crown", "primary big", renderWin));
      } else {
        var nextStage = stageOf(state.round + 1) !== stageOf(state.round)
          ? "Into the Knockouts →" : "Next Opponent →";
        nav.appendChild(buttonEl(nextStage, "primary big", function () {
          state.round++;
          renderGauntlet();
        }));
      }
    } else {
      app.querySelector(".result").appendChild(el('<div class="share-track">' + resultSquares() + "</div>"));
      nav.appendChild(buttonEl("📋 Share", "ghost", shareResult));
      nav.appendChild(buttonEl("Try Again", "primary big", renderStart));
    }
  }

  function commentary(res, opp) {
    var gf = res.home, ga = res.away;
    if (res.penalties) {
      return res.result === "win"
        ? "Nerves of steel from the spot! After " + gf + "–" + ga + " couldn't separate them, your legends hold their nerve to knock out " + opp.name + " " + opp.year + "."
        : "Agony from twelve yards. " + opp.name + " " + opp.year + " edge a shootout after a " + gf + "–" + ga + " deadlock.";
    }
    if (res.result === "win") {
      if (gf - ga >= 3) return "A statement performance — " + opp.name + " " + opp.year + " are swept aside in style.";
      if (gf - ga === 1) return "A nervy, hard-fought win. The greats find a way past " + opp.name + " " + opp.year + ".";
      return "Job done. Your legends see off " + opp.name + " " + opp.year + ".";
    }
    if (ga - gf >= 3) return opp.name + " " + opp.year + " were simply irresistible. The dream ends here.";
    return "So close. " + opp.name + " " + opp.year + " find the decisive goal and the gauntlet claims another challenger.";
  }

  // ---------------------------------------------------------------- win
  function renderWin() {
    app.innerHTML = "";
    app.appendChild(el(
      '<section class="screen win">' +
        '<div class="trophy big-trophy">🏆</div>' +
        "<h1>CHAMPIONS OF HISTORY</h1>" +
        '<p class="tagline">Your ' + window.Modes.label(state.mode) + " ran the gauntlet and beat every great team ever assembled. Immortal.</p>" +
        '<div class="share-track">' + resultSquares() + "</div>" +
        pitchHTML() +
        '<div class="team-nav">' +
          '<button class="btn ghost" id="shareWin">📋 Share</button>' +
          '<button class="btn primary big" id="againBtn">Play Again</button>' +
        "</div>" +
      "</section>"
    ));
    document.getElementById("shareWin").onclick = shareResult;
    document.getElementById("againBtn").onclick = renderStart;
  }

  // ---------------------------------------------------------------- boot
  renderStart();
})();
