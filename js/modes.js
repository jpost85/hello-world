/*
 * Game modes — how the draft pool is constrained.
 *
 *   all-time : the curated themed tiers from js/slots.js (Pelé vs Messi, etc.)
 *   decade   : only players whose `decade` matches (e.g. the 1980s XI)
 *   nation   : only players from one country (e.g. an all-time Brazil XI)
 *
 * A mode is { type: 'all-time' | 'decade' | 'nation', value: string|null }.
 *
 * For decade/nation modes the draft uses a generic 4-3-3 formation and each
 * slot is filled from the matching players for that line, minus anyone already
 * picked. Modes only ever offers a decade/nation that can actually field a
 * full XI, so the player never hits a dead end.
 */

// Generic 4-3-3 used by decade/nation modes.
window.FORMATION = [
  { key: "gk",  line: "GK",  label: "Goalkeeper",   blurb: "Your last line of defence." },
  { key: "rb",  line: "DEF", label: "Right-Back",   blurb: "Lock down the right flank." },
  { key: "rcb", line: "DEF", label: "Centre-Back",  blurb: "The defensive rock." },
  { key: "lcb", line: "DEF", label: "Centre-Back",  blurb: "Win every aerial duel." },
  { key: "lb",  line: "DEF", label: "Left-Back",    blurb: "Lock down the left flank." },
  { key: "cm1", line: "MID", label: "Midfielder",   blurb: "Control the centre of the park." },
  { key: "cm2", line: "MID", label: "Midfielder",   blurb: "Drive the team forward." },
  { key: "cm3", line: "MID", label: "Midfielder",   blurb: "Pull the creative strings." },
  { key: "rw",  line: "FWD", label: "Forward",      blurb: "Stretch and terrorise the defence." },
  { key: "st",  line: "FWD", label: "Forward",      blurb: "Lead the line and finish chances." },
  { key: "lw",  line: "FWD", label: "Forward",      blurb: "The wide threat." },
];

window.Modes = (function () {
  // Order in which decades are presented.
  var DECADE_ORDER = ["1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];

  // A squad needs 1 GK, 4 DEF, 3 MID, 3 FWD — can this pool field it?
  function canField(players) {
    var c = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    players.forEach(function (p) { c[p.pos]++; });
    return c.GK >= 1 && c.DEF >= 4 && c.MID >= 3 && c.FWD >= 3;
  }

  function groupBy(key) {
    return window.PLAYERS.reduce(function (acc, p) {
      (acc[p[key]] = acc[p[key]] || []).push(p);
      return acc;
    }, {});
  }

  // Decades that can field a full XI, in chronological order.
  function availableDecades() {
    var byDecade = groupBy("decade");
    return DECADE_ORDER.filter(function (d) {
      return byDecade[d] && canField(byDecade[d]);
    }).map(function (d) {
      return { value: d, label: d, count: byDecade[d].length };
    });
  }

  // Nations that can field a full XI, richest squads first.
  function availableNations() {
    var byNation = groupBy("nation");
    return Object.keys(byNation)
      .filter(function (n) { return canField(byNation[n]); })
      .map(function (n) {
        return { value: n, flag: byNation[n][0].flag, count: byNation[n].length };
      })
      .sort(function (a, b) { return b.count - a.count || a.value.localeCompare(b.value); });
  }

  // The slot template for a mode.
  function slotsFor(mode) {
    return mode.type === "all-time" ? window.SLOTS : window.FORMATION;
  }

  // Eligible player ids for a slot, given the mode and current squad
  // (already-picked players are filtered out so no one is chosen twice).
  function poolFor(mode, slot, squad) {
    var ids;
    if (mode.type === "all-time") {
      ids = slot.pool.slice();
    } else {
      var matchKey = mode.type === "decade" ? "decade" : "nation";
      ids = window.PLAYERS
        .filter(function (p) { return p.pos === slot.line && p[matchKey] === mode.value; })
        .map(function (p) { return p.id; });
    }
    var taken = slotsFor(mode)
      .filter(function (s) { return s.key !== slot.key; })
      .map(function (s) { return squad[s.key]; })
      .filter(Boolean)
      .map(function (p) { return p.id; });
    return ids.filter(function (id) { return taken.indexOf(id) === -1; });
  }

  // Short human label for a chosen mode (used in headers / share text).
  function label(mode) {
    if (mode.type === "all-time") return "All-Time XI";
    if (mode.type === "decade") return mode.value + " XI";
    return mode.value + " XI";
  }

  return {
    canField: canField,
    availableDecades: availableDecades,
    availableNations: availableNations,
    slotsFor: slotsFor,
    poolFor: poolFor,
    label: label,
  };
})();
