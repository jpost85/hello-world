/**
 * Derived player ratings. Kept separate from the raw `Attributes` so the
 * weighting model can evolve without touching stored save data.
 */
import { Attributes, Player } from '@eurobasqet/data';

/** Weights sum to 1. Tune these to reshape the meta. */
const OVERALL_WEIGHTS: Record<keyof Attributes, number> = {
  shooting: 0.18,
  inside: 0.16,
  playmaking: 0.14,
  rebounding: 0.12,
  defense: 0.16,
  athleticism: 0.1,
  stamina: 0.04,
  iq: 0.1,
};

/** Weighted 0–99 overall rating. */
export function overall(attrs: Attributes): number {
  let sum = 0;
  for (const key of Object.keys(OVERALL_WEIGHTS) as (keyof Attributes)[]) {
    sum += attrs[key] * OVERALL_WEIGHTS[key];
  }
  return Math.round(sum);
}

/** Effective rating for a single game — overall nudged by current form. */
export function gameStrength(player: Player): number {
  return overall(player.attributes) + player.form;
}

/**
 * Team strength = the best `rotationSize` players by overall, so bench
 * depth matters but a stacked starting five carries a squad.
 */
export function teamStrength(players: Player[], rotationSize = 8): number {
  if (players.length === 0) return 40;
  const sorted = [...players]
    .map((p) => gameStrength(p))
    .sort((a, b) => b - a)
    .slice(0, rotationSize);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return avg;
}
