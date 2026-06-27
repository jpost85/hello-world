import type { CreatureState, Enemy } from "./types";

/**
 * The EVO-point economy: the single currency that ties eating to evolving.
 *
 * Keep this the one place points are minted or spent so the loop stays
 * balanceable. `expectedReward` is a design helper — use it to sanity-check
 * that an enemy's hand-authored `reward` is proportional to its difficulty.
 */

/** Award points for eating an enemy. Returns a new creature state. */
export function awardForEating(creature: CreatureState, enemy: Enemy): CreatureState {
  return { ...creature, evoPoints: creature.evoPoints + enemy.reward };
}

/** Rough "fair" payout for an enemy, from its stats. Tuning reference only. */
export function expectedReward(enemy: Enemy): number {
  const s = enemy.stats;
  return Math.round((s.attack + s.defense + s.maxHealth * 0.5 + s.size * 3) * 0.6);
}
