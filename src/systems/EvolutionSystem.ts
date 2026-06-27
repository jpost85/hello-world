import type { BodyPart, CreatureState } from "./types";
import { PART_BY_ID } from "../data/bodyParts";
import { clampHealth, computeStats } from "./CreatureModel";

/**
 * Spending EVO points to mutate. This is the heart of the game loop: the player
 * trades banked points for a stronger body.
 */

export interface EvolutionOption {
  part: BodyPart;
  affordable: boolean;
}

/**
 * What can this creature evolve into right now? For each occupied slot we look
 * at the equipped part's `evolvesTo`; empty/absent slots offer their tier-1
 * starter parts so new branches (fins, armor) can be grown.
 */
export function availableEvolutions(creature: CreatureState): EvolutionOption[] {
  const options: BodyPart[] = [];

  // Upgrades to currently-equipped parts.
  for (const partId of Object.values(creature.parts)) {
    if (!partId) continue;
    const current = PART_BY_ID[partId];
    if (!current) continue;
    for (const nextId of current.evolvesTo) {
      const next = PART_BY_ID[nextId];
      if (next) options.push(next);
    }
  }

  // Tier-1 starters for slots the creature hasn't grown yet.
  const occupied = new Set(Object.keys(creature.parts));
  for (const part of Object.values(PART_BY_ID)) {
    if (part.tier === 1 && !occupied.has(part.slot)) options.push(part);
  }

  return options.map((part) => ({
    part,
    affordable: creature.evoPoints >= part.cost,
  }));
}

export type EvolveResult =
  | { ok: true; creature: CreatureState }
  | { ok: false; reason: "unknown-part" | "not-available" | "too-expensive" };

/**
 * Apply an evolution. Pure: returns a new creature, never mutates the input.
 * Deducts the cost, swaps the part into its slot, and re-clamps health to the
 * new max so an upgrade doesn't leave you over/under cap.
 */
export function evolve(creature: CreatureState, partId: string): EvolveResult {
  const part = PART_BY_ID[partId];
  if (!part) return { ok: false, reason: "unknown-part" };

  const isAvailable = availableEvolutions(creature).some((o) => o.part.id === partId);
  if (!isAvailable) return { ok: false, reason: "not-available" };

  if (creature.evoPoints < part.cost) return { ok: false, reason: "too-expensive" };

  const beforeMax = computeStats(creature).maxHealth;
  let next: CreatureState = {
    ...creature,
    parts: { ...creature.parts, [part.slot]: part.id },
    evoPoints: creature.evoPoints - part.cost,
  };

  // Grant the health delta from the upgrade so evolving feels like healing.
  const afterMax = computeStats(next).maxHealth;
  next = { ...next, currentHealth: next.currentHealth + Math.max(0, afterMax - beforeMax) };

  return { ok: true, creature: clampHealth(next) };
}
