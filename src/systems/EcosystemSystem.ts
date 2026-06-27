import type { Enemy } from "./types";
import { ENEMY_BY_ID } from "../data/enemies";
import { ERA_BY_ID } from "../data/eras";

/**
 * Decides what lives in the world right now. The renderer asks this system
 * which enemies belong in the current era and how often to spawn them; it has
 * no opinion about pixels or positions.
 */

/** The enemy roster for an era. */
export function enemiesForEra(eraId: string): Enemy[] {
  const era = ERA_BY_ID[eraId];
  if (!era) return [];
  return era.enemyIds.map((id) => ENEMY_BY_ID[id]).filter(Boolean);
}

/**
 * Pick the next enemy to spawn, weighted toward weaker prey so the world stays
 * mostly edible. `roll` is a 0..1 value supplied by the caller (keeps this
 * function deterministic and testable instead of calling Math.random itself).
 */
export function pickSpawn(eraId: string, roll: number): Enemy | undefined {
  const roster = enemiesForEra(eraId);
  if (roster.length === 0) return undefined;

  // Weight inversely to total stats: weak prey is common, predators are rare.
  const weights = roster.map((e) => {
    const s = e.stats;
    const power = s.attack + s.defense + s.maxHealth + s.size * 5;
    return 1 / power;
  });
  const total = weights.reduce((a, b) => a + b, 0);

  let acc = 0;
  const target = roll * total;
  for (let i = 0; i < roster.length; i++) {
    acc += weights[i];
    if (target <= acc) return roster[i];
  }
  return roster[roster.length - 1];
}
