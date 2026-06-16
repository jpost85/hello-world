/**
 * Game state machine.
 *
 * Every exported action is a pure function: it takes the current `GameState`
 * (and arguments) and returns a *new* state, never mutating the input. Invalid
 * actions throw with a descriptive message so the UI can guard against them.
 *
 * Turn structure per player: reinforce -> attack -> fortify -> (next player).
 */

import { resolveRound } from "./combat.ts";
import { CONFIG } from "./config.ts";
import {
  baseReinforcements,
  connectedByOwnership,
  getTerritory,
  regionBonus,
  territoriesOf,
} from "./map.ts";
import { nextFloat, seedRng } from "./rng.ts";
import type {
  AttackResult,
  AttackStyle,
  DefenseStyle,
  Faction,
  GameEvent,
  GameMap,
  GameState,
  General,
  Player,
  TerritoryState,
} from "./types.ts";

/** Armies each player starts with, by player count (classic conquest-game values). */
const STARTING_ARMIES = CONFIG.startingArmies;

/** Armies removed from a territory's garrison to raise a fortress. */
export const FORTRESS_BUILD_COST = CONFIG.fortress.buildCost;

/** Combat bonus each starting general provides. */
export const DEFAULT_GENERAL_BONUS = CONFIG.generals.combatBonus;

export interface PlayerConfig {
  name: string;
  factionId: string;
  isAI?: boolean;
}

export interface GameConfig {
  map: GameMap;
  factions: Faction[];
  players: PlayerConfig[];
  seed?: number;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function createGame(config: GameConfig): GameState {
  const { map, factions } = config;
  const playerCount = config.players.length;
  if (playerCount < 2 || playerCount > 6) {
    throw new Error("Dominion supports 2 to 6 players");
  }

  const players: Player[] = config.players.map((p, i) => ({
    id: `p${i + 1}`,
    name: p.name,
    factionId: p.factionId,
    isAI: p.isAI ?? false,
    isEliminated: false,
  }));

  let rngState = seedRng(config.seed ?? 0x1a2b3c4d);

  // Shuffle territories, then deal them round-robin so ownership is balanced.
  const shuffled = map.territories.map((t) => t.id);
  rngState = shuffleInPlace(shuffled, rngState);

  const territories: Record<string, TerritoryState> = {};
  shuffled.forEach((id, i) => {
    territories[id] = {
      ownerId: players[i % playerCount].id,
      armies: 1,
      hasFortress: false,
    };
  });

  // Distribute the remaining starting armies onto each player's territories.
  const startingArmies = STARTING_ARMIES[playerCount];
  for (const player of players) {
    const owned = Object.keys(territories).filter(
      (id) => territories[id].ownerId === player.id,
    );
    let remaining = startingArmies - owned.length;
    while (remaining > 0) {
      const draw = nextFloat(rngState);
      rngState = draw.state;
      const target = owned[Math.floor(draw.value * owned.length)];
      territories[target].armies++;
      remaining--;
    }
  }

  // Deploy one general per player on their most-garrisoned territory.
  const generals: General[] = players.map((player, i) => {
    const owned = Object.keys(territories).filter(
      (id) => territories[id].ownerId === player.id,
    );
    const home = owned.reduce((best, id) =>
      territories[id].armies > territories[best].armies ? id : best,
    );
    return {
      id: `g${i + 1}`,
      ownerId: player.id,
      name: `General ${player.name}`,
      territoryId: home,
      combatBonus: DEFAULT_GENERAL_BONUS,
    };
  });

  const state: GameState = {
    map,
    factions,
    players,
    territories,
    generals,
    turn: 1,
    currentPlayerIndex: 0,
    phase: "reinforce",
    reinforcementsRemaining: 0,
    conqueredThisTurn: false,
    rngState,
    events: [],
    winnerId: null,
  };

  // Grant the first player's opening reinforcements.
  return startReinforcement(state);
}

// ---------------------------------------------------------------------------
// Reinforce phase
// ---------------------------------------------------------------------------

function startReinforcement(state: GameState): GameState {
  const player = currentPlayer(state);
  const amount = baseReinforcements(state, player.id) + regionBonus(state, player.id);
  return {
    ...state,
    phase: "reinforce",
    reinforcementsRemaining: amount,
    conqueredThisTurn: false,
    events: log(state, `${player.name} receives ${amount} reinforcements`),
  };
}

/** Place `count` armies on an owned territory during the reinforce phase. */
export function placeReinforcements(
  state: GameState,
  territoryId: string,
  count: number,
): GameState {
  requirePhase(state, "reinforce");
  if (count <= 0) throw new Error("Must place at least one army");
  if (count > state.reinforcementsRemaining) {
    throw new Error("Not enough reinforcements remaining");
  }
  const ts = state.territories[territoryId];
  if (!ts || ts.ownerId !== currentPlayer(state).id) {
    throw new Error("Can only reinforce territories you own");
  }
  return {
    ...state,
    territories: patchTerritory(state, territoryId, { armies: ts.armies + count }),
    reinforcementsRemaining: state.reinforcementsRemaining - count,
  };
}

/** Spend reinforcements is optional; this advances to the attack phase. */
export function endReinforcement(state: GameState): GameState {
  requirePhase(state, "reinforce");
  return { ...state, phase: "attack" };
}

// ---------------------------------------------------------------------------
// Attack phase
// ---------------------------------------------------------------------------

export interface AttackOptions {
  from: string;
  to: string;
  attackStyle?: AttackStyle;
  defenseStyle?: DefenseStyle;
  /** Armies to advance into a captured territory (defaults to attacker dice). */
  advance?: number;
}

/**
 * Resolve a single round of combat between two adjacent territories. Returns the
 * new state and a result describing the dice and casualties. If the defender is
 * wiped out the territory is captured and armies advance in.
 */
export function attack(
  state: GameState,
  opts: AttackOptions,
): { state: GameState; result: AttackResult } {
  requirePhase(state, "attack");
  const attacker = currentPlayer(state);
  const fromTs = state.territories[opts.from];
  const toTs = state.territories[opts.to];

  if (!fromTs || fromTs.ownerId !== attacker.id) {
    throw new Error("You must attack from a territory you own");
  }
  if (!toTs || toTs.ownerId === attacker.id) {
    throw new Error("You must attack a territory you do not own");
  }
  if (!getTerritory(state.map, opts.from).adjacentTo.includes(opts.to)) {
    throw new Error("Territories are not adjacent");
  }
  if (fromTs.armies < 2) {
    throw new Error("Need at least 2 armies to attack");
  }

  const { round, rngState } = resolveRound({
    attackerArmies: fromTs.armies,
    defenderArmies: toTs.armies,
    attackStyle: opts.attackStyle ?? "standard",
    defenseStyle: opts.defenseStyle ?? "standard",
    attackerGeneralBonus: generalBonusAt(state, opts.from, attacker.id),
    defenderGeneralBonus: generalBonusAt(state, opts.to, toTs.ownerId ?? ""),
    defenderHasFortress: toTs.hasFortress,
    rngState: state.rngState,
  });

  const newFromArmies = fromTs.armies - round.attackerLosses;
  const newToArmies = toTs.armies - round.defenderLosses;

  let next: GameState = { ...state, rngState };
  let captured = false;

  if (newToArmies <= 0) {
    // Territory falls. Advance armies (at least the dice rolled, at most all but one).
    captured = true;
    const diceUsed = round.attackerDice.length;
    const maxAdvance = newFromArmies - 1;
    const advance = clamp(opts.advance ?? diceUsed, diceUsed, Math.max(diceUsed, maxAdvance));
    const moveIn = Math.min(advance, maxAdvance);

    next = {
      ...next,
      territories: {
        ...next.territories,
        [opts.from]: { ...fromTs, armies: newFromArmies - moveIn },
        [opts.to]: {
          ownerId: attacker.id,
          armies: moveIn,
          hasFortress: false, // a captured fortress is razed
        },
      },
      conqueredThisTurn: true,
    };
    next = { ...next, events: log(next, `${attacker.name} captured ${territoryName(state, opts.to)}`) };

    // A general caught in an overrun territory is captured and leaves the board.
    const fallen = next.generals.find(
      (g) => g.territoryId === opts.to && g.ownerId === toTs.ownerId,
    );
    if (fallen) {
      next = {
        ...next,
        generals: next.generals.map((g) =>
          g.id === fallen.id ? { ...g, territoryId: null } : g,
        ),
        events: log(next, `${fallen.name} was captured at ${territoryName(state, opts.to)}`),
      };
    }

    next = checkElimination(next, toTs.ownerId!);
    next = checkVictory(next);
  } else {
    next = {
      ...next,
      territories: {
        ...next.territories,
        [opts.from]: { ...fromTs, armies: newFromArmies },
        [opts.to]: { ...toTs, armies: newToArmies },
      },
    };
  }

  const result: AttackResult = {
    round,
    captured,
    attackerArmiesRemaining: next.territories[opts.from].armies,
    defenderArmiesRemaining: captured ? 0 : newToArmies,
  };
  return { state: next, result };
}

export function endAttack(state: GameState): GameState {
  requirePhase(state, "attack");
  return { ...state, phase: "fortify" };
}

// ---------------------------------------------------------------------------
// Fortify phase
// ---------------------------------------------------------------------------

/** Move armies between two connected territories you own (one move per turn). */
export function fortify(
  state: GameState,
  from: string,
  to: string,
  count: number,
): GameState {
  requirePhase(state, "fortify");
  const player = currentPlayer(state);
  const fromTs = state.territories[from];
  const toTs = state.territories[to];
  if (!fromTs || fromTs.ownerId !== player.id || !toTs || toTs.ownerId !== player.id) {
    throw new Error("Both territories must be yours");
  }
  if (count <= 0 || count > fromTs.armies - 1) {
    throw new Error("Must leave at least one army behind");
  }
  if (!connectedByOwnership(state, player.id, from, to)) {
    throw new Error("Territories are not connected through your land");
  }
  let next: GameState = {
    ...state,
    territories: {
      ...state.territories,
      [from]: { ...fromTs, armies: fromTs.armies - count },
      [to]: { ...toTs, armies: toTs.armies + count },
    },
  };
  next = { ...next, events: log(next, `${player.name} moved ${count} armies to ${territoryName(state, to)}`) };
  return next;
}

/** End the current player's turn and hand off to the next active player. */
export function endTurn(state: GameState): GameState {
  if (state.phase === "gameover") return state;
  const count = state.players.length;
  let idx = state.currentPlayerIndex;
  let turn = state.turn;
  do {
    idx = (idx + 1) % count;
    if (idx === 0) turn++;
  } while (state.players[idx].isEliminated);

  const advanced: GameState = { ...state, currentPlayerIndex: idx, turn };
  return startReinforcement(advanced);
}

// ---------------------------------------------------------------------------
// Generals & fortresses
// ---------------------------------------------------------------------------

/**
 * Reposition a general to another territory the owner controls, connected
 * through owned land. Allowed during the reinforce or fortify phase.
 */
export function moveGeneral(
  state: GameState,
  generalId: string,
  toTerritoryId: string,
): GameState {
  if (state.phase !== "reinforce" && state.phase !== "fortify") {
    throw new Error("Generals can only be repositioned in reinforce or fortify");
  }
  const general = state.generals.find((g) => g.id === generalId);
  if (!general) throw new Error("Unknown general");
  const player = currentPlayer(state);
  if (general.ownerId !== player.id) throw new Error("Not your general");

  const dest = state.territories[toTerritoryId];
  if (!dest || dest.ownerId !== player.id) {
    throw new Error("Generals can only move to territory you own");
  }
  if (
    general.territoryId &&
    general.territoryId !== toTerritoryId &&
    !connectedByOwnership(state, player.id, general.territoryId, toTerritoryId)
  ) {
    throw new Error("Destination is not connected through your land");
  }

  const generals = state.generals.map((g) =>
    g.id === generalId ? { ...g, territoryId: toTerritoryId } : g,
  );
  return {
    ...state,
    generals,
    events: log(state, `${general.name} redeployed to ${territoryName(state, toTerritoryId)}`),
  };
}

/** Raise a fortress on an owned territory, paying the build cost in armies. */
export function buildFortress(state: GameState, territoryId: string): GameState {
  if (state.phase !== "reinforce" && state.phase !== "fortify") {
    throw new Error("Fortresses can only be built in reinforce or fortify");
  }
  const player = currentPlayer(state);
  const ts = state.territories[territoryId];
  if (!ts || ts.ownerId !== player.id) throw new Error("You must own the territory");
  if (ts.hasFortress) throw new Error("This territory already has a fortress");
  if (ts.armies <= FORTRESS_BUILD_COST) {
    throw new Error(`Need more than ${FORTRESS_BUILD_COST} armies to build a fortress`);
  }
  let next: GameState = {
    ...state,
    territories: patchTerritory(state, territoryId, {
      hasFortress: true,
      armies: ts.armies - FORTRESS_BUILD_COST,
    }),
  };
  next = { ...next, events: log(next, `${player.name} built a fortress at ${territoryName(state, territoryId)}`) };
  return next;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function generalBonusAt(state: GameState, territoryId: string, ownerId: string): number {
  const general = state.generals.find(
    (g) => g.territoryId === territoryId && g.ownerId === ownerId,
  );
  return general ? general.combatBonus : 0;
}

function checkElimination(state: GameState, formerOwnerId: string): GameState {
  if (territoriesOf(state, formerOwnerId).length > 0) return state;
  const players = state.players.map((p) =>
    p.id === formerOwnerId ? { ...p, isEliminated: true } : p,
  );
  // A general whose owner is eliminated leaves the board.
  const generals = state.generals.map((g) =>
    g.ownerId === formerOwnerId ? { ...g, territoryId: null } : g,
  );
  const eliminated = state.players.find((p) => p.id === formerOwnerId);
  return {
    ...state,
    players,
    generals,
    events: log(state, `${eliminated?.name ?? formerOwnerId} has been eliminated`),
  };
}

function checkVictory(state: GameState): GameState {
  const alive = state.players.filter((p) => !p.isEliminated);
  if (alive.length === 1) {
    return {
      ...state,
      phase: "gameover",
      winnerId: alive[0].id,
      events: log(state, `${alive[0].name} wins the game!`),
    };
  }
  return state;
}

function patchTerritory(
  state: GameState,
  id: string,
  patch: Partial<TerritoryState>,
): Record<string, TerritoryState> {
  return { ...state.territories, [id]: { ...state.territories[id], ...patch } };
}

function requirePhase(state: GameState, phase: GameState["phase"]): void {
  if (state.phase !== phase) {
    throw new Error(`Action requires the ${phase} phase (currently ${state.phase})`);
  }
}

function territoryName(state: GameState, id: string): string {
  return getTerritory(state.map, id).name;
}

function log(state: GameState, message: string): GameEvent[] {
  return [
    ...state.events,
    { turn: state.turn, playerId: currentPlayer(state).id, message },
  ];
}

/** Fisher-Yates shuffle driven by the seeded RNG; returns the advanced state. */
function shuffleInPlace<T>(arr: T[], rngState: number): number {
  let s = rngState;
  for (let i = arr.length - 1; i > 0; i--) {
    const draw = nextFloat(s);
    s = draw.state;
    const j = Math.floor(draw.value * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return s;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
