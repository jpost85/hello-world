/*
 * Game modes — how the draft pool is constrained.
 *
 *   all-time : the curated themed tiers from js/slots.js (Pelé vs Messi, etc.)
 *   decade   : only players whose `decade` matches (e.g. the 1980s XI)
 *   nation   : only players from one country (e.g. an all-time Brazil XI)
 *   confed   : only players from one confederation / region (e.g. an
 *              all-time South America or Africa XI)
 *
 * A mode is { type: 'all-time' | 'decade' | 'nation' | 'confed', value: string|null }.
 *
 * For decade/nation/confed modes the draft uses a generic 4-3-3 formation and
 * each slot is filled from the matching players for that line, minus anyone
 * already picked. Modes only ever offers an option that can actually field a
 * full XI, so the player never hits a dead end.
 */

// Generic 4-3-3 used by the filtered modes.
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

  // Nation -> confederation. Any nation not listed is treated as "other".
  var NATION_CONFED = {
    // UEFA (Europe)
    "England": "UEFA", "Italy": "UEFA", "Germany": "UEFA", "Spain": "UEFA",
    "France": "UEFA", "Netherlands": "UEFA", "Portugal": "UEFA", "Belgium": "UEFA",
    "Croatia": "UEFA", "Denmark": "UEFA", "Sweden": "UEFA", "Poland": "UEFA",
    "Hungary": "UEFA", "USSR": "UEFA", "N. Ireland": "UEFA",
    // CONMEBOL (South America)
    "Brazil": "CONMEBOL", "Argentina": "CONMEBOL", "Uruguay": "CONMEBOL",
    "Colombia": "CONMEBOL", "Chile": "CONMEBOL",
    // CAF (Africa)
    "Nigeria": "CAF", "Cameroon": "CAF", "Ivory Coast": "CAF", "Egypt": "CAF",
    "Senegal": "CAF", "Ghana": "CAF", "Algeria": "CAF", "Morocco": "CAF", "Liberia": "CAF",
    // CONCACAF (North & Central America)
    "Mexico": "CONCACAF", "USA": "CONCACAF", "Costa Rica": "CONCACAF",
    // AFC (Asia / Australia)
    "Japan": "AFC", "South Korea": "AFC", "Iran": "AFC", "Australia": "AFC",
  };

  // Display metadata for confederations, in the order they're offered.
  var CONFED_META = [
    { value: "CONMEBOL", label: "South America", flag: "🌎" },
    { value: "UEFA",     label: "Europe",        flag: "🇪🇺" },
    { value: "CAF",      label: "Africa",        flag: "🌍" },
    { value: "CONCACAF", label: "North America", flag: "🌎" },
    { value: "AFC",      label: "Asia",          flag: "🌏" },
  ];

  function confedOf(nation) {
    return NATION_CONFED[nation] || null;
  }

  // A squad needs 1 GK, 4 DEF, 3 MID, 3 FWD — can this pool field it?
  function canField(players) {
    var c = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    players.forEach(function (p) { c[p.pos]++; });
    return c.GK >= 1 && c.DEF >= 4 && c.MID >= 3 && c.FWD >= 3;
  }

  function groupBy(keyFn) {
    return window.PLAYERS.reduce(function (acc, p) {
      var k = keyFn(p);
      if (k == null) return acc;
      (acc[k] = acc[k] || []).push(p);
      return acc;
    }, {});
  }

  // Decades that can field a full XI, in chronological order.
  function availableDecades() {
    var byDecade = groupBy(function (p) { return p.decade; });
    return DECADE_ORDER.filter(function (d) {
      return byDecade[d] && canField(byDecade[d]);
    }).map(function (d) {
      return { value: d, label: d, flag: null, count: byDecade[d].length };
    });
  }

  // Nations that can field a full XI, richest squads first.
  function availableNations() {
    var byNation = groupBy(function (p) { return p.nation; });
    return Object.keys(byNation)
      .filter(function (n) { return canField(byNation[n]); })
      .map(function (n) {
        return { value: n, label: n, flag: byNation[n][0].flag, count: byNation[n].length };
      })
      .sort(function (a, b) { return b.count - a.count || a.value.localeCompare(b.value); });
  }

  // Confederations that can field a full XI, in CONFED_META order.
  function availableConfederations() {
    var byConfed = groupBy(function (p) { return confedOf(p.nation); });
    return CONFED_META.filter(function (m) {
      return byConfed[m.value] && canField(byConfed[m.value]);
    }).map(function (m) {
      return { value: m.value, label: m.label, flag: m.flag, count: byConfed[m.value].length };
    });
  }

  // The slot template for a mode.
  function slotsFor(mode) {
    return mode.type === "all-time" ? window.SLOTS : window.FORMATION;
  }

  // ----- Daily Challenge: seeded draft shortlists -----
  // Every position gets the same fixed shortlist of candidates for everyone
  // playing on the given date — the puzzle is to build the best XI from these.
  var DAILY_CHOICES = 6;

  function seededShuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Returns { [slotKey]: [playerId, ...] } for the day.
  function buildDailyPools(dateKey) {
    var pools = {};
    window.FORMATION.forEach(function (slot) {
      var rng = window.Rng.fromString(dateKey + "|slot|" + slot.key);
      var byLine = window.PLAYERS.filter(function (p) { return p.pos === slot.line; });
      pools[slot.key] = seededShuffle(byLine, rng)
        .slice(0, DAILY_CHOICES)
        .map(function (p) { return p.id; });
    });
    return pools;
  }

  // Does a player match the (non all-time) mode's filter?
  function matchesFilter(player, mode) {
    if (mode.type === "decade") return player.decade === mode.value;
    if (mode.type === "nation") return player.nation === mode.value;
    if (mode.type === "confed") return confedOf(player.nation) === mode.value;
    return true;
  }

  // Eligible player ids for a slot, given the mode and current squad
  // (already-picked players are filtered out so no one is chosen twice).
  function poolFor(mode, slot, squad) {
    var ids;
    if (mode.type === "all-time") {
      ids = slot.pool.slice();
    } else if (mode.type === "daily") {
      ids = (mode.pools && mode.pools[slot.key] ? mode.pools[slot.key] : []).slice();
    } else {
      ids = window.PLAYERS
        .filter(function (p) { return p.pos === slot.line && matchesFilter(p, mode); })
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
    if (mode.type === "daily") return "Daily Challenge";
    if (mode.type === "confed") {
      var meta = CONFED_META.filter(function (m) { return m.value === mode.value; })[0];
      return (meta ? meta.label : mode.value) + " XI";
    }
    return mode.value + " XI";
  }

  return {
    canField: canField,
    confedOf: confedOf,
    availableDecades: availableDecades,
    availableNations: availableNations,
    availableConfederations: availableConfederations,
    slotsFor: slotsFor,
    poolFor: poolFor,
    buildDailyPools: buildDailyPools,
    label: label,
  };
})();
