/*
 * Game controller — screens, state and rendering for the
 * All-Time World Cup Simulator.
 *
 * Flow:  Start  →  Draft (tier picks)  →  Team review  →  Gauntlet  →  Win/Lose
 */
(function () {
  var app = document.getElementById("app");

  var state = {
    squad: {},     // slotKey -> player object
    slotIndex: 0,  // which draft slot we're on
    round: 0,      // current gauntlet round (index into OPPONENTS)
  };

  // ---------------------------------------------------------------- helpers
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
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
    return window.SLOTS.every(function (s) { return state.squad[s.key]; });
  }

  // ---------------------------------------------------------------- start
  function renderStart() {
    state.squad = {};
    state.slotIndex = 0;
    state.round = 0;

    app.innerHTML = "";
    app.appendChild(el(
      '<section class="screen start">' +
        '<div class="trophy">🏆</div>' +
        "<h1>All-Time World Cup</h1>" +
        '<p class="tagline">Draft a team of legends. Run the gauntlet of the greatest sides ever to play. Lose once and it\'s over.</p>' +
        '<div class="how">' +
          '<div class="how-step"><span class="num">1</span> Pick one legend for each of 11 themed positions.</div>' +
          '<div class="how-step"><span class="num">2</span> Face ' + window.OPPONENTS.length + " all-time great teams, one by one.</div>" +
          '<div class="how-step"><span class="num">3</span> Win every match to be crowned champion of history.</div>' +
        "</div>" +
        '<button class="btn primary big" id="startBtn">Start the Gauntlet</button>' +
      "</section>"
    ));
    document.getElementById("startBtn").onclick = renderDraft;
  }

  // ---------------------------------------------------------------- draft
  function renderDraft() {
    var slot = window.SLOTS[state.slotIndex];
    app.innerHTML = "";

    var cards = slot.pool
      .map(function (id) { return window.PLAYER_BY_ID[id]; })
      .filter(Boolean)
      .map(function (p) {
        return pdCard(p, {
          pickKey: slot.key,
          selected: state.squad[slot.key] && state.squad[slot.key].id === p.id,
        });
      })
      .join("");

    var section = el(
      '<section class="screen draft">' +
        '<div class="draft-head">' +
          '<div class="draft-progress">Pick ' + (state.slotIndex + 1) + " of " + window.SLOTS.length + "</div>" +
          "<h2>" + slot.label + "</h2>" +
          '<p class="slot-blurb">' + slot.blurb + "</p>" +
        "</div>" +
        '<div class="pick-grid">' + cards + "</div>" +
        '<div class="draft-nav">' +
          '<button class="btn ghost" id="backBtn"' + (state.slotIndex === 0 ? " disabled" : "") + ">← Back</button>" +
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
    };
  }

  function dotsHTML() {
    return window.SLOTS.map(function (s, i) {
      var cls = state.squad[s.key] ? "dot filled" : (i === state.slotIndex ? "dot active" : "dot");
      return '<span class="' + cls + '"></span>';
    }).join("");
  }

  function advanceDraft() {
    if (state.slotIndex < window.SLOTS.length - 1) {
      state.slotIndex++;
      renderDraft();
    } else if (squadComplete()) {
      renderTeam();
    } else {
      // jump to first unfilled slot
      state.slotIndex = window.SLOTS.findIndex(function (s) { return !state.squad[s.key]; });
      renderDraft();
    }
  }

  // ---------------------------------------------------------------- team review
  function lineRow(label, line) {
    var players = window.SLOTS
      .filter(function (s) { return s.line === line; })
      .map(function (s) { return state.squad[s.key]; });
    var chips = players.map(function (p) {
      return '<span class="xi-chip">' + p.flag + " " + p.name + "</span>";
    }).join("");
    return '<div class="line-row"><div class="line-label">' + label + "</div><div class="line-chips">" + chips + "</div></div>";
  }

  function renderTeam() {
    var r = window.Engine.rateSquad(state.squad);
    app.innerHTML = "";
    app.appendChild(el(
      '<section class="screen team">' +
        "<h2>Your All-Time XI</h2>" +
        '<div class="ratings">' +
          ratingBox("Attack", r.att) +
          ratingBox("Midfield", r.mid) +
          ratingBox("Defence", r.def) +
        "</div>" +
        '<div class="lineup">' +
          lineRow("FWD", "FWD") +
          lineRow("MID", "MID") +
          lineRow("DEF", "DEF") +
          lineRow("GK", "GK") +
        "</div>" +
        '<div class="team-nav">' +
          '<button class="btn ghost" id="redraftBtn">↺ Re-draft</button>' +
          '<button class="btn primary big" id="toGauntletBtn">Enter the Gauntlet →</button>' +
        "</div>" +
      "</section>"
    ));
    document.getElementById("redraftBtn").onclick = function () {
      state.slotIndex = 0; renderDraft();
    };
    document.getElementById("toGauntletBtn").onclick = renderGauntlet;
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
    var opp = window.OPPONENTS[state.round];
    var me = window.Engine.rateSquad(state.squad);
    var oppRating = { att: opp.att, mid: opp.mid, def: opp.def };
    var odds = window.Engine.winProbability(me, oppRating);

    app.innerHTML = "";
    app.appendChild(el(
      '<section class="screen gauntlet">' +
        '<div class="round-pill">Round ' + (state.round + 1) + " / " + window.OPPONENTS.length + "</div>" +
        '<div class="matchup">' +
          '<div class="side me">' +
            '<div class="side-flag">⭐</div>' +
            '<div class="side-name">Your Legends</div>' +
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
    var dots = window.OPPONENTS.map(function (o, i) {
      var cls = i < state.round ? "track-dot beat" : (i === state.round ? "track-dot now" : "track-dot");
      return '<span class="' + cls + '" title="' + o.name + " " + o.year + '">' + o.flag + "</span>";
    }).join("");
    return '<div class="track">' + dots + "</div>";
  }

  // ---------------------------------------------------------------- match
  function playMatch(me, oppRating, opp) {
    var res = window.Engine.simulateMatch(me, oppRating);
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
      if (state.round >= window.OPPONENTS.length - 1) {
        nav.appendChild(buttonEl("🏆 Claim Your Crown", "primary big", renderWin));
      } else {
        nav.appendChild(buttonEl("Next Opponent →", "primary big", function () {
          state.round++;
          renderGauntlet();
        }));
      }
    } else {
      nav.appendChild(buttonEl("Try Again", "primary big", renderStart));
    }
  }

  function buttonEl(text, cls, onclick) {
    var b = el('<button class="btn ' + cls + '">' + text + "</button>");
    b.onclick = onclick;
    return b;
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
    var names = window.SLOTS.map(function (s) { return state.squad[s.key].name; }).join(", ");
    app.appendChild(el(
      '<section class="screen win">' +
        '<div class="trophy big-trophy">🏆</div>' +
        "<h1>CHAMPIONS OF HISTORY</h1>" +
        "<p class=\"tagline\">Your legends ran the gauntlet and beat every great team ever assembled. Immortal.</p>" +
        '<div class="winners">' + names + "</div>" +
        '<button class="btn primary big" id="againBtn">Play Again</button>' +
      "</section>"
    ));
    document.getElementById("againBtn").onclick = renderStart;
  }

  // ---------------------------------------------------------------- boot
  renderStart();
})();
