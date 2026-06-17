/**
 * The game state machine: setup, the seasonal command loop, and every public
 * action a warlord can take. Mirrors the Dominion branch's `game.ts` — pure
 * functions that validate preconditions, throw a descriptive `Error` on misuse,
 * and return a brand-new `GameState`. The UI and the AI call the *same* actions.
 *
 * Turn lifecycle (the RoTK reshaping of Dominion's reinforce→attack→fortify):
 *   beginTurn  → collect seasonal income, refresh command points
 *   command    → spend command points on develop / recruit / scheme / fortify / march
 *   endTurn    → hand off; after the last warlord, the season (and year) advances
 */
import { CONFIG } from "./config.ts";
import { resolveBattle, type BattleSide } from "./battle.ts";
import { seedRng } from "./rng.ts";
import { buildOfficers, DEFAULT_SCENARIO, type Scenario } from "./scenario.ts";
import {
  SEASONS,
  type GameMap,
  type GameState,
  type Officer,
  type Player,
  type ProvinceState,
  type Season,
} from "./types.ts";

export interface NewGameOptions {
  map: GameMap;
  scenario?: Scenario;
  /** Faction the human controls; the rest are AI. Omit for an all-AI game. */
  humanFactionId?: string | null;
  seed?: number;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function createGame(opts: NewGameOptions): GameState {
  const { map } = opts;
  const scenario = opts.scenario ?? DEFAULT_SCENARIO;
  const seed = opts.seed ?? 12345;

  const players: Player[] = scenario.factions.map((fac) => ({
    id: fac.id,
    name: fac.name,
    factionId: fac.id,
    isAI: opts.humanFactionId ? fac.id !== opts.humanFactionId : true,
    isEliminated: false,
  }));

  const owner: Record<string, string> = {};
  for (const [factionId, provs] of Object.entries(scenario.holdings))
    for (const p of provs) owner[p] = factionId;

  const provinces: Record<string, ProvinceState> = {};
  for (const prov of map.provinces) {
    const s = CONFIG.start;
    provinces[prov.id] = {
      ownerId: owner[prov.id] ?? null,
      troops: owner[prov.id] ? s.troops : Math.round(s.troops * 0.4),
      gold: s.gold,
      food: s.food,
      population: s.population,
      order: s.order,
      development: s.development,
      hasRampart: false,
    };
  }

  const officers = buildOfficers(scenario);

  const state: GameState = {
    map,
    factions: scenario.factions,
    players,
    provinces,
    officers,
    year: 0,
    season: "spring",
    turn: 1,
    currentPlayerIndex: 0,
    phase: "command",
    commandPointsRemaining: 0,
    rngState: seedRng(seed),
    events: [],
    winnerId: null,
  };

  return beginTurn(log(state, players[0].id, `${players[0].name} takes command.`));
}

// ---------------------------------------------------------------------------
// Immutable-update helpers
// ---------------------------------------------------------------------------

function cloneState(s: GameState): GameState {
  const provinces: Record<string, ProvinceState> = {};
  for (const [k, v] of Object.entries(s.provinces)) provinces[k] = { ...v };
  return {
    ...s,
    provinces,
    officers: s.officers.map((o) => ({ ...o })),
    players: s.players.map((p) => ({ ...p })),
    events: s.events.slice(),
  };
}

function log(s: GameState, playerId: string, message: string): GameState {
  return { ...s, events: [...s.events, { turn: s.turn, playerId, message }] };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function currentPlayer(s: GameState): Player {
  return s.players[s.currentPlayerIndex];
}

export function provincesOf(s: GameState, playerId: string): string[] {
  return Object.keys(s.provinces).filter((id) => s.provinces[id].ownerId === playerId);
}

/** The lead officer (highest WAR) a player has stationed in a province, if any. */
export function leadOfficer(s: GameState, provinceId: string, ownerId: string): Officer | undefined {
  return s.officers
    .filter((o) => o.ownerId === ownerId && o.provinceId === provinceId)
    .sort((a, b) => b.war - a.war)[0];
}

/** Best schemer/administrator (highest of a stat) a player has in a province. */
function bestStatOfficer(s: GameState, provinceId: string, ownerId: string, stat: keyof Officer): Officer | undefined {
  return s.officers
    .filter((o) => o.ownerId === ownerId && o.provinceId === provinceId)
    .sort((a, b) => (b[stat] as number) - (a[stat] as number))[0];
}

function requireCommand(s: GameState): void {
  if (s.phase !== "command") throw new Error("the game is over");
  if (s.commandPointsRemaining <= 0) throw new Error("no command points left this season");
}

function requireOwned(s: GameState, provinceId: string): void {
  const p = s.provinces[provinceId];
  if (!p) throw new Error(`unknown province: ${provinceId}`);
  if (p.ownerId !== currentPlayer(s).id) throw new Error(`${provinceId} is not yours`);
}

// ---------------------------------------------------------------------------
// Seasonal economy
// ---------------------------------------------------------------------------

function beginTurn(s: GameState): GameState {
  const player = currentPlayer(s);
  const next = cloneState(s);
  const e = CONFIG.economy;
  for (const id of provincesOf(next, player.id)) {
    const p = next.provinces[id];
    // Gold tax from developed, orderly land.
    p.gold += Math.round((p.development / 10) * (p.order / 100) * e.goldPerDevelopment);
    // Autumn harvest.
    if (next.season === "autumn") p.food += Math.round((p.population / 10) * (p.order / 100) * e.foodPerPopulation);
    // Army upkeep eats food; shortfall saps order.
    p.food -= Math.round((p.troops / 1000) * e.foodPerThousandTroops);
    if (p.food < 0) {
      p.food = 0;
      p.order = clamp(p.order - 3, 0, 100);
    }
    // Order drifts toward its resting point.
    const dir = Math.sign(e.orderRestingPoint - p.order);
    p.order = clamp(p.order + dir * e.orderDriftPerSeason, 0, 100);
  }
  next.commandPointsRemaining = commandPointsFor(provincesOf(next, player.id).length);
  return next;
}

/** Command points a warlord earns for holding `provinceCount` provinces. */
export function commandPointsFor(provinceCount: number): number {
  const cp = CONFIG.commandPoints;
  return Math.min(cp.max, cp.base + Math.floor(provinceCount / cp.perProvinces));
}

// ---------------------------------------------------------------------------
// Commands (each costs one command point)
// ---------------------------------------------------------------------------

/** Invest in a province's economy and public order. */
export function develop(s: GameState, provinceId: string): GameState {
  requireCommand(s);
  requireOwned(s, provinceId);
  const cfg = CONFIG.develop;
  if (s.provinces[provinceId].gold < cfg.goldCost) throw new Error("not enough gold to develop");
  const next = cloneState(s);
  const p = next.provinces[provinceId];
  const admin = bestStatOfficer(next, provinceId, currentPlayer(next).id, "politics");
  const bonus = admin ? 1 + cfg.politicsScale * (admin.politics / 100) : 1;
  p.gold -= cfg.goldCost;
  p.development = clamp(p.development + Math.round(cfg.developmentGain * bonus), 0, 100);
  p.order = clamp(p.order + cfg.orderGain, 0, 100);
  next.commandPointsRemaining--;
  return log(next, currentPlayer(next).id, `Develops ${province(next, provinceId)}.`);
}

/** Draft soldiers from the province population. */
export function recruit(s: GameState, provinceId: string): GameState {
  requireCommand(s);
  requireOwned(s, provinceId);
  const cfg = CONFIG.recruit;
  const p0 = s.provinces[provinceId];
  if (p0.gold < cfg.goldCost) throw new Error("not enough gold to recruit");
  if (p0.population < cfg.populationCost) throw new Error("not enough population to recruit");
  const next = cloneState(s);
  const p = next.provinces[provinceId];
  p.gold -= cfg.goldCost;
  p.population -= cfg.populationCost;
  p.troops += cfg.troopsGained;
  p.order = clamp(p.order - cfg.orderCost, 0, 100);
  next.commandPointsRemaining--;
  return log(next, currentPlayer(next).id, `Recruits ${cfg.troopsGained} troops in ${province(next, provinceId)}.`);
}

/** Raise a rampart to strengthen a province's defenders. */
export function fortify(s: GameState, provinceId: string): GameState {
  requireCommand(s);
  requireOwned(s, provinceId);
  if (s.provinces[provinceId].hasRampart) throw new Error("province already fortified");
  if (s.provinces[provinceId].gold < CONFIG.rampartGoldCost) throw new Error("not enough gold to fortify");
  const next = cloneState(s);
  const p = next.provinces[provinceId];
  p.gold -= CONFIG.rampartGoldCost;
  p.hasRampart = true;
  next.commandPointsRemaining--;
  return log(next, currentPlayer(next).id, `Builds a rampart in ${province(next, provinceId)}.`);
}

/** Incite unrest in an adjacent enemy province, sapping its public order. */
export function scheme(s: GameState, targetProvinceId: string): GameState {
  requireCommand(s);
  const target = s.provinces[targetProvinceId];
  if (!target) throw new Error(`unknown province: ${targetProvinceId}`);
  const me = currentPlayer(s).id;
  if (target.ownerId === me) throw new Error("cannot scheme against your own province");
  const myProvs = provincesOf(s, me);
  const adjacent = s.map.provinces.find((p) => p.id === targetProvinceId)?.adjacentTo ?? [];
  if (!adjacent.some((a) => myProvs.includes(a))) throw new Error("no province of yours borders the target");
  // Strongest available schemer across the bordering provinces.
  let schemer: Officer | undefined;
  for (const a of adjacent.filter((x) => myProvs.includes(x))) {
    const o = bestStatOfficer(s, a, me, "intellect");
    if (o && (!schemer || o.intellect > schemer.intellect)) schemer = o;
  }
  const payer = myProvs.find((id) => s.provinces[id].gold >= CONFIG.scheme.goldCost);
  if (!payer) throw new Error("not enough gold to scheme");
  const next = cloneState(s);
  next.provinces[payer].gold -= CONFIG.scheme.goldCost;
  const intel = schemer ? schemer.intellect : 40;
  const damage = Math.round(CONFIG.scheme.baseOrderDamage * (intel / 100) * (1 + (100 - target.order) / 200));
  next.provinces[targetProvinceId].order = clamp(next.provinces[targetProvinceId].order - damage, 0, 100);
  next.commandPointsRemaining--;
  return log(next, me, `Foments unrest in ${province(next, targetProvinceId)} (-${damage} order).`);
}

/**
 * March troops from one of your provinces to an adjacent one. Into your own
 * land it reinforces; into hostile land it triggers a battle.
 */
export function march(s: GameState, fromId: string, toId: string, troops: number): GameState {
  requireCommand(s);
  requireOwned(s, fromId);
  const from = s.provinces[fromId];
  const toMap = s.map.provinces.find((p) => p.id === toId);
  if (!toMap) throw new Error(`unknown province: ${toId}`);
  if (!from && !toMap) throw new Error("invalid march");
  if (!s.map.provinces.find((p) => p.id === fromId)?.adjacentTo.includes(toId))
    throw new Error(`${toId} does not border ${fromId}`);
  if (troops <= 0) throw new Error("must march at least one soldier");
  if (troops > from.troops) throw new Error("not enough troops to march");

  const me = currentPlayer(s).id;
  const to = s.provinces[toId];

  // Friendly move: simple reinforcement.
  if (to.ownerId === me) {
    const next = cloneState(s);
    next.provinces[fromId].troops -= troops;
    next.provinces[toId].troops += troops;
    next.commandPointsRemaining--;
    return log(next, me, `Reinforces ${province(next, toId)} with ${troops} troops.`);
  }

  // Hostile move: battle.
  const attackerOfficer = leadOfficer(s, fromId, me);
  const defenderOfficer = to.ownerId ? leadOfficer(s, toId, to.ownerId) : undefined;
  const attacker: BattleSide = { playerId: me, troops, officer: attackerOfficer };
  const defender: BattleSide = { playerId: to.ownerId, troops: to.troops, officer: defenderOfficer };
  const { result, rngState } = resolveBattle(
    { provinceId: toId, attacker, defender, hasRampart: to.hasRampart, defenderOrder: to.order },
    s.rngState,
  );

  let next = cloneState(s);
  next.rngState = rngState;
  next.provinces[fromId].troops -= troops;

  for (const ev of result.events) {
    if (ev.kind !== "rout" || result.captured) next = log(next, me, ev.message);
  }

  if (result.captured) {
    const prevOwner = to.ownerId;
    const p = next.provinces[toId];
    p.ownerId = me;
    p.troops = Math.max(1, result.attackerTroopsEnd);
    p.order = clamp(Math.round(p.order * 0.6), 10, 100);
    p.hasRampart = false;
    // The victorious officer occupies the captured seat.
    if (attackerOfficer) next.officers.find((o) => o.id === attackerOfficer.id)!.provinceId = toId;
    // Resolve the defending officers.
    for (const off of next.officers) {
      if (off.provinceId === toId && off.ownerId === prevOwner) {
        if (off.id === result.capturedOfficerId) {
          off.ownerId = me; // pressed into service
          off.loyalty = clamp(Math.round(off.loyalty * 0.4), 5, 60);
          next = log(next, me, `${off.name} is captured and joins ${currentPlayer(next).name}!`);
        } else {
          off.ownerId = null; // scatters into the wind
        }
      }
    }
    next = log(next, me, `${currentPlayer(next).name} captures ${province(next, toId)}!`);
    next = checkElimination(next, prevOwner);
  } else {
    // Survivors fall back to the staging province.
    next.provinces[fromId].troops += Math.max(0, result.attackerTroopsEnd);
    next.provinces[toId].troops = Math.max(1, result.defenderTroopsEnd);
    next = log(next, me, `The assault on ${province(next, toId)} is repulsed.`);
  }

  next.commandPointsRemaining--;
  return checkVictory(next);
}

/** End the current warlord's season and hand off. */
export function endTurn(s: GameState): GameState {
  if (s.phase === "gameover") return s;
  let next = cloneState(s);
  const n = next.players.length;
  let idx = next.currentPlayerIndex;
  for (let step = 0; step < n; step++) {
    idx = (idx + 1) % n;
    if (idx <= next.currentPlayerIndex) {
      // wrapped — advance the season (and the year each spring)
    }
    if (!next.players[idx].isEliminated) break;
  }
  // Detect a season/year rollover: we passed the end of the player list.
  if (idx <= next.currentPlayerIndex) {
    const si = SEASONS.indexOf(next.season);
    const nextSeason: Season = SEASONS[(si + 1) % SEASONS.length];
    next.season = nextSeason;
    if (nextSeason === "spring") next.year += 1;
  }
  next.currentPlayerIndex = idx;
  next.turn += 1;
  next = beginTurn(next);
  return checkVictory(next);
}

// ---------------------------------------------------------------------------
// Elimination & victory
// ---------------------------------------------------------------------------

function checkElimination(s: GameState, playerId: string | null): GameState {
  if (!playerId) return s;
  if (provincesOf(s, playerId).length > 0) return s;
  const next = cloneState(s);
  const pl = next.players.find((p) => p.id === playerId);
  if (pl && !pl.isEliminated) {
    pl.isEliminated = true;
    // Their remaining officers scatter.
    for (const o of next.officers) if (o.ownerId === playerId) o.ownerId = null;
    return log(next, playerId, `${pl.name} is destroyed.`);
  }
  return next;
}

function checkVictory(s: GameState): GameState {
  const alive = s.players.filter((p) => !p.isEliminated);
  if (alive.length === 1) {
    return { ...log(s, alive[0].id, `${alive[0].name} unifies the realm!`), phase: "gameover", winnerId: alive[0].id };
  }
  // Hegemony: a commanding lead in provinces over the nearest rival.
  const total = s.map.provinces.length;
  const need = Math.ceil(total * CONFIG.victory.dominationFraction);
  const counts = alive
    .map((p) => ({ id: p.id, name: p.name, n: provincesOf(s, p.id).length }))
    .sort((a, b) => b.n - a.n);
  const top = counts[0];
  const rival = counts[1]?.n ?? 0;
  if (top.n >= need && top.n >= CONFIG.victory.leadMultiple * rival) {
    return { ...log(s, top.id, `${top.name} commands the realm and is declared hegemon!`), phase: "gameover", winnerId: top.id };
  }
  return s;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function province(s: GameState, id: string): string {
  return s.map.provinces.find((p) => p.id === id)?.name ?? id;
}
