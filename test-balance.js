/* Balance check: play full games as a COMPETENT Patriot who both defends and
   attacks — pours recruits into the capital and threatened fronts, consolidates
   interior troops toward the front, and only attacks with a clear advantage —
   then report the win rate and game length. Uses the game's recorded winner. */
function makeEl() {
  return { style: {}, classList: { add(){}, remove(){}, contains(){return false;} },
    _value:"1", set textContent(v){this._tc=v;}, get textContent(){return this._tc;},
    set innerHTML(v){this._h=v;}, get innerHTML(){return this._h;},
    get value(){return this._value;}, set value(v){this._value=v;},
    appendChild(){}, addEventListener(){}, setAttribute(){} };
}
const cache = {};
global.document = { querySelector: s => cache[s] || (cache[s]=makeEl()),
  querySelectorAll: () => [], createElement: makeEl, createElementNS: makeEl, addEventListener(){} };
global.localStorage = { _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=v;} };

const game = require("./game.js");
const ADJ = game.ADJACENCY;
const R = game.CONFIG.regiment; // men per regiment

function crownAdjStack(S, id) {
  let m = 0;
  for (const n of ADJ[id]) if (S.regions[n].owner === "crown") m = Math.max(m, S.regions[n].troops);
  return m;
}
function minDistToSet(id, set) {
  let m = 99; for (const t of set) m = Math.min(m, game.dist(id, t)); return m;
}

function playTurn() {
  let S = game.getState();
  const isPatriot = (id) => S.regions[id].owner === "patriot";
  const threatened = Object.keys(S.regions).filter((id) => isPatriot(id) && crownAdjStack(S, id) > 0);

  // 1) Recruit: weight the capital, then the most-threatened fronts. Stops when
  //    no targeted region can muster (gold or manpower exhausted).
  const order = ["philadelphia", "penn", "philadelphia"];
  threatened.slice().sort((a, b) => crownAdjStack(S, b) - crownAdjStack(S, a)).forEach((id) => order.push(id));
  let progressed = true, guard = 0;
  while (progressed && S.gold >= game.CONFIG.recruitCost && guard++ < 80) {
    progressed = false;
    for (const tgt of order) {
      if (S.gold < game.CONFIG.recruitCost) break;
      if (S.regions[tgt] && S.regions[tgt].owner === "patriot" && game.recruit(tgt)) {
        progressed = true; S = game.getState();
      }
    }
  }

  // 1b) Garrison the capital and front: pull troops from safe neighbours into
  //     the capital and any threatened region (this is how you defend a city
  //     you can't muster much in).
  const pullInto = (target) => {
    let St = game.getState();
    if (!St.regions[target] || St.regions[target].owner !== "patriot") return;
    for (const n of ADJ[target]) {
      const nr = St.regions[n];
      if (!nr || nr.owner !== "patriot" || nr.acted || nr.troops < 2 * R) continue;
      if (ADJ[n].some((x) => St.regions[x].owner === "crown")) continue; // don't strip the front
      game.doMove(n, target, nr.troops - R);
      St = game.getState();
    }
  };
  pullInto("philadelphia");
  threatened.slice().sort((a, b) => crownAdjStack(S, b) - crownAdjStack(S, a)).forEach(pullInto);
  S = game.getState();

  // 2) Consolidate: march interior armies one step toward the threatened front.
  if (threatened.length) {
    for (const id of Object.keys(S.regions)) {
      const r = S.regions[id];
      if (r.owner !== "patriot" || r.acted || r.troops < 2 * R) continue;
      if (ADJ[id].some((n) => S.regions[n].owner === "crown")) continue; // front holds
      const step = ADJ[id].filter((n) => S.regions[n].owner === "patriot")
        .sort((a, b) => minDistToSet(a, threatened) - minDistToSet(b, threatened))[0];
      if (step && minDistToSet(step, threatened) < minDistToSet(id, threatened)) {
        game.doMove(id, step, r.troops - R);
        S = game.getState();
      }
    }
  }

  // 3) Attack only with a clear advantage, keeping a garrison.
  for (const id of Object.keys(S.regions)) {
    const r = S.regions[id];
    if (r.owner !== "patriot" || r.acted || r.troops <= 3 * R) continue;
    const t = ADJ[id].filter((n) => S.regions[n].owner !== "patriot")
      .map((n) => ({ n, need: S.regions[n].troops * game.defenseBonus(n) }))
      .filter((o) => r.troops >= o.need * 1.5 + 3 * R)
      .sort((a, b) => a.need - b.need)[0];
    if (t) { game.doAttack(id, t.n, r.troops - 2 * R); S = game.getState(); }
  }

  game.endTurn();
}

let wins = 0, losses = 0, undecided = 0;
const turns = [];
const N = 1000;
for (let g = 0; g < N; g++) {
  game.setState(game.newState());
  let guard = 0;
  while (!game.getState().over && guard++ < 400) playTurn();
  const S = game.getState();
  turns.push(S.turn);
  if (!S.over) undecided++;
  else if (S.winner === "patriot") wins++;
  else losses++;
}
const avg = (turns.reduce((a, b) => a + b, 0) / N).toFixed(1);
console.log(`competent player: games=${N} wins=${wins} (${(wins / N * 100).toFixed(0)}%) losses=${losses} undecided=${undecided} avgTurns=${avg}`);
