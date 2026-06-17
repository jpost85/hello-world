import type { Tank } from "./Tank";

/** Cash awarded to the killer when they destroy a tank. */
export const KILL_REWARD = 4500;
/** Cash for being the last tank standing. */
export const SURVIVOR_BONUS = 3000;
/** Cash earned per point of damage dealt to enemies. */
export const DAMAGE_RATE = 30;

/** Starting wallet so the shop is usable from round 1. */
export const STARTING_CASH = 4000;

export function awardDamage(tank: Tank, damage: number): void {
  tank.cash += Math.round(damage * DAMAGE_RATE);
}

export function awardKill(tank: Tank): void {
  tank.cash += KILL_REWARD;
}

export function awardSurvival(tank: Tank): void {
  tank.cash += SURVIVOR_BONUS;
  tank.score += 1;
}
