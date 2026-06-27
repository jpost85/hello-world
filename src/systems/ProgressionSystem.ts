import type { CreatureState } from "./types";
import { ERA_BY_ID, ERA_ORDER } from "../data/eras";

/**
 * Macro progression across eras. The player advances when their banked EVO
 * points cross the current era's threshold.
 */

/** Has the creature earned enough to advance past its current era? */
export function canAdvanceEra(creature: CreatureState): boolean {
  const era = ERA_BY_ID[creature.eraId];
  if (!era) return false;
  return creature.evoPoints >= era.advanceAtPoints && nextEraId(creature.eraId) !== undefined;
}

/** The era after the given one, or undefined if it's the last. */
export function nextEraId(eraId: string): string | undefined {
  const idx = ERA_ORDER.indexOf(eraId);
  if (idx === -1 || idx + 1 >= ERA_ORDER.length) return undefined;
  return ERA_ORDER[idx + 1];
}

/** Move the creature into the next era. Pure; no-op if already at the last. */
export function advanceEra(creature: CreatureState): CreatureState {
  const next = nextEraId(creature.eraId);
  if (!next) return creature;
  return { ...creature, eraId: next };
}
