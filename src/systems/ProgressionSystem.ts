import type { CreatureState, Enemy } from "./types";
import { ERA_BY_ID, ERA_ORDER } from "../data/eras";
import { ENEMY_BY_ID } from "../data/enemies";

/**
 * Macro progression across eras, gated by a boss.
 *
 * Reaching an era's EVO threshold doesn't advance you on its own — it summons
 * the era's boss. Defeating the boss is what lets you cross into the next era.
 * This gives each era a climax instead of a silent counter flipping over.
 */

/** Has the creature banked enough points for this era's boss to appear? */
export function isBossReady(creature: CreatureState): boolean {
  const era = ERA_BY_ID[creature.eraId];
  if (!era) return false;
  return creature.evoPoints >= era.advanceAtPoints && !creature.bossDefeated;
}

/** The boss enemy that gates the current era, if any. */
export function bossForEra(eraId: string): Enemy | undefined {
  const era = ERA_BY_ID[eraId];
  if (!era) return undefined;
  return ENEMY_BY_ID[era.bossId];
}

/** Mark the current era's boss as defeated (unlocks advancement). Pure. */
export function defeatBoss(creature: CreatureState): CreatureState {
  return { ...creature, bossDefeated: true };
}

/** Can the creature now move on? Requires the boss to be down and a next era to exist. */
export function canAdvanceEra(creature: CreatureState): boolean {
  return creature.bossDefeated && nextEraId(creature.eraId) !== undefined;
}

/** The era after the given one, or undefined if it's the last. */
export function nextEraId(eraId: string): string | undefined {
  const idx = ERA_ORDER.indexOf(eraId);
  if (idx === -1 || idx + 1 >= ERA_ORDER.length) return undefined;
  return ERA_ORDER[idx + 1];
}

/** Move the creature into the next era and reset the per-era boss gate. Pure. */
export function advanceEra(creature: CreatureState): CreatureState {
  const next = nextEraId(creature.eraId);
  if (!next) return creature;
  return { ...creature, eraId: next, bossDefeated: false };
}
