import type { CreatureState, Enemy } from "./types";
import { computeStats, clampHealth } from "./CreatureModel";

/**
 * Survival pressure: hunger. It drains steadily and is refilled by eating.
 * When it hits zero the creature starves, losing health until it eats again.
 * This is what turns "wander and nibble" into "hunt or die".
 *
 * Pure and deterministic: callers pass elapsed time; nothing reads a clock.
 */

/** Hunger pool scales with body size so bigger creatures have more buffer. */
export function maxHunger(creature: CreatureState): number {
  const size = computeStats(creature).size;
  return 60 + size * 20;
}

/** Hunger lost per second. Larger creatures burn a little more. */
export function hungerDrainPerSec(creature: CreatureState): number {
  const size = computeStats(creature).size;
  return 3 + size * 0.5;
}

/** Health lost per second while fully starved. */
const STARVE_DAMAGE_PER_SEC = 4;

/** How much hunger a meal restores (proportional to the prey's reward). */
export function hungerFromEating(enemy: Enemy): number {
  return 12 + enemy.reward * 0.8;
}

/** Advance hunger by `dtSec`; apply starvation damage if empty. Pure. */
export function tickSurvival(creature: CreatureState, dtSec: number): CreatureState {
  const drained = Math.max(0, creature.hunger - hungerDrainPerSec(creature) * dtSec);
  let next: CreatureState = { ...creature, hunger: drained };
  if (drained <= 0) {
    next = clampHealth({ ...next, currentHealth: next.currentHealth - STARVE_DAMAGE_PER_SEC * dtSec });
  }
  return next;
}

/** Refill hunger after a meal, capped at the creature's max. Pure. */
export function feed(creature: CreatureState, enemy: Enemy): CreatureState {
  const fed = Math.min(maxHunger(creature), creature.hunger + hungerFromEating(enemy));
  return { ...creature, hunger: fed };
}
