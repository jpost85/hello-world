/*
 * Match engine — rated simulation with randomness.
 *
 * 1. Reduce each side to three line ratings (att / mid / def).
 * 2. The midfield battle shifts expected goals toward whoever controls it.
 * 3. Each attack is graded against the opposing defence to produce an
 *    expected-goals (xG) figure, which is sampled with a Poisson draw so
 *    upsets are always possible but talent wins out over time.
 */
window.Engine = (function () {
  // ---- Build the player's three line ratings from their chosen XI ----
  // squad: { [slotKey]: playerObject }
  function rateSquad(squad) {
    var lines = { GK: [], DEF: [], MID: [], FWD: [] };
    window.SLOTS.forEach(function (slot) {
      var player = squad[slot.key];
      if (player) lines[slot.line].push(player.pwr);
    });
    var avg = function (arr) {
      if (!arr.length) return 70;
      return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
    };
    // The keeper reinforces the defensive line (weighted in).
    var defBase = avg(lines.DEF);
    var gk = avg(lines.GK);
    return {
      att: avg(lines.FWD),
      mid: avg(lines.MID),
      def: defBase * 0.78 + gk * 0.22,
    };
  }

  // ---- Poisson sampler (Knuth) for goal counts ----
  function poisson(lambda) {
    var L = Math.exp(-lambda);
    var k = 0;
    var p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // ---- Expected goals for an attack vs a defence, tilted by midfield edge ----
  function expectedGoals(att, def, midEdge) {
    // 1.25 baseline goals; every rating point of attacking edge is worth
    // ~0.07 xG, and controlling midfield adds a smaller bonus. The edge
    // coefficient is tuned so a top XI clears the full gauntlet ~11% of the
    // time while a mediocre XI is all but doomed — hard but achievable.
    var xg = 1.25 + (att - def) * 0.07 + midEdge * 0.035;
    return clamp(xg, 0.18, 5.0);
  }

  // ---- Simulate one match. a = player squad rating, b = opponent ----
  // Returns { home, away, xgHome, xgAway, result, penalties? }
  function simulateMatch(a, b) {
    var midEdge = a.mid - b.mid;
    var xgHome = expectedGoals(a.att, b.def, midEdge);
    var xgAway = expectedGoals(b.att, a.def, -midEdge);

    var home = poisson(xgHome);
    var away = poisson(xgAway);

    var out = {
      home: home,
      away: away,
      xgHome: xgHome,
      xgAway: xgAway,
      penalties: null,
    };

    if (home > away) out.result = "win";
    else if (home < away) out.result = "loss";
    else {
      // Knockout: a draw goes to penalties, weighted slightly by who had
      // the better expected-goals figure (i.e. who created more).
      var edge = clamp(0.5 + (xgHome - xgAway) * 0.12, 0.2, 0.8);
      var winHome = Math.random() < edge;
      out.penalties = {
        home: winHome ? 4 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2),
        away: winHome ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 2),
      };
      // Guarantee the shootout isn't level.
      if (out.penalties.home === out.penalties.away) {
        if (winHome) out.penalties.home++; else out.penalties.away++;
      }
      out.result = winHome ? "win" : "loss";
    }
    return out;
  }

  // ---- Win probability estimate (for the pre-match odds display) ----
  // Runs a quick Monte-Carlo so the displayed odds match the live engine.
  function winProbability(a, b, samples) {
    samples = samples || 600;
    var wins = 0;
    for (var i = 0; i < samples; i++) {
      if (simulateMatch(a, b).result === "win") wins++;
    }
    return Math.round((wins / samples) * 100);
  }

  return {
    rateSquad: rateSquad,
    simulateMatch: simulateMatch,
    winProbability: winProbability,
  };
})();
