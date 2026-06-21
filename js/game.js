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

  // Aggregate the finished (or abandoned) run into shareable stats.
  function runStats() {
    var won = state.history.filter(function (h) { return h.result === "win"; }).length;
    var total = state.bracket ? state.bracket.length : state.history.length;
    var gf = state.history.reduce(function (s, h) { return s + h.home; }, 0);
    var ga = state.history.reduce(function (s, h) { return s + h.away; }, 0);
    var best = null; // toughest side beaten, by combined rating
    state.history.forEach(function (h, i) {
      if (h.result === "win" && state.bracket[i]) {
        var o = state.bracket[i];
        var st = o.att + o.mid + o.def;
        if (!best || st > best.st) best = { o: o, st: st };
      }
    });
    return {
      won: won, total: total, gf: gf, ga: ga, best: best,
      champion: won === total && state.history.length === total,
    };
  }

  function buildShareText() {
    var s = runStats();
    var last = state.history[state.history.length - 1];
    var lines = ["🏆 All-Time World Cup", window.Modes.label(state.mode)];
    if (s.champion) {
      lines.push("👑 CHAMPIONS — won all " + s.total + "!");
    } else {
      lines.push("Out in the " + stageOf(state.history.length - 1) + " · " + s.won + "/" + s.total);
    }
    lines.push(resultSquares());
    if (!s.champion && last) {
      lines.push("Fell to " + last.flag + " " + last.name + " " + last.year + " (" + last.home + "–" + last.away + ")");
    }
    if (s.best) lines.push("Best win: beat " + s.best.o.flag + " " + s.best.o.name + " " + s.best.o.year);
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
        nav.appendChild(buttonEl("🏆 See Final Standings →", "primary big", renderSummary));
      } else {
        var nextStage = stageOf(state.round + 1) !== stageOf(state.round)
          ? "Into the Knockouts →" : "Next Opponent →";
        nav.appendChild(buttonEl(nextStage, "primary big", function () {
          state.round++;
          renderGauntlet();
        }));
      }
    } else {
      nav.appendChild(buttonEl("See Final Standings →", "primary big", renderSummary));
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

  // ---------------------------------------------------------------- final standings
  function xiNames() {
    return state.slots.map(function (s) { return state.squad[s.key]; }).filter(Boolean);
  }

  function matchRows() {
    return state.history.map(function (h, i) {
      var opp = state.bracket[i];
      var stage = i < window.GAUNTLET.group ? "G" : "K";
      var win = h.result === "win";
      return (
        '<div class="match-row ' + (win ? "w" : "l") + '">' +
          '<span class="mr-stage" title="' + (stage === "G" ? "Group Stage" : "Knockout") + '">' + stage + "</span>" +
          '<span class="mr-flag">' + opp.flag + "</span>" +
          '<span class="mr-name">' + opp.name + " " + opp.year + "</span>" +
          '<span class="mr-score">' + h.home + "–" + h.away + "</span>" +
          '<span class="mr-mark">' + (win ? "✓" : "✗") + "</span>" +
        "</div>"
      );
    }).join("");
  }

  function renderSummary() {
    var s = runStats();
    var headline = s.champion
      ? "👑 CHAMPIONS OF HISTORY"
      : "Out in the " + stageOf(state.history.length - 1);
    var sub = s.champion
      ? "Your " + window.Modes.label(state.mode) + " beat every side drawn against them. Immortal."
      : "Your " + window.Modes.label(state.mode) + " reached match " + state.history.length + " of " + s.total + ".";

    var xi = xiNames();
    var chips = xi.map(function (p) {
      return '<span class="xi-chip">' + p.flag + " " + p.name + "</span>";
    }).join("");

    var stats =
      statBox(s.won + "/" + s.total, "Won") +
      statBox(s.gf + "–" + s.ga, "Goals") +
      (s.best ? statBox(s.best.o.flag + " " + s.best.o.year, "Best Win") : statBox("–", "Best Win"));

    app.innerHTML = "";
    app.appendChild(el(
      '<section class="screen summary ' + (s.champion ? "champ" : "out") + '">' +
        (s.champion ? '<div class="trophy big-trophy">🏆</div>' : "") +
        '<div class="summary-result">' + headline + "</div>" +
        '<p class="summary-sub">' + sub + "</p>" +
        '<div class="share-track">' + resultSquares() + "</div>" +
        '<div class="summary-stats">' + stats + "</div>" +
        '<div class="match-list">' + matchRows() + "</div>" +
        '<div class="summary-xi"><div class="sxi-label">' + window.Modes.label(state.mode) + "</div>" + chips + "</div>" +
        '<div class="team-nav">' +
          '<button class="btn ghost" id="copyBtn">📋 Copy</button>' +
          '<button class="btn ghost" id="imgBtn">📸 Save Image</button>' +
          '<button class="btn primary big" id="againBtn">Play Again</button>' +
        "</div>" +
        '<div class="share-hint">Screenshot this or save the image to share your run!</div>' +
      "</section>"
    ));
    document.getElementById("copyBtn").onclick = shareResult;
    document.getElementById("imgBtn").onclick = saveImage;
    document.getElementById("againBtn").onclick = renderStart;
  }

  function statBox(val, label) {
    return '<div class="stat-box"><div class="sb-val">' + val + '</div><div class="sb-label">' + label + "</div></div>";
  }

  // ---------------------------------------------------------------- shareable image card
  // Rendered with plain canvas shapes/text (no emoji) so it looks identical
  // on every device, then offered via the native share sheet or a download.
  function drawCard() {
    var W = 1080, H = 1350;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var x = c.getContext("2d");
    var s = runStats();

    // background
    var bg = x.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f5934");
    bg.addColorStop(1, "#08251a");
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(245,197,66,0.55)"; x.lineWidth = 10;
    x.strokeRect(20, 20, W - 40, H - 40);

    var cx = W / 2;
    x.textAlign = "center";

    x.fillStyle = "#f5c542";
    x.font = "700 40px Arial";
    x.fillText("ALL-TIME WORLD CUP", cx, 110);

    x.fillStyle = "#eaf3ee";
    x.font = "800 64px Arial";
    x.fillText(window.Modes.label(state.mode), cx, 185);

    // result headline
    x.fillStyle = s.champion ? "#f5c542" : "#e0533d";
    x.font = "800 56px Arial";
    var head = s.champion ? "CHAMPIONS" : "OUT — " + stageOf(state.history.length - 1).toUpperCase();
    x.fillText(head, cx, 270);
    x.fillStyle = "#9fb8ac";
    x.font = "600 34px Arial";
    x.fillText("Record: " + s.won + " / " + s.total + "    Goals: " + s.gf + "–" + s.ga, cx, 320);

    // result squares
    var n = state.bracket.length;
    var sq = 58, gap = 12, totalW = n * sq + (n - 1) * gap;
    var sx = cx - totalW / 2, sy = 360;
    for (var i = 0; i < n; i++) {
      var done = i < state.history.length;
      x.fillStyle = !done ? "rgba(255,255,255,0.12)"
        : (state.history[i].result === "win" ? "#2ec16b" : "#e0533d");
      roundRect(x, sx + i * (sq + gap), sy, sq, sq, 10); x.fill();
      if (i === window.GAUNTLET.group - 1 && i < n - 1) {
        // small gold tick marking the group→knockout boundary
        x.fillStyle = "#f5c542";
        x.fillRect(sx + i * (sq + gap) + sq + gap / 2 - 2, sy - 8, 4, sq + 16);
      }
    }

    // match list
    var ly = 500, lh = 64;
    x.textAlign = "left";
    state.history.forEach(function (h, idx) {
      var o = state.bracket[idx];
      var y = ly + idx * lh;
      var win = h.result === "win";
      x.fillStyle = "rgba(255,255,255,0.05)";
      roundRect(x, 90, y - 38, W - 180, 52, 10); x.fill();
      x.fillStyle = win ? "#2ec16b" : "#e0533d";
      roundRect(x, 102, y - 30, 36, 36, 8); x.fill();
      x.fillStyle = "#08251a"; x.font = "800 26px Arial"; x.textAlign = "center";
      x.fillText(win ? "✓" : "✗", 120, y - 3);
      x.textAlign = "left";
      x.fillStyle = "#eaf3ee"; x.font = "600 30px Arial";
      x.fillText((idx < window.GAUNTLET.group ? "Group · " : "KO · ") + o.name + " " + o.year, 158, y - 5);
      x.textAlign = "right";
      x.fillStyle = "#f5c542"; x.font = "800 32px Arial";
      x.fillText(h.home + "–" + h.away, W - 110, y - 4);
      x.textAlign = "left";
    });

    // XI footer
    var xi = xiNames();
    var fy = ly + state.history.length * lh + 36;
    x.textAlign = "center";
    x.fillStyle = "#9fb8ac"; x.font = "700 26px Arial";
    x.fillText("YOUR XI", cx, fy);
    x.fillStyle = "#eaf3ee"; x.font = "500 27px Arial";
    var names = xi.map(function (p) { return p.name; });
    wrapCentered(x, names.join("  •  "), cx, fy + 40, W - 160, 36);

    x.fillStyle = "rgba(245,197,66,0.8)"; x.font = "700 24px Arial";
    x.fillText("Play it yourself — All-Time World Cup Simulator", cx, H - 50);
    return c;
  }

  function roundRect(x, X, Y, w, h, r) {
    x.beginPath();
    x.moveTo(X + r, Y);
    x.arcTo(X + w, Y, X + w, Y + h, r);
    x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r);
    x.arcTo(X, Y, X + w, Y, r);
    x.closePath();
  }

  function wrapCentered(x, text, cx, y, maxW, lh) {
    var words = text.split(" "), line = "", yy = y;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i] + " ";
      if (x.measureText(test).width > maxW && line) {
        x.fillText(line.trim(), cx, yy); line = words[i] + " "; yy += lh;
      } else line = test;
    }
    x.fillText(line.trim(), cx, yy);
  }

  function saveImage() {
    var canvas;
    try { canvas = drawCard(); }
    catch (e) { toast("Couldn't build image"); return; }
    canvas.toBlob(function (blob) {
      if (!blob) { toast("Couldn't build image"); return; }
      var fname = "world-cup-" + window.Modes.label(state.mode).replace(/\s+/g, "-").toLowerCase() + ".png";
      var file = null;
      try { file = new File([blob], fname, { type: "image/png" }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], text: buildShareText() }).catch(function () { downloadBlob(blob, fname); });
      } else {
        downloadBlob(blob, fname);
      }
    }, "image/png");
  }

  function downloadBlob(blob, fname) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Image saved!");
  }

  // ---------------------------------------------------------------- boot
  renderStart();
})();
