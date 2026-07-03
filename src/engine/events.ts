import type { GameState, Hazard } from "../types";
import { HAZARDS } from "../data/hazards";

/**
 * Hazard roller. Each turn there's a flat chance a crisis fires; if it does, we
 * pick one by weight from those eligible for the current turn. Kept simple and
 * swappable — replace with a deck/escalation model later if desired.
 */

const HAZARD_CHANCE_PER_TURN = 0.22;

function weightedPick(pool: Hazard[]): Hazard | undefined {
  if (pool.length === 0) return undefined;
  const total = pool.reduce((a, h) => a + h.weight, 0);
  let roll = Math.random() * total;
  for (const h of pool) {
    roll -= h.weight;
    if (roll <= 0) return h;
  }
  return pool[pool.length - 1];
}

/**
 * Possibly trigger a hazard. Mutates state via the hazard's `apply` and returns
 * a log line, or null if nothing happened this turn.
 */
export function maybeTriggerHazard(state: GameState): string | null {
  if (Math.random() > HAZARD_CHANCE_PER_TURN) return null;
  const eligible = HAZARDS.filter((h) => (h.minTurn ?? 0) <= state.turn);
  const hazard = weightedPick(eligible);
  if (!hazard) return null;
  return hazard.apply(state);
}
