import type { CreatureState, PartSlot, Stats } from "./types";
import { PART_BY_ID } from "../data/bodyParts";

const ZERO_STATS: Stats = {
  attack: 0,
  defense: 0,
  maxHealth: 0,
  speed: 0,
  size: 0,
};

/**
 * Pure functions over a creature's composed parts.
 *
 * The creature has no baked-in stats of its own — they are always derived by
 * summing the stat mods of its equipped parts. This is what makes evolution
 * cheap: change a part, the stats recompute for free.
 */

/** Sum the stat contributions of every equipped part. */
export function computeStats(creature: CreatureState): Stats {
  const total: Stats = { ...ZERO_STATS };
  for (const partId of Object.values(creature.parts)) {
    if (!partId) continue;
    const part = PART_BY_ID[partId];
    if (!part) continue;
    for (const key of Object.keys(part.statMods) as (keyof Stats)[]) {
      total[key] += part.statMods[key] ?? 0;
    }
  }
  return total;
}

/** Build a fresh starter creature for the given era. */
export function createStarterCreature(eraId: string): CreatureState {
  const creature: CreatureState = {
    parts: { body: "body.cell", mouth: "mouth.none" },
    evoPoints: 0,
    currentHealth: 0,
    eraId,
  };
  creature.currentHealth = computeStats(creature).maxHealth;
  return creature;
}

/** The part currently equipped in a slot, if any. */
export function partInSlot(creature: CreatureState, slot: PartSlot): string | undefined {
  return creature.parts[slot];
}

/** Clamp current health into [0, maxHealth] after stat changes. */
export function clampHealth(creature: CreatureState): CreatureState {
  const max = computeStats(creature).maxHealth;
  return { ...creature, currentHealth: Math.max(0, Math.min(creature.currentHealth, max)) };
}
