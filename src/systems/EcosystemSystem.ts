import type { Enemy } from "./types";
import { ENEMY_BY_ID } from "../data/enemies";
import { ERA_BY_ID } from "../data/eras";

/**
 * Decides what lives in the world right now. The renderer asks this system
 * which enemies belong in the current era and how often to spawn them; it has
 * no opinion about pixels or positions.
 */

/** The full enemy roster for an era (ignores difficulty thresholds). */
export function enemiesForEra(eraId: string): Enemy[] {
  const era = ERA_BY_ID[eraId];
  if (!era) return [];
  return era.enemyIds.map((id) => ENEMY_BY_ID[id]).filter(Boolean);
}

/**
 * The enemies eligible to spawn right now: an era's roster filtered to those
 * the player has progressed far enough to face (`appearsAtPoints <= evoPoints`).
 * This is the difficulty ramp — early on only harmless prey is eligible.
 */
export function availableEnemies(eraId: string, evoPoints: number): Enemy[] {
  return enemiesForEra(eraId).filter((e) => (e.appearsAtPoints ?? 0) <= evoPoints);
}

/**
 * Pick the next enemy to spawn, weighted toward weaker prey so the world stays
 * mostly edible. Only enemies unlocked by the player's `evoPoints` are eligible.
 * `roll` is a 0..1 value supplied by the caller (keeps this function
 * deterministic and testable instead of calling Math.random itself).
 */
export function pickSpawn(eraId: string, evoPoints: number, roll: number): Enemy | undefined {
  const roster = availableEnemies(eraId, evoPoints);
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
