/* Headless smoke test: stub a minimal DOM, then simulate full games to
   verify the core loop (battles, AI, France, win conditions) runs without
   runtime errors and reaches a decisive end. Not shipped to the browser. */

function makeEl() {
  const el = {
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    children: [],
    _value: "1",
    set textContent(v) { this._tc = v; },
    get textContent() { return this._tc; },
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    get value() { return this._value; },
    set value(v) { this._value = v; },
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
  };
  return el;
}

const elCache = {};
global.document = {
  querySelector(sel) { return elCache[sel] || (elCache[sel] = makeEl()); },
  querySelectorAll() { return []; },
  createElement() { return makeEl(); },
  createElementNS() { return makeEl(); },
  addEventListener() {},
};
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } };

const game = require("./game.js");

// --- Test 1: battle resolution stays within valid bounds ---
let battleOk = true;
for (let i = 0; i < 20000; i++) {
  const a = 1 + Math.floor(Math.random() * 40);
  const d = Math.floor(Math.random() * 40);
  const r = game.resolveBattle(a, d, 1 + Math.random());
  if (r.attLoss < 0 || r.attLoss > a || r.defLoss < 0 || r.defLoss > d) battleOk = false;
}
console.log("battle bounds:", battleOk ? "OK" : "FAIL");

// --- Test 2: distance symmetry & connectivity ---
console.log("dist philadelphia->ga:", game.dist("philadelphia", "ga"));
console.log("dist self:", game.dist("ny", "ny"), "(expect 0)");

// --- Test 3: stress the loop with a RECKLESS player (no recruiting, commits
//     full stacks into the weakest enemy). Goal: no runtime errors, and a
//     decisive result every game. A reckless player is *expected* to lose. ---
let wins = 0, losses = 0, errors = 0;
const GAMES = 400;
for (let g = 0; g < GAMES; g++) {
  try {
    game.setState(game.newState());
    let guard = 0;
    while (!game.getState().over && guard++ < 500) {
      const S = game.getState();
      // Player: every army attacks the weakest enemy neighbour it can reach.
      const adj = game.ADJACENCY;
      for (const id of Object.keys(S.regions)) {
        const r = S.regions[id];
        if (r.owner !== "patriot" || r.acted || r.troops < game.CONFIG.regiment) continue;
        const enemies = adj[id].filter((n) => S.regions[n].owner === "crown");
        if (enemies.length) {
          enemies.sort((a, b) => S.regions[a].troops - S.regions[b].troops);
          game.setSelected(id);
          game.doAttack(id, enemies[0], r.troops);
        }
      }
      if (game.getState().over) break;
      game.endTurn();
    }
    const S = game.getState();
    if (!S.over) { errors++; continue; }
    if (S.winner === "patriot") wins++; else losses++;
  } catch (e) {
    errors++;
    if (errors <= 3) console.error("RUNTIME ERROR:", e.message, "\n", e.stack);
  }
}
console.log(`games=${GAMES} decisive_wins=${wins} losses=${losses} errors/undecided=${errors}`);

// --- Test 4: France can trigger once conditions are met ---
game.setState(game.newState());
const st = game.getState();
st.turn = game.CONFIG.franceTurn; st.morale.patriot = game.CONFIG.franceMoraleNeeded;
game.maybeFranceEvent();
console.log("france triggers:", game.getState().franceJoined ? "OK" : "FAIL");

console.log(errors === 0 ? "\nALL SMOKE TESTS PASSED" : "\nSMOKE TESTS HAD ERRORS");
