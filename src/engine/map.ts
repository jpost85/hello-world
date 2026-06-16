/** Pure query helpers over a `GameMap` and the dynamic territory state. */

import type { GameMap, GameState, Region, Territory } from "./types.ts";

export function getTerritory(map: GameMap, id: string): Territory {
  const t = map.territories.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown territory: ${id}`);
  return t;
}

export function getRegion(map: GameMap, id: string): Region {
  const r = map.regions.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown region: ${id}`);
  return r;
}

export function areAdjacent(map: GameMap, a: string, b: string): boolean {
  return getTerritory(map, a).adjacentTo.includes(b);
}

/** Territory ids owned by a given player. */
export function territoriesOf(state: GameState, playerId: string): string[] {
  return Object.keys(state.territories).filter(
    (id) => state.territories[id].ownerId === playerId,
  );
}

/** Whether a player controls every territory in a region. */
export function controlsRegion(
  state: GameState,
  playerId: string,
  region: Region,
): boolean {
  return region.territoryIds.every(
    (id) => state.territories[id]?.ownerId === playerId,
  );
}

/** Total bonus armies a player earns this turn from fully-held regions. */
export function regionBonus(state: GameState, playerId: string): number {
  return state.map.regions.reduce(
    (sum, region) =>
      sum + (controlsRegion(state, playerId, region) ? region.bonusArmies : 0),
    0,
  );
}

/**
 * Base reinforcements from territory count: floor(owned / 3), minimum 3 — the
 * classic Risk formula. Region bonuses are added on top by the caller.
 */
export function baseReinforcements(state: GameState, playerId: string): number {
  const count = territoriesOf(state, playerId).length;
  return Math.max(3, Math.floor(count / 3));
}

/**
 * Whether two friendly territories are connected through a chain of territories
 * all owned by `playerId` (used to validate fortify moves).
 */
export function connectedByOwnership(
  state: GameState,
  playerId: string,
  from: string,
  to: string,
): boolean {
  if (from === to) return false;
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of getTerritory(state.map, current).adjacentTo) {
      if (seen.has(next)) continue;
      if (state.territories[next]?.ownerId !== playerId) continue;
      if (next === to) return true;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
}
