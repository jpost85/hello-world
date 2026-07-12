/**
 * The game state machine: setup, the seasonal command loop, and every public
 * action a warlord can take. Mirrors the Dominion branch's `game.ts` — pure
 * functions that validate preconditions, throw a descriptive `Error` on misuse,
 * and return a brand-new `GameState`. The UI and the AI call the *same* actions.
 *
 * Turn lifecycle (the RoTK reshaping of Dominion's reinforce→attack→fortify):
 *   beginTurn  → grain harvest & supply, defections, refresh command points
 *   command    → develop / cultivate / train / recruit / fortify / scheme /
 *                march / recruit-officer / prisoner & diplomacy actions
 *   endTurn    → expire lapsed pacts, hand off; after the last warlord the
 *                season (and, each spring, the year) advances
 */
import { CONFIG, typeMatchup } from "./config.ts";
import { resolveBattle, type BattleSide } from "./battle.ts";
import { effectiveStats, hasTrait, ITEMS } from "./items.ts";
import { nextFloat, seedRng } from "./rng.ts";
import { buildOfficers, DEFAULT_SCENARIO, type Scenario } from "./scenario.ts";
import {
  SEASONS,
  type GameMap,
  type GameState,
  type Officer,
  type PactKind,
  type Player,
  type ProvinceState,
  type Season,
  type UnitType,
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
    const held = !!owner[prov.id];
    provinces[prov.id] = {
      ownerId: owner[prov.id] ?? null,
      troops: held ? s.troops : Math.round(s.troops * 0.4),
      garrisonType: scenario.garrisonTypes?.[prov.id] ?? "spearmen",
      morale: s.morale,
      training: s.training,
      gold: s.gold,
      food: s.food,
      population: s.population,
      order: s.order,
      commerce: s.commerce,
      agriculture: s.agriculture,
      wallLevel: s.wallLevel,
    };
  }

  const officers = buildOfficers(scenario);

  const state: GameState = {
    map,
    factions: scenario.factions,
    players,
    provinces,
    officers,
    items: ITEMS,
    pacts: [],
    relations: {},
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
    pacts: s.pacts.map((p) => ({ ...p })),
    relations: { ...s.relations },
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

/** Officers actively serving a player in a province (alive, not captive). */
function servingIn(s: GameState, provinceId: string, ownerId: string): Officer[] {
  return s.officers.filter((o) => o.alive && o.ownerId === ownerId && o.provinceId === provinceId);
}

/** The lead officer (highest effective WAR) a player has in a province, if any. */
export function leadOfficer(s: GameState, provinceId: string, ownerId: string): Officer | undefined {
  return servingIn(s, provinceId, ownerId).sort((a, b) => effectiveStats(b).war - effectiveStats(a).war)[0];
}

/** Best officer by an effective stat that a player has in a province. */
function bestBy(s: GameState, provinceId: string, ownerId: string, stat: keyof ReturnType<typeof effectiveStats>): Officer | undefined {
  return servingIn(s, provinceId, ownerId).sort((a, b) => effectiveStats(b)[stat] - effectiveStats(a)[stat])[0];
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
// Diplomacy helpers
// ---------------------------------------------------------------------------

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

export function relationOf(s: GameState, a: string, b: string): number {
  return s.relations[pairKey(a, b)] ?? 0;
}

function adjustRelation(s: GameState, a: string, b: string, delta: number): void {
  const k = pairKey(a, b);
  s.relations[k] = clamp((s.relations[k] ?? 0) + delta, -100, 100);
}

export function areAllied(s: GameState, a: string, b: string): boolean {
  return s.pacts.some((p) => p.kind === "alliance" && pairKey(p.a, p.b) === pairKey(a, b));
}

export function inCeasefire(s: GameState, a: string, b: string): boolean {
  return s.pacts.some(
    (p) => p.kind === "ceasefire" && pairKey(p.a, p.b) === pairKey(a, b) && (p.untilTurn === null || p.untilTurn > s.turn),
  );
}

/** True if a pact forbids `a` from attacking `b`. */
export function atPeace(s: GameState, a: string, b: string): boolean {
  return areAllied(s, a, b) || inCeasefire(s, a, b);
}

function isWaterCrossing(s: GameState, a: string, b: string): boolean {
  return (s.map.connectors ?? []).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

// ---------------------------------------------------------------------------
// Seasonal economy, supply & defections
// ---------------------------------------------------------------------------

function beginTurn(s: GameState): GameState {
  const player = currentPlayer(s);
  const next = cloneState(s);
  const e = CONFIG.economy;
  for (const id of provincesOf(next, player.id)) {
    const p = next.provinces[id];
    // Gold tax from commerce and order.
    p.gold += Math.round((p.commerce / 10) * (p.order / 100) * e.goldPerCommerce);
    // Grain: a trickle each season, a bounty at the autumn harvest.
    const harvest = next.season === "autumn" ? e.harvestMultiplier : 1;
    p.food += Math.round(p.agriculture * (p.order / 100) * e.foodPerAgriculture * harvest);
    // Army upkeep draws grain; a shortfall starves the garrison.
    p.food -= Math.round((p.troops / 1000) * e.foodPerThousandTroops);
    if (p.food < 0) {
      p.food = 0;
      p.troops = Math.round(p.troops * (1 - e.starvationDesertion));
      p.order = clamp(p.order - e.starvationOrderLoss, 0, 100);
      p.morale = clamp(p.morale - e.starvationMoraleLoss, 0, 100);
    } else {
      // Fed troops recover morale toward a ceiling set by public order.
      const ceiling = p.order * e.moraleFromOrder;
      const dir = Math.sign(ceiling - p.morale);
      p.morale = clamp(p.morale + dir * e.moraleDriftPerSeason, 0, 100);
    }
    // Order drifts toward its resting point.
    const dir = Math.sign(e.orderRestingPoint - p.order);
    p.order = clamp(p.order + dir * e.orderDriftPerSeason, 0, 100);
  }

  // Disloyal officers may defect (the lord himself never does).
  const oc = CONFIG.officers;
  for (const off of next.officers) {
    if (!off.alive || off.ownerId !== player.id || off.id === player.id) continue;
    if (off.loyalty >= oc.defectionLoyalty) continue;
    const r = nextFloat(next.rngState);
    next.rngState = r.state;
    if (r.value < oc.defectionChance * (1 - off.loyalty / oc.defectionLoyalty)) {
      off.ownerId = null; // slips away into the wider realm
      next.events.push({ turn: next.turn, playerId: player.id, message: `${off.name} deserts ${player.name}!` });
    }
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
// Domestic commands (each costs one command point)
// ---------------------------------------------------------------------------

/** Invest in a province's commerce (gold income) and public order. */
export function develop(s: GameState, provinceId: string): GameState {
  requireCommand(s);
  requireOwned(s, provinceId);
  const cfg = CONFIG.develop;
  if (s.provinces[provinceId].gold < cfg.goldCost) throw new Error("not enough gold to develop");
  const next = cloneState(s);
  const p = next.provinces[provinceId];
  const admin = bestBy(next, provinceId, currentPlayer(next).id, "politics");
  const adminBonus = hasTrait(admin, "administrator") ? 1.3 : 1;
  const bonus = (admin ? 1 + cfg.politicsScale * (effectiveStats(admin).politics / 100) : 1) * adminBonus;
  p.gold -= cfg.goldCost;
  p.commerce = clamp(p.commerce + Math.round(cfg.gain * bonus), 0, 100);
  p.order = clamp(p.order + cfg.orderGain, 0, 100);
  next.commandPointsRemaining--;
  return log(next, currentPlayer(next).id, `Develops commerce in ${province(next, provinceId)}.`);
}

/** Invest in a province's agriculture (grain income). */
export function cultivate(s: GameState, provinceId: string): GameState {
  requireCommand(s);
  requireOwned(s, provinceId);
  const cfg = CONFIG.cultivate;
  if (s.provinces[provinceId].gold < cfg.goldCost) throw new Error("not enough gold to cultivate");
  const next = cloneState(s);
  const p = next.provinces[provinceId];
  const admin = bestBy(next, provinceId, currentPlayer(next).id, "politics");
  const farmBonus = hasTrait(admin, "farmer") ? 1.3 : 1;
  const bonus = (admin ? 1 + cfg.politicsScale * (effectiveStats(admin).politics / 100) : 1) * farmBonus;
  p.gold -= cfg.goldCost;
  p.agriculture = clamp(p.agriculture + Math.round(cfg.gain * bonus), 0, 100);
  next.commandPointsRemaining--;
  return log(next, currentPlayer(next).id, `Cultivates farmland in ${province(next, provinceId)}.`);
}

/** Drill the garrison, raising troop training. */
export function train(s: GameState, provinceId: string): GameState {
  requireCommand(s);
  requireOwned(s, provinceId);
  const cfg = CONFIG.train;
  if (s.provinces[provinceId].gold < cfg.goldCost) throw new Error("not enough gold to train");
  const next = cloneState(s);
  const p = next.provinces[provinceId];
  const drill = leadOfficer(next, provinceId, currentPlayer(next).id);
  const bonus = drill ? 1 + cfg.leadershipScale * (effectiveStats(drill).leadership / 100) : 1;
  p.training = clamp(p.training + Math.round(cfg.gain * bonus), 0, 100);
  p.gold -= cfg.goldCost;
  next.commandPointsRemaining--;
  return log(next, currentPlayer(next).id, `Drills the troops in ${province(next, provinceId)}.`);
}

/** Draft soldiers from the population (optionally as a chosen branch). */
export function recruit(s: GameState, provinceId: string, type?: UnitType): GameState {
  requireCommand(s);
  requireOwned(s, provinceId);
  const cfg = CONFIG.recruit;
  const p0 = s.provinces[provinceId];
  if (p0.gold < cfg.goldCost) throw new Error("not enough gold to recruit");
  if (p0.population < cfg.populationCost) throw new Error("not enough population to recruit");
  const next = cloneState(s);
  const p = next.provinces[provinceId];
  const newType = type ?? p.garrisonType;
  // Raw conscripts dilute the garrison's training and morale.
  const before = p.troops;
  const after = before + cfg.troopsGained;
  p.training = Math.round((p.training * before + cfg.rawTraining * cfg.troopsGained) / after);
  p.morale = Math.round((p.morale * before + cfg.rawMorale * cfg.troopsGained) / after);
  p.troops = after;
  p.garrisonType = cfg.troopsGained > before ? newType : p.garrisonType;
  p.gold -= cfg.goldCost;
  p.population -= cfg.populationCost;
  p.order = clamp(p.order - cfg.orderCost, 0, 100);
  next.commandPointsRemaining--;
  return log(next, currentPlayer(next).id, `Recruits ${cfg.troopsGained} ${newType} in ${province(next, provinceId)}.`);
}

/** Raise the province wall by one level. */
export function fortify(s: GameState, provinceId: string): GameState {
  requireCommand(s);
  requireOwned(s, provinceId);
  const p0 = s.provinces[provinceId];
  if (p0.wallLevel >= CONFIG.fortify.maxLevel) throw new Error("walls already at maximum");
  const cost = CONFIG.fortify.goldCostPerLevel;
  if (p0.gold < cost) throw new Error("not enough gold to fortify");
  const next = cloneState(s);
  const p = next.provinces[provinceId];
  p.gold -= cost;
  p.wallLevel += 1;
  next.commandPointsRemaining--;
  return log(next, currentPlayer(next).id, `Raises the walls of ${province(next, provinceId)} to level ${p.wallLevel}.`);
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
  const borders = adjacent.filter((x) => myProvs.includes(x));
  if (!borders.length) throw new Error("no province of yours borders the target");
  // Strongest available schemer across the bordering provinces.
  let schemer: Officer | undefined;
  for (const a of borders) {
    const o = bestBy(s, a, me, "intellect");
    if (o && (!schemer || effectiveStats(o).intellect > effectiveStats(schemer).intellect)) schemer = o;
  }
  const payer = myProvs.find((id) => s.provinces[id].gold >= CONFIG.scheme.goldCost);
  if (!payer) throw new Error("not enough gold to scheme");
  const next = cloneState(s);
  next.provinces[payer].gold -= CONFIG.scheme.goldCost;
  const intel = schemer ? effectiveStats(schemer).intellect : 40;
  const strat = hasTrait(schemer, "strategist") ? CONFIG.scheme.strategistMultiplier : 1;
  const damage = Math.round(CONFIG.scheme.baseOrderDamage * (intel / 100) * strat * (1 + (100 - target.order) / 200));
  next.provinces[targetProvinceId].order = clamp(next.provinces[targetProvinceId].order - damage, 0, 100);
  next.commandPointsRemaining--;
  return log(next, me, `Foments unrest in ${province(next, targetProvinceId)} (-${damage} order).`);
}

// ---------------------------------------------------------------------------
// Marching & battle
// ---------------------------------------------------------------------------

/**
 * March troops from one of your provinces to an adjacent one. Into your own
 * land it reinforces; into hostile land it triggers a supplied battle.
 */
export function march(s: GameState, fromId: string, toId: string, troops: number): GameState {
  requireCommand(s);
  requireOwned(s, fromId);
  const from = s.provinces[fromId];
  const toMap = s.map.provinces.find((p) => p.id === toId);
  if (!toMap) throw new Error(`unknown province: ${toId}`);
  if (!s.map.provinces.find((p) => p.id === fromId)?.adjacentTo.includes(toId))
    throw new Error(`${toId} does not border ${fromId}`);
  if (troops <= 0) throw new Error("must march at least one soldier");
  if (troops > from.troops) throw new Error("not enough troops to march");

  const me = currentPlayer(s).id;
  const to = s.provinces[toId];

  // Friendly move: simple reinforcement (the larger body sets the branch).
  if (to.ownerId === me) {
    const next = cloneState(s);
    const f = next.provinces[fromId];
    const t = next.provinces[toId];
    if (troops > t.troops) t.garrisonType = f.garrisonType;
    t.morale = Math.round((t.morale * t.troops + f.morale * troops) / (t.troops + troops));
    t.training = Math.round((t.training * t.troops + f.training * troops) / (t.troops + troops));
    f.troops -= troops;
    t.troops += troops;
    next.commandPointsRemaining--;
    return log(next, me, `Reinforces ${province(next, toId)} with ${troops} troops.`);
  }

  // Diplomacy forbids attacking a sworn friend.
  if (to.ownerId && atPeace(s, me, to.ownerId)) throw new Error(`you are bound by a pact with ${playerName(s, to.ownerId)}`);

  // Campaign supply: the column draws grain from its staging province.
  const foodNeed = Math.round((troops / 1000) * CONFIG.march.foodPerThousandTroops);
  const supply = foodNeed > 0 ? clamp(from.food / foodNeed, 0, 1) : 1;
  const supplyMorale = Math.round(from.morale * (CONFIG.march.minSupplyMorale + (1 - CONFIG.march.minSupplyMorale) * supply));

  const attackerOfficer = leadOfficer(s, fromId, me);
  const defenderOfficer = to.ownerId ? leadOfficer(s, toId, to.ownerId) : undefined;
  const attacker: BattleSide = { playerId: me, troops, officer: attackerOfficer, unitType: from.garrisonType, morale: supplyMorale, training: from.training };
  const defender: BattleSide = { playerId: to.ownerId, troops: to.troops, officer: defenderOfficer, unitType: to.garrisonType, morale: to.morale, training: to.training };
  const { result, rngState } = resolveBattle(
    { provinceId: toId, attacker, defender, defenderWallLevel: to.wallLevel, defenderOrder: to.order, waterCrossing: isWaterCrossing(s, fromId, toId) },
    s.rngState,
  );

  let next = cloneState(s);
  next.rngState = rngState;
  next.provinces[fromId].troops -= troops;
  next.provinces[fromId].food = Math.max(0, next.provinces[fromId].food - Math.min(foodNeed, from.food));
  if (supply < 0.999) next = log(next, me, `The march on ${province(next, toId)} outruns its supply lines.`);

  for (const ev of result.events) {
    if (ev.kind !== "rout" || result.captured) next = log(next, me, ev.message);
  }

  if (result.captured) {
    const prevOwner = to.ownerId;
    const p = next.provinces[toId];
    p.ownerId = me;
    p.troops = Math.max(1, result.attackerTroopsEnd);
    p.garrisonType = from.garrisonType;
    p.morale = clamp(Math.round(supplyMorale * 0.9), 10, 100);
    p.training = from.training;
    p.order = clamp(Math.round(p.order * 0.6), 10, 100);
    p.wallLevel = 0; // walls are stormed in the taking
    if (attackerOfficer) next.officers.find((o) => o.id === attackerOfficer.id)!.provinceId = toId;
    // Resolve the defending officers.
    for (const off of next.officers) {
      if (off.alive && off.provinceId === toId && off.ownerId === prevOwner) {
        if (off.id === result.capturedOfficerId) {
          off.ownerId = null;
          off.captiveOf = me; // taken prisoner — recruit, release, or execute later
          off.loyalty = clamp(Math.round(off.loyalty * 0.4), 5, 50);
          next = log(next, me, `${off.name} is taken prisoner!`);
        } else {
          off.ownerId = null; // scatters into the wind
        }
      }
    }
    next = log(next, me, `${currentPlayer(next).name} captures ${province(next, toId)}!`);
    if (prevOwner) adjustRelation(next, me, prevOwner, -15);
    next = checkElimination(next, prevOwner);
  } else {
    // Survivors fall back to the staging province.
    next.provinces[fromId].troops += Math.max(0, result.attackerTroopsEnd);
    next.provinces[toId].troops = Math.max(1, result.defenderTroopsEnd);
    next.provinces[toId].morale = clamp(next.provinces[toId].morale - 6, 0, 100);
    if (to.ownerId) adjustRelation(next, me, to.ownerId, -8);
    next = log(next, me, `The assault on ${province(next, toId)} is repulsed.`);
  }

  next.commandPointsRemaining--;
  return checkVictory(next);
}

// ---------------------------------------------------------------------------
// Officer management (recruiting, prisoners)
// ---------------------------------------------------------------------------

/** A wandering hero or a prisoner you hold, present in a province you own. */
export function recruitableIn(s: GameState, provinceId: string, playerId: string): Officer[] {
  if (s.provinces[provinceId]?.ownerId !== playerId) return [];
  return s.officers.filter(
    (o) => o.alive && o.provinceId === provinceId && (((o.ownerId === null && o.captiveOf === null)) || o.captiveOf === playerId),
  );
}

/** Persuade a wandering hero or a prisoner to enter your service. */
export function recruitOfficer(s: GameState, provinceId: string, officerId: string): GameState {
  requireCommand(s);
  requireOwned(s, provinceId);
  const me = currentPlayer(s).id;
  const target = s.officers.find((o) => o.id === officerId);
  if (!target || !target.alive) throw new Error("no such officer");
  const isCaptive = target.captiveOf === me;
  const isWanderer = target.ownerId === null && target.captiveOf === null;
  if (target.provinceId !== provinceId || (!isCaptive && !isWanderer)) throw new Error("that officer cannot be recruited here");
  const persuader = bestBy(s, provinceId, me, "charisma");
  const payer = provincesOf(s, me).find((id) => s.provinces[id].gold >= CONFIG.officers.recruitGoldCost);
  if (!payer) throw new Error("not enough gold to send gifts");

  const oc = CONFIG.officers;
  const cha = persuader ? effectiveStats(persuader).charisma : 40;
  let chance: number = oc.recruitBase;
  chance += (oc.recruitCharismaScale * (cha - 50)) / 100;
  chance -= (oc.recruitCharismaScale * (target.loyalty - 50)) / 100;
  if (isCaptive) chance += 0.2;
  if (hasTrait(persuader, "orator")) chance += 0.15;
  chance = clamp(chance, 0.05, 0.95);

  const next = cloneState(s);
  next.provinces[payer].gold -= oc.recruitGoldCost;
  const r = nextFloat(next.rngState);
  next.rngState = r.state;
  next.commandPointsRemaining--;
  const o = next.officers.find((x) => x.id === officerId)!;
  if (r.value < chance) {
    o.ownerId = me;
    o.captiveOf = null;
    o.loyalty = oc.recruitedLoyalty;
    return log(next, me, `${o.name} enters the service of ${playerName(next, me)}!`);
  }
  return log(next, me, `${o.name} spurns ${playerName(next, me)}'s overtures.`);
}

/** Free a prisoner — a show of virtue that mends your wider reputation. */
export function releasePrisoner(s: GameState, officerId: string): GameState {
  const me = currentPlayer(s).id;
  const target = s.officers.find((o) => o.id === officerId);
  if (!target || target.captiveOf !== me) throw new Error("you do not hold that prisoner");
  const next = cloneState(s);
  const o = next.officers.find((x) => x.id === officerId)!;
  o.captiveOf = null;
  o.ownerId = null; // returns to the wandering life
  for (const pl of next.players) if (pl.id !== me && !pl.isEliminated) adjustRelation(next, me, pl.id, Math.round(CONFIG.officers.releaseRelationsGain / 2));
  return log(next, me, `${playerName(next, me)} releases ${o.name} unharmed.`);
}

/** Execute a prisoner — decisive, but it hardens every rival against you. */
export function executePrisoner(s: GameState, officerId: string): GameState {
  const me = currentPlayer(s).id;
  const target = s.officers.find((o) => o.id === officerId);
  if (!target || target.captiveOf !== me) throw new Error("you do not hold that prisoner");
  const next = cloneState(s);
  const o = next.officers.find((x) => x.id === officerId)!;
  o.alive = false;
  o.captiveOf = null;
  o.ownerId = null;
  o.provinceId = null;
  for (const pl of next.players) if (pl.id !== me && !pl.isEliminated) adjustRelation(next, me, pl.id, -CONFIG.officers.executeRelationsHit);
  return log(next, me, `${playerName(next, me)} executes ${o.name}.`);
}

/**
 * Reassign one of your serving officers to another province you hold — the RoTK
 * staple of posting your best general to the front or your finest administrator
 * to a rich city. Instant across the realm for one command point.
 */
export function deployOfficer(s: GameState, officerId: string, toProvinceId: string): GameState {
  requireCommand(s);
  const me = currentPlayer(s).id;
  const off = s.officers.find((o) => o.id === officerId);
  if (!off || !off.alive) throw new Error("no such officer");
  if (off.ownerId !== me || off.captiveOf) throw new Error("that officer does not serve you");
  const to = s.provinces[toProvinceId];
  if (!to) throw new Error(`unknown province: ${toProvinceId}`);
  if (to.ownerId !== me) throw new Error("you must hold the destination province");
  if (off.provinceId === toProvinceId) throw new Error(`${off.name} is already stationed there`);
  const next = cloneState(s);
  next.officers.find((o) => o.id === officerId)!.provinceId = toProvinceId;
  next.commandPointsRemaining--;
  return log(next, me, `${off.name} is posted to ${province(next, toProvinceId)}.`);
}

// ---------------------------------------------------------------------------
// Diplomacy actions
// ---------------------------------------------------------------------------

/** Propose an alliance or a ceasefire; AI accepts if relations are warm enough. */
export function proposePact(s: GameState, targetPlayerId: string, kind: PactKind): GameState {
  requireCommand(s);
  const me = currentPlayer(s).id;
  if (targetPlayerId === me) throw new Error("cannot make a pact with yourself");
  const target = s.players.find((p) => p.id === targetPlayerId);
  if (!target || target.isEliminated) throw new Error("no such warlord");
  if (kind === "alliance" && areAllied(s, me, targetPlayerId)) throw new Error("already allied");
  if (kind === "ceasefire" && inCeasefire(s, me, targetPlayerId)) throw new Error("already at ceasefire");

  const next = cloneState(s);
  next.commandPointsRemaining--;
  const threshold = kind === "alliance" ? CONFIG.diplomacy.allianceThreshold : CONFIG.diplomacy.ceasefireThreshold;
  const accepts = relationOf(next, me, targetPlayerId) >= threshold;
  adjustRelation(next, me, targetPlayerId, CONFIG.diplomacy.pactRelationsGain);
  if (!accepts) return log(next, me, `${playerName(next, targetPlayerId)} rebuffs the ${kind} offer.`);
  const [a, b] = [me, targetPlayerId].sort();
  next.pacts.push({ a, b, kind, untilTurn: kind === "ceasefire" ? next.turn + CONFIG.diplomacy.ceasefireTurns : null });
  return log(next, me, `${playerName(next, me)} and ${playerName(next, targetPlayerId)} agree to a ${kind}.`);
}

/** Tear up a pact — frees your hand, but rivals remember the betrayal. */
export function breakPact(s: GameState, targetPlayerId: string): GameState {
  const me = currentPlayer(s).id;
  const had = s.pacts.some((p) => pairKey(p.a, p.b) === pairKey(me, targetPlayerId));
  if (!had) throw new Error("no pact to break");
  const next = cloneState(s);
  next.pacts = next.pacts.filter((p) => pairKey(p.a, p.b) !== pairKey(me, targetPlayerId));
  adjustRelation(next, me, targetPlayerId, -25);
  return log(next, me, `${playerName(next, me)} breaks faith with ${playerName(next, targetPlayerId)}.`);
}

// ---------------------------------------------------------------------------
// Turn hand-off
// ---------------------------------------------------------------------------

export function endTurn(s: GameState): GameState {
  if (s.phase === "gameover") return s;
  let next = cloneState(s);
  // Expire lapsed ceasefires.
  next.pacts = next.pacts.filter((p) => p.untilTurn === null || p.untilTurn > next.turn);

  const n = next.players.length;
  let idx = next.currentPlayerIndex;
  for (let step = 0; step < n; step++) {
    idx = (idx + 1) % n;
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
    // Their officers scatter; any prisoners they held go free.
    for (const o of next.officers) {
      if (o.ownerId === playerId) o.ownerId = null;
      if (o.captiveOf === playerId) o.captiveOf = null;
    }
    // Pacts with the fallen lapse.
    next.pacts = next.pacts.filter((p) => p.a !== playerId && p.b !== playerId);
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
  // Backstop: a far-horizon time limit decides a deadlocked realm by size.
  if (s.turn >= CONFIG.victory.turnLimit) {
    const byMight = alive
      .map((p) => ({ id: p.id, name: p.name, n: provincesOf(s, p.id).length, troops: provincesOf(s, p.id).reduce((t, id) => t + s.provinces[id].troops, 0) }))
      .sort((a, b) => b.n - a.n || b.troops - a.troops);
    const w = byMight[0];
    return { ...log(s, w.id, `The chronicle closes; ${w.name} holds the most of the realm.`), phase: "gameover", winnerId: w.id };
  }
  return s;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function province(s: GameState, id: string): string {
  return s.map.provinces.find((p) => p.id === id)?.name ?? id;
}

function playerName(s: GameState, id: string): string {
  return s.players.find((p) => p.id === id)?.name ?? id;
}

// Re-export so the AI can reason about branch matchups without reaching into config.
export { typeMatchup };
