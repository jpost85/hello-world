import type { CreatureState, Enemy, Stats } from "./types";
import { computeStats } from "./CreatureModel";

/**
 * Combat resolution. Deliberately simple and deterministic so it is easy to
 * tune and to unit test. Damage = attacker.attack reduced by defender.defense,
 * with a guaranteed minimum so nothing is fully immune.
 */

const MIN_DAMAGE = 1;

export function damageBetween(attack: number, defense: number): number {
  return Math.max(MIN_DAMAGE, Math.round(attack - defense * 0.5));
}

/** Can the player eat this enemy outright? You must out-size your prey. */
export function canEat(playerStats: Stats, enemy: Enemy): boolean {
  return playerStats.size >= enemy.stats.size;
}

export interface BiteOutcome {
  enemyDefeated: boolean;
  damageToEnemy: number;
  damageToPlayer: number;
  enemyRemainingHealth: number;
}

/**
 * Resolve one bite exchange against an enemy with `enemyHealth` remaining.
 * The player deals a bite; if the enemy survives it bites back. Returns the
 * outcome plus the enemy's remaining health so the caller can track it across
 * exchanges without the system holding mutable enemy state.
 */
export function resolveBite(
  creature: CreatureState,
  enemy: Enemy,
  enemyHealth: number,
): BiteOutcome {
  const player = computeStats(creature);

  const damageToEnemy = damageBetween(player.attack, enemy.stats.defense);
  const enemyRemainingHealth = enemyHealth - damageToEnemy;
  const enemyDefeated = enemyRemainingHealth <= 0;

  const damageToPlayer = enemyDefeated
    ? 0
    : damageBetween(enemy.stats.attack, player.defense);

  return {
    enemyDefeated,
    damageToEnemy,
    damageToPlayer,
    enemyRemainingHealth: Math.max(0, enemyRemainingHealth),
  };
}
