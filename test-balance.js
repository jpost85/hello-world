/* Balance check: play full games as a competent Patriot (recruit into the
   front, mass forces, attack only with favourable odds) and report the win
   rate and game length. Uses the game's own recorded winner. */
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

function bestAttack(S, id) {
  const r = S.regions[id];
  const enemies = ADJ[id].filter(n => S.regions[n].owner === "crown");
  if (!enemies.length) return null;
  enemies.sort((a,b) => S.regions[a].troops - S.regions[b].troops);
  const t = enemies[0];
  const need = S.regions[t].troops * game.defenseBonus(t);
  return r.troops >= need * 1.25 + 2 ? t : null;
}

let wins = 0, losses = 0, undecided = 0;
const turns = [];
const N = 1000;
for (let g = 0; g < N; g++) {
  game.setState(game.newState());
  let guard = 0;
  while (!game.getState().over && guard++ < 400) {
    let S = game.getState();
    const front = Object.keys(S.regions).filter(id =>
      S.regions[id].owner === "patriot" && ADJ[id].some(n => S.regions[n].owner === "crown"));
    const targets = front.length ? front : ["penn"];
    let safety = 0;
    while (S.gold >= game.CONFIG.recruitCost * game.CONFIG.recruitBatch && safety++ < 40) {
      game.recruit(targets[safety % targets.length]); S = game.getState();
    }
    for (const id of Object.keys(S.regions)) {
      const r = S.regions[id];
      if (r.owner !== "patriot" || r.acted || r.troops <= 2) continue;
      const t = bestAttack(S, id);
      if (t) game.doAttack(id, t, r.troops - 1);
    }
    if (game.getState().over) break;
    game.endTurn();
  }
  const S = game.getState();
  turns.push(S.turn);
  if (!S.over) undecided++;
  else if (S.winner === "patriot") wins++;
  else losses++;
}
const avg = (turns.reduce((a,b)=>a+b,0)/N).toFixed(1);
console.log(`competent player: games=${N} wins=${wins} (${(wins/N*100).toFixed(0)}%) losses=${losses} undecided=${undecided} avgTurns=${avg}`);
