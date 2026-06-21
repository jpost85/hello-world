/*
 * Seeded RNG — deterministic pseudo-random numbers from a string key.
 *
 * Used by the Daily Challenge so that everyone playing on a given date gets
 * the exact same draft shortlists, bracket and match outcomes. Normal modes
 * keep using Math.random.
 *
 *   var rng = Rng.fromString("2026-06-21|bracket");
 *   rng(); // -> deterministic float in [0, 1)
 */
window.Rng = (function () {
  // xmur3 string hash -> 32-bit seed
  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  // mulberry32 PRNG
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fromString(str) {
    return mulberry32(xmur3(String(str))());
  }

  // Today's challenge id (UTC, so it's the same worldwide).
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  return { fromString: fromString, today: today };
})();
